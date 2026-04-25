import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

async function buscarXmlPorChave(chave) {
  // Manifestar primeiro para liberar o XML
  try {
    await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}/manifestacoes`, {
      method: 'POST',
      headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'ciencia_operacao' }),
    });
  } catch (_) {}

  const endpoints = [
    `${FOCUSNFE_BASE}/nfes_recebidas/${chave}.xml`,
    `${FOCUSNFE_BASE}/nfes_recebidas/${chave}/xml`,
    `${FOCUSNFE_BASE}/download_nfe/${chave}`,
    `${FOCUSNFE_BASE}/nfes_recebidas/${chave}`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
      if (!resp.ok) continue;
      const ct = resp.headers.get('content-type') || '';
      let candidate = '';
      if (ct.includes('xml')) {
        candidate = await resp.text();
      } else {
        const data = await resp.json().catch(() => null);
        candidate = data?.xml || data?.xml_nota || data?.xml_nfe || data?.xml_documento || '';
        if (!candidate && data?.caminho_xml_nota_fiscal) {
          const r2 = await fetch(data.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
          if (r2.ok) candidate = await r2.text();
        }
      }
      if (candidate && candidate.length > 500 && (candidate.includes('<det') || candidate.includes(':det') || candidate.includes('infNFe'))) {
        return candidate.trim();
      }
    } catch (_) {}
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Busca todas as NFe importadas sem xml_original
    const notas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const semXml = notas.filter(n =>
      n.tipo === 'NFe' &&
      (n.status === 'Importada') &&
      n.chave_acesso &&
      !n.xml_original &&
      !(n.xml_content && n.xml_content.trim().startsWith('<'))
    );

    let recuperadas = 0;
    let falhas = 0;

    for (const nota of semXml) {
      const xml = await buscarXmlPorChave(nota.chave_acesso);
      if (xml) {
        try {
          await base44.asServiceRole.entities.NotaFiscal.update(nota.id, { xml_original: xml });
          recuperadas++;
        } catch (_) { falhas++; }
      } else {
        falhas++;
      }
      // Pequena pausa para não sobrecarregar a API
      await new Promise(r => setTimeout(r, 300));
    }

    return Response.json({
      sucesso: true,
      total_sem_xml: semXml.length,
      recuperadas,
      falhas,
      mensagem: `${recuperadas} de ${semXml.length} XMLs recuperados.`,
    });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});