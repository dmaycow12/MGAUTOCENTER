import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar todas as vendas (paginado)
    let todasVendas = [];
    let skip = 0;
    const limit = 100;
    while (true) {
      const lote = await base44.asServiceRole.entities.Vendas.list('-created_date', limit, skip);
      if (!lote || lote.length === 0) break;
      todasVendas = todasVendas.concat(lote);
      skip += limit;
      if (lote.length < limit) break;
    }

    // Buscar todos os serviços cadastrados
    const servicosCadastrados = await base44.asServiceRole.entities.Servico.list('-created_date', 500);
    
    // Mapear serviços por código ou descrição
    const mapaServicos = {};
    for (const s of servicosCadastrados) {
      if (s.codigo) {
        mapaServicos[s.codigo] = s;
      } else if (s.descricao) {
        const key = s.descricao.toUpperCase().trim();
        mapaServicos[key] = s;
      }
    }

    // Agregar histórico por serviço (código como chave, fallback descrição)
    const historicoMap = {};

    for (const venda of todasVendas.filter(v => v.status !== 'Orçamento')) {
      const servicos = venda.servicos || [];
      for (const s of servicos) {
        if (!s.descricao && !s.codigo) continue;
        const key = s.codigo || s.descricao.toUpperCase().trim();
        if (!historicoMap[key]) historicoMap[key] = [];
        historicoMap[key].push({
          data: venda.data_entrada || venda.created_date?.split('T')[0] || '',
          quantidade: Number(s.quantidade || 1),
          valor_unitario: Number(s.valor || 0),
          valor_total: Number(s.valor || 0) * Number(s.quantidade || 1),
          ordem_venda_numero: venda.numero || '',
          ordem_venda_id: venda.id || '',
          cliente: venda.cliente_nome || ''
        });
      }
    }

    let criados = 0;
    let atualizados = 0;

    // Para cada serviço com histórico, criar ou atualizar na entity Servico
    for (const [chave, historico] of Object.entries(historicoMap)) {
      // Ordenar histórico por data
      historico.sort((a, b) => a.data.localeCompare(b.data));
      
      // Calcular valor médio
      const valorTotal = historico.reduce((acc, h) => acc + h.valor_unitario, 0);
      const valorMedio = historico.length > 0 ? valorTotal / historico.length : 0;

      if (mapaServicos[chave]) {
        // Atualizar serviço existente
        await base44.asServiceRole.entities.Servico.update(mapaServicos[chave].id, {
          historico
        });
        atualizados++;
      } else {
        // Criar novo serviço com código
        await base44.asServiceRole.entities.Servico.create({
          codigo: chave,
          descricao: historico[0] ? (historico[0].desc_venda || chave) : chave,
          valor: Math.round(valorMedio * 100) / 100,
          historico
        });
        criados++;
      }
    }

    return Response.json({
      success: true,
      totalVendas: todasVendas.length,
      servicosProcessados: Object.keys(historicoMap).length,
      criados,
      atualizados
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});