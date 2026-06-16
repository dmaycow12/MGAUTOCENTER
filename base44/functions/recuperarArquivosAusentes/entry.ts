import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
let API_KEY = '';
let AUTH_HEADER = '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { nota_id, auth_secret } = body;

    // Autenticação: aceita auth_secret (site real/PasswordGate) ou sessão Base44 (preview)
    const AUTH_SECRET = Deno.env.get('AUTH_SECRET') || '';
    const reqSecret = req.headers.get('x-auth-secret') || auth_secret || '';
    if (!AUTH_SECRET || reqSecret !== AUTH_SECRET) {
      try {
        const user = await base44.auth.me();
        if (!user) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
      } catch (_) {
        return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
      }
    }

    const allConfigs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const getConf = (chave, padrao = '') => allConfigs.find(c => c.chave === chave)?.valor || padrao;
    API_KEY = getConf('focusnfe_api_key_producao', '');
    AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

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

      let pdfEncontrado = false;

      // Estratégia 1: Notas emitidas (NFe/NFCe/NFSe) - buscar via endpoint de consulta
      const statusesEmitida = ['Emitida', 'Homologada', 'Pré-visualização', 'Processando', 'Aguardando Sefin Nacional'];
      if (!pdfEncontrado && nota.spedy_id && statusesEmitida.includes(nota.status)) {
        const ep = nota.tipo === 'NFSe' ? 'nfsen' : nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
        console.log('[RECUPERAR] Nota emitida, consultando:', `${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`);
        
        try {
          const consultaResp = await fetch(`${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
            headers: { 'Authorization': AUTH_HEADER },
          });
          if (consultaResp.ok) {
            const result = await consultaResp.json();
            const rawPdf = result.url_danfse || result.caminho_danfse || result.caminho_pdf_nfsen 
              || result.caminho_danfe || result.url_danfe || result.url_pdf
              || result.caminho_xml_nota_fiscal_pdf || '';
            
            if (rawPdf) {
              const pdfUrlFocus = rawPdf.startsWith('http') ? rawPdf : `https://api.focusnfe.com.br${rawPdf}`;
              const isS3 = pdfUrlFocus.includes('amazonaws.com') || pdfUrlFocus.includes('s3.');
              
              console.log('[RECUPERAR] URL PDF:', pdfUrlFocus);
              const pdfResp = await fetch(pdfUrlFocus, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
              
              if (pdfResp.ok) {
                const blob = await pdfResp.blob();
                const buf = await blob.arrayBuffer();
                const h = new Uint8Array(buf, 0, 4);
                if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) {
                  const pdfFile = new File([blob], `NF-${nota.numero || chave}.pdf`, { type: 'application/pdf' });
                  const uploadPdf = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
                  if (uploadPdf?.file_url) {
                    updates.pdf_url = uploadPdf.file_url;
                    pdfEncontrado = true;
                    console.log('[RECUPERAR] PDF de nota emitida salvo com sucesso');
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('[RECUPERAR] Erro ao buscar PDF de nota emitida:', e.message);
        }
      }

      // Estratégia 2: Notas recebidas/importadas - endpoints diretos
      if (!pdfEncontrado) {
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
                  pdfEncontrado = true;
                  console.log('[RECUPERAR] PDF salvo via endpoint direto');
                }
              }
              break;
            }
          } catch (e) {}
        }
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