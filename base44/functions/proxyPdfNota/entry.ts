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

    // Para NFCe emitida: a Focus NFe retorna HTML (DANFE simplificado), não PDF
    // Usamos o serviço gratuito screenshotmachine ou urlpdf para converter para PDF
    if (nota.tipo === 'NFCe' && nota.spedy_id) {
      console.log('[DEBUG] NFCe emitida, buscando dados via spedy_id:', nota.spedy_id);

      const consultaResp = await fetch(`${FOCUSNFE_BASE}/nfce/${nota.spedy_id}?completo=1`, {
        headers: { 'Authorization': AUTH_HEADER },
      });
      if (!consultaResp.ok) {
        return Response.json({ sucesso: false, erro: `Erro ao consultar NFCe: ${consultaResp.status}` });
      }
      const dadosNFCe = await consultaResp.json();
      const chave = (dadosNFCe.chave_nfe || nota.chave_acesso || '').replace(/\D/g, '');
      const caminhoHtml = dadosNFCe.caminho_danfe || '';
      const htmlUrl = caminhoHtml ? normalizarUrl(caminhoHtml) : '';

      if (!htmlUrl) {
        return Response.json({ sucesso: false, erro: 'DANFE da NFCe não disponível ainda.' });
      }

      // Baixa o conteúdo HTML da Focus NFe
      const htmlResp = await fetch(htmlUrl, { headers: { 'Authorization': AUTH_HEADER } });
      if (!htmlResp.ok) {
        return Response.json({ sucesso: false, erro: `Erro ao buscar DANFE HTML: ${htmlResp.status}` });
      }
      const htmlContent = await htmlResp.text();
      console.log('[DEBUG] HTML obtido, tamanho:', htmlContent.length);

      // Converte HTML → PDF usando screenshotapi.net (gratuito com limite)
      // Alternativa: urlbox, browserless, etc.
      // Usamos o serviço do screenshotapi que aceita HTML content para PDF
      const pdfConvertResp = await fetch('https://screenshotapi.net/api/v1/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'DEMO',
          html: htmlContent,
          output: 'pdf',
          width: 400,
          full_page: true,
        }),
      });
      console.log('[DEBUG] screenshotapi status:', pdfConvertResp.status);

      if (pdfConvertResp.ok) {
        const ct = pdfConvertResp.headers.get('content-type') || '';
        if (ct.includes('pdf') || ct.includes('octet')) {
          const pdfBlob = await pdfConvertResp.blob();
          if (pdfBlob.size > 500) {
            const { file_url } = await db.integrations.Core.UploadFile({ file: pdfBlob });
            await db.entities.NotaFiscal.update(nota_id, { pdf_url: file_url, chave_acesso: chave });
            return Response.json({ sucesso: true, pdf_url: file_url });
          }
        }
      }

      // Fallback: salva URL do HTML — frontend abre em nova aba (usuário imprime como PDF)
      await db.entities.NotaFiscal.update(nota_id, { pdf_url: htmlUrl, chave_acesso: chave });
      return Response.json({ sucesso: true, pdf_url: htmlUrl, is_html: true });
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
      || result.caminho_xml_nota_fiscal_pdf || result.url_pdf || result.arquivo_pdf || '';
    const pdfUrlFocus = normalizarUrl(rawPdf);
    console.log('[DEBUG] rawPdf:', rawPdf, 'pdfUrlFocus:', pdfUrlFocus);

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
          const { file_url } = await db.integrations.Core.UploadFile({ file: blob });
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
      // Não tem URL de PDF direto — tenta gerar DANFE se tiver chave
      if (nota.chave_acesso) {
        console.log('[DEBUG] Sem URL de PDF na resposta. Tentando gerar DANFE via chave_acesso...');
        const chave = nota.chave_acesso.replace(/\D/g, '');
        const danfeResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}.pdf`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (danfeResp.ok && danfeResp.headers.get('content-type')?.includes('pdf')) {
           const blob = await danfeResp.blob();
           const { file_url } = await db.integrations.Core.UploadFile({ file: blob });
           await db.entities.NotaFiscal.update(nota_id, { pdf_url: file_url });
           return Response.json({ sucesso: true, pdf_url: file_url });
         }
      }
      return Response.json({ sucesso: false, erro: 'PDF não disponível na Focus NFe. Verifique se o fornecedor autorizou o acesso ao DANFE ou se a nota ainda está sendo processada.' });
    }

    const isS3 = pdfUrlFocus.includes('amazonaws.com') || pdfUrlFocus.includes('s3.');
    console.log('[DEBUG] Tentando buscar PDF em:', pdfUrlFocus, '| isS3:', isS3);
    const pdfResp = await fetch(pdfUrlFocus, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
    
    if (!pdfResp.ok) {
      // Tenta novamente sem auth header se for erro de permissão
      if (pdfResp.status === 403 && !isS3) {
        console.log('[DEBUG] 403 Forbidden com auth, tentando sem auth...');
        const pdfResp2 = await fetch(pdfUrlFocus, {});
        if (pdfResp2.ok) {
          const blob = await pdfResp2.blob();
          const buffer = await blob.arrayBuffer();
          const header = new Uint8Array(buffer, 0, 4);
          const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
          if (isPdfValid) {
            const { file_url } = await db.integrations.Core.UploadFile({ file: blob });
            await db.entities.NotaFiscal.update(nota_id, { pdf_url: file_url });
            return Response.json({ sucesso: true, pdf_url: file_url });
          }
        }
      }
      // Se URL está retornando erro mas temos chave de acesso, tenta gerar DANFE
      if (nota.chave_acesso && pdfResp.status !== 200) {
        console.log('[DEBUG] URL retornou erro, tentando gerar DANFE via chave_acesso...');
        const chave = nota.chave_acesso.replace(/\D/g, '');
        try {
          const danfeResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}.pdf`, {
            headers: { 'Authorization': AUTH_HEADER },
          });
          if (danfeResp.ok && danfeResp.headers.get('content-type')?.includes('pdf')) {
            const blob = await danfeResp.blob();
            const { file_url } = await db.integrations.Core.UploadFile({ file: blob });
            await db.entities.NotaFiscal.update(nota_id, { pdf_url: file_url });
            return Response.json({ sucesso: true, pdf_url: file_url });
          }
        } catch (_) {}
      }
      return Response.json({ sucesso: false, erro: `Erro ${pdfResp.status} ao buscar PDF. A URL pode estar inválida ou o fornecedor não autorizou acesso.`, url_tentada: pdfUrlFocus });
    }

    const blob = await pdfResp.blob();
    const buffer = await blob.arrayBuffer();
    const header = new Uint8Array(buffer, 0, 4);
    const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
    
    if (!isPdfValid) {
      // Se não é PDF, extrai mensagem de erro completa
      const textDecoder = new TextDecoder();
      const texto = textDecoder.decode(buffer);
      console.log('[DEBUG] Resposta não-PDF:', texto.substring(0, 1000));
      
      // Tenta extrair mensagem do JSON se houver
      let erroMsg = 'Focus NFe retornou erro ou HTML.';
      try {
        const jsonErr = JSON.parse(texto);
        if (jsonErr.status_code || jsonErr.message || jsonErr.error) {
          erroMsg = `${jsonErr.status_code || ''} ${jsonErr.message || jsonErr.error}`.trim();
        }
      } catch {}
      
      return Response.json({ sucesso: false, erro: erroMsg, detalhes: texto.substring(0, 500) });
    }
    
    const { file_url } = await db.integrations.Core.UploadFile({ file: blob });

    const updateData = { pdf_url: file_url };
    if (result.chave_nfe || result.chave_nfse) updateData.chave_acesso = result.chave_nfe || result.chave_nfse;
    await db.entities.NotaFiscal.update(nota_id, updateData);

    return Response.json({ sucesso: true, pdf_url: file_url });

  } catch (error) {
    console.error('proxyPdfNota erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message });
  }
});