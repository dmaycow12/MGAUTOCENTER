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

    let sucessos = 0;
    let falhas = 0;

    for (const item of items) {
      try {
        let novoPreco = reajusteTipo === "percentual"
          ? Number(item.valor_custo || 0) * (1 + Number(reajusteValor) / 100)
          : Number(item.valor_venda || 0) + Number(reajusteValor);
        novoPreco = arredondarVendaParaCinco(Math.max(0, novoPreco));
        
        await base44.entities.Estoque.update(item.id, { valor_venda: novoPreco });
        sucessos++;
      } catch (err) {
        falhas++;
        console.error(`Erro ao atualizar ${item.id}:`, err.message);
      }
    }

    return Response.json({ 
      sucesso: sucessos,
      falhas: falhas,
      total: items.length
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: String(error.message) }, { status: 500 });
  }
});