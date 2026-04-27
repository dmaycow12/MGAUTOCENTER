import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { nota_id, ref, chave_acesso } = await req.json();

    if (!nota_id) return Response.json({ sucesso: false, erro: 'nota_id obrigatório' }, { status: 400 });

    const ep = ref?.startsWith('nfce') ? 'nfce' : 'nfe';
    const logs = [];
    let xmlCancelamento = null;

    // Tentar buscar XML de cancelamento via referência
    if (ref) {
      // Endpoint de cancelamento direto
      const urls = [
        `${FOCUSNFE_BASE}/${ep}/${ref}/cancelamento.xml`,
        `${FOCUSNFE_BASE}/${ep}/${ref}/cancelamento`,
        `${FOCUSNFE_BASE}/${ep}/${ref}?completo=1`,
      ];

      for (const url of urls) {
        logs.push(`Tentando: ${url}`);
        const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
        if (!resp.ok) { logs.push(`Falhou: ${resp.status}`); continue; }

        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('xml')) {
          const text = await resp.text();
          if (text && text.includes('<')) {
            xmlCancelamento = text;
            logs.push(`XML encontrado via ${url}`);
            break;
          }
        }

        const json = await resp.json().catch(() => null);
        if (!json) continue;
        logs.push(`JSON retornado: ${JSON.stringify(json).substring(0, 300)}`);

        // Tentar campos de XML de cancelamento na resposta
        const xmlField = json.caminho_xml_cancelamento || json.xml_cancelamento || json.xml_carta_correcao || '';
        if (xmlField) {
          let xmlUrl = xmlField.startsWith('http') ? xmlField : `https://api.focusnfe.com.br${xmlField}`;
          const r2 = await fetch(xmlUrl, { headers: { 'Authorization': AUTH_HEADER } });
          if (r2.ok) {
            const text = await r2.text();
            if (text && text.includes('<')) {
              xmlCancelamento = text;
              logs.push(`XML cancelamento obtido via caminho_xml_cancelamento`);
              break;
            }
          }
        }

        // Neste caso o XML da nota (proc) já inclui o evento de cancelamento
        const xmlNota = json.xml_nfe_proc || json.xml || '';
        if (xmlNota && xmlNota.includes('<')) {
          xmlCancelamento = xmlNota;
          logs.push(`XML proc obtido via campo json`);
          break;
        }

        // Se status cancelado, o caminho_xml_nota_fiscal pode já incluir o evento
        if (json.caminho_xml_nota_fiscal) {
          const xmlUrl = json.caminho_xml_nota_fiscal.startsWith('http')
            ? json.caminho_xml_nota_fiscal
            : `https://api.focusnfe.com.br${json.caminho_xml_nota_fiscal}`;
          const r2 = await fetch(xmlUrl, { headers: { 'Authorization': AUTH_HEADER } });
          if (r2.ok) {
            const text = await r2.text();
            if (text && text.includes('<')) {
              xmlCancelamento = text;
              logs.push(`XML nota obtido via caminho_xml_nota_fiscal`);
              break;
            }
          }
        }
      }
    }

    // Tentar via chave de acesso diretamente no endpoint de cancelamentos
    if (!xmlCancelamento && chave_acesso) {
      const chave = chave_acesso.replace('NFe', '');
      const urlsChave = [
        `${FOCUSNFE_BASE}/nfce/${chave}/cancelamento.xml`,
        `${FOCUSNFE_BASE}/nfe/${chave}/cancelamento.xml`,
        `${FOCUSNFE_BASE}/nfce/${chave_acesso}/cancelamento.xml`,
      ];
      for (const url of urlsChave) {
        logs.push(`Tentando chave: ${url}`);
        const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
        if (!resp.ok) { logs.push(`Falhou: ${resp.status}`); continue; }
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('xml')) {
          const text = await resp.text();
          if (text && text.includes('<')) {
            xmlCancelamento = text;
            logs.push(`XML cancelamento via chave`);
            break;
          }
        }
      }
    }

    if (!xmlCancelamento) {
      return Response.json({
        sucesso: false,
        erro: 'XML de cancelamento não encontrado na FocusNFe. A nota foi cancelada mas o XML do evento pode não estar disponível.',
        logs,
      });
    }

    // Salvar XML encontrado
    const xmlFile = new File([xmlCancelamento], `NFCe-${nota_id}-cancelamento.xml`, { type: 'text/xml' });
    const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });

    if (uploadResp?.file_url) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        xml_url: uploadResp.file_url,
      });
    }

    return Response.json({ sucesso: true, xml: xmlCancelamento, xml_url: uploadResp?.file_url, logs });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});