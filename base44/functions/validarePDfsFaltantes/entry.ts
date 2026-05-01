import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    const todasNotas = await db.entities.NotaFiscal.list('-created_date', 500);
    
    // Notas com pdf_url salvo
    const comPdf = todasNotas.filter(n => n.pdf_url && n.status === 'Emitida' && n.spedy_id);

    const logs = [];
    let corrompidas = 0;
    let recuperadas = 0;

    for (const nota of comPdf.slice(0, 30)) {
      try {
        // Valida se o PDF salvo é realmente válido
        const pdfResp = await fetch(nota.pdf_url);
        if (!pdfResp.ok) {
          logs.push(`SKIP: ${nota.tipo} nº ${nota.numero} - URL retorna ${pdfResp.status}`);
          continue;
        }

        const blob = await pdfResp.blob();
        const buffer = await blob.arrayBuffer();
        const header = new Uint8Array(buffer, 0, 4);
        const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;

        if (isPdfValid) {
          logs.push(`OK: ${nota.tipo} nº ${nota.numero} - PDF válido`);
          continue;
        }

        // PDF corrompido — tenta recuperar da Focus NFe
        corrompidas++;
        const ep = nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
        const consultaResp = await fetch(`${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });

        if (!consultaResp.ok) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - API ${consultaResp.status}`);
          continue;
        }

        const result = await consultaResp.json();
        if (result.status !== 'autorizado') {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - status ${result.status}`);
          continue;
        }

        // NFCe: endpoint direto; NFe: campos de URL
        let pdfUrl = '';
        if (nota.tipo === 'NFCe') {
          pdfUrl = `${FOCUSNFE_BASE}/nfce/${nota.spedy_id}.pdf`;
        } else {
          const rawPdf = result.url_danfse || result.caminho_pdf_nfsen || result.caminho_pdf_nfse || result.caminho_danfe || result.url_danfe || result.caminho_pdf || '';
          pdfUrl = normalizarUrl(rawPdf);
        }

        if (!pdfUrl) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - sem URL na Focus`);
          continue;
        }

        const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
        const novoResp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });

        if (!novoResp.ok) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - download ${novoResp.status}`);
          continue;
        }

        const novoBlob = await novoResp.blob();
        const novoBuffer = await novoBlob.arrayBuffer();
        const novoHeader = new Uint8Array(novoBuffer, 0, 4);
        const isNovoValid = novoHeader[0] === 0x25 && novoHeader[1] === 0x50 && novoHeader[2] === 0x44 && novoHeader[3] === 0x46;

        if (!isNovoValid) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - PDF da Focus também inválido`);
          continue;
        }

        // Salva o novo PDF válido
        const nomeArquivo = `${(nota.tipo || 'nf').toLowerCase()}-${nota.numero || nota.id}.pdf`;
        const file = new File([novoBlob], nomeArquivo, { type: 'application/pdf' });
        const { file_url } = await db.integrations.Core.UploadFile({ file });
        await db.entities.NotaFiscal.update(nota.id, { pdf_url: file_url });
        logs.push(`RECUPERADO: ${nota.tipo} nº ${nota.numero} - novo PDF salvo`);
        recuperadas++;

      } catch (e) {
        logs.push(`ERRO: ${nota.tipo} nº ${nota.numero} - ${e.message}`);
      }
    }

    return Response.json({
      sucesso: true,
      corrompidas,
      recuperadas,
      logs,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});