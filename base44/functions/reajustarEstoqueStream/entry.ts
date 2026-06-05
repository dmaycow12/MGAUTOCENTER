import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const arredondarVendaParaCinco = (valor) => Math.ceil(Number(valor) / 5) * 5;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { reajusteTipo, reajusteValor, reajusteGrupo } = await req.json();
    const ajuste = Number(reajusteValor);

    // Busca todos os itens do estoque no servidor
    const todos = await base44.asServiceRole.entities.Estoque.list('-created_date', 9999);
    const alvo = reajusteGrupo && reajusteGrupo !== 'Todos'
      ? todos.filter(i => i.categoria === reajusteGrupo)
      : todos;

    if (alvo.length === 0) return Response.json({ sucesso: 0, falhas: 0, total: 0 });

    // Calcula novos preços
    const atualizacoes = alvo.map(item => ({
      id: item.id,
      valor_venda: arredondarVendaParaCinco(
        reajusteTipo === 'percentual'
          ? Number(item.valor_custo || 0) * (1 + ajuste / 100)
          : Number(item.valor_venda || 0) + ajuste
      )
    }));

    // Processa em lotes de 20 com delay entre lotes para evitar rate limit
    const BATCH = 20;
    let sucesso = 0;
    let falhas = 0;

    for (let i = 0; i < atualizacoes.length; i += BATCH) {
      const lote = atualizacoes.slice(i, i + BATCH);
      await Promise.all(lote.map(async upd => {
        try {
          await base44.asServiceRole.entities.Estoque.update(upd.id, { valor_venda: upd.valor_venda });
          sucesso++;
        } catch {
          falhas++;
        }
      }));
      if (i + BATCH < atualizacoes.length) await sleep(300);
    }

    return Response.json({ sucesso, falhas, total: atualizacoes.length });
  } catch (error) {
    return Response.json({ error: error?.message || 'Erro' }, { status: 500 });
  }
});