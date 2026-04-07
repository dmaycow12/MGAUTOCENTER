import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list("-created_date", 1000);
    const todasVendas = await base44.asServiceRole.entities.Vendas.list("-created_date", 1000);

    let restauradas = 0;
    const detalhes = [];

    // Notas EMITIDAS (não importadas)
    const notasVenda = todasNotas.filter(n => 
      ['Emitida', 'Lançada', 'Processando', 'Aguardando Sefin Nacional', 'Erro de Sincronia Governamental'].includes(n.status)
    );

    console.log(`Processando ${notasVenda.length} notas emitidas`);

    for (const nota of notasVenda) {
      if (!nota.cliente_nome || !nota.valor_total) continue;

      const valorNota = Number(nota.valor_total);
      let vendaSelecionada = null;

      // Busca por cliente_nome + valor (tolerância 10%)
      let candidatas = todasVendas.filter(v => {
        if (!v.cliente_nome) return false;
        const nomeMatch = v.cliente_nome.toUpperCase().includes(nota.cliente_nome.toUpperCase()) || 
                          nota.cliente_nome.toUpperCase().includes(v.cliente_nome.toUpperCase());
        const valorDiff = Math.abs(Number(v.valor_total) - valorNota);
        const tolerancia = Math.max(valorNota * 0.1, 50); // 10% ou R$50
        const valorMatch = valorDiff <= tolerancia;
        return nomeMatch && valorMatch;
      });

      if (candidatas.length > 0) {
        // Ordena por proximidade de valor
        candidatas.sort((a, b) => 
          Math.abs(Number(a.valor_total) - valorNota) - Math.abs(Number(b.valor_total) - valorNota)
        );
        vendaSelecionada = candidatas[0];
      }

      if (vendaSelecionada) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          ordem_venda_id: vendaSelecionada.id,
          cliente_id: vendaSelecionada.cliente_id,
        });
        restauradas++;
        detalhes.push({
          nf: `${nota.tipo} #${nota.numero || '(sem número)'}`,
          venda: `#${vendaSelecionada.numero}`,
          cliente: nota.cliente_nome.substring(0, 30),
          nfValor: valorNota.toFixed(2),
          vendaValor: Number(vendaSelecionada.valor_total).toFixed(2),
          match: 'OK',
        });
      }
    }

    return Response.json({
      sucesso: true,
      restauradas,
      totalProcessadas: notasVenda.length,
      detalhes,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});