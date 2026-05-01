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
    const body = await req.json();
    const { nota_id } = body;

    if (!nota_id) return Response.json({ sucesso: false, erro: 'nota_id obrigatório' });

    const lista = await db.entities.NotaFiscal.filter({ id: nota_id });
    const nota = lista[0];
    if (!nota) return Response.json({ sucesso: false, erro: 'Nota não encontrada' });

    // Se já tem PDF salvo, retorna a URL diretamente
    if (nota.pdf_url) {
      return Response.json({ sucesso: true, pdf_url: nota.pdf_url });
    }

    // Ainda não tem PDF permanente — tenta buscar na Focus NFe
    // Para notas de entrada (Importada/Lançada), buscar pelo chave_acesso na SEFAZ via Focus NFe
    let result = null;

    if (nota.spedy_id) {
      // Notas emitidas: buscar pelo spedy_id (referência interna)
      const ep = nota.tipo === 'NFSe' ? 'nfsen' : nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
      const consultaResp = await fetch(`${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
        headers: { 'Authorization': AUTH_HEADER },
      });
      if (consultaResp.ok) {
        result = await consultaResp.json();
      }
    } else if (nota.chave_acesso) {
      // Notas de entrada: buscar pelo endpoint de notas recebidas
      const chave = nota.chave_acesso.replace(/\D/g, '');
      // Tenta endpoint de notas recebidas primeiro (NFe de entrada)
      const endpoints = [
        `${FOCUSNFE_BASE}/nfes_recebidas/${chave}`,
        `${FOCUSNFE_BASE}/nfe/${chave}?completo=1`,
      ];
      for (const ep of endpoints) {
        const r = await fetch(ep, { headers: { 'Authorization': AUTH_HEADER } });
        if (r.ok) { result = await r.json().catch(() => null); if (result) break; }
      }
    }

    if (!result) {
      return Response.json({ sucesso: false, erro: 'Nota sem referência Focus NFe (spedy_id) ou chave de acesso.' });
    }

    // Campos de PDF: notas emitidas e notas recebidas têm campos diferentes
    const rawPdf = result.url_danfse || result.caminho_pdf_nfsen || result.caminho_pdf_nfse
      || result.caminho_danfe || result.url_danfe || result.caminho_pdf
      || result.caminho_xml_nota_fiscal_pdf || result.url_pdf || '';
    const pdfUrlFocus = normalizarUrl(rawPdf);

    // Se não tem URL de PDF direto mas tem chave, tenta gerar DANFE via endpoint específico
    if (!pdfUrlFocus && nota.chave_acesso) {
      const chave = nota.chave_acesso.replace(/\D/g, '');
      const danfeResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}.pdf`, {
        headers: { 'Authorization': AUTH_HEADER },
      });
      if (danfeResp.ok) {
        const ct = danfeResp.headers.get('content-type') || '';
        if (ct.includes('pdf') || ct.includes('octet')) {
          const blob = await danfeResp.blob();
          const nomeArquivo = `${(nota.tipo || 'nf').toLowerCase()}-${nota.numero || nota_id}.pdf`;
          const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
          const { file_url } = await db.integrations.Core.UploadFile({ file });
          await db.entities.NotaFiscal.update(nota_id, { pdf_url: file_url });
          return Response.json({ sucesso: true, pdf_url: file_url });
        }
      }
      return Response.json({ sucesso: false, erro: 'DANFE não disponível para esta nota de entrada. O fornecedor pode não ter autorizado o acesso.' });
    }

    const statusFocus = result.status || '';
    if (statusFocus && statusFocus !== 'autorizado' && !rawPdf) {
      return Response.json({ sucesso: false, processando: true, mensagem: `Status na SEFAZ: ${statusFocus}.` });
    }

    if (!pdfUrlFocus) {
      return Response.json({ sucesso: false, erro: 'PDF não disponível na Focus NFe.' });
    }

    const isS3 = pdfUrlFocus.includes('amazonaws.com') || pdfUrlFocus.includes('s3.');
    const pdfResp = await fetch(pdfUrlFocus, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
    if (!pdfResp.ok) {
      return Response.json({ sucesso: false, erro: `Erro ao baixar PDF da Focus NFe: ${pdfResp.status}` });
    }

    const blob = await pdfResp.blob();
    
    // Valida se é PDF válido (%PDF header)
    const buffer = await blob.arrayBuffer();
    const header = new Uint8Array(buffer, 0, 4);
    const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
    if (!isPdfValid) {
      // Para NFCe, PDF pode não estar disponível na Focus NFe
      if (nota.tipo === 'NFCe') {
        return Response.json({ 
          sucesso: false, 
          erro: 'PDF da NFCe não disponível na Focus NFe. Acesse o e-Commerce do fornecedor ou use o QR Code da nota fiscal.' 
        }, { status: 400 });
      }
      return Response.json({ sucesso: false, erro: 'PDF inválido ou corrompido na Focus NFe' }, { status: 400 });
    }
    
    const nomeArquivo = `${(nota.tipo || 'nf').toLowerCase()}-${nota.numero || nota_id}.pdf`;
    const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
    const { file_url } = await db.integrations.Core.UploadFile({ file });

    const updateData = { pdf_url: file_url };
    if (result.chave_nfe || result.chave_nfse) updateData.chave_acesso = result.chave_nfe || result.chave_nfse;
    await db.entities.NotaFiscal.update(nota_id, updateData);

    return Response.json({ sucesso: true, pdf_url: file_url });

  } catch (error) {
    console.error('proxyPdfNota erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message });
  }
});