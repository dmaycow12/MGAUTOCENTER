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

    // Busca XML da nota recebida na Focus NFe
    const resp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}.json`, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return Response.json({ sucesso: false, erro: `Erro Focus NFe (${resp.status}): ${txt.substring(0, 200)}` });
    }

    const data = await resp.json();
    const xml = data.xml || '';

    // Salva o XML na nota para evitar buscar novamente
    if (xml && nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_content: xml });
    }

    return Response.json({ sucesso: true, xml });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});