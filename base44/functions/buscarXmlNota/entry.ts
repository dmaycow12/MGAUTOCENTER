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

    const resp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}`, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return Response.json({ sucesso: false, erro: `Erro Focus NFe (${resp.status}): ${txt.substring(0, 200)}` });
    }

    let xml = '';
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('xml')) {
      xml = await resp.text();
    } else {
      const data = await resp.json().catch(() => ({}));
      xml = data.xml || data.xml_nota || data.xml_nfe || '';
    }

    if (!xml) {
      return Response.json({ sucesso: false, erro: 'XML não disponível na Focus NFe. Importe o arquivo XML manualmente.' });
    }

    // Salva o XML na nota para não precisar buscar novamente
    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_content: xml });
    }

    return Response.json({ sucesso: true, xml });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});