/**
 * Gerador SINTEGRA - Convênio ICMS 57/95
 *
 * Regras de formatação (críticas):
 *   N = Numérico → alinhado à DIREITA, preenchido com ZEROS à esquerda
 *   X = Alfanumérico → alinhado à ESQUERDA, preenchido com ESPAÇOS à direita
 *
 * Todos os registros têm exatamente 126 posições (sem CR/LF).
 * Linhas separadas por CRLF (\r\n).
 */

// Campo Numérico: direita, zero-pad
function N(val, size) {
  const s = String(Math.round(Number(val ?? 0)));
  return s.padStart(size, "0").slice(-size);
}

// Campo Numérico com decimais implícitas (x100): direita, zero-pad
function ND(val, size) {
  return N(Math.round(Number(val ?? 0) * 100), size);
}

// Campo Alfanumérico: esquerda, space-pad, maiúsculas
function X(val, size) {
  const s = String(val ?? "").toUpperCase().replace(/[^\x20-\x7E\xC0-\xFF]/g, " ");
  return s.padEnd(size, " ").substring(0, size);
}

// Data AAAA-MM-DD → AAAAMMDD (N 8)
function DATA(d) {
  return d ? d.replace(/-/g, "").substring(0, 8) : "        ";
}

// CNPJ: apenas dígitos, 14 chars, N
function CNPJ(c) {
  return (c || "").replace(/\D/g, "").padStart(14, "0").slice(-14);
}

// IE: alfanumérico, 14 chars, X (espaços)
function IE(ie) {
  const s = (ie || "ISENTO").replace(/[^A-Z0-9a-z]/gi, "").toUpperCase();
  return s.padEnd(14, " ").substring(0, 14);
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO 10 — Identificação do estabelecimento informante
// Pos  1- 2: Tipo "10"                          N  2
// Pos  3-16: CNPJ                                N 14
// Pos 17-30: Inscrição Estadual                  X 14
// Pos 31-65: Nome/Razão Social                   X 35
// Pos 66-95: Município                           X 30
// Pos 96-97: UF                                  X  2
// Pos 98-107: Fax                               N 10
// Pos 108-115: Data Inicial (AAAAMMDD)           N  8
// Pos 116-123: Data Final   (AAAAMMDD)           N  8
// Pos 124: Cód. estrutura arquivo (2=atual)      X  1
// Pos 125: Natureza operações (3=totalidade)     X  1
// Pos 126: Finalidade (1=normal)                 X  1
// Total: 2+14+14+35+30+2+10+8+8+1+1+1 = 126 ✓
// ─────────────────────────────────────────────────────────────────────────────
export function reg10(empresa, periodo) {
  const fax = (empresa.fax || "").replace(/\D/g, "").padEnd(10, "0").substring(0, 10);
  const linha =
    "10" +
    CNPJ(empresa.cnpj) +           // N 14
    IE(empresa.ie) +               // X 14
    X(empresa.nome, 35) +          // X 35
    X(empresa.municipio, 30) +     // X 30
    X(empresa.uf, 2) +             // X  2
    fax +                          // N 10
    DATA(periodo.inicio) +         // N  8
    DATA(periodo.fim) +            // N  8
    "2" +                          // X  1 — versão atual do convênio
    "3" +                          // X  1 — totalidade das operações
    "1";                           // X  1 — normal
  if (linha.length !== 126) throw new Error(`REG10 tem ${linha.length} posições (esperado 126)`);
  return linha;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO 11 — Dados complementares do informante
// Pos  1- 2: Tipo "11"                          N  2
// Pos  3-36: Logradouro                         X 34
// Pos 37-41: Número                             N  5
// Pos 42-63: Complemento                        X 22
// Pos 64-78: Bairro                             X 15
// Pos 79-86: CEP                                N  8
// Pos 87-114: Nome do Contato                   X 28
// Pos 115-126: Telefone                         N 12
// Total: 2+34+5+22+15+8+28+12 = 126 ✓
// ─────────────────────────────────────────────────────────────────────────────
export function reg11(empresa) {
  const numero = (empresa.numero || "0").replace(/\D/g, "") || "0";
  const cep = (empresa.cep || "").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  const fone = (empresa.fone || "").replace(/\D/g, "").padEnd(12, "0").substring(0, 12);
  const linha =
    "11" +
    X(empresa.logradouro || "RUA RUI BARBOSA", 34) + // X 34
    N(numero, 5) +                                    // N  5
    X(empresa.complemento, 22) +                      // X 22
    X(empresa.bairro || "CENTRO", 15) +               // X 15
    cep +                                             // N  8
    X(empresa.responsavel || "MAYCOW", 28) +          // X 28
    fone;                                             // N 12
  if (linha.length !== 126) throw new Error(`REG11 tem ${linha.length} posições (esperado 126)`);
  return linha;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO 50 — Nota Fiscal (cabeçalho)
// Pos   1-  2: Tipo "50"                        N  2
// Pos   3- 16: CNPJ dest/rem                    N 14
// Pos  17- 30: IE dest/rem                      X 14
// Pos  31- 38: Data emissão/recebimento         N  8
// Pos  39- 40: UF dest/rem                      X  2
// Pos  41- 42: Modelo (55=NFe)                  N  2
// Pos  43- 45: Série                            X  3
// Pos  46- 51: Número                           N  6
// Pos  52- 55: CFOP                             N  4
// Pos  56- 56: Emitente (P/T)                   X  1
// Pos  57- 69: Valor total                      N 13 (2 decimais)
// Pos  70- 82: Base cálculo ICMS                N 13 (2 decimais)
// Pos  83- 95: Valor ICMS                       N 13 (2 decimais)
// Pos  96-108: Isenta/não-tributada             N 13 (2 decimais)
// Pos 109-121: Outras                           N 13 (2 decimais)
// Pos 122-125: Alíquota ICMS                    N  4 (2 decimais)
// Pos 126-126: Situação                         X  1
// Total: 2+14+14+8+2+2+3+6+4+1+13+13+13+13+13+4+1 = 126 ✓
// ─────────────────────────────────────────────────────────────────────────────
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada" || nota.status === "Lançada";
  const codSit = nota.status === "Cancelada" ? "S" : "N";
  const cfop = isEntrada ? "1102" : "5405";
  const emitente = isEntrada ? "T" : "P";

  // CNPJ: do cliente/fornecedor. Se CPF (11 dígitos), completar 14 com zeros.
  // Se em branco, usar CNPJ da própria empresa (consumidor final sem doc).
  const cnpjDoc = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "");
  const cnpjCampo = cnpjDoc.length >= 11
    ? cnpjDoc.padEnd(14, "0").substring(0, 14)
    : CNPJ(empresa.cnpj);

  // Série: campo X (alfanumérico), left-align com espaços
  const serieStr = String(nota.serie || "1");

  // UF: do cliente, ou UF da empresa para consumidor final
  const uf = nota.cliente_estado || empresa.uf || "MG";

  const linha =
    "50" +
    cnpjCampo +              // N 14
    IE(nota.cliente_ie) +    // X 14
    DATA(nota.data_emissao) + // N  8
    X(uf, 2) +               // X  2
    N(55, 2) +               // N  2 — modelo 55 (NFe). NFCe não entra no SINTEGRA
    X(serieStr, 3) +         // X  3 — série, left-align
    N(nota.numero, 6) +      // N  6
    N(cfop, 4) +             // N  4
    emitente +               // X  1
    ND(nota.valor_total, 13) + // N 13
    ND(0, 13) +              // N 13 — base ICMS
    ND(0, 13) +              // N 13 — valor ICMS
    ND(nota.valor_total, 13) + // N 13 — isentas/não tributadas
    ND(0, 13) +              // N 13 — outras
    N(0, 4) +                // N  4 — alíquota (0000)
    codSit;                  // X  1
  if (linha.length !== 126) throw new Error(`REG50 tem ${linha.length} posições (esperado 126) — NF ${nota.numero}`);
  return linha;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO 54 — Produto (item de nota fiscal)
// Pos   1-  2: Tipo "54"                        N  2
// Pos   3- 16: CNPJ dest/rem (= mesmo do Reg50) N 14
// Pos  17- 18: Modelo (55)                      N  2
// Pos  19- 21: Série                            X  3
// Pos  22- 27: Número                           N  6
// Pos  28- 31: CFOP                             N  4
// Pos  32- 34: CST                              N  3
// Pos  35- 37: Nº do item                       N  3
// Pos  38- 51: Código produto                   X 14
// Pos  52- 62: Quantidade                       N 11 (3 decimais)
// Pos  63- 74: Valor unitário                   N 12 (5 decimais — ×100000)
// Pos  75- 86: Desconto                         N 12 (2 decimais)
// Pos  87- 98: Base cálculo ICMS                N 12 (2 decimais)
// Pos  99-110: Valor ICMS                       N 12 (2 decimais)
// Pos 111-122: IPI                              N 12 (2 decimais)
// Pos 123-126: Alíquota ICMS                    N  4 (2 decimais)
// Total: 2+14+2+3+6+4+3+3+14+11+12+12+12+12+12+4 = 126 ✓
// ─────────────────────────────────────────────────────────────────────────────
export function reg54(nota, item, numItem, empresa) {
  const isEntrada = nota.status === "Importada" || nota.status === "Lançada";
  const cfop = isEntrada ? "1102" : "5405";
  const cst = "060"; // tributado com substituição tributária

  // CNPJ: DEVE ser igual ao usado no Reg.50 correspondente
  const cnpjDoc = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "");
  const cnpjCampo = cnpjDoc.length >= 11
    ? cnpjDoc.padEnd(14, "0").substring(0, 14)
    : CNPJ(empresa.cnpj);

  const serieStr = String(nota.serie || "1");

  // Código do produto: X (alfanumérico), left-align
  const codProd = X(item.codigo || "000", 14);

  // Quantidade com 3 casas decimais implícitas (×1000)
  const qtdInt = Math.round(Number(item.quantidade || 1) * 1000);

  // Valor unitário com 5 casas decimais implícitas (×100000)
  const qtd = Number(item.quantidade || 1) || 1;
  const vUnit = Number(item.valor_unitario) || (Number(item.valor_total || 0) / qtd);
  const vUnitInt = Math.round(vUnit * 100000);

  const linha =
    "54" +
    cnpjCampo +                                    // N 14
    N(55, 2) +                                     // N  2 — modelo 55
    X(serieStr, 3) +                               // X  3 — série, left-align
    N(nota.numero, 6) +                            // N  6
    N(cfop, 4) +                                   // N  4
    N(cst, 3) +                                    // N  3
    N(numItem + 1, 3) +                            // N  3
    codProd +                                      // X 14
    String(qtdInt).padStart(11, "0").slice(-11) +  // N 11
    String(vUnitInt).padStart(12, "0").slice(-12) + // N 12
    N(0, 12) +                                     // N 12 — desconto
    N(0, 12) +                                     // N 12 — base ICMS
    N(0, 12) +                                     // N 12 — valor ICMS
    N(0, 12) +                                     // N 12 — IPI
    N(0, 4);                                       // N  4 — alíquota
  if (linha.length !== 126) throw new Error(`REG54 tem ${linha.length} posições (esperado 126) — NF ${nota.numero} item ${numItem + 1}`);
  return linha;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO 75 — Código de produto
// Pos   1-  2: Tipo "75"                        N  2
// Pos   3- 10: Data inicial                     N  8
// Pos  11- 18: Data final                       N  8
// Pos  19- 32: Código produto                   X 14
// Pos  33- 40: NCM/NBM/SH                       N  8
// Pos  41- 93: Descrição                        X 53
// Pos  94- 99: Unidade                          X  6
// Pos 100-112: Valor bruto (PVP c/ 2 decimais)  N 13
// Pos 113-125: Valor base ICMS (c/ 2 decimais)  N 13
// Pos 126-126: Situação tributária ICM          X  1
// Total: 2+8+8+14+8+53+6+13+13+1 = 126 ✓
// ─────────────────────────────────────────────────────────────────────────────
export function reg75(produto, periodoInicio, periodoFim) {
  const ncm = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  const linha =
    "75" +
    DATA(periodoInicio) +              // N  8
    DATA(periodoFim) +                 // N  8
    X(produto.codigo || "000", 14) +   // X 14 — left-align (igual ao Reg.54!)
    ncm +                              // N  8
    X(produto.descricao, 53) +         // X 53
    X(produto.unidade || "UN", 6) +    // X  6
    ND(produto.valor_venda || 0, 13) + // N 13
    ND(0, 13) +                        // N 13 — base ICMS (zero)
    "T";                               // X  1 — tributado
  if (linha.length !== 126) throw new Error(`REG75 tem ${linha.length} posições (esperado 126) — ${produto.codigo}`);
  return linha;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO 90 — Encerramento (totalizadores)
// Pos   1-  2: Tipo "90"                        N  2
// Pos   3- 16: CNPJ                             N 14
// Pos  17- 30: IE                               X 14
// Pos  31- 32: Tipo de registro contabilizado   N  2  (ou "99" para total)
// Pos  33- 40: Total de registros               N  8
// Pos  41-125: Brancos                          X 85
// Pos 126-126: Reservado ("1" por registro / "9" na linha final)
// Total: 2+14+14+2+8+85+1 = 126 ✓
// Retorna ARRAY de strings (cada uma = 126 chars).
// Tipos 10 e 11 NÃO aparecem no Reg.90 (segundo o validador MG).
// ─────────────────────────────────────────────────────────────────────────────
export function reg90(empresa, totais, totalLinhasAntes) {
  const BR = " ".repeat(85);
  const cnpj = CNPJ(empresa.cnpj);
  const ie = IE(empresa.ie);

  const tiposValidos = Object.entries(totais)
    .filter(([reg]) => reg !== "10" && reg !== "11")
    .sort(([a], [b]) => Number(a) - Number(b));

  const linhas = tiposValidos.map(([reg, qtd]) => {
    const linha = "90" + cnpj + ie + N(reg, 2) + N(qtd, 8) + BR + "1";
    if (linha.length !== 126) throw new Error(`REG90 (tipo ${reg}) tem ${linha.length} posições`);
    return linha;
  });

  // Linha final "99": total de TODOS os registros no arquivo (incluindo as linhas do Reg.90)
  // = linhas antes do Reg.90 + linhas tipo-específicas do Reg.90 + a própria linha 99
  const totalGeral = totalLinhasAntes + linhas.length + 1;
  const linhaFinal = "90" + cnpj + ie + "99" + N(totalGeral, 8) + BR + "9";
  if (linhaFinal.length !== 126) throw new Error(`REG90 (tipo 99) tem ${linhaFinal.length} posições`);
  linhas.push(linhaFinal);

  return linhas; // array — NÃO joined aqui
}

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  const cfg = (chave) => configs.find(c => c.chave === chave)?.valor || "";

  const empresa = {
    cnpj:        cfg("cnpj")               || "54043647000120",
    ie:          cfg("inscricao_estadual") || "0048295510070",
    nome:        cfg("razao_social")       || "MG AUTOCENTER LTDA",
    municipio:   cfg("municipio")          || "PATOS DE MINAS",
    uf:          cfg("uf")                 || "MG",
    logradouro:  cfg("endereco")           || "RUA RUI BARBOSA",
    numero:      cfg("numero")             || "1355",
    complemento: cfg("complemento")        || "",
    bairro:      cfg("bairro")             || "CENTRO",
    cep:         cfg("cep")                || "38700327",
    fone:        cfg("telefone")           || "3438225092",
    fax:         cfg("fax")               || "",
    responsavel: cfg("responsavel")        || "MAYCOW",
  };

  const linhas = [];
  const totais = {};

  const add = (tipo, linha) => {
    linhas.push(linha);
    totais[tipo] = (totais[tipo] || 0) + 1;
  };

  // Reg.10 e Reg.11
  add("10", reg10(empresa, { inicio: periodoInicio, fim: periodoFim }));
  add("11", reg11(empresa));

  // Filtrar notas do período (excluir Rascunho)
  const notasPeriodo = notas.filter(n => {
    const d = n.data_emissao || "";
    return d >= periodoInicio && d <= periodoFim && n.status !== "Rascunho";
  });

  // Somente NFe (modelo 55). NFCe (65) NÃO é aceita pelo SINTEGRA MG.
  // Deduplicar por série+número para evitar "registro informado em duplicidade".
  const vistas = new Set();
  const notasNFe = notasPeriodo.filter(n => {
    if (n.tipo !== "NFe") return false;
    const chave = `${String(n.serie || "1")}_${n.numero}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  // ── Reg.50 — todos primeiro ──
  for (const nota of notasNFe) {
    add("50", reg50(nota, empresa));
  }

  // ── Reg.54 — depois (coletar códigos para Reg.75) ──
  const codigosNosItens = new Set();
  for (const nota of notasNFe) {
    let itens = [];
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        if (Array.isArray(parsed)) itens = parsed;
      } catch {}
    }
    itens.forEach((item, idx) => {
      add("54", reg54(nota, item, idx, empresa));
      const cod = (item.codigo || "").trim();
      if (cod) codigosNosItens.add(cod);
    });
  }

  // ── Reg.75 — apenas produtos que aparecem no Reg.54 ──
  const produtosUnicos = new Map();
  estoque.forEach(p => {
    const cod = (p.codigo || "").trim();
    if (!cod || !codigosNosItens.has(cod)) return;
    if (!produtosUnicos.has(cod)) produtosUnicos.set(cod, p);
  });
  for (const produto of produtosUnicos.values()) {
    add("75", reg75(produto, periodoInicio, periodoFim));
  }

  // ── Reg.90 — encerramento ──
  const reg90Linhas = reg90(empresa, totais, linhas.length);

  // Unir tudo com CRLF (padrão Windows exigido pelo validador)
  const conteudo = [...linhas, ...reg90Linhas].join("\r\n");

  return { conteudo, totalNotas: notasPeriodo.length };
}