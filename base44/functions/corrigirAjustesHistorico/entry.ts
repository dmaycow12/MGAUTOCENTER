import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const items = await base44.asServiceRole.entities.Estoque.list('-created_date', 500);
  let atualizados = 0;

  for (const item of items) {
    const hist = item.historico || [];
    let modificado = false;

    const novoHist = hist.map(h => {
      if ((h.observacao || '').toLowerCase().includes('regulariza')) {
        modificado = true;
        return {
          ...h,
          observacao: 'Ajuste',
          valor_unitario: h.valor_unitario && h.valor_unitario > 0 ? h.valor_unitario : Number(item.valor_custo || 0),
        };
      }
      return h;
    });

    if (modificado) {
      await base44.asServiceRole.entities.Estoque.update(item.id, { historico: novoHist });
      atualizados++;
    }
  }

  return Response.json({ ok: true, atualizados });
  } catch(e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});