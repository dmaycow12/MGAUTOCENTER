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
    const body = await req.json();
    const { nota_id } = body;

    if (!nota_id) return Response.json({ sucesso: false, erro: 'nota_id obrigatório' });

    // Busca a nota no banco
    const lista = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
    const nota = lista[0];
    if (!nota) return Response.json({ sucesso: false, erro: 'Nota não encontrada' });

    // Se já tem PDF permanente salvo, retorna direto (rápido!)
    if (nota.pdf_url && (nota.pdf_url.startsWith('https://files.base44.com') || nota.pdf_url.includes('base44.com'))) {
      return Response.json({ sucesso: true, pdf_url_publica: nota.pdf_url, fonte: 'cache' });
    }

    // Ainda não tem PDF permanente — tenta buscar na Focus NFe
    if (!nota.spedy_id) {
      return Response.json({ sucesso: false, erro: 'Nota sem referência Focus NFe (spedy_id).' });
    }

    const ep = nota.tipo === 'NFSe' ? 'nfsen' : nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
    const consultaResp = await fetch(`${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (!consultaResp.ok) {
      return Response.json({ sucesso: false, erro: `Erro ao consultar Focus NFe: ${consultaResp.status}` });
    }

    const result = await consultaResp.json();
    const statusFocus = result.status || '';

    if (statusFocus !== 'autorizado') {
      return Response.json({ sucesso: false, processando: true, mensagem: `Status na SEFAZ: ${statusFocus}. Aguarde a autorização.` });
    }

    // Busca URL do PDF
    const rawPdf = result.caminho_pdf_nfsen || result.caminho_pdf_nfse || result.caminho_danfe || '';
    const pdfUrlFocus = normalizarUrl(rawPdf);

    if (!pdfUrlFocus) {
      return Response.json({ sucesso: false, erro: 'PDF não disponível na Focus NFe.' });
    }

    // Baixa e salva permanentemente no Base44
    const pdfResp = await fetch(pdfUrlFocus, { headers: { 'Authorization': AUTH_HEADER } });
    if (!pdfResp.ok) {
      return Response.json({ sucesso: false, erro: `Erro ao baixar PDF: ${pdfResp.status}` });
    }

    const blob = await pdfResp.blob();
    const file = new File([blob], `nota_${nota_id}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    // Atualiza a nota com o PDF permanente + status
    const updateData = { pdf_url: file_url, status: 'Emitida' };
    if (result.chave_nfe || result.chave_nfse) {
      updateData.chave_acesso = result.chave_nfe || result.chave_nfse;
    }
    await base44.asServiceRole.entities.NotaFiscal.update(nota_id, updateData);

    console.log('[PDF SALVO PERMANENTE]', nota_id, '->', file_url);

    return Response.json({ sucesso: true, pdf_url_publica: file_url, fonte: 'focus_nfe' });

  } catch (error) {
    console.error('proxyPdfNota erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message });
  }
});