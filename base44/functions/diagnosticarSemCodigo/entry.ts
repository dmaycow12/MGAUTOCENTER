import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user;
  try { user = await base44.auth.me(); } catch(e) { user = null; }
  if (!user || user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const vendas = await base44.asServiceRole.entities.Vendas.list(null, 2000);

  const resultado = [];

  for (const venda of vendas) {
    if (venda.status === 'Orçamento') continue;

    const pecasSemCodigo = (venda.pecas || []).filter(p => !p.codigo || !p.codigo.trim());
    const servicosSemCodigo = (venda.servicos || []).filter(s => !s.codigo || !s.codigo.trim());

    if (pecasSemCodigo.length > 0 || servicosSemCodigo.length > 0) {
      const totalPecasSem = pecasSemCodigo.reduce((acc, p) => acc + (Number(p.valor_total || 0) || Number(p.valor_unitario || 0) * Number(p.quantidade || 1)), 0);
      const totalServicosSem = servicosSemCodigo.reduce((acc, s) => acc + Number(s.valor || 0) * Number(s.quantidade || 1), 0);

      resultado.push({
        id: venda.id,
        numero: venda.numero,
        cliente: venda.cliente_nome,
        status: venda.status,
        data: venda.data_entrada || venda.created_date,
        pecasSemCodigo: pecasSemCodigo.map(p => ({ descricao: p.descricao, quantidade: p.quantidade, valor: p.valor_total || p.valor_unitario })),
        servicosSemCodigo: servicosSemCodigo.map(s => ({ descricao: s.descricao, quantidade: s.quantidade, valor: s.valor })),
        totalSemCodigo: totalPecasSem + totalServicosSem,
      });
    }
  }

  resultado.sort((a, b) => b.totalSemCodigo - a.totalSemCodigo);

  const totalReceita = resultado.reduce((acc, v) => acc + v.totalSemCodigo, 0);

  return Response.json({ vendas: resultado, totalVendas: resultado.length, totalReceita });
});