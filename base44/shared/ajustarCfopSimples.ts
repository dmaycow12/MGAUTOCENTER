/**
 * Ajusta o CFOP para ser compatível com o regime de tributação e o modelo de documento.
 *
 * 1) Simples Nacional com CSOSN sem ST (102/103/300/400): não admite CFOPs de
 *    substituição tributária (5405/6405/5655/6655). Convertemos para venda simples.
 *
 * 2) NFCe (DANFE Simplificado Tipo 2): a SEFAZ rejeita CFOPs de ST com o erro 725
 *    ("NFC-e ou NF-e com DANFE Simplificado Tipo 2 com CFOP"), independentemente do
 *    CSOSN (mesmo 500). Por isso, em NFCe SEMPRE convertemos ST para venda simples.
 *
 * Mesma UF (5xxx) -> 5102 | Outra UF (6xxx) -> 6102
 */
export function ajustarCfopSimples(cfop: string, csosn = "102", tipo?: string): string {
  const c = (cfop || "").replace(/\D/g, "");
  const semSt = ["102", "103", "300", "400"];
  const isNFCe = tipo === "NFCe";
  if (isNFCe || semSt.includes(csosn)) {
    if (c.startsWith("54") || c === "5655") return "5102";
    if (c.startsWith("64") || c === "6655") return "6102";
  }
  return c || "5102";
}