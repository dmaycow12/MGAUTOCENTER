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

    // Notas sem pdf_url: emitidas (spedy_id) + entradas (chave_acesso)
    const candidatas = todasNotas.filter(n => !n.pdf_url && (
      (n.status === 'Emitida' && n.spedy_id) ||
      ((n.status === 'Importada' || n.status === 'Lançada') && n.chave_acesso)
    ));
    const semPdf = candidatas.slice(0, 20);
    const totalSemPdf = candidatas.length;

    const logs = [];
    let recuperadas = 0;
    let falhas = 0;

    for (const nota of semPdf) {
      try {
        let pdfBlob = null;

        if (nota.spedy_id) {
          // Nota emitida — buscar via spedy_id
          const ep = nota.tipo === 'NFSe' ? 'nfsen' : nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
          const consultaResp = await fetch(`${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
            headers: { 'Authorization': AUTH_HEADER },
          });
          if (!consultaResp.ok) { logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - API ${consultaResp.status}`); falhas++; continue; }
          const result = await consultaResp.json();
          if (result.status !== 'autorizado') { logs.push(`SKIP: ${nota.tipo} nº ${nota.numero} - status ${result.status}`); falhas++; continue; }
          
          // NFCe: tenta endpoint direto .pdf; NFe/NFSe: usa campos de URL
          let pdfUrl = '';
          if (nota.tipo === 'NFCe') {
            pdfUrl = `${FOCUSNFE_BASE}/nfce/${nota.spedy_id}.pdf`;
          } else {
            const rawPdf = result.url_danfse || result.caminho_pdf_nfsen || result.caminho_pdf_nfse || result.caminho_danfe || result.url_danfe || result.caminho_pdf || '';
            pdfUrl = normalizarUrl(rawPdf);
          }
          
          if (!pdfUrl) { logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - sem URL PDF`); falhas++; continue; }
          const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
          const pdfResp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
          if (!pdfResp.ok) { logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - download ${pdfResp.status}`); falhas++; continue; }
          pdfBlob = await pdfResp.blob();

          // Valida se é PDF válido
          const buffer = await pdfBlob.arrayBuffer();
          const header = new Uint8Array(buffer, 0, 4);
          const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
          if (!isPdfValid) { logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - PDF inválido`); falhas++; continue; }

          } else if (nota.chave_acesso) {
          // Nota de entrada — DANFE via endpoint nfes_recebidas
          const chave = nota.chave_acesso.replace(/\D/g, '');
          const danfeResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}.pdf`, {
            headers: { 'Authorization': AUTH_HEADER },
          });
          if (!danfeResp.ok) { logs.push(`FALHA entrada: nº ${nota.numero} - ${danfeResp.status}`); falhas++; continue; }
          const ct = danfeResp.headers.get('content-type') || '';
          if (!ct.includes('pdf') && !ct.includes('octet')) { logs.push(`FALHA entrada: nº ${nota.numero} - não é PDF`); falhas++; continue; }
          pdfBlob = await danfeResp.blob();

          // Valida se é PDF válido
          const bufferEntrada = await pdfBlob.arrayBuffer();
          const headerEntrada = new Uint8Array(bufferEntrada, 0, 4);
          const isPdfValidEntrada = headerEntrada[0] === 0x25 && headerEntrada[1] === 0x50 && headerEntrada[2] === 0x44 && headerEntrada[3] === 0x46;
          if (!isPdfValidEntrada) { logs.push(`FALHA entrada: nº ${nota.numero} - PDF inválido`); falhas++; continue; }
        }

        if (!pdfBlob) { falhas++; continue; }

        const nomeArquivo = `${(nota.tipo || 'nf').toLowerCase()}-${nota.numero || nota.id}.pdf`;
        const file = new File([pdfBlob], nomeArquivo, { type: 'application/pdf' });
        const { file_url } = await db.integrations.Core.UploadFile({ file });
        await db.entities.NotaFiscal.update(nota.id, { pdf_url: file_url });
        logs.push(`OK: ${nota.tipo} nº ${nota.numero} (${nota.status})`);
        recuperadas++;
      } catch (e) {
        logs.push(`ERRO: ${nota.tipo} nº ${nota.numero} - ${e.message}`);
        falhas++;
      }
    }

    return Response.json({
      sucesso: true,
      total_sem_pdf_geral: totalSemPdf,
      processadas_agora: semPdf.length,
      restantes: Math.max(0, totalSemPdf - semPdf.length),
      recuperadas,
      falhas,
      logs,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});