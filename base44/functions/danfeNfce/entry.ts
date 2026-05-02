import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

// Tenta converter HTML em PDF usando múltiplos serviços
const converterHtmlParaPdf = async (htmlContent) => {
  // Tentativa 1: gotenberg (serviço open source público)
  try {
    const formData = new FormData();
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    formData.append('files', htmlBlob, 'index.html');

    const resp = await fetch('https://demo.gotenberg.dev/forms/chromium/convert/html', {
      method: 'POST',
      body: formData,
    });
    if (resp.ok) {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('pdf') || ct.includes('octet')) {
        const blob = await resp.blob();
        if (blob.size > 1000) {
          console.log('[danfeNfce] PDF gerado via gotenberg, tamanho:', blob.size);
          return blob;
        }
      }
    }
    console.log('[danfeNfce] gotenberg falhou:', resp.status);
  } catch (e) {
    console.log('[danfeNfce] gotenberg erro:', e.message);
  }

  return null;
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

    if (nota.tipo !== 'NFCe') {
      return Response.json({ sucesso: false, erro: 'Este endpoint é apenas para NFCe.' });
    }

    // Se já tem PDF salvo (não HTML), retorna direto
    if (nota.pdf_url && !nota.pdf_url.endsWith('.html') && !nota.pdf_url.includes('/notas_fiscais_consumidor/')) {
      return Response.json({ sucesso: true, pdf_url: nota.pdf_url });
    }

    // Determina a URL do HTML da DANFE
    let htmlUrl = '';
    let chave = nota.chave_acesso || '';

    if (nota.pdf_url && (nota.pdf_url.endsWith('.html') || nota.pdf_url.includes('/notas_fiscais_consumidor/'))) {
      htmlUrl = nota.pdf_url;
    } else if (nota.spedy_id) {
      const consultaResp = await fetch(`${FOCUSNFE_BASE}/nfce/${nota.spedy_id}?completo=1`, {
        headers: { 'Authorization': AUTH_HEADER },
      });
      if (!consultaResp.ok) {
        return Response.json({ sucesso: false, erro: `Erro ao consultar NFCe: ${consultaResp.status}` });
      }
      const dadosNFCe = await consultaResp.json();
      chave = (dadosNFCe.chave_nfe || nota.chave_acesso || '').replace(/\D/g, '');
      const caminhoHtml = dadosNFCe.caminho_danfe || '';
      htmlUrl = caminhoHtml ? normalizarUrl(caminhoHtml) : '';
    }

    if (!htmlUrl) {
      return Response.json({ sucesso: false, erro: 'DANFE da NFCe não disponível ainda.' });
    }

    // Busca o HTML autenticado da Focus NFe
    const htmlResp = await fetch(htmlUrl, { headers: { 'Authorization': AUTH_HEADER } });
    if (!htmlResp.ok) {
      return Response.json({ sucesso: false, erro: `Erro ao buscar DANFE: ${htmlResp.status}` });
    }
    const htmlContent = await htmlResp.text();

    // Tenta converter para PDF
    console.log('[danfeNfce] Tentando converter HTML para PDF...');
    const pdfBlob = await converterHtmlParaPdf(htmlContent);

    if (pdfBlob) {
      console.log('[danfeNfce] PDF gerado com sucesso, salvando no banco...');
      // Converte Blob para File para upload correto
      const pdfBuffer = await pdfBlob.arrayBuffer();
      const pdfFile = new File([pdfBuffer], `nfce-${nota_id}.pdf`, { type: 'application/pdf' });
      const { file_url } = await db.integrations.Core.UploadFile({ file: pdfFile });
      const updateData = { pdf_url: file_url };
      if (chave) updateData.chave_acesso = chave;
      await db.entities.NotaFiscal.update(nota_id, updateData);
      return Response.json({ sucesso: true, pdf_url: file_url });
    }

    // Fallback: retorna HTML para abrir na aba (usuário imprime como PDF)
    console.log('[danfeNfce] Conversão não disponível, retornando HTML');
    const PRINT_BUTTON_HTML = `
<style>
  #btn-salvar-pdf {
    position: fixed; bottom: 24px; right: 24px;
    background: #062C9B; color: #fff; border: none;
    border-radius: 12px; padding: 14px 28px;
    font-size: 16px; font-weight: bold; cursor: pointer;
    box-shadow: 0 4px 20px rgba(0,0,0,0.35); z-index: 9999;
    letter-spacing: 0.5px; font-family: Arial, sans-serif;
  }
  #btn-salvar-pdf:hover { background: #0a40d4; }
  @media print { #btn-salvar-pdf { display: none !important; } }
</style>
<button id="btn-salvar-pdf" onclick="window.print()">⬇ Salvar como PDF</button>`;

    const htmlFinal = htmlContent.includes('</body>')
      ? htmlContent.replace('</body>', PRINT_BUTTON_HTML + '</body>')
      : htmlContent + PRINT_BUTTON_HTML;

    if (chave && !nota.chave_acesso) {
      await db.entities.NotaFiscal.update(nota_id, { chave_acesso: chave, pdf_url: htmlUrl });
    }

    return Response.json({ sucesso: true, html: htmlFinal });

  } catch (error) {
    console.error('danfeNfce erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message });
  }
});