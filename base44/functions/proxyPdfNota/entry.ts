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
    const db = base44.asServiceRole; // usa sempre service role, sem precisar de auth de usuário
    const body = await req.json();
    const { nota_id } = body;

    if (!nota_id) return Response.json({ sucesso: false, erro: 'nota_id obrigatório' });

    // Busca a nota no banco (service role — sem exigir usuário logado)
    const lista = await db.entities.NotaFiscal.filter({ id: nota_id });
    const nota = lista[0];
    if (!nota) return Response.json({ sucesso: false, erro: 'Nota não encontrada' });

    // Se já tem PDF permanente salvo no Base44, retorna direto (rápido!)
    if (nota.pdf_url && nota.pdf_url.includes('base44.com')) {
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
    console.log('[STATUS FOCUS]', nota.spedy_id, '->', statusFocus, '| campos PDF:', Object.keys(result).filter(k => k.includes('pdf') || k.includes('danfe')));

    if (statusFocus !== 'autorizado') {
      return Response.json({ sucesso: false, processando: true, mensagem: `Status na SEFAZ: ${statusFocus}. Aguarde a autorização.` });
    }

    // Busca URL do PDF (tenta todos os campos possíveis por tipo)
    const rawPdf = result.url_danfse || result.caminho_pdf_nfsen || result.caminho_pdf_nfse || result.caminho_danfe || result.url_danfe || result.caminho_pdf || '';
    const pdfUrlFocus = normalizarUrl(rawPdf);

    console.log('[PDF URL]', rawPdf, '->', pdfUrlFocus);

    if (!pdfUrlFocus) {
      return Response.json({ sucesso: false, erro: 'PDF não disponível na Focus NFe.' });
    }

    // Baixa e salva permanentemente no Base44
    // URLs do S3 (amazonaws.com) são públicas — sem auth. Outras usam AUTH_HEADER
    const isS3 = pdfUrlFocus.includes('amazonaws.com') || pdfUrlFocus.includes('s3.');
    const pdfResp = await fetch(pdfUrlFocus, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
    if (!pdfResp.ok) {
      return Response.json({ sucesso: false, erro: `Erro ao baixar PDF da Focus NFe: ${pdfResp.status}` });
    }

    const blob = await pdfResp.blob();
    const file = new File([blob], `nota_${nota_id}.pdf`, { type: 'application/pdf' });
    const { file_url } = await db.integrations.Core.UploadFile({ file });

    // Atualiza a nota com o PDF permanente
    const updateData = { pdf_url: file_url, status: 'Emitida' };
    if (result.chave_nfe || result.chave_nfse) updateData.chave_acesso = result.chave_nfe || result.chave_nfse;
    await db.entities.NotaFiscal.update(nota_id, updateData);

    console.log('[PDF SALVO PERMANENTE]', nota_id, '->', file_url);

    return Response.json({ sucesso: true, pdf_url_publica: file_url, fonte: 'focus_nfe' });

  } catch (error) {
    console.error('proxyPdfNota erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message });
  }
});