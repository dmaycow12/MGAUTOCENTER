import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const arredondarVendaParaCinco = (valor) => {
  return Math.ceil(valor / 5) * 5;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, reajusteTipo, reajusteValor } = await req.json();
    
    if (!items || items.length === 0) {
      return Response.json({ error: 'Nenhum item fornecido' }, { status: 400 });
    }

    const updates = items.map(item => {
      let novoPreco = reajusteTipo === "percentual"
        ? Number(item.valor_custo || 0) * (1 + Number(reajusteValor) / 100)
        : Number(item.valor_venda || 0) + Number(reajusteValor);
      novoPreco = arredondarVendaParaCinco(Math.max(0, novoPreco));
      
      return { id: item.id, valor_venda: novoPreco };
    });

    const results = [];
    for (const update of updates) {
      const result = await base44.entities.Estoque.update(update.id, { valor_venda: update.valor_venda });
      results.push(result);
    }

    return Response.json({ 
      sucesso: results.length,
      total: items.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});