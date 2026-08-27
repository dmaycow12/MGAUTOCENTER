/**
 * Ajusta o CFOP para ser compatível com o CSOSN do Simples Nacional.
 *
 * A empresa opera no Simples Nacional usando CSOSN 102 (tributada sem permissão de crédito),
 * que NÃO admite CFOPs de substituição tributária (5405/6405/5655/6655). Quando o produto
 * está cadastrado com um CFOP de ST, a SEFAZ rejeita com "CFOP não permitido para o CSOSN".
 * Aqui normalizamos o CFOP para a venda de mercadoria equivalente sem ST.
 *
 * Mesma UF (5xxx) -> 5102 | Outra UF (6xxx) -> 6102
 */
export function ajustarCfopSimples(cfop: string, csosn = "102"): string {
  const c = (cfop || "").replace(/\D/g, "");
  const semSt = ["102", "103", "300", "400"];
  if (semSt.includes(csosn)) {
    if (c.startsWith("54") || c === "5655") return "5102";
    if (c.startsWith("64") || c === "6655") return "6102";
  }
  return c || "5102";
}