import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { chave_acesso, nota_id } = body;

  if (!chave_acesso) {
    return Response.json({ sucesso: false, erro: 'chave_acesso é obrigatória' });
  }

  // Passo 1: manifestação para liberar XML completo na SEFAZ
  try {
    await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}/manifestacoes`, {
      method: 'POST',
      headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'ciencia_operacao' }),
    });
  } catch (_) {}

  await new Promise(r => setTimeout(r, 1500));

  // Passo 2: tentar endpoints em ordem até achar XML com <det>
  const endpoints = [
    `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}.xml`,
    `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}/xml`,
    `${FOCUSNFE_BASE}/download_nfe/${chave_acesso}`,
    `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}`,
  ];

  let xml = '';
  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
      if (!resp.ok) continue;
      const ct = resp.headers.get('content-type') || '';
      let candidate = '';
      if (ct.includes('xml')) {
        candidate = await resp.text();
      } else {
        const data = await resp.json().catch(() => ({}));
        candidate = data.xml || data.xml_nota || data.xml_nfe || '';
        if (!candidate && data.caminho_xml_nota_fiscal) {
          const r2 = await fetch(data.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
          if (r2.ok) candidate = await r2.text();
        }
      }
      if (candidate && candidate.includes('<det')) {
        xml = candidate;
        break;
      }
    } catch (_) {}
  }

  if (!xml) {
    return Response.json({
      sucesso: false,
      erro: 'XML completo ainda não disponível na SEFAZ. Importe o arquivo XML manualmente clicando em "Importar XML".'
    });
  }

  // Salva XML na nota para não precisar buscar novamente
  if (nota_id) {
    try {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_content: xml });
    } catch (_) {}
  }

  return Response.json({ sucesso: true, xml });
});