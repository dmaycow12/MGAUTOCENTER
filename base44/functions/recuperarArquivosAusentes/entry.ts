import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
let API_KEY = '';
let AUTH_HEADER = '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });

    const allConfigs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const getConf = (chave, padrao = '') => allConfigs.find(c => c.chave === chave)?.valor || padrao;
    API_KEY = getConf('focusnfe_api_key_producao', '');
    AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

    const body = await req.json().catch(() => ({}));
    const { nota_id } = body;

    if (!nota_id) {
      return Response.json({ sucesso: false, erro: 'nota_id é obrigatória' });
    }

    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
    const nota = notas[0];
    if (!nota) {
      return Response.json({ sucesso: false, erro: 'Nota não encontrada' });
    }

    const chave = nota.chave_acesso || nota.spedy_id;
    if (!chave) {
      return Response.json({ sucesso: false, erro: 'Nota sem chave de acesso ou spedy_id' });
    }

    const updates = {};

    // ===== XML =====
    if (!nota.xml_url && !(nota.xml_original && nota.xml_original.trim().startsWith('<'))) {
      console.log('[RECUPERAR] Buscando XML para:', chave);

      // Passo 1: Manifestação para liberar XML na SEFAZ
      try {
        await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}/manifestacoes`, {
          method: 'POST',
          headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: 'ciencia_operacao' }),
        });
        await new Promise(r => setTimeout(r, 3000));
      } catch (_) {}

      // Passo 2: Buscar XML com retry
      const endpointsXml = [
        `${FOCUSNFE_BASE}/nfes_recebidas/${chave}.xml`,
        `${FOCUSNFE_BASE}/nfes_recebidas/${chave}`,
        `${FOCUSNFE_BASE}/nfes/${chave}.xml`,
        `${FOCUSNFE_BASE}/nfes/${chave}`,
        `${FOCUSNFE_BASE}/download_nfe/${chave}`,
      ];

      let xmlContent = '';

      for (let tentativa = 0; tentativa < 3 && !xmlContent; tentativa++) {
        if (tentativa > 0) {
          await new Promise(r => setTimeout(r, 3000));
        }

        for (const url of endpointsXml) {
          try {
            const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
            if (!resp.ok) continue;
            const ct = resp.headers.get('content-type') || '';
            let candidate = '';

            if (ct.includes('xml') || url.endsWith('.xml')) {
              candidate = await resp.text();
            } else {
              const data = await resp.json().catch(() => ({}));
              candidate = data.xml || data.xml_nota || data.xml_nfe || '';
              if (!candidate && data.caminho_xml_nota_fiscal) {
                const r2 = await fetch(data.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
                if (r2.ok) candidate = await r2.text();
              }
            }

            if (candidate && candidate.length > 500 && (
              candidate.includes('infNFe') || candidate.includes('nfeProc') || candidate.includes('<det') || candidate.includes(':det')
            )) {
              xmlContent = candidate;
              break;
            }
          } catch (e) {
            console.error('[RECUPERAR XML ERROR]', url, e.message);
          }
        }
      }

      if (xmlContent) {
        try {
          const xmlFile = new File([xmlContent], `NF-${nota.numero || chave}.xml`, { type: 'text/xml' });
          const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });
          if (uploadResp?.file_url) {
            updates.xml_url = uploadResp.file_url;
            updates.xml_original_url = uploadResp.file_url;
            console.log('[RECUPERAR] XML salvo via UploadFile');
          }
        } catch (_) {}
      }
    }

    // ===== PDF =====
    if (!nota.pdf_url) {
      console.log('[RECUPERAR] Buscando PDF para:', chave);

      const endpointsPdf = [
        `${FOCUSNFE_BASE}/nfes_recebidas/${chave}.pdf`,
        `${FOCUSNFE_BASE}/nfes/${chave}.pdf`,
      ];

      if (nota.tipo === 'NFSe') {
        endpointsPdf.unshift(`${FOCUSNFE_BASE}/nfses_recebidas/${chave}.pdf`);
      }

      for (const url of endpointsPdf) {
        try {
          const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
          if (resp.ok) {
            const ct = resp.headers.get('content-type') || '';
            if (ct.includes('pdf') || ct.includes('octet')) {
              const blob = await resp.blob();
              const pdfFile = new File([blob], `NF-${nota.numero || chave}.pdf`, { type: 'application/pdf' });
              const uploadPdf = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
              if (uploadPdf?.file_url) {
                updates.pdf_url = uploadPdf.file_url;
                console.log('[RECUPERAR] PDF salvo via UploadFile');
              }
            }
            break;
          }
        } catch (e) {}
      }
    }

    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, updates);
      return Response.json({
        sucesso: true,
        mensagem: 'Arquivos recuperados com sucesso!',
        encontrou_xml: !!(updates.xml_url || updates.xml_original_url),
        encontrou_pdf: !!updates.pdf_url,
      });
    }

    return Response.json({
      sucesso: false,
      erro: 'Nenhum arquivo encontrado na SEFAZ para esta nota.',
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message });
  }
});