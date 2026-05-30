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

    // Mapa: id -> { numero, data_entrada, pecas }
    const mapaOV = {};
    for (const v of todasVendas) {
      if (v.id) mapaOV[v.id] = { numero: v.numero, data: (v.data_entrada || v.created_date || '').substring(0, 10), pecas: v.pecas || [] };
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

    // Mapa: estoque_id -> item
    const mapaEstoque = {};
    for (const e of todosEstoque) {
      if (e.id) mapaEstoque[e.id] = e;
    }

    console.log(`Total itens estoque: ${todosEstoque.length}`);

    // Construir índice de lookup: estoque_id -> [ { vendaId, numero, data, quantidade, valorUnitario } ]
    // Para cada venda, cada peca com estoque_id
    const indiceVendas = {}; // estoque_id -> array de referências de venda
    for (const v of todasVendas) {
      const ovData = (v.data_entrada || v.created_date || '').substring(0, 10);
      for (const p of (v.pecas || [])) {
        if (!p.estoque_id) continue;
        if (!indiceVendas[p.estoque_id]) indiceVendas[p.estoque_id] = [];
        indiceVendas[p.estoque_id].push({
          vendaId: v.id,
          numero: v.numero,
          data: ovData,
          quantidade: Number(p.quantidade || 1),
          valorUnitario: Number(p.valor_unitario || 0),
        });
      }
    }

    let itensAtualizados = 0;
    let movimentacoesCorrigidas = 0;

    for (const item of todosEstoque) {
      const historico = Array.isArray(item.historico) ? item.historico : [];
      if (historico.length === 0) continue;

      let modificado = false;
      const candidatos = indiceVendas[item.id] || [];

      const novoHistorico = historico.map(mov => {
        const tipoNorm = String(mov.tipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (tipoNorm !== 'saida') return mov;

        // PASSO 1: tem ordem_venda_id → atualizar numero se errado
        if (mov.ordem_venda_id) {
          const ov = mapaOV[mov.ordem_venda_id];
          if (ov && mov.ordem_venda_numero !== ov.numero) {
            modificado = true;
            movimentacoesCorrigidas++;
            return { ...mov, ordem_venda_numero: ov.numero };
          }
          return mov;
        }

        // PASSO 2: sem ordem_venda_id → tentar casar por data + quantidade + valor
        if (!candidatos.length) return mov;

        const movData = String(mov.data || '').substring(0, 10);
        const movQtd = Number(mov.quantidade || 0);
        const movValor = Number(mov.valor_unitario || 0);

        // Tentar match exato: data + quantidade + valor
        let match = candidatos.find(c =>
          c.data === movData &&
          c.quantidade === movQtd &&
          (movValor === 0 || Math.abs(c.valorUnitario - movValor) < 0.01)
        );

        // Se não encontrou, tentar só data + quantidade
        if (!match) {
          match = candidatos.find(c => c.data === movData && c.quantidade === movQtd);
        }

        // Se não encontrou, tentar só data
        if (!match) {
          match = candidatos.find(c => c.data === movData);
        }

        if (match) {
          modificado = true;
          movimentacoesCorrigidas++;
          return { ...mov, ordem_venda_id: match.vendaId, ordem_venda_numero: match.numero };
        }

        return mov;
      });

      if (modificado) {
        await base44.asServiceRole.entities.Estoque.update(item.id, { historico: novoHistorico });
        itensAtualizados++;
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