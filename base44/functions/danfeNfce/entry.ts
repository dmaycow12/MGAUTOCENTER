import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE_PROD = 'https://api.focusnfe.com.br/v2';
const FOCUSNFE_BASE_HOM = 'https://homologacao.focusnfe.com.br/v2';
const API_KEY_PROD = Deno.env.get('FOCUSNFE_API_KEY') || '';
const API_KEY_HOM = Deno.env.get('FOCUSNFE_API_KEY_HOM') || '';
const AUTH_HEADER_PROD = 'Basic ' + btoa(API_KEY_PROD + ':');
const AUTH_HEADER_HOM = 'Basic ' + btoa(API_KEY_HOM + ':');

const normalizarUrl = (url, useHom = false) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseHost = useHom ? 'homologacao.focusnfe.com.br' : 'api.focusnfe.com.br';
  return `https://${baseHost}${url}`;
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
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

    // Se já tem PDF salvo permanente e válido (não HTML, não o arquivo genérico nota_nova.pdf), retorna direto
    const pdfJaSalvo = nota.pdf_url &&
      !nota.pdf_url.endsWith('.html') &&
      !nota.pdf_url.includes('/notas_fiscais_consumidor/') &&
      !nota.pdf_url.includes('nota_nova.pdf') &&
      !nota.pdf_url.includes('focusnfe') &&
      !nota.pdf_url.includes('amazonaws');
    if (pdfJaSalvo) {
      return Response.json({ sucesso: true, pdf_url: nota.pdf_url });
    }

    // Determina a URL do HTML da DANFE
    let htmlUrl = '';
    let chave = nota.chave_acesso || '';
    // Se status é Homologada, usa homologação; senão produção
    const isHomologada = nota.status === 'Homologada' || nota.status === 'Pré-visualização';
    const baseUrl = isHomologada ? FOCUSNFE_BASE_HOM : FOCUSNFE_BASE_PROD;
    const authHeader = isHomologada ? AUTH_HEADER_HOM : AUTH_HEADER_PROD;

    console.log(`[danfeNfce] nota_id=${nota_id}, status=${nota.status}, isHomologada=${isHomologada}, baseUrl=${baseUrl}, spedy_id=${nota.spedy_id}`);

    if (nota.pdf_url && (nota.pdf_url.endsWith('.html') || nota.pdf_url.includes('/notas_fiscais_consumidor/'))) {
      htmlUrl = nota.pdf_url;
    } else if (nota.spedy_id) {
       const consultaUrl = `${baseUrl}/nfce/${nota.spedy_id}?completo=1`;
       console.log(`[danfeNfce] Consultando: ${consultaUrl}`);
       const consultaResp = await fetch(consultaUrl, {
         headers: { 'Authorization': authHeader },
       });

       if (!consultaResp.ok) {
         console.log(`[danfeNfce] Falha na consulta: status=${consultaResp.status}`);
         return Response.json({ sucesso: false, erro: `Erro ao consultar NFCe: ${consultaResp.status}` });
       }
       const dadosNFCe = await consultaResp.json();
       chave = (dadosNFCe.chave_nfe || nota.chave_acesso || '').replace(/\D/g, '');
       // Verifica se há PDF direto (caminho_pdf_nfce) ou HTML (caminho_danfe)
       const caminhoPdf = dadosNFCe.caminho_pdf_nfce || '';
       const caminhoHtml = dadosNFCe.caminho_danfe || '';
       console.log(`[danfeNfce] Dados da NFCe: caminhoPdf=${caminhoPdf}, caminhoHtml=${caminhoHtml}`);
      if (caminhoPdf) {
        // Baixa e salva como PDF permanente
        const pdfUrl = normalizarUrl(caminhoPdf, isHomologada);
        const pdfResp = await fetch(pdfUrl, { headers: { 'Authorization': authHeader } });
        
        if (pdfResp.ok) {
          const blob = await pdfResp.blob();
          const buffer = await blob.arrayBuffer();
          const header = new Uint8Array(buffer, 0, 4);
          const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
          if (isPdf) {
            const pdfFile = new File([blob], `nfce-${nota_id}.pdf`, { type: 'application/pdf' });
            const { file_url } = await db.integrations.Core.UploadFile({ file: pdfFile });
            const updateData = { pdf_url: file_url };
            if (chave) updateData.chave_acesso = chave;
            await db.entities.NotaFiscal.update(nota_id, updateData);
            return Response.json({ sucesso: true, pdf_url: file_url });
          }
        }
      }
      htmlUrl = caminhoHtml ? normalizarUrl(caminhoHtml, isHomologada) : '';
    }

    if (!htmlUrl) {
      return Response.json({ sucesso: false, erro: 'DANFE da NFCe não disponível ainda.' });
    }

    // Busca o HTML autenticado da Focus NFe
    const htmlUrlCompleta = normalizarUrl(htmlUrl, isHomologada);
    console.log(`[danfeNfce] Buscando HTML: ${htmlUrlCompleta}`);
    const htmlResp = await fetch(htmlUrlCompleta, { headers: { 'Authorization': authHeader } });

    if (!htmlResp.ok) {
      console.log(`[danfeNfce] Erro ao buscar HTML: status=${htmlResp.status}, url=${htmlUrl}`);
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
      const updateData = { chave_acesso: chave };
      if (htmlUrl) updateData.pdf_url = htmlUrl;
      await db.entities.NotaFiscal.update(nota_id, updateData);
    }

    return Response.json({ sucesso: true, html: htmlFinal });

  } catch (error) {
    console.error('danfeNfce erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message });
  }
});