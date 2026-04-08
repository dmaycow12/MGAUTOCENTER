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

export async function reduzirEstoque(pecas) {
  if (!pecas || pecas.length === 0) return;
  const estoqueList = await base44.entities.Estoque.list("-created_date", 1000);
  for (const peca of pecas) {
    const qtd = Number(peca.quantidade);
    if (!qtd || qtd <= 0) continue;
    const item = encontrarItemEstoque(estoqueList, peca);
    if (item) {
      const novaQtd = Math.max(0, Number(item.quantidade || 0) - qtd);
      await base44.entities.Estoque.update(item.id, { quantidade: novaQtd });
    }
  }
}

export async function restaurarEstoque(pecas) {
  if (!pecas || pecas.length === 0) return;
  const estoqueList = await base44.entities.Estoque.list("-created_date", 1000);
  for (const peca of pecas) {
    const qtd = Number(peca.quantidade);
    if (!qtd || qtd <= 0) continue;
    const item = encontrarItemEstoque(estoqueList, peca);
    if (item) {
      const novaQtd = Number(item.quantidade || 0) + qtd;
      await base44.entities.Estoque.update(item.id, { quantidade: novaQtd });
    }
  }
}

export async function excluirLancamentosOS(osId) {
  const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
  const vinculados = financeiros.filter(f => f.ordem_servico_id === osId);
  for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
}