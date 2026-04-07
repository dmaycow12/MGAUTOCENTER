import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar notas emitidas (não rascunho)
    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list("-created_date", 1000);
    const notasEmitidas = todasNotas.filter(n => n.status !== 'Rascunho' && n.status !== 'Cancelada');
    
    const todasVendas = await base44.asServiceRole.entities.Vendas.list("-created_date", 1000);

    // Analisar problemas
    const notasSemVenda = notasEmitidas.filter(n => !n.ordem_venda_id);
    const notasComVendaInvalida = notasEmitidas.filter(n => n.ordem_venda_id && !todasVendas.find(v => v.id === n.ordem_venda_id));
    
    return Response.json({
      totalNotas: notasEmitidas.length,
      totalVendas: todasVendas.length,
      semVenda: notasSemVenda.length,
      comVendaInvalida: notasComVendaInvalida.length,
      exemplosSemVenda: notasSemVenda.slice(0, 5).map(n => ({
        id: n.id,
        numero: n.numero,
        tipo: n.tipo,
        status: n.status,
        cliente_id: n.cliente_id,
        cliente_nome: n.cliente_nome,
        data_emissao: n.data_emissao,
        valor_total: n.valor_total,
      })),
      exemplosComVendaInvalida: notasComVendaInvalida.slice(0, 5).map(n => ({
        id: n.id,
        numero: n.numero,
        ordem_venda_id: n.ordem_venda_id,
        cliente_nome: n.cliente_nome,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});