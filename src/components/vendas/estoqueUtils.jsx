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

export async function reduzirEstoque(pecas, venda = null, estoqueList = null) {
  if (!pecas || pecas.length === 0) return;
  const lista = estoqueList || await base44.entities.Estoque.list("-created_date", 1000);
  const porItem = new Map();
  for (const peca of pecas) {
    const qtd = Number(peca.quantidade);
    if (!qtd || qtd <= 0) continue;
    const item = encontrarItemEstoque(lista, peca);
    if (!item) continue;
    if (!porItem.has(item.id)) porItem.set(item.id, { item, saidas: [] });
    porItem.get(item.id).saidas.push({
      tipo: "saída",
      data: venda?.data_entrada || new Date().toISOString().split('T')[0],
      quantidade: qtd,
      valor_unitario: Number(peca.valor_unitario || peca.valor_venda || item.valor_venda || 0),
      ordem_venda_numero: venda?.numero || "",
      ordem_venda_id: venda?.id || "",
      observacao: "",
    });
  }
  const updates = Array.from(porItem.values()).map(({ item, saidas }) => {
    const historicoAtual = Array.isArray(item.historico) ? item.historico : [];
    // Remove saídas anteriores desta mesma venda (idempotente)
    const vendaId = venda?.id;
    const historicoSemVenda = vendaId
      ? historicoAtual.filter(m => !(m.tipo === "saída" && m.ordem_venda_id === vendaId))
      : historicoAtual;
    // Quantidade já deduçada anteriormente por esta venda
    const qtdAnterior = vendaId
      ? historicoAtual.filter(m => m.tipo === "saída" && m.ordem_venda_id === vendaId)
          .reduce((s, m) => s + Number(m.quantidade || 0), 0)
      : 0;
    const totalQtd = saidas.reduce((s, m) => s + m.quantidade, 0);
    // Ajusta quantidade: reverte o que foi deduzido antes e aplica o novo
    const novaQtd = Math.max(0, Number(item.quantidade || 0) + qtdAnterior - totalQtd);
    const historico = [...historicoSemVenda, ...saidas];
    return base44.entities.Estoque.update(item.id, { quantidade: novaQtd, historico });
  });
  await Promise.all(updates);
}

export async function restaurarEstoque(pecas, vendaId = null, estoqueList = null) {
  if (!pecas || pecas.length === 0) return;
  const lista = estoqueList || await base44.entities.Estoque.list("-created_date", 1000);
  const porItem = new Map();
  for (const peca of pecas) {
    const qtd = Number(peca.quantidade);
    if (!qtd || qtd <= 0) continue;
    const item = encontrarItemEstoque(lista, peca);
    if (!item) continue;
    if (!porItem.has(item.id)) porItem.set(item.id, { item });
  }
  const updates = Array.from(porItem.values()).map(({ item }) => {
    const historicoAtual = Array.isArray(item.historico) ? item.historico : [];
    if (vendaId) {
      // Calcula a devolução pelo que está no histórico real (evita dobrar se chamado 2x)
      const saidasVenda = historicoAtual.filter(m => m.tipo === "saída" && m.ordem_venda_id === vendaId);
      const qtdNaHistoria = saidasVenda.reduce((s, m) => s + Number(m.quantidade || 0), 0);
      if (qtdNaHistoria === 0) return null; // Já restaurado, não faz nada
      const historico = historicoAtual.filter(m => !(m.tipo === "saída" && m.ordem_venda_id === vendaId));
      const novaQtd = Number(item.quantidade || 0) + qtdNaHistoria;
      return base44.entities.Estoque.update(item.id, { quantidade: novaQtd, historico });
    } else {
      return null;
    }
  }).filter(Boolean);
  await Promise.all(updates);
}

export async function excluirLancamentosOS(osId) {
  const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
  const vinculados = financeiros.filter(f => f.ordem_servico_id === osId);
  for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
}

export async function excluirLancamentosVenda(vendaId) {
  const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
  const vinculados = financeiros.filter(f => f.ordem_venda_id === vendaId || f.ordem_servico_id === vendaId);
  for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
}