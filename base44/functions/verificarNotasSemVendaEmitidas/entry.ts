import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list("-created_date", 1000);
    const vendaIds = new Set((await base44.asServiceRole.entities.Vendas.list("-created_date", 1000)).map(v => v.id));

    const notasSemVenda = todasNotas.filter(n => !n.ordem_venda_id || !vendaIds.has(n.ordem_venda_id));
    
    // Agrupa por status
    const porStatus = {};
    for (const nota of notasSemVenda) {
      if (!porStatus[nota.status]) porStatus[nota.status] = [];
      porStatus[nota.status].push({
        numero: nota.numero || '(vazio)',
        tipo: nota.tipo,
        cliente: nota.cliente_nome,
        valor: nota.valor_total,
      });
    }

    return Response.json({
      totalSemVenda: notasSemVenda.length,
      porStatus,
      amostraCompleta: notasSemVenda.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});