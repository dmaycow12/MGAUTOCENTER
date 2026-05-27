import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user;
  try { user = await base44.auth.me(); } catch(e) { user = null; }
  if (!user || user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let vendas;
  try {
    vendas = await base44.asServiceRole.entities.Vendas.list(null, 2000);
  } catch(e) {
    return Response.json({ error: 'Erro ao buscar vendas: ' + e.message }, { status: 500 });
  }
  let totalVendas = 0;
  let totalPecas = 0;

  for (const venda of vendas) {
    const pecas = venda.pecas || [];
    let alterou = false;
    const novasPecas = pecas.map(p => {
      if (p.codigo && p.codigo.toUpperCase().trim() === 'XX1') {
        alterou = true;
        totalPecas++;
        return { ...p, codigo: 'XX' };
      }
      return p;
    });

    if (alterou) {
      await base44.asServiceRole.entities.Vendas.update(venda.id, { pecas: novasPecas });
      totalVendas++;
    }
  }

  return Response.json({ ok: true, vendasAtualizadas: totalVendas, pecasCorrigidas: totalPecas });
});