import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { chave_acesso, nota_id } = body;

    if (!chave_acesso) {
      return Response.json({ sucesso: false, erro: 'chave_acesso é obrigatória' });
    }

    // Passo 1: fazer manifestação (ciência da operação) para a SEFAZ liberar o XML completo
    try {
      await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}/manifestacoes`, {
        method: 'POST',
        headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'ciencia_operacao' }),
      });
    } catch (_) {}

    // Aguarda um momento para a SEFAZ processar a manifestação
    await new Promise(r => setTimeout(r, 1500));

    // Passo 2: tentar baixar o XML completo - testa múltiplos endpoints
    const endpoints = [
      `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}.xml`,
      `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}/xml`,
      `${FOCUSNFE_BASE}/download_nfe/${chave_acesso}`,
    ];

    let xml = '';
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('xml')) {
          const txt = await resp.text();
          if (txt && txt.includes('<')) { xml = txt; break; }
        } else {
          const data = await resp.json().catch(() => ({}));
          let candidate = data.xml || data.xml_nota || data.xml_nfe || '';
          if (!candidate && data.caminho_xml_nota_fiscal) {
            const r2 = await fetch(data.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
            if (r2.ok) candidate = await r2.text();
          }
          if (candidate && candidate.includes('<')) { xml = candidate; break; }
        }
      } catch (_) {}
    }

    // Passo 3: verificar se o XML tem produtos (<det>)
    if (!xml) {
      return Response.json({
        sucesso: false,
        erro: 'XML completo ainda não disponível na SEFAZ. Aguarde alguns minutos e tente novamente, ou importe o arquivo XML manualmente.'
      });
    }

    if (!xml.includes('<det')) {
      return Response.json({
        sucesso: false,
        erro: 'XML encontrado mas sem detalhes de produtos. A SEFAZ ainda está processando. Aguarde e tente novamente.'
      });
    }

    // Salva o XML na nota
    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_content: xml });
    }

    return Response.json({ sucesso: true, xml, temProdutos: true });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});