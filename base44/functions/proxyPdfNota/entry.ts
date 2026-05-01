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

    // Para NFCe emitida: buscar direto pelo reference_id (spedy_id)
    if (nota.tipo === 'NFCe' && nota.spedy_id) {
      console.log('[DEBUG] NFCe emitida, buscando PDF via reference_id:', nota.spedy_id);
      
      // Tenta múltiplos endpoints para NFCe
      const endpoints = [
        `${FOCUSNFE_BASE}/nfce/${nota.spedy_id}.pdf`,
        `${FOCUSNFE_BASE}/nfce/${nota.spedy_id}`,
      ];
      
      for (const pdfUrl of endpoints) {
        console.log('[DEBUG] Tentando endpoint NFCe:', pdfUrl);
        const pdfResp = await fetch(pdfUrl, { headers: { 'Authorization': AUTH_HEADER } });
        
        if (!pdfResp.ok) continue;
        
        const contentType = pdfResp.headers.get('content-type') || '';
        console.log('[DEBUG] Content-Type:', contentType);
        
        // Se endpoint retorna JSON, significa que tem mais dados
        if (contentType.includes('application/json')) {
          const jsonData = await pdfResp.json();
          console.log('[DEBUG] Resposta JSON da NFCe:', JSON.stringify(jsonData).substring(0, 200));
          
          // Tenta extrair URL de PDF dos dados
          const pdfUrls = [
            jsonData.url_danfce,
            jsonData.caminho_pdf,
            jsonData.url_pdf,
            jsonData.danfce_url,
          ].filter(Boolean);
          
          for (const url of pdfUrls) {
            if (!url) continue;
            const fullUrl = url.startsWith('http') ? url : normalizarUrl(url);
            console.log('[DEBUG] Tentando URL extraída:', fullUrl);
            const pdfResp2 = await fetch(fullUrl, {});
            if (pdfResp2.ok && pdfResp2.headers.get('content-type')?.includes('pdf')) {
              const blob = await pdfResp2.blob();
              const buffer = await blob.arrayBuffer();
              if (buffer.byteLength > 100) { // PDF válido tem pelo menos 100 bytes
                const nomeArquivo = `nfce-${nota.numero || nota_id}.pdf`;
                const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
                const { file_url } = await db.integrations.Core.UploadFile({ file });
                await db.entities.NotaFiscal.update(nota_id, { pdf_url: file_url });
                return Response.json({ sucesso: true, pdf_url: file_url });
              }
            }
          }
          continue;
        }
        
        // Se é PDF direto
        if (contentType.includes('pdf')) {
          const blob = await pdfResp.blob();
          const buffer = await blob.arrayBuffer();
          console.log('[DEBUG] PDF recebido, tamanho:', buffer.byteLength, 'bytes');
          
          if (buffer.byteLength > 100) {
            const nomeArquivo = `nfce-${nota.numero || nota_id}.pdf`;
            const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
            const { file_url } = await db.integrations.Core.UploadFile({ file });
            await db.entities.NotaFiscal.update(nota_id, { pdf_url: file_url });
            return Response.json({ sucesso: true, pdf_url: file_url });
          }
        }
      }
      
      return Response.json({ sucesso: false, erro: 'Não foi possível recuperar o PDF da NFCe. Verifique se a NFCe foi autorizada corretamente.' });
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
      // Não tem URL de PDF direto — tenta gerar DANFE se tiver chave
      if (nota.chave_acesso) {
        console.log('[DEBUG] Sem URL de PDF na resposta. Tentando gerar DANFE via chave_acesso...');
        const chave = nota.chave_acesso.replace(/\D/g, '');
        const danfeResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}.pdf`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (danfeResp.ok && danfeResp.headers.get('content-type')?.includes('pdf')) {
          const blob = await danfeResp.blob();
          const nomeArquivo = `${(nota.tipo || 'nf').toLowerCase()}-${nota.numero || nota_id}.pdf`;
          const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
          const { file_url } = await db.integrations.Core.UploadFile({ file });
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
            const nomeArquivo = `${(nota.tipo || 'nf').toLowerCase()}-${nota.numero || nota_id}.pdf`;
            const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
            const { file_url } = await db.integrations.Core.UploadFile({ file });
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
            const nomeArquivo = `${(nota.tipo || 'nf').toLowerCase()}-${nota.numero || nota_id}.pdf`;
            const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
            const { file_url } = await db.integrations.Core.UploadFile({ file });
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