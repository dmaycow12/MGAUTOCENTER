import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

async function tentarBuscarXml(url) {
  const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
  if (!resp.ok) return '';
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('xml')) {
    const txt = await resp.text();
    return txt;
  }
  const data = await resp.json().catch(() => ({}));
  let xml = data.xml || data.xml_nota || data.xml_nfe || '';
  if (!xml && data.caminho_xml_nota_fiscal) {
    const r2 = await fetch(data.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
    if (r2.ok) xml = await r2.text();
  }
  if (!xml && data.url_xml) {
    const r3 = await fetch(data.url_xml, { headers: { 'Authorization': AUTH_HEADER } });
    if (r3.ok) xml = await r3.text();
  }
  return xml;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { chave_acesso, nota_id } = body;

    if (!chave_acesso) {
      return Response.json({ sucesso: false, erro: 'chave_acesso é obrigatória' });
    }

    // Tenta múltiplos endpoints em ordem — prioriza os que podem retornar o XML completo com <det>
    const endpoints = [
      `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}/xml`,
      `${FOCUSNFE_BASE}/download_nfe/${chave_acesso}`,
      `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}`,
    ];

    let xml = '';
    for (const url of endpoints) {
      try {
        xml = await tentarBuscarXml(url);
        if (xml && xml.includes('<det')) break; // XML completo com produtos
        if (xml && xml.length > 500) break; // qualquer XML substancial
      } catch (_) {}
    }

    if (!xml) {
      return Response.json({ sucesso: false, erro: 'XML não disponível na Focus NFe. Importe o arquivo XML manualmente.' });
    }

    // Salva o XML na nota para não precisar buscar novamente
    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_content: xml });
    }

    return Response.json({ sucesso: true, xml, temProdutos: xml.includes('<det') });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});