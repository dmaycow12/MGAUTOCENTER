import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list("-created_date", 1000);
    const todasVendas = await base44.asServiceRole.entities.Vendas.list("-created_date", 1000);

    const vendaIds = new Set(todasVendas.map(v => v.id));
    let atualizadas = 0;
    let detalhes = [];

    for (const nota of todasNotas) {
      // Processa notas emitidas/lançadas SEM venda
      if (nota.status === 'Rascunho' || nota.status === 'Cancelada') continue;
      if (nota.ordem_venda_id && vendaIds.has(nota.ordem_venda_id)) continue;

      let vendaSelecionada = null;

      // Estratégia 1: Por cliente_id + data próxima
      if (nota.cliente_id) {
        const candidatas = todasVendas.filter(v => v.cliente_id === nota.cliente_id);
        if (candidatas.length > 0) {
          const dataNota = new Date(nota.data_emissao || '');
          // Ordena por proximidade de data
          candidatas.sort((a, b) => {
            const dataA = new Date(a.data_entrada || '');
            const dataB = new Date(b.data_entrada || '');
            return Math.abs(dataA - dataNota) - Math.abs(dataB - dataNota);
          });
          vendaSelecionada = candidatas[0];
        }
      }

      // Estratégia 2: Por cliente_nome + data + valor (tolerância 5%)
      if (!vendaSelecionada && nota.cliente_nome && nota.data_emissao && nota.valor_total) {
        const dataNota = new Date(nota.data_emissao);
        const valorNota = Number(nota.valor_total);
        const candidatas = todasVendas.filter(v => {
          if (!v.cliente_nome || !v.data_entrada) return false;
          const nomeMatch = v.cliente_nome.toUpperCase() === nota.cliente_nome.toUpperCase();
          const dataVenda = new Date(v.data_entrada);
          const diasDiff = Math.abs((dataNota - dataVenda) / (1000 * 60 * 60 * 24));
          const valorMatch = Math.abs(Number(v.valor_total) - valorNota) <= valorNota * 0.05;
          return nomeMatch && diasDiff <= 7 && valorMatch;
        });
        if (candidatas.length > 0) vendaSelecionada = candidatas[0];
      }

      // Estratégia 3: Por cliente_nome + valor (tolerância 5%)
      if (!vendaSelecionada && nota.cliente_nome && nota.valor_total) {
        const valorNota = Number(nota.valor_total);
        const candidatas = todasVendas.filter(v => {
          if (!v.cliente_nome) return false;
          const nomeMatch = v.cliente_nome.toUpperCase() === nota.cliente_nome.toUpperCase();
          const valorMatch = Math.abs(Number(v.valor_total) - valorNota) <= valorNota * 0.05;
          return nomeMatch && valorMatch;
        });
        if (candidatas.length > 0) vendaSelecionada = candidatas[0];
      }

      // Estratégia 4: Por cliente_nome (match exato)
      if (!vendaSelecionada && nota.cliente_nome) {
        const candidatas = todasVendas.filter(v =>
          v.cliente_nome && v.cliente_nome.toUpperCase() === nota.cliente_nome.toUpperCase()
        );
        if (candidatas.length > 0) vendaSelecionada = candidatas[0];
      }

      if (vendaSelecionada) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          ordem_venda_id: vendaSelecionada.id,
          cliente_id: vendaSelecionada.cliente_id || nota.cliente_id,
        });
        atualizadas++;
        detalhes.push({
          notaNumero: nota.numero,
          notaTipo: nota.tipo,
          vendaNumero: vendaSelecionada.numero,
          cliente: nota.cliente_nome,
          sucesso: true,
        });
      } else {
        detalhes.push({
          notaNumero: nota.numero,
          notaTipo: nota.tipo,
          cliente: nota.cliente_nome,
          sucesso: false,
          motivo: 'Nenhuma venda correspondente encontrada',
        });
      }
    }

    return Response.json({
      sucesso: true,
      atualizadas,
      totalProcessadas: detalhes.length,
      detalhes: detalhes.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});