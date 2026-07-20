// Cálculo de comissão baseado nas configurações do AbaComissoes (banco de dados)
export function calcularComissaoVenda(os, comissaoConfig) {
  if (!comissaoConfig || !Object.keys(comissaoConfig).length) return null;
  let total = 0;
  (os.servicos || []).forEach(sv => {
    const tec = (sv.tecnico || "").trim().toUpperCase();
    if (!tec) return;
    const pct = comissaoConfig[tec] ?? comissaoConfig["*"] ?? null;
    if (pct === null) return;
    const valorServico = Number(sv.valor || 0) * Number(sv.quantidade ?? 1);
    total += valorServico * (Number(pct) / 100);
  });
  return total;
}