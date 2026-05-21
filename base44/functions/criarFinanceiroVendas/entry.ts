import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Busca todas as vendas
    let allVendas = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Vendas.list('-created_date', 200, skip);
      if (!batch || !batch.length) break;
      allVendas = [...allVendas, ...batch];
      skip += 200;
      if (batch.length < 200) break;
    }

    // Busca todos os financeiros existentes indexados por ordem_venda_id
    let allFin = [];
    let skipFin = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Financeiro.list('-created_date', 500, skipFin);
      if (!batch || !batch.length) break;
      allFin = [...allFin, ...batch];
      skipFin += 500;
      if (batch.length < 500) break;
    }

    // Mapa: ordem_venda_id -> array de financeiros
    const finMap = {};
    for (const f of allFin) {
      if (!f.ordem_venda_id) continue;
      if (!finMap[f.ordem_venda_id]) finMap[f.ordem_venda_id] = [];
      finMap[f.ordem_venda_id].push(f);
    }

    let financeirosCriados = 0;
    let vendasAtualizadas = 0;

    for (const venda of allVendas) {
      const parcelas = venda.parcelas_detalhes || [];
      if (!parcelas.length) continue;

      let changed = false;
      const parcelasAtualizadas = [...parcelas];
      const finVenda = finMap[venda.id] || [];

      for (let i = 0; i < parcelasAtualizadas.length; i++) {
        const descParcela = `Parcela ${i+1}/${parcelasAtualizadas.length}`;

        // Verifica se já existe lançamento para esta parcela
        const jaExiste = parcelasAtualizadas[i].financeiro_id
          || finVenda.find(f => f.descricao?.includes(descParcela));

        if (!jaExiste) {
          // Pausa para evitar rate limit
          await new Promise(r => setTimeout(r, 80));
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
          // Adiciona ao mapa para evitar duplicata na mesma execução
          finVenda.push(fin);
          financeirosCriados++;
          changed = true;
        } else if (!parcelasAtualizadas[i].financeiro_id && jaExiste?.id) {
          // Recupera o financeiro_id se estava faltando na parcela
          parcelasAtualizadas[i] = { ...parcelasAtualizadas[i], financeiro_id: jaExiste.id };
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