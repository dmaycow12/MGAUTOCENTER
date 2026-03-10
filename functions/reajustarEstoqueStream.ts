import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const arredondarVendaParaCinco = (valor) => {
  const num = Number(valor);
  return Math.ceil(num / 5) * 5;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, reajusteTipo, reajusteValor } = await req.json();
    
    if (!items || items.length === 0) {
      return Response.json({ error: 'Nenhum item' }, { status: 400 });
    }

    const ajuste = Number(reajusteValor);
    const atualizacoes = [];
    const naoProcessaveis = [];

    // Validação e preparação dos dados
    for (const item of items) {
      const custo = Number(item.valor_custo || 0);
      const venda = Number(item.valor_venda || 0);
      
      if (!item.id || isNaN(custo) || isNaN(venda) || isNaN(ajuste)) {
        naoProcessaveis.push({
          id: item.id,
          descricao: item.descricao,
          motivo: 'Dados inválidos'
        });
        continue;
      }

      let preco = reajusteTipo === "percentual" 
        ? custo * (1 + ajuste / 100)
        : venda + ajuste;
      
      preco = Math.max(0, arredondarVendaParaCinco(preco));
      
      atualizacoes.push({
        id: item.id,
        preco: parseFloat(preco.toFixed(2))
      });
    }

    // Processa em lote com retry
    let sucessos = 0;
    let falhas = 0;
    const falhasDetalhadas = [];
    const batchSize = 20;
    let tentativa = 0;
    const maxTentativas = 3;

    while (atualizacoes.length > 0 && tentativa < maxTentativas) {
      tentativa++;
      const lote = atualizacoes.splice(0, batchSize);
      
      for (const upd of lote) {
        try {
          await base44.entities.Estoque.update(upd.id, { valor_venda: upd.preco });
          sucessos++;
        } catch (err) {
          falhas++;
          falhasDetalhadas.push({
            id: upd.id,
            erro: err?.message || 'Erro ao atualizar'
          });
          // Readiciona para retry
          if (tentativa < maxTentativas) {
            atualizacoes.push(upd);
          }
        }
      }
      
      if (atualizacoes.length > 0) {
        await sleep(500); // Espera entre lotes
      }
    }

    return Response.json({
      sucesso: sucessos,
      falhas: falhas + naoProcessaveis.length,
      total: items.length,
      naoProcessaveis: naoProcessaveis.length,
      detalhesFalhas: falhasDetalhadas.slice(0, 5)
    });
  } catch (error) {
    return Response.json({ 
      error: error?.message || 'Erro',
      tipo: 'erro_servidor'
    }, { status: 500 });
  }
});