import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

const temCacheLocal = (url) => {
  if (!url) return false;
  return url.includes('base44.app') || url.includes('base44.com') || url.startsWith('https://files.');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    // Busca todas as notas Emitidas sem PDF em cache local
    const todasEmitidas = await db.entities.NotaFiscal.filter({ status: 'Emitida' }, '-created_date', 500);
    const semCache = todasEmitidas.filter(n => n.spedy_id && !temCacheLocal(n.pdf_url));

    console.log(`[CACHE] Total emitidas: ${todasEmitidas.length} | Sem cache: ${semCache.length}`);

    if (semCache.length === 0) {
      return Response.json({ sucesso: true, mensagem: 'Todas as notas já têm PDF em cache!', total: 0 });
    }

    let salvas = 0;
    let erros = 0;

    for (const nota of semCache) {
      try {
        const ep = nota.tipo === 'NFSe' ? 'nfsen' : nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
        const r = await fetch(`${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (!r.ok) { erros++; continue; }

        const result = await r.json();
        if (result.status !== 'autorizado') { erros++; continue; }

        const rawPdf = result.url_danfse || result.caminho_pdf_nfsen || result.caminho_pdf_nfse || result.caminho_danfe || result.url_danfe || result.caminho_pdf || '';
        const pdfUrl = normalizarUrl(rawPdf);
        if (!pdfUrl) { erros++; continue; }

        const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
        const pdfResp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
        if (!pdfResp.ok) { erros++; continue; }

        const blob = await pdfResp.blob();
        const file = new File([blob], `nota_${nota.id}.pdf`, { type: 'application/pdf' });
        const { file_url } = await db.integrations.Core.UploadFile({ file });

        const updateData = { pdf_url: file_url };
        if (result.chave_nfe || result.chave_nfse || result.chave_nfce) {
          updateData.chave_acesso = result.chave_nfe || result.chave_nfse || result.chave_nfce;
        }
        await db.entities.NotaFiscal.update(nota.id, updateData);

        console.log(`[OK] ${nota.tipo} ${nota.numero} -> ${file_url}`);
        salvas++;
      } catch (e) {
        console.error(`[ERRO] ${nota.id}: ${e.message}`);
        erros++;
      }
    }

    return Response.json({ sucesso: true, total: semCache.length, salvas, erros });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});