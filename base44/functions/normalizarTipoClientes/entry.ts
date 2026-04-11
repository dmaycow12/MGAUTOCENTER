import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 2000);
  
  let corrigidos = 0;
  for (const c of clientes) {
    let novoTipo = null;
    if (c.tipo === 'PF') novoTipo = 'Pessoa Física';
    else if (c.tipo === 'PJ') novoTipo = 'Pessoa Jurídica';
    
    if (novoTipo) {
      await base44.asServiceRole.entities.Cliente.update(c.id, { tipo: novoTipo });
      corrigidos++;
    }
  }

  return Response.json({ ok: true, corrigidos, total: clientes.length });
});