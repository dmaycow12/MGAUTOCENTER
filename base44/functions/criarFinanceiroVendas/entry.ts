import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const saveProgress = async (msg, current, total, done = false) => {
      try {
        await base44.asServiceRole.entities.Configuracao.filter({ chave: "financeiro_progress" }, "-created_date", 1).then(async (rows) => {
          const data = { chave: "financeiro_progress", valor: JSON.stringify({ msg, current, total, done, ts: Date.now() }) };
          if (rows.length > 0) await base44.asServiceRole.entities.Configuracao.update(rows[0].id, data);
          else await base44.asServiceRole.entities.Configuracao.create(data);
        });
      } catch (_) {}
    };

    await saveProgress("Carregando vendas...", 0, 0, false);

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

    await saveProgress("Carregando financeiros existentes...", 0, allVendas.length, false);

    // Busca todos os financeiros existentes
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

    for (let vi = 0; vi < allVendas.length; vi++) {
      const venda = allVendas[vi];
      const parcelas = venda.parcelas_detalhes || [];
      if (!parcelas.length) continue;

      let changed = false;
      const parcelasAtualizadas = [...parcelas];
      const finVenda = finMap[venda.id] || [];

      for (let i = 0; i < parcelasAtualizadas.length; i++) {
        const descParcela = `Parcela ${i+1}/${parcelasAtualizadas.length}`;
        const jaExiste = parcelasAtualizadas[i].financeiro_id
          || finVenda.find(f => f.descricao?.includes(descParcela));

        if (!jaExiste) {
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
          parcelasAtualizadas[i] = { ...parcelasAtualizadas[i], financeiro_id: fin.id, financeiro_status: "Pendente" };
          finVenda.push(fin);
          financeirosCriados++;
          changed = true;
        } else if (!parcelasAtualizadas[i].financeiro_id && jaExiste?.id) {
          parcelasAtualizadas[i] = { ...parcelasAtualizadas[i], financeiro_id: jaExiste.id };
          changed = true;
        }
      }

      if (changed) {
        await base44.asServiceRole.entities.Vendas.update(venda.id, { parcelas_detalhes: parcelasAtualizadas });
        vendasAtualizadas++;
      }

      // Atualiza progresso a cada 10 vendas
      if (vi % 10 === 0 || vi === allVendas.length - 1) {
        await saveProgress(
          `Processando venda ${vi + 1} de ${allVendas.length} — ${financeirosCriados} lançamentos criados`,
          vi + 1,
          allVendas.length,
          false
        );
      }
    }

    await saveProgress(`Concluído! ${financeirosCriados} lançamentos criados em ${vendasAtualizadas} vendas.`, allVendas.length, allVendas.length, true);

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