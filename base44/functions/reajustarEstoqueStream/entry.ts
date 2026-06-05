import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const arredondar = (v) => Math.ceil(Number(v) / 5) * 5;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { reajusteTipo, reajusteValor, reajusteGrupo } = await req.json();
    const ajuste = Number(reajusteValor);

    // 1. Busca todos os itens de uma vez
    const todos = await base44.asServiceRole.entities.Estoque.list('created_date', 9999);
    const filtrados = reajusteGrupo && reajusteGrupo !== 'Todos'
      ? todos.filter(i => i.categoria === reajusteGrupo)
      : todos;

    // 2. Calcula novos valores em memória
    const atualizacoes = filtrados.map(item => ({
      id: item.id,
      valor_venda: arredondar(
        reajusteTipo === 'percentual'
          ? Number(item.valor_custo || 0) * (1 + ajuste / 100)
          : Number(item.valor_venda || 0) + ajuste
      )
    }));

    // 3. bulkUpdate em lotes de 500 — UMA chamada para todos os 325 itens
    const LOTE = 500;
    let sucesso = 0;
    for (let i = 0; i < atualizacoes.length; i += LOTE) {
      const lote = atualizacoes.slice(i, i + LOTE);
      await base44.asServiceRole.entities.Estoque.bulkUpdate(lote);
      sucesso += lote.length;
    }

    return Response.json({ sucesso, total: filtrados.length });
  } catch (error) {
    return Response.json({ error: error?.message || 'Erro' }, { status: 500 });
  }
});