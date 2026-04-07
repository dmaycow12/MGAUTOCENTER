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

    let atualizadas = 0;
    const detalhes = [];

    // Notas específicas sem venda - força restauração
    const notasSemVenda = [
      { numero: "43278", cliente_nome: "VESPOR AUTOMOTIVE DIST DE AUTO PECAS LTDA" },
      { numero: "41205", cliente_nome: "VESPOR AUTOMOTIVE DIST DE AUTO PECAS LTDA" },
      { numero: "20811", cliente_nome: "B.A.P. AUTOMOTIVA LTDA." },
      { numero: "155422", cliente_nome: "AUTUS COMERCIAL DISTRIBUIDORA LTDA." },
      { numero: "40034", cliente_nome: "VESPOR AUTOMOTIVE DIST DE AUTO PECAS LTDA" },
    ];

    for (const ref of notasSemVenda) {
      const nota = todasNotas.find(n => n.numero === ref.numero);
      if (!nota) continue;

      // Busca venda por cliente_nome exato
      let venda = todasVendas.find(v => 
        v.cliente_nome && v.cliente_nome.toUpperCase() === ref.cliente_nome.toUpperCase()
      );

      // Se não achou, busca pela primeira palavra
      if (!venda) {
        const primeiroNome = ref.cliente_nome.split(' ')[0].toUpperCase();
        venda = todasVendas.find(v =>
          v.cliente_nome && v.cliente_nome.toUpperCase().includes(primeiroNome)
        );
      }

      if (venda) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          ordem_venda_id: venda.id,
          cliente_id: venda.cliente_id || nota.cliente_id,
        });
        atualizadas++;
        detalhes.push({
          notaNumero: nota.numero,
          vendaNumero: venda.numero,
          restaurado: true,
        });
      } else {
        detalhes.push({
          notaNumero: nota.numero,
          restaurado: false,
          motivo: "Nenhuma venda encontrada para " + ref.cliente_nome,
        });
      }
    }

    return Response.json({
      sucesso: true,
      atualizadas,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});