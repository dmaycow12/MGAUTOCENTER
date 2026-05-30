import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar todas as vendas paginado
    let todasVendas = [];
    let skip = 0;
    while (true) {
      const lote = await base44.asServiceRole.entities.Vendas.list('-created_date', 200, skip);
      if (!lote || lote.length === 0) break;
      todasVendas = todasVendas.concat(lote);
      skip += 200;
      if (lote.length < 200) break;
    }

    // Mapa: id -> numero atual da OV
    const mapaOV = {};
    for (const v of todasVendas) {
      if (v.id && v.numero) mapaOV[v.id] = v.numero;
    }

    console.log(`Total OVs carregadas: ${todasVendas.length}`);

    // Buscar todos os itens de estoque paginado
    let todosEstoque = [];
    skip = 0;
    while (true) {
      const lote = await base44.asServiceRole.entities.Estoque.list('-created_date', 200, skip);
      if (!lote || lote.length === 0) break;
      todosEstoque = todosEstoque.concat(lote);
      skip += 200;
      if (lote.length < 200) break;
    }

    console.log(`Total itens estoque: ${todosEstoque.length}`);

    let itensAtualizados = 0;
    let movimentacoesCorrigidas = 0;

    for (const item of todosEstoque) {
      const historico = Array.isArray(item.historico) ? item.historico : [];
      if (historico.length === 0) continue;

      let modificado = false;
      const novoHistorico = historico.map(mov => {
        // Só corrige movimentos que têm ordem_venda_id
        if (!mov.ordem_venda_id) return mov;

        const numeroCorreto = mapaOV[mov.ordem_venda_id];
        if (!numeroCorreto) return mov; // OV não encontrada (pode ter sido deletada)

        // Verifica se precisa corrigir
        if (mov.ordem_venda_numero !== numeroCorreto) {
          modificado = true;
          movimentacoesCorrigidas++;
          return { ...mov, ordem_venda_numero: numeroCorreto };
        }
        return mov;
      });

      if (modificado) {
        await base44.asServiceRole.entities.Estoque.update(item.id, { historico: novoHistorico });
        itensAtualizados++;
        // Pequena pausa para não sobrecarregar
        await new Promise(r => setTimeout(r, 50));
      }
    }

    return Response.json({
      success: true,
      totalOVs: todasVendas.length,
      totalEstoque: todosEstoque.length,
      itensAtualizados,
      movimentacoesCorrigidas,
      mensagem: `${movimentacoesCorrigidas} movimentações corrigidas em ${itensAtualizados} produtos.`
    });

  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});