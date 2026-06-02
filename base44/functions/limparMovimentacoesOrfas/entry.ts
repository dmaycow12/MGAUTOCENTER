import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar todas as vendas
    const vendas = await base44.entities.Vendas.list("-created_date", 9999);
    const vendasMap = new Map(vendas.map(v => [v.id, v]));

    // Buscar todos os itens de estoque
    const estoque = await base44.entities.Estoque.list("-created_date", 9999);
    
    let totalRemovidas = 0;
    let totalProcessados = 0;

    // Para cada item de estoque, verificar histórico
    const updates = [];
    for (const item of estoque) {
      const historico = Array.isArray(item.historico) ? item.historico : [];
      
      if (historico.length === 0) continue;
      
      // Filtrar movimentações válidas (que têm venda correspondente)
      const historicoFiltrado = historico.filter(mov => {
        // Se não é saída, manter (pode ser entrada ou ajuste)
        if (mov.tipo !== "saída" && mov.tipo !== "saida") {
          return true;
        }
        
        // Se é saída, verificar se a venda existe
        const vendaId = mov.ordem_venda_id;
        if (!vendaId) return true; // Sem ID, manter por segurança
        
        const vendaExiste = vendasMap.has(vendaId);
        
        if (!vendaExiste) {
          totalRemovidas++;
        }
        
        return vendaExiste;
      });
      
      // Se houve remoções, atualizar
      if (historicoFiltrado.length < historico.length) {
        // Recalcular quantidade baseada no histórico real
        let qtdTotal = item.quantidade || 0;
        
        // Restaurar quantidade removidas
        const saidasRemovidasQtd = historico
          .filter(m => (m.tipo === "saída" || m.tipo === "saida") && !vendasMap.has(m.ordem_venda_id || ""))
          .reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
        
        const novaQtd = Number(item.quantidade || 0) + saidasRemovidasQtd;
        
        updates.push(
          base44.entities.Estoque.update(item.id, {
            historico: historicoFiltrado,
            quantidade: novaQtd
          })
        );
      }
      
      totalProcessados++;
    }

    // Executar todas as atualizações em paralelo
    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return Response.json({
      success: true,
      mensagem: `Limpeza concluída! ${totalRemovidas} movimentações órfãs foram removidas. ${updates.length} itens de estoque foram atualizados. Total de itens processados: ${totalProcessados}`,
      estatisticas: {
        movimentacoesRemovidas: totalRemovidas,
        itensAtualizados: updates.length,
        itensProcessados: totalProcessados
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});