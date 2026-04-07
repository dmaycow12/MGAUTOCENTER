import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { cnpj } = await req.json();
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return Response.json({ error: 'CNPJ inválido' }, { status: 400 });

    const resp = await fetch(`https://www.cnpj.ws/cnpj/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return Response.json({ error: `CNPJ não encontrado (${resp.status})` }, { status: 404 });
    }

    const data = await resp.json();
    return Response.json({ sucesso: true, data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});