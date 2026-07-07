import { base44 } from "@/api/base44Client";

function normalize(str) {
  return String(str || "").toUpperCase().trim();
}

function encontrarItemEstoque(estoqueList, peca) {
  if (peca.estoque_id) {
    const item = estoqueList.find(e => e.id === peca.estoque_id);
    if (item) return item;
  }
  if (peca.codigo) {
    const cod = normalize(peca.codigo);
    const item = estoqueList.find(e => e.codigo && normalize(e.codigo) === cod);
    if (item) return item;
  }
  if (peca.descricao) {
    const desc = normalize(peca.descricao);
    const exato = estoqueList.find(e => normalize(e.descricao) === desc);
    if (exato) return exato;
    const parcial = estoqueList.find(e =>
      normalize(e.descricao).includes(desc) || desc.includes(normalize(e.descricao))
    );
    if (parcial) return parcial;
  }
  return null;
}

// ======================
// OPERAÇÃO PRINCIPAL:
// Remove TODAS as saídas de uma venda e restaura o estoque
// ======================
// Normaliza tipo de movimentação para comparação (remove acentos, minúsculas)
function normalizarTipo(tipo) {
  return String(tipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isSaidaVenda(m, vendaId) {
  const tipo = normalizarTipo(m.tipo);
  return (tipo === 'saida' || tipo === 'saída') && m.ordem_venda_id === vendaId;
}

async function aplicarMovimentacaoEstoque(pecas, venda, remover = false) {
  if (!pecas || pecas.length === 0) return;
  
  // Sempre busca dados frescos do banco para evitar estoque stale
  const estoque = await base44.entities.Estoque.list("-created_date", 1000);
  const vendaId = venda?.id;
  
  const updates = [];
  
  for (const peca of pecas) {
    const qtd = Number(peca.quantidade || 0);
    if (qtd <= 0) continue;
    
    const item = encontrarItemEstoque(estoque, peca);
    if (!item) continue;
    
    const historicoAtual = Array.isArray(item.historico) ? item.historico : [];
    
    if (remover) {
      // REMOVER: limpa os movimentos desta venda e restaura quantidade
      const historicoSemVenda = historicoAtual.filter(m => !isSaidaVenda(m, vendaId));
      
      const saidasRemovidas = historicoAtual
        .filter(m => isSaidaVenda(m, vendaId))
        .reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
      
      const novaQtd = Number(item.quantidade || 0) + saidasRemovidas;
      
      updates.push(
        base44.entities.Estoque.update(item.id, {
          quantidade: novaQtd,
          historico: historicoSemVenda
        })
      );
    } else {
      // ADICIONAR: remove movs antigos desta venda e cria novo movimento de saída
      // (evita duplicatas ao reeditar)
      const historicoSemVenda = historicoAtual.filter(m => !isSaidaVenda(m, vendaId));

      // Restaura quantidade das saídas antigas antes de reduzir novamente
      const saidasAntigas = historicoAtual
        .filter(m => isSaidaVenda(m, vendaId))
        .reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
      
      const novoMovimento = {
        tipo: "saida",
        data: (() => {
          const d = venda?.data_entrada;
          if (!d) return new Date().toLocaleDateString('en-CA');
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
          return new Date(d).toLocaleDateString('en-CA');
        })(),
        quantidade: qtd,
        valor_unitario: Number(peca.valor_unitario || peca.valor_venda || item.valor_venda || 0),
        ordem_venda_numero: venda?.numero || "",
        ordem_venda_id: venda?.id || "",
        observacao: "",
      };
      
      // Quantidade atual + restaura antigas - nova saída
      const novaQtd = Number(item.quantidade || 0) + saidasAntigas - qtd;
      
      updates.push(
        base44.entities.Estoque.update(item.id, {
          quantidade: novaQtd,
          historico: [...historicoSemVenda, novoMovimento]
        })
      );
    }
  }
  
  await Promise.all(updates);
}

export async function reduzirEstoque(pecas, venda = null) {
  await aplicarMovimentacaoEstoque(pecas, venda, false);
}

export async function restaurarEstoque(pecas, vendaId = null) {
  if (!pecas || pecas.length === 0) return;
  // Restaura pecas específicas da venda
  await aplicarMovimentacaoEstoque(pecas, { id: vendaId }, true);
}

export async function restaurarEstoqueCompletoPeca(peca, vendaId) {
  if (!peca || !vendaId) return;
  // Remove a peça inteira da venda
  await aplicarMovimentacaoEstoque([peca], { id: vendaId }, true);
}

export async function limparHistoricoVenda(vendaId) {
  // Remove TODOS os movimentos de uma venda
  const estoque = await base44.entities.Estoque.list("-created_date", 1000);
  const updates = [];
  
  for (const item of estoque) {
    const historicoAtual = Array.isArray(item.historico) ? item.historico : [];
    
    const historicoSemVenda = historicoAtual.filter(m => !isSaidaVenda(m, vendaId));
    
    const saidasRemovidas = historicoAtual
      .filter(m => isSaidaVenda(m, vendaId))
      .reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
    
    if (saidasRemovidas > 0) {
      const novaQtd = Number(item.quantidade || 0) + saidasRemovidas;
      updates.push(
        base44.entities.Estoque.update(item.id, {
          quantidade: novaQtd,
          historico: historicoSemVenda
        })
      );
    }
  }
  
  await Promise.all(updates);
}

// ======================
// SINCRONIZAÇÃO UNIFICADA (otimizada):
// Compara pecas antigas vs novas de uma venda e aplica TODAS as mudanças de estoque
// em uma única passada: uma busca de estoque + um bulkUpdate.
// Substitui as múltiplas chamadas sequenciais de restaurarEstoque/reduzirEstoque.
// ======================
export async function sincronizarEstoqueVenda(oldPecas, newPecas, venda, estoquePreCarregado) {
  oldPecas = oldPecas || [];
  newPecas = newPecas || [];
  if (oldPecas.length === 0 && newPecas.length === 0) return;

  const vendaId = venda?.id;
  if (!vendaId) return;

  // Usa cache se fornecido, senão busca do banco (uma única vez)
  const estoque = estoquePreCarregado && estoquePreCarregado.length > 0
    ? estoquePreCarregado
    : await base44.entities.Estoque.list("-created_date", 1000);

  // Indexa pecas antigas e novas por estoque_id
  const oldByItemId = {};
  const newByItemId = {};

  for (const p of oldPecas) {
    const item = encontrarItemEstoque(estoque, p);
    if (item) oldByItemId[item.id] = { peca: p, item };
  }
  for (const p of newPecas) {
    const item = encontrarItemEstoque(estoque, p);
    if (item) newByItemId[item.id] = { peca: p, item };
  }

  // Todos os itens de estoque que aparecem em old ou new
  const allItemIds = new Set([...Object.keys(oldByItemId), ...Object.keys(newByItemId)]);

  const bulkUpdates = [];

  for (const itemId of allItemIds) {
    const oldEntry = oldByItemId[itemId];
    const newEntry = newByItemId[itemId];
    const item = (oldEntry || newEntry).item;

    const historicoAtual = Array.isArray(item.historico) ? item.historico : [];

    // Remove TODOS os movimentos de saída desta venda do histórico
    const historicoSemVenda = historicoAtual.filter(m => !isSaidaVenda(m, vendaId));

    // Soma das saídas antigas a restaurar
    const saidasAntigas = historicoAtual
      .filter(m => isSaidaVenda(m, vendaId))
      .reduce((sum, m) => sum + Number(m.quantidade || 0), 0);

    // Quantidade atual + restauração das saídas antigas
    let novaQtd = Number(item.quantidade || 0) + saidasAntigas;
    let novoHistorico = historicoSemVenda;

    // Se há uma peça nova para este item, adiciona o movimento de saída e reduz
    if (newEntry) {
      const peca = newEntry.peca;
      const qtd = Number(peca.quantidade || 0);
      if (qtd > 0) {
        const novoMovimento = {
          tipo: "saida",
          data: (() => {
            const d = venda?.data_entrada;
            if (!d) return new Date().toLocaleDateString('en-CA');
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
            return new Date(d).toLocaleDateString('en-CA');
          })(),
          quantidade: qtd,
          valor_unitario: Number(peca.valor_unitario || peca.valor_venda || item.valor_venda || 0),
          ordem_venda_numero: venda?.numero || "",
          ordem_venda_id: vendaId || "",
          observacao: "",
        };
        novoHistorico = [...novoHistorico, novoMovimento];
        novaQtd -= qtd;
      }
    }

    bulkUpdates.push({
      id: itemId,
      quantidade: novaQtd,
      historico: novoHistorico,
    });
  }

  if (bulkUpdates.length > 0) {
    await base44.entities.Estoque.bulkUpdate(bulkUpdates);
  }
}

export async function excluirLancamentosVenda(vendaId) {
  const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
  const vinculados = financeiros.filter(f => f.ordem_venda_id === vendaId || f.ordem_servico_id === vendaId);
  for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
}

export async function excluirLancamentosOS(osId) {
  const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
  const vinculados = financeiros.filter(f => f.ordem_servico_id === osId);
  for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
}