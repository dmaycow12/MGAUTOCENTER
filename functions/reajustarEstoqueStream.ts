import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const arredondarVendaParaCinco = (valor) => {
  return Math.ceil(valor / 5) * 5;
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
      return Response.json({ error: 'Nenhum item fornecido' }, { status: 400 });
    }

    let sucessos = 0;
    let falhas = 0;
    const erros = [];

    // Processa sequencialmente com retry
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let novoPreco = reajusteTipo === "percentual"
        ? Number(item.valor_custo || 0) * (1 + Number(reajusteValor) / 100)
        : Number(item.valor_venda || 0) + Number(reajusteValor);
      novoPreco = arredondarVendaParaCinco(Math.max(0, novoPreco));
      
      let retentativas = 3;
      let atualizado = false;
      let ultimoErro = null;
      
      while (retentativas > 0 && !atualizado) {
        try {
          await base44.entities.Estoque.update(item.id, { valor_venda: novoPreco });
          sucessos++;
          atualizado = true;
        } catch (err) {
          ultimoErro = err?.message || 'Erro desconhecido';
          retentativas--;
          if (retentativas > 0) {
            await sleep(200);
          }
        }
      }
      
      if (!atualizado) {
        falhas++;
        erros.push({
          id: item.id,
          descricao: item.descricao,
          erro: ultimoErro
        });
      }
      
      // Pausa a cada 10 items para evitar rate limit
      if ((i + 1) % 10 === 0) {
        await sleep(300);
      }
    }

    return Response.json({ 
      sucesso: sucessos,
      total: items.length,
      falhas: falhas,
      erros: erros.length > 0 ? erros.slice(0, 5) : null
    });
  } catch (error) {
    console.error('Erro em reajustarEstoqueStream:', error.message);
    return Response.json({ error: String(error.message) }, { status: 500 });
  }
});