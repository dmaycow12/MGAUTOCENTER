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

    const resultados = [];
    const batchSize = 10;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(update => 
          base44.entities.Estoque.update(update.id, { valor_venda: update.valor_venda })
        )
      );
      
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        resultados.push({
          id: batch[j].id,
          sucesso: result.status === 'fulfilled',
          erro: result.status === 'rejected' ? result.reason?.message : null
        });
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso);

    return Response.json({ 
      sucesso: sucessos,
      total: items.length,
      falhas: falhas.length > 0 ? falhas : null,
      detalhes: resultados
    });
  } catch (error) {
    console.error('Erro em reajustarEstoqueStream:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});