import { base44 } from "@/api/base44Client";

export async function reduzirEstoque(pecas) {
  if (!pecas || pecas.length === 0) return;
  const estoqueList = await base44.entities.Estoque.list("-created_date", 1000);
  for (const peca of pecas) {
    if (!peca.descricao || !peca.quantidade) continue;
    const item = estoqueList.find(e =>
      e.descricao?.toLowerCase() === peca.descricao?.toLowerCase()
    );
    if (item) {
      const novaQtd = Math.max(0, (item.quantidade || 0) - (peca.quantidade || 0));
      await base44.entities.Estoque.update(item.id, { quantidade: novaQtd });
    }
  }
}

export async function restaurarEstoque(pecas) {
  if (!pecas || pecas.length === 0) return;
  const estoqueList = await base44.entities.Estoque.list("-created_date", 1000);
  for (const peca of pecas) {
    if (!peca.descricao || !peca.quantidade) continue;
    const item = estoqueList.find(e =>
      e.descricao?.toLowerCase() === peca.descricao?.toLowerCase()
    );
    if (item) {
      const novaQtd = (item.quantidade || 0) + (peca.quantidade || 0);
      await base44.entities.Estoque.update(item.id, { quantidade: novaQtd });
    }
  }
}

export async function excluirLancamentosOS(osId) {
  const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
  const vinculados = financeiros.filter(f => f.ordem_servico_id === osId);
  for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
}