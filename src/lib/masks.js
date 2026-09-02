// Máscaras de formatação brasileira para CPF/CNPJ, IE, telefone e CEP.
// As funções `mask*` servem tanto para input ao vivo quanto para exibição (idempotentes).

export const maskCpfCnpj = (val) => {
  const d = String(val || "").replace(/\D/g, "").slice(0, 14);
  if (!d) return "";
  if (d.length <= 11) {
    const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)].filter(p => p.length > 0);
    if (parts.length <= 3) return parts.join(".");
    return parts.slice(0, 3).join(".") + "-" + parts[3];
  }
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)].filter(p => p.length > 0);
  if (parts.length <= 3) return parts.join(".");
  if (parts.length === 4) return parts.slice(0, 3).join(".") + "/" + parts[3];
  return parts.slice(0, 3).join(".") + "/" + parts[3] + "-" + parts[4];
};

// IE varia por estado. MG usa 13 dígitos no formato XXX.XXX.XXX/XXXX
// (ex.: 062.307.904/0081); demais estados usam separadores genéricos a cada 3 dígitos.
// Sem a UF informada, 13 dígitos usam o formato MG. Valores não-numéricos (ex.: "ISENTO") são preservados.
export const maskIE = (val, uf) => {
  if (val == null) return "";
  const s = String(val);
  if (!/\d/.test(s)) return s.toUpperCase();
  const d = s.replace(/\D/g, "").slice(0, 14);
  if (!d) return s;
  const estado = String(uf || "").toUpperCase().trim();
  const formatoMG = estado === "MG" || (!estado && d.length === 13);
  if (formatoMG) {
    const base = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(p => p.length > 0).join(".");
    if (d.length > 9) return base + "/" + d.slice(9, 13);
    return base;
  }
  const groups = [];
  for (let i = 0; i < d.length; i += 3) groups.push(d.slice(i, i + 3));
  return groups.join(".");
};

export const maskTelefone = (val) => {
  const d = String(val || "").replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const maskCep = (val) => {
  const d = String(val || "").replace(/\D/g, "").slice(0, 8);
  if (!d) return "";
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};