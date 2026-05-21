import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let allVendas = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Vendas.list('-created_date', 200, skip);
      if (!batch || !batch.length) break;
      allVendas = [...allVendas, ...batch];
      skip += 200;
      if (batch.length < 200) break;
    }

    let financeirosCriados = 0;
    let vendasAtualizadas = 0;

    for (const venda of allVendas) {
      const parcelas = venda.parcelas_detalhes || [];
      if (!parcelas.length) continue;

      let changed = false;
      const parcelasAtualizadas = [...parcelas];

      for (let i = 0; i < parcelasAtualizadas.length; i++) {
        if (!parcelasAtualizadas[i].financeiro_id) {
          const fin = await base44.asServiceRole.entities.Financeiro.create({
            tipo: "Receita",
            categoria: "Ordem de Venda",
            descricao: `Venda #${venda.numero} — ${venda.cliente_nome || ""} — Parcela ${i+1}/${parcelasAtualizadas.length}`,
            valor: parcelasAtualizadas[i].valor || 0,
            data_vencimento: parcelasAtualizadas[i].vencimento,
            status: "Pendente",
            forma_pagamento: parcelasAtualizadas[i].forma_pagamento || "A Combinar",
            ordem_venda_id: venda.id,
            cliente_id: venda.cliente_id || "",
          });
          parcelasAtualizadas[i] = {
            ...parcelasAtualizadas[i],
            financeiro_id: fin.id,
            financeiro_status: "Pendente"
          };
          financeirosCriados++;
          changed = true;
        }
      }

      if (changed) {
        await base44.asServiceRole.entities.Vendas.update(venda.id, { parcelas_detalhes: parcelasAtualizadas });
        vendasAtualizadas++;
      }
    }

    return Response.json({
      success: true,
      financeiros_criados: financeirosCriados,
      vendas_atualizadas: vendasAtualizadas,
      total_vendas: allVendas.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});