import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('Buscando vendas e financeiros...');
    const [vendas, financeiros] = await Promise.all([
      base44.asServiceRole.entities.Vendas.list('-created_date', 9999),
      base44.asServiceRole.entities.Financeiro.filter({ ordem_venda_id: { $exists: true, $ne: null } }, '-created_date', 9999),
    ]);
    console.log(`Vendas: ${vendas.length}, Financeiros: ${financeiros.length}`);

    const vendaMap = {};
    for (const v of vendas) {
      if (v.id && v.numero) vendaMap[v.id] = v;
    }

    const toUpdate = [];
    for (const fin of financeiros) {
      const venda = vendaMap[fin.ordem_venda_id];
      if (!venda) continue;

      const desc = fin.descricao || '';
      const parcelaMatch = desc.match(/Parcela (\d+\/\d+)/i);
      const parcelaStr = parcelaMatch ? parcelaMatch[1] : '1/1';
      const newDesc = `Venda #${venda.numero} — ${venda.cliente_nome || 'CONSUMIDOR'} — Parcela ${parcelaStr}`;

      if (newDesc !== desc) {
        toUpdate.push({ id: fin.id, descricao: newDesc });
      }
    }

    console.log(`Registros a atualizar: ${toUpdate.length}`);

    // Sequential updates with delay to avoid rate limit
    for (let i = 0; i < toUpdate.length; i++) {
      await base44.asServiceRole.entities.Financeiro.update(toUpdate[i].id, { descricao: toUpdate[i].descricao });
      if ((i + 1) % 10 === 0) console.log(`Atualizado ${i + 1}/${toUpdate.length}`);
      await new Promise(r => setTimeout(r, 150));
    }

    return Response.json({ success: true, updated: toUpdate.length, total: financeiros.length });
  } catch (error) {
    console.error('Erro:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});