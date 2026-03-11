import { base44 } from "@/api/base44Client";

function encontrarItemEstoque(estoqueList, peca) {
  // Primeiro tenta por ID exato (mais confiável)
  if (peca.estoque_id) {
    const porId = estoqueList.find(e => e.id === peca.estoque_id);
    if (porId) return porId;
  }
  // Fallback: por código exato
  if (peca.codigo) {
    const porCodigo = estoqueList.find(e => e.codigo && e.codigo.trim() === peca.codigo.trim());
    if (porCodigo) return porCodigo;
  }
  // Fallback: por descrição case-insensitive
  if (peca.descricao) {
    const desc = peca.descricao.toLowerCase().trim();
    return estoqueList.find(e => e.descricao?.toLowerCase().trim() === desc);
  }
  return null;
}

export async function reduzirEstoque(pecas) {
  console.log("[ESTOQUE] reduzirEstoque chamado com pecas:", JSON.stringify(pecas));
  if (!pecas || pecas.length === 0) {
    console.log("[ESTOQUE] Nenhuma peça para baixar.");
    return;
  }
  const estoqueList = await base44.entities.Estoque.list("-created_date", 1000);
  console.log("[ESTOQUE] Total de itens no estoque:", estoqueList.length);
  for (const peca of pecas) {
    console.log("[ESTOQUE] Processando peça:", JSON.stringify(peca));
    if (!peca.quantidade) { console.log("[ESTOQUE] Peça sem quantidade, pulando."); continue; }
    const item = encontrarItemEstoque(estoqueList, peca);
    console.log("[ESTOQUE] Item encontrado no estoque:", item ? `${item.descricao} (${item.id}) qtd atual: ${item.quantidade}` : "NÃO ENCONTRADO");
    if (item) {
      const novaQtd = Math.max(0, (item.quantidade || 0) - (peca.quantidade || 0));
      console.log("[ESTOQUE] Atualizando para qtd:", novaQtd);
      await base44.entities.Estoque.update(item.id, { quantidade: novaQtd });
    }
  }
}

export async function restaurarEstoque(pecas) {
  if (!pecas || pecas.length === 0) return;
  const estoqueList = await base44.entities.Estoque.list("-created_date", 1000);
  for (const peca of pecas) {
    if (!peca.quantidade) continue;
    const item = encontrarItemEstoque(estoqueList, peca);
    if (item) {
      const novaQtd = Number(item.quantidade || 0) + Number(peca.quantidade || 0);
      await base44.entities.Estoque.update(item.id, { quantidade: novaQtd });
    }
  }
}

export async function excluirLancamentosOS(osId) {
  const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
  const vinculados = financeiros.filter(f => f.ordem_servico_id === osId);
  for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
}