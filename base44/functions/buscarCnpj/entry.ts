import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { cnpj } = await req.json();
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return Response.json({ error: 'CNPJ inválido' }, { status: 400 });

    // Tenta cnpj.ws primeiro (tem inscrição estadual)
    let resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });

    // Fallback para BrasilAPI se cnpj.ws falhar
    if (!resp.ok) {
      resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
        headers: { 'Accept': 'application/json' }
      });
    }

    if (!resp.ok) {
      return Response.json({ error: `CNPJ não encontrado (${resp.status})` }, { status: 404 });
    }

    const data = await resp.json();
    return Response.json({ sucesso: true, data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});