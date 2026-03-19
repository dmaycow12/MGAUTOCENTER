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

    const batchSize = 50;
    let sucessos = 0;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const promises = batch.map(update => 
        base44.entities.Estoque.update(update.id, { valor_venda: update.valor_venda })
          .then(() => { sucessos++; return true; })
          .catch(() => false)
      );
      
      await Promise.all(promises);
    }

    return Response.json({ 
      sucesso: sucessos,
      total: items.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});