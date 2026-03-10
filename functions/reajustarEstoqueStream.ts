import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const arredondarVendaParaCinco = (valor) => {
  const num = Number(valor);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.ceil(num / 5) * 5;
};

const processarComLimite = async (items, fn, limit = 10) => {
  const resultados = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const batch = await Promise.all(chunk.map(fn));
    resultados.push(...batch);
  }
  return resultados;
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

    const ajuste = Number(reajusteValor || 0);
    if (isNaN(ajuste)) {
      return Response.json({ error: 'Valor de reajuste inválido' }, { status: 400 });
    }

    // Processa com limite de 10 requisições paralelas
    const resultados = await processarComLimite(items, async (item) => {
      try {
        const valorCusto = Number(item.valor_custo || 0);
        const valorVendaAtual = Number(item.valor_venda || 0);
        
        if (isNaN(valorCusto) || isNaN(valorVendaAtual)) {
          return { sucesso: false, id: item.id };
        }

        let novoPreco;
        if (reajusteTipo === "percentual") {
          novoPreco = valorCusto * (1 + ajuste / 100);
        } else {
          novoPreco = valorVendaAtual + ajuste;
        }
        
        novoPreco = arredondarVendaParaCinco(Math.max(0, novoPreco));
        
        if (isNaN(novoPreco) || !isFinite(novoPreco)) {
          return { sucesso: false, id: item.id };
        }

        await base44.entities.Estoque.update(item.id, { 
          valor_venda: parseFloat(novoPreco.toFixed(2))
        });
        
        return { sucesso: true, id: item.id };
      } catch (err) {
        return { sucesso: false, id: item.id, erro: err?.message };
      }
    }, 10);

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    return Response.json({ 
      sucesso: sucessos,
      falhas: falhas,
      total: items.length
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: String(error?.message || 'Erro desconhecido') }, { status: 500 });
  }
});