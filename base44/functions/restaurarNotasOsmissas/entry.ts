import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar TODAS as notas (incluindo as com ordem_venda_id que pode estar quebrado)
    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list("-created_date", 1000);
    const todasVendas = await base44.asServiceRole.entities.Vendas.list("-created_date", 1000);

    let atualizadas = 0;
    const resultados = [];
    const vendaIds = new Set(todasVendas.map(v => v.id));

    for (const nota of todasNotas) {
      let precisaAtualizar = false;
      let novaVendaId = null;

      // Caso 1: Nota sem ordem_venda_id
      if (!nota.ordem_venda_id && nota.cliente_id) {
        precisaAtualizar = true;
      }
      // Caso 2: Nota com ordem_venda_id que aponta para venda que não existe mais
      else if (nota.ordem_venda_id && !vendaIds.has(nota.ordem_venda_id)) {
        precisaAtualizar = true;
      }

      if (precisaAtualizar && nota.cliente_id) {
        // Buscar melhor match: venda do mesmo cliente, data proxima
        const vendasDoCliente = todasVendas.filter(v => v.cliente_id === nota.cliente_id);
        
        if (vendasDoCliente.length > 0) {
          // Prioridade: venda mais recente com valor próximo, senão a mais recente mesmo
          let vendaSelecionada = vendasDoCliente[0];
          
          if (nota.valor_total && nota.data_emissao) {
            const notaDate = new Date(nota.data_emissao);
            const ventasProximas = vendasDoCliente.filter(v => {
              const vDate = new Date(v.data_entrada);
              const daysDiff = Math.abs((notaDate - vDate) / (1000 * 60 * 60 * 24));
              return daysDiff <= 30 && Math.abs(Number(v.valor_total || 0) - Number(nota.valor_total || 0)) < 1000;
            });
            if (ventasProximas.length > 0) {
              vendaSelecionada = ventasProximas[0];
            }
          }

          novaVendaId = vendaSelecionada.id;
          await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
            ordem_venda_id: novaVendaId,
          });
          atualizadas++;
          resultados.push({
            notaId: nota.id,
            notaNumero: nota.numero,
            notaData: nota.data_emissao,
            vendaId: novaVendaId,
            vendaNumero: vendaSelecionada.numero,
            sucesso: true,
          });
        }
      }
    }

    return Response.json({
      sucesso: true,
      totalNotas: todasNotas.length,
      totalVendas: todasVendas.length,
      atualizadas,
      detalhes: resultados.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});