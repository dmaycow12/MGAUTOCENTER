import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, retries = 5, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      const wait = delayMs * Math.pow(2, i);
      await sleep(wait);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const saveProgress = async (msg, current, total, done = false) => {
      try {
        const rows = await base44.asServiceRole.entities.Configuracao.filter({ chave: "financeiro_progress" }, "-created_date", 1);
        const data = { chave: "financeiro_progress", valor: JSON.stringify({ msg, current, total, done, ts: Date.now() }) };
        if (rows.length > 0) await base44.asServiceRole.entities.Configuracao.update(rows[0].id, data);
        else await base44.asServiceRole.entities.Configuracao.create(data);
      } catch (_) {}
    };

    await saveProgress("Carregando vendas...", 0, 0, false);

    // Busca todas as vendas
    let allVendas = [];
    let skip = 0;
    while (true) {
      const batch = await withRetry(() => base44.asServiceRole.entities.Vendas.list('-created_date', 200, skip));
      if (!batch || !batch.length) break;
      allVendas = [...allVendas, ...batch];
      skip += 200;
      if (batch.length < 200) break;
      await sleep(500);
    }

    // Ordena por número CRESCENTE para processar as mais antigas (1-225) primeiro
    allVendas.sort((a, b) => {
      const na = parseInt(a.numero) || 0;
      const nb = parseInt(b.numero) || 0;
      return na - nb;
    });

    await saveProgress("Carregando financeiros existentes...", 0, allVendas.length, false);

    // Busca todos os financeiros existentes
    let allFin = [];
    let skipFin = 0;
    while (true) {
      const batch = await withRetry(() => base44.asServiceRole.entities.Financeiro.list('-created_date', 500, skipFin));
      if (!batch || !batch.length) break;
      allFin = [...allFin, ...batch];
      skipFin += 500;
      if (batch.length < 500) break;
      await sleep(500);
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
    let vendasPuladas = 0;

    for (let vi = 0; vi < allVendas.length; vi++) {
      const venda = allVendas[vi];
      const parcelas = venda.parcelas_detalhes || [];
      if (!parcelas.length) continue;

      const finVenda = finMap[venda.id] || [];
      const totalParcelas = parcelas.length;

      // Se já tem o mesmo número de financeiros que parcelas, pula tudo
      if (finVenda.length >= totalParcelas) {
        vendasPuladas++;
        continue;
      }

      let changed = false;
      const parcelasAtualizadas = [...parcelas];

      for (let i = 0; i < parcelasAtualizadas.length; i++) {
        // Verificação 1: parcela já tem financeiro_id salvo
        if (parcelasAtualizadas[i].financeiro_id) continue;

        // Verificação 2: existe financeiro para esta venda neste índice (por posição)
        const finExistente = finVenda[i];
        if (finExistente) {
          parcelasAtualizadas[i] = { ...parcelasAtualizadas[i], financeiro_id: finExistente.id, financeiro_status: finExistente.status };
          changed = true;
          continue;
        }

        // Criar novo lançamento
        await sleep(400);
        const fin = await withRetry(() => base44.asServiceRole.entities.Financeiro.create({
          tipo: "Receita",
          categoria: "Ordem de Venda",
          descricao: `Venda #${venda.numero} — ${venda.cliente_nome || ""} — Parcela ${i+1}/${totalParcelas}`,
          valor: parcelasAtualizadas[i].valor || 0,
          data_vencimento: parcelasAtualizadas[i].vencimento,
          status: "Pendente",
          forma_pagamento: parcelasAtualizadas[i].forma_pagamento || "A Combinar",
          ordem_venda_id: venda.id,
          cliente_id: venda.cliente_id || "",
        }));
        parcelasAtualizadas[i] = { ...parcelasAtualizadas[i], financeiro_id: fin.id, financeiro_status: "Pendente" };
        finVenda.push(fin);
        financeirosCriados++;
        changed = true;
      }

      if (changed) {
        await sleep(300);
        await withRetry(() => base44.asServiceRole.entities.Vendas.update(venda.id, { parcelas_detalhes: parcelasAtualizadas }));
        vendasAtualizadas++;
      }

      if (vi % 5 === 0 || vi === allVendas.length - 1) {
        await saveProgress(
          `Venda #${venda.numero} (${vi + 1}/${allVendas.length}) — ${financeirosCriados} criados, ${vendasPuladas} já tinham`,
          vi + 1,
          allVendas.length,
          false
        );
      }
    }

    await saveProgress(`Concluído! ${financeirosCriados} lançamentos criados, ${vendasPuladas} vendas já estavam ok.`, allVendas.length, allVendas.length, true);

    return Response.json({
      success: true,
      financeiros_criados: financeirosCriados,
      vendas_atualizadas: vendasAtualizadas,
      vendas_puladas: vendasPuladas,
      total_vendas: allVendas.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});