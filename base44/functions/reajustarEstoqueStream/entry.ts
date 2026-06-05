import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const arredondarVendaParaCinco = (valor) => Math.ceil(Number(valor) / 5) * 5;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function updateComRetry(base44, id, valor_venda) {
  let delay = 1500;
  for (let i = 0; i < 8; i++) {
    try {
      await base44.asServiceRole.entities.Estoque.update(id, { valor_venda });
      return true;
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        await sleep(delay);
        delay = Math.min(delay * 2, 15000);
      } else {
        return false;
      }
    }
  }
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // skip e limit permitem paginar o processamento pelo frontend
    const { reajusteTipo, reajusteValor, reajusteGrupo, skip = 0, limit = 30 } = await req.json();
    const ajuste = Number(reajusteValor);

    // Busca página de itens
    const todos = await base44.asServiceRole.entities.Estoque.list('created_date', 9999);
    const filtrados = reajusteGrupo && reajusteGrupo !== 'Todos'
      ? todos.filter(i => i.categoria === reajusteGrupo)
      : todos;

    const alvo = filtrados.slice(skip, skip + limit);
    const total = filtrados.length;
    const hasMore = skip + limit < total;

    let sucesso = 0;
    let falhas = 0;

    for (const item of alvo) {
      const novoValor = arredondarVendaParaCinco(
        reajusteTipo === 'percentual'
          ? Number(item.valor_custo || 0) * (1 + ajuste / 100)
          : Number(item.valor_venda || 0) + ajuste
      );
      const ok = await updateComRetry(base44, item.id, novoValor);
      if (ok) sucesso++; else falhas++;
      await sleep(400);
    }

    return Response.json({ sucesso, falhas, total, hasMore, processados: skip + alvo.length });
  } catch (error) {
    return Response.json({ error: error?.message || 'Erro' }, { status: 500 });
  }
});