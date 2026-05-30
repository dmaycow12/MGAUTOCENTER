import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let todosEstoque = [];
    let skip = 0;
    while (true) {
      const lote = await base44.asServiceRole.entities.Estoque.list('-created_date', 200, skip);
      if (!lote || lote.length === 0) break;
      todosEstoque = todosEstoque.concat(lote);
      skip += 200;
      if (lote.length < 200) break;
    }

    console.log(`Total itens: ${todosEstoque.length}`);

    let itensAtualizados = 0;
    let movimentacoesRemovidas = 0;

    for (const item of todosEstoque) {
      const historico = Array.isArray(item.historico) ? item.historico : [];
      if (historico.length === 0) continue;

      const semSaidas = historico.filter(mov => {
        const t = String(mov.tipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return t !== 'saida';
      });

      const removidas = historico.length - semSaidas.length;
      if (removidas > 0) {
        await base44.asServiceRole.entities.Estoque.update(item.id, { historico: semSaidas });
        itensAtualizados++;
        movimentacoesRemovidas += removidas;
        await new Promise(r => setTimeout(r, 30));
      }
    }

    return Response.json({
      success: true,
      itensAtualizados,
      movimentacoesRemovidas,
      mensagem: `${movimentacoesRemovidas} saídas removidas de ${itensAtualizados} produtos.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});