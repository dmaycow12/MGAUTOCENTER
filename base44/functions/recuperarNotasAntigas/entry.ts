import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch todos os dados necessários
    const [notas, clientes, vendas] = await Promise.all([
      base44.asServiceRole.entities.NotaFiscal.list('-created_date', 1000),
      base44.asServiceRole.entities.Cliente.list('-created_date', 1000),
      base44.asServiceRole.entities.Vendas.list('-created_date', 1000),
    ]);
    
    // Notas que precisam ser recuperadas
    const notasParaRecuperar = notas.filter(n => 
      (!n.cliente_id || n.cliente_id.trim() === '') && n.cliente_nome && n.cliente_nome.trim() !== ''
    );
    
    let atualizadas = 0;
    const resultados = [];
    
    for (const nota of notasParaRecuperar) {
      const updates = {};
      
      // 1. Procura cliente por nome exato
      let clienteEncontrado = clientes.find(c => 
        c.nome?.toUpperCase().trim() === nota.cliente_nome.toUpperCase().trim()
      );
      
      // 2. Se não encontrar, tenta match parcial (começa com)
      if (!clienteEncontrado) {
        clienteEncontrado = clientes.find(c => 
          c.nome?.toUpperCase().startsWith(nota.cliente_nome.substring(0, 20).toUpperCase().trim())
        );
      }
      
      // 3. Atualiza cliente_id se encontrou
      if (clienteEncontrado) {
        updates.cliente_id = clienteEncontrado.id;
      }
      
      // 4. Procura venda do mesmo cliente
      let vendaCorrespondente = null;
      if (updates.cliente_id || nota.cliente_id) {
        const clienteId = updates.cliente_id || nota.cliente_id;
        const vendasCandidatas = vendas.filter(v => v.cliente_id === clienteId);
        
        if (vendasCandidatas.length === 1) {
          vendaCorrespondente = vendasCandidatas[0];
        } else if (vendasCandidatas.length > 1) {
          // Usa a mais recente ou a mais próxima pela data
          vendaCorrespondente = vendasCandidatas.sort((a, b) => 
            new Date(b.data_entrada || 0) - new Date(a.data_entrada || 0)
          )[0];
        }
      }
      
      if (vendaCorrespondente) {
        updates.ordem_venda_id = vendaCorrespondente.id;
      }
      
      // 5. Atualiza a nota se tem algo para atualizar
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, updates);
        atualizadas++;
        
        resultados.push({
          numero: nota.numero,
          tipo: nota.tipo,
          cliente_nome: nota.cliente_nome,
          cliente_id_novo: updates.cliente_id || 'não encontrado',
          ordem_venda_id: updates.ordem_venda_id || 'não linkada',
          sucesso: true
        });
      } else {
        resultados.push({
          numero: nota.numero,
          tipo: nota.tipo,
          cliente_nome: nota.cliente_nome,
          sucesso: false,
          motivo: 'Cliente não encontrado no cadastro'
        });
      }
    }
    
    return Response.json({
      sucesso: true,
      totalAnalisadas: notasParaRecuperar.length,
      atualizadas: atualizadas,
      mensagem: `${atualizadas}/${notasParaRecuperar.length} notas recuperadas com sucesso`,
      detalhes: resultados.slice(0, 10) // Primeiras 10 para preview
    });
  } catch (error) {
    return Response.json({ 
      sucesso: false, 
      erro: error.message 
    }, { status: 500 });
  }
});