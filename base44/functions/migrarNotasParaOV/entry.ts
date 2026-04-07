import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Busca todas as notas sem ordem_venda_id
    const notasSemOV = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 1000);
    const paraLinkar = notasSemOV.filter(n => !n.ordem_venda_id || n.ordem_venda_id.trim() === '');
    
    // Busca todas as vendas
    const vendas = await base44.asServiceRole.entities.Vendas.list('-created_date', 1000);
    
    let migradas = 0;
    for (const nota of paraLinkar) {
      let vendaCorrespondente = null;
      
      // Tenta 1: cliente_id
      if (nota.cliente_id) {
        const candidatos = vendas.filter(v => v.cliente_id === nota.cliente_id);
        if (candidatos.length === 1) {
          vendaCorrespondente = candidatos[0];
        } else if (candidatos.length > 1) {
          // Mais recente
          vendaCorrespondente = candidatos.sort((a, b) => 
            new Date(b.data_entrada || 0) - new Date(a.data_entrada || 0)
          )[0];
        }
      }
      
      // Tenta 2: nome do cliente (se não achou por ID)
      if (!vendaCorrespondente && nota.cliente_nome) {
        const candidatos = vendas.filter(v => 
          v.cliente_nome?.toUpperCase() === nota.cliente_nome.toUpperCase()
        );
        if (candidatos.length === 1) {
          vendaCorrespondente = candidatos[0];
        } else if (candidatos.length > 1) {
          // Mais recente
          vendaCorrespondente = candidatos.sort((a, b) => 
            new Date(b.data_entrada || 0) - new Date(a.data_entrada || 0)
          )[0];
        }
      }
      
      if (vendaCorrespondente) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, { ordem_venda_id: vendaCorrespondente.id });
        migradas++;
        console.log(`Linkada NF ${nota.numero} (${nota.cliente_nome}) à venda ${vendaCorrespondente.numero}`);
      }
    }
    
    return Response.json({ 
      sucesso: true, 
      mensagem: `${migradas} notas fiscais migradas com sucesso`,
      totalVerificadas: paraLinkar.length 
    });
  } catch (error) {
    console.error('Erro na migração:', error);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});