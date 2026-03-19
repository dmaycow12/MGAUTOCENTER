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
    const total = items.length;
    
    // Prepara lista de atualizações
    const pendentes = items.map(item => ({
      id: item.id,
      descricao: item.descricao,
      preco: arredondarVendaParaCinco(
        reajusteTipo === "percentual"
          ? Number(item.valor_custo || 0) * (1 + ajuste / 100)
          : Number(item.valor_venda || 0) + ajuste
      )
    }));

    let sucessos = 0;
    let tentativa = 0;
    const maxTentativas = 50;
    let delayBase = 100;

    // Loop até 100% de sucesso ou max tentativas
    while (pendentes.length > 0 && tentativa < maxTentativas) {
      tentativa++;
      const delay = Math.min(delayBase * tentativa, 5000);
      
      const paraProcessar = [...pendentes];
      
      for (const upd of paraProcessar) {
        try {
          await base44.entities.Estoque.update(upd.id, { valor_venda: upd.preco });
          sucessos++;
          // Remove da lista de pendentes
          const idx = pendentes.findIndex(p => p.id === upd.id);
          if (idx > -1) pendentes.splice(idx, 1);
        } catch (err) {
          // Mantém na lista para retry
          console.log(`Retry ${tentativa}: ${upd.id} - ${err?.message}`);
        }
      }

      if (pendentes.length > 0) {
        await sleep(delay);
      }
    }

    // Retorna resultado
    if (pendentes.length === 0) {
      return Response.json({
        sucesso: total,
        falhas: 0,
        total: total,
        status: 'completo'
      });
    } else {
      return Response.json({
        sucesso: sucessos,
        falhas: pendentes.length,
        total: total,
        status: 'falha_maxima_tentativa',
        itensNaoAtualizados: pendentes.slice(0, 10)
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ 
      error: error?.message || 'Erro',
      tipo: 'erro_servidor'
    }, { status: 500 });
  }
});