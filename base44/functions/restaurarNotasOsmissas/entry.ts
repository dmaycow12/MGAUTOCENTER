import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list("-created_date", 1000);
    const todasVendas = await base44.asServiceRole.entities.Vendas.list("-created_date", 1000);
    const todosClientes = await base44.asServiceRole.entities.Cliente.list("-created_date", 500);

    let atualizadas = 0;
    const resultados = [];
    const vendaIds = new Set(todasVendas.map(v => v.id));

    for (const nota of todasNotas) {
      // Só processa notas emitidas sem venda
      if (nota.status === 'Rascunho' || nota.status === 'Cancelada') continue;
      if (nota.ordem_venda_id && vendaIds.has(nota.ordem_venda_id)) continue;

      let vendaSelecionada = null;

      // Estratégia 1: Por cliente_id
      if (nota.cliente_id) {
        const vendasDoCliente = todasVendas.filter(v => v.cliente_id === nota.cliente_id);
        if (vendasDoCliente.length > 0) {
          vendaSelecionada = vendasDoCliente[0];
        }
      }

      // Estratégia 2: Por cliente_nome (match exato com clientes cadastrados)
      if (!vendaSelecionada && nota.cliente_nome) {
        const clienteMatch = todosClientes.find(c => 
          c.nome && c.nome.toUpperCase() === nota.cliente_nome.toUpperCase()
        );
        if (clienteMatch) {
          const vendasDoCliente = todasVendas.filter(v => v.cliente_id === clienteMatch.id);
          if (vendasDoCliente.length > 0) {
            vendaSelecionada = vendasDoCliente[0];
          }
        }
      }

      // Estratégia 3: Por cliente_nome (match parcial)
      if (!vendaSelecionada && nota.cliente_nome) {
        const nomeNota = nota.cliente_nome.toUpperCase().split(' ')[0]; // Primeiro nome
        const vendasProximas = todasVendas.filter(v => 
          v.cliente_nome && v.cliente_nome.toUpperCase().includes(nomeNota)
        );
        if (vendasProximas.length > 0) {
          vendaSelecionada = vendasProximas[0];
        }
      }

      // Estratégia 4: Por data e valor (se tudo mais falhar)
      if (!vendaSelecionada && nota.data_emissao && nota.valor_total) {
        const notaDate = new Date(nota.data_emissao);
        const vendasProximas = todasVendas.filter(v => {
          if (!v.data_entrada) return false;
          const vDate = new Date(v.data_entrada);
          const daysDiff = Math.abs((notaDate - vDate) / (1000 * 60 * 60 * 24));
          const valueDiff = Math.abs(Number(v.valor_total || 0) - Number(nota.valor_total || 0));
          return daysDiff <= 7 && valueDiff < 100;
        });
        if (vendasProximas.length > 0) {
          vendaSelecionada = vendasProximas[0];
        }
      }

      if (vendaSelecionada) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          ordem_venda_id: vendaSelecionada.id,
          cliente_id: vendaSelecionada.cliente_id, // Sincroniza cliente_id também
        });
        atualizadas++;
        resultados.push({
          notaNumero: nota.numero,
          vendaNumero: vendaSelecionada.numero,
          sucesso: true,
        });
      }
    }

    return Response.json({
      sucesso: true,
      totalNotas: todasNotas.length,
      atualizadas,
      detalhes: resultados.slice(0, 30),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});