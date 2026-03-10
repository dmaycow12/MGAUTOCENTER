import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const arredondarVendaParaCinco = (valor) => {
  const num = Number(valor);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.ceil(num / 5) * 5;
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
    const errosDetalhados = [];

    for (const item of items) {
      try {
        const valorCusto = Number(item.valor_custo || 0);
        const valorVendaAtual = Number(item.valor_venda || 0);
        const ajuste = Number(reajusteValor || 0);
        
        // Validação de entrada
        if (isNaN(valorCusto) || isNaN(valorVendaAtual) || isNaN(ajuste)) {
          falhas++;
          errosDetalhados.push({
            id: item.id,
            descricao: item.descricao,
            erro: 'Valores inválidos'
          });
          continue;
        }

        let novoPreco;
        if (reajusteTipo === "percentual") {
          novoPreco = valorCusto * (1 + ajuste / 100);
        } else {
          novoPreco = valorVendaAtual + ajuste;
        }
        
        // Garantir que é um número válido
        novoPreco = arredondarVendaParaCinco(novoPreco);
        
        if (isNaN(novoPreco) || !isFinite(novoPreco)) {
          falhas++;
          errosDetalhados.push({
            id: item.id,
            descricao: item.descricao,
            erro: 'Cálculo resultou em valor inválido'
          });
          continue;
        }
        
        // Garantir que não é negativo
        if (novoPreco < 0) {
          novoPreco = 0;
        }

        await base44.entities.Estoque.update(item.id, { 
          valor_venda: parseFloat(novoPreco.toFixed(2))
        });
        sucessos++;
      } catch (err) {
        falhas++;
        errosDetalhados.push({
          id: item.id,
          descricao: item.descricao,
          erro: err?.message || 'Erro desconhecido'
        });
      }
    }

    return Response.json({ 
      sucesso: sucessos,
      falhas: falhas,
      total: items.length,
      erros: errosDetalhados.slice(0, 10)
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: String(error?.message || 'Erro desconhecido') }, { status: 500 });
  }
});