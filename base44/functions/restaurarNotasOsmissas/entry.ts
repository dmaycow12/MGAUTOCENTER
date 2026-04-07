import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar notas sem venda vinculada
    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list("-created_date", 500);
    const notasSemVenda = todasNotas.filter(n => !n.ordem_venda_id && n.cliente_id);

    // Buscar todas as vendas
    const todasVendas = await base44.asServiceRole.entities.Vendas.list("-created_date", 500);

    let atualizadas = 0;
    const resultados = [];

    for (const nota of notasSemVenda) {
      // Buscar venda do mesmo cliente (mais recente)
      const vendasDoCliente = todasVendas.filter(v => v.cliente_id === nota.cliente_id);
      if (vendasDoCliente.length > 0) {
        const vendaMaisRecente = vendasDoCliente[0]; // já está ordenada por -created_date
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          ordem_venda_id: vendaMaisRecente.id,
        });
        atualizadas++;
        resultados.push({
          notaId: nota.id,
          notaNumero: nota.numero,
          vendaId: vendaMaisRecente.id,
          vendaNumero: vendaMaisRecente.numero,
          sucesso: true,
        });
      } else {
        resultados.push({
          notaId: nota.id,
          notaNumero: nota.numero,
          sucesso: false,
          motivo: 'Nenhuma venda encontrada para este cliente',
        });
      }
    }

    return Response.json({
      sucesso: true,
      total: notasSemVenda.length,
      atualizadas,
      detalhes: resultados.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});