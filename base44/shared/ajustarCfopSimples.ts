/**
 * Ajusta o CFOP para ser compatível com o regime de tributação e o modelo de documento.
 *
 * 1) Simples Nacional com CSOSN sem ST (102/103/300/400): não admite CFOPs de
 *    substituição tributária (5405/6405/5655/6655). Convertemos para venda simples.
 *
 * 2) NFCe (DANFE Simplificado Tipo 2): a SEFAZ rejeita QUALQUER CFOP que não seja de
 *    venda ao consumidor com o erro 725 ("NFC-e ou NF-e com DANFE Simplificado Tipo 2
 *    com CFOP"), independentemente do CSOSN (mesmo 500). Por isso, em NFCe SEMPRE
 *    forçamos o CFOP para o padrão de venda: 5102 (mesma UF) ou 6102 (outra UF).
 *
 * Mesma UF (5xxx) -> 5102 | Outra UF (6xxx) -> 6102
 */
export function ajustarCfopSimples(cfop: string, csosn = "102", tipo?: string): string {
  const c = (cfop || "").replace(/\D/g, "");
  const semSt = ["102", "103", "300", "400"];
  const isNFCe = tipo === "NFCe";
  const ehVenda = (x: string) => x === "5102" || x === "6102";

  // Em NFCe: força sempre CFOP de venda ao consumidor (únicos aceitos no DANFE Simplificado)
  if (isNFCe) {
    if (ehVenda(c)) return c;
    if (c.startsWith("6")) return "6102";
    return "5102";
  }

  // NFe: converte apenas CFOPs de ST quando o CSOSN não admite ST
  if (semSt.includes(csosn)) {
    if (c.startsWith("54") || c === "5655") return "5102";
    if (c.startsWith("64") || c === "6655") return "6102";
  }
  return c || "5102";
}

/**
 * Ajusta o CSOSN para ser compatível com o CFOP e o modelo de documento.
 *
 * Em NFCe o CFOP é forçado para 5102/6102 (venda sem ST), então o CSOSN também não
 * pode indicar ST (500/201/202/203), senão a SEFAZ rejeita com "CFOP não permitido
 * para o CSOSN". Convertemos esses casos para 102 (tributada pelo Simples sem ST).
 */
export function ajustarCsosnNFCe(csosn = "102", tipo?: string): string {
  const c = (csosn || "102").replace(/\D/g, "");
  if (tipo !== "NFCe") return c || "102";
  const st = ["500", "201", "202", "203"];
  if (st.includes(c)) return "102";
  return c || "102";
}