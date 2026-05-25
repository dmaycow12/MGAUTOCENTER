import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizar(str) {
  if (!str) return str;
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .toUpperCase()
    .trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const vendas = await base44.asServiceRole.entities.Vendas.list('-created_date', 5000);
    let atualizadas = 0;

    for (const venda of vendas) {
      let changed = false;
      const novosServicos = (venda.servicos || []).map(s => {
        const desc = normalizar(s.descricao);
        if (desc !== s.descricao) { changed = true; return { ...s, descricao: desc }; }
        return s;
      });
      const novasPecas = (venda.pecas || []).map(p => {
        const desc = normalizar(p.descricao);
        if (desc !== p.descricao) { changed = true; return { ...p, descricao: desc }; }
        return p;
      });

      if (changed) {
        await base44.asServiceRole.entities.Vendas.update(venda.id, {
          servicos: novosServicos,
          pecas: novasPecas,
        });
        atualizadas++;
      }
    }

    return Response.json({ ok: true, total: vendas.length, atualizadas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});