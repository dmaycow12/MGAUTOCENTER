import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const venda = body?.data;
    if (!venda?.id) {
      return Response.json({ error: 'Venda não encontrada no payload' }, { status: 400 });
    }

    // Busca os financeiros vinculados a esta venda
    const financeiros = await base44.asServiceRole.entities.Financeiro.filter(
      { ordem_venda_id: venda.id },
      '-created_date',
      50
    );

    if (!financeiros.length) {
      return Response.json({ success: true, updated: 0 });
    }

    let updated = 0;
    for (let i = 0; i < financeiros.length; i++) {
      const fin = financeiros[i];
      const desc = fin.descricao || '';
      const parcelaMatch = desc.match(/(\d+\/\d+)/);
      const parcelaStr = parcelaMatch ? parcelaMatch[1] : `${i + 1}/${financeiros.length}`;
      const veiculo = venda.veiculo_modelo ? ` — ${venda.veiculo_modelo}` : '';
      const placa = venda.veiculo_placa ? ` — ${venda.veiculo_placa}` : '';
      const nomeCliente = venda.cliente_nome_fantasia || venda.cliente_nome || 'CONSUMIDOR';
      const newDesc = `#${venda.numero} — ${nomeCliente}${veiculo}${placa} — ${parcelaStr}`;

      if (newDesc !== desc) {
        await base44.asServiceRole.entities.Financeiro.update(fin.id, { descricao: newDesc });
        updated++;
        if (i < financeiros.length - 1) await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log(`Venda #${venda.numero}: ${updated} financeiros atualizados`);
    return Response.json({ success: true, updated });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});