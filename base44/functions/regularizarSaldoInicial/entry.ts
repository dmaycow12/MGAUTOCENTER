import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const normTipo = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Buscar todos os itens
  let todos = [];
  let skip = 0;
  while (true) {
    const lote = await base44.asServiceRole.entities.Estoque.list('-created_date', 500, skip);
    todos = todos.concat(lote);
    if (lote.length < 500) break;
    skip += 500;
  }

  const semEntrada = todos.filter(i =>
    i.quantidade > 0 && !(i.historico || []).some(h => normTipo(h.tipo) === 'entrada')
  );

  if (semEntrada.length === 0) {
    return Response.json({ regularizados: 0, msg: 'Nenhum produto sem entrada encontrado.' });
  }

  const hoje = new Date().toISOString().split('T')[0] + 'T12:00:00.000Z';
  let regularizados = 0;

  for (const item of semEntrada) {
    const mov = {
      tipo: 'entrada',
      data: hoje,
      quantidade: item.quantidade,
      valor_unitario: item.valor_custo || 0,
      observacao: 'SALDO INICIAL',
    };
    await base44.asServiceRole.entities.Estoque.update(item.id, {
      historico: [...(item.historico || []), mov],
    });
    regularizados++;
  }

  return Response.json({ regularizados, msg: `${regularizados} produto(s) regularizados com sucesso.` });
});