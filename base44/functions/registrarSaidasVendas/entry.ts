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

    console.log(`Total vendas: ${todasVendas.length}`);

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

    console.log(`Total estoque: ${todosEstoque.length}`);

    // Mapa: estoque_id -> item (com historico mutável)
    const mapaEstoque = {};
    for (const e of todosEstoque) {
      mapaEstoque[e.id] = {
        ...e,
        historico: Array.isArray(e.historico) ? [...e.historico] : []
      };
    }

    // Indexar movimentos existentes por estoque_id + ordem_venda_id para evitar duplicatas
    // (já foi limpo antes, mas por segurança)
    const movExistentes = {}; // `${estoque_id}_${venda_id}` -> true
    for (const e of todosEstoque) {
      for (const mov of (e.historico || [])) {
        if (mov.ordem_venda_id) {
          movExistentes[`${e.id}_${mov.ordem_venda_id}`] = true;
        }
      }
    }

    let movimentacoesRegistradas = 0;
    let vendasProcessadas = 0;

    // Para cada venda (exceto Orçamento)
    for (const venda of todasVendas) {
      if (venda.status === 'Orçamento') continue;

      const pecas = Array.isArray(venda.pecas) ? venda.pecas : [];
      const data = (venda.data_entrada || venda.created_date || '').substring(0, 10);

      let temPeca = false;

      for (const peca of pecas) {
        if (!peca.estoque_id) continue;

        // Pular produto XX (coringa)
        const codigo = String(peca.codigo || '').toUpperCase().trim();
        const descricao = String(peca.descricao || '').toUpperCase().trim();
        if (codigo === 'XX' || descricao.startsWith('XX')) continue;

        const item = mapaEstoque[peca.estoque_id];
        if (!item) continue;

        // Verificar se já existe movimento para esta venda neste produto
        const chave = `${peca.estoque_id}_${venda.id}`;
        if (movExistentes[chave]) continue;

        // Registrar movimento de saída
        item.historico.push({
          tipo: 'saida',
          data: data ? `${data}T00:00:00.000Z` : new Date().toISOString(),
          quantidade: Number(peca.quantidade || 1),
          valor_unitario: Number(peca.valor_unitario || 0),
          ordem_venda_id: venda.id,
          ordem_venda_numero: venda.numero || '',
          observacao: ''
        });

        movExistentes[chave] = true;
        movimentacoesRegistradas++;
        temPeca = true;
      }

      if (temPeca) vendasProcessadas++;
    }

    // Salvar apenas os itens modificados
    const itemsParaSalvar = todosEstoque.filter(e => {
      const atual = mapaEstoque[e.id];
      return atual && atual.historico.length > (e.historico || []).length;
    });

    console.log(`Items para salvar: ${itemsParaSalvar.length}`);

    // Salvar em lotes de 5 com pausa maior entre lotes
    let salvos = 0;
    const LOTE = 5;
    for (let i = 0; i < itemsParaSalvar.length; i += LOTE) {
      const lote = itemsParaSalvar.slice(i, i + LOTE);
      await Promise.all(lote.map(e => {
        const item = mapaEstoque[e.id];
        return base44.asServiceRole.entities.Estoque.update(e.id, { historico: item.historico });
      }));
      salvos += lote.length;
      if (i + LOTE < itemsParaSalvar.length) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    return Response.json({
      success: true,
      totalVendas: todasVendas.length,
      vendasComPecas: vendasProcessadas,
      movimentacoesRegistradas,
      produtosSalvos: salvos,
      mensagem: `${movimentacoesRegistradas} saídas registradas em ${salvos} produtos, de ${vendasProcessadas} vendas.`
    });

  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});