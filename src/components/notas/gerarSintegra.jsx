// Gerador de SINTEGRA - Layout padrão MG
// Registros: 10, 11, 50, 54, 75, 90

function r(str, n, dir = "L", pad = " ") {
  const s = String(str ?? "");
  if (dir === "L") return s.padEnd(n, pad).substring(0, n);
  return s.padStart(n, pad).slice(-n);
}
function rN(v, n) { return r(Math.round(Number(v || 0) * 100), n, "R", "0"); }
function rZ(v, n) { return r(String(Number(v || 0)), n, "R", "0"); }
function rData(d) { return d ? d.replace(/-/g, "") : "        "; }
function limpaCNPJ(c) { return (c || "").replace(/\D/g, "").padEnd(14, "0").substring(0, 14); }
function limpaIE(ie) { return (ie || "ISENTO").padEnd(14, " ").substring(0, 14); }

// Registro 10 - Identificação da empresa
export function reg10(empresa, periodo) {
  // IE: pega somente dígitos; se vazio usa a IE padrão da MG AUTOCENTER
  const ieSoDigitos = (empresa.ie || "").replace(/\D/g, "");
  const ieUsar = ieSoDigitos || "0048295510070";
  const ieCampo = ieUsar.padEnd(14, " ").substring(0, 14);
  const fax = (empresa.fax || "").replace(/\D/g, "") || "0000000000";
  // Campos fixos do layout:
  // pos 124 = código identificação estrutura: "3" = Convênio 76/03 e 20/04
  // pos 125 = natureza das operações: "3" = Totalidade das operações do informante
  // pos 126 = finalidade: "1" = Normal
  const COD_ESTRUTURA = "3";
  const NATUREZA = "3";
  const FINALIDADE = "1";
  return (
    "10" +
    limpaCNPJ(empresa.cnpj) +
    ieCampo +
    r(empresa.nome, 35) +
    r(empresa.municipio, 30) +
    r(empresa.uf, 2) +
    r(fax.substring(0, 10).padEnd(10, "0"), 10) +
    rData(periodo.inicio) +
    rData(periodo.fim) +
    COD_ESTRUTURA +
    NATUREZA +
    FINALIDADE
  );
}

// Registro 11 - Dados do estabelecimento
// Layout aceito pela SEFAZ MG: 2+34+5+22+15+8+28+12 = 126 chars
// SEM município, SEM UF, SEM fax — responsável ANTES do telefone
export function reg11(empresa) {
  const numeroDigitos = (empresa.numero || "1355").replace(/\D/g, "") || "1355";
  const numero = numeroDigitos.padStart(5, "0").slice(-5);
  const foneDigitos = (empresa.fone || "3438225092").replace(/\D/g, "") || "3438225092";
  return (
    "11" +
    r(empresa.logradouro || "RUA RUI BARBOSA", 34) + //  34
    numero +                                          //   5
    r(empresa.complemento, 22) +                      //  22
    r(empresa.bairro || "CENTRO", 15) +               //  15
    r((empresa.cep || "38700327").replace(/\D/g, ""), 8) + //  8
    r(empresa.responsavel || "MAYCOW", 28) +          //  28
    r(foneDigitos, 12, "R", "0")                      //  12 — zero-padded à esq. ex: 034998791260
  );
}

// Registro 50 - Notas fiscais (cabeçalho)
// Layout: 2+14+14+8+2+2+3+6+4+1+13+13+12+13+13+4+1 = 125 chars + \n = 126
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada";
  const codSit = nota.status === "Cancelada" ? "S" : "N";
  const modelo = nota.tipo === "NFCe" ? "65" : "55";
  const cfop = isEntrada ? "1102" : "5405";
  // Emitente: P = próprio (saída), T = terceiros (entrada)
  const emitente = isEntrada ? "T" : "P";
  // CNPJ: usar empresa quando cliente não tem CNPJ válido (saídas próprias)
  const cnpjDoc = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "");
  const cnpjUsar = cnpjDoc.length >= 11 ? cnpjDoc.padEnd(14,"0").substring(0,14) : limpaCNPJ(empresa.cnpj);

  return (
    "50" +
    cnpjUsar +                           // 14
    limpaIE(nota.cliente_ie || "") +     // 14
    rData(nota.data_emissao) +           //  8
    r(nota.cliente_estado || empresa.uf, 2) + //  2
    r(modelo, 2) +                       //  2
    rZ(nota.serie || "1", 3) +           //  3
    rZ(nota.numero, 6) +                 //  6
    r(cfop, 4) +                         //  4 — CFOP são 4 chars
    emitente +                           //  1 — P ou T
    rN(nota.valor_total, 13) +           // 13
    rN(0, 13) +                          // 13 base ICMS
    rN(0, 13) +                          // 13 valor ICMS (13, não 12!)
    rN(nota.valor_total, 13) +           // 13 isentas
    rN(0, 13) +                          // 13 outras
    r("0000", 4) +                       //  4 alíquota
    r(codSit, 1)                         //  1 situação
  );
}

// Registro 54 - Itens das notas
// Layout exato: 2+14+2+3+6+4+3+3+14+11+12+12+12+12+12+4 = 126 chars
export function reg54(nota, item, numItem, empresa) {
  const modelo = nota.tipo === "NFCe" ? "65" : "55";
  const cfop = nota.status === "Importada" ? "1102" : "5405";
  const cst = "060"; // Tributado com substituição tributária
  const ncm = (item.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  // CNPJ: mesma lógica do Reg.50 (para que o validador encontre o correspondente)
  const cnpjDoc54 = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "");
  const cnpjCampo = cnpjDoc54.length >= 11 ? cnpjDoc54.padEnd(14, "0").substring(0, 14) : limpaCNPJ(empresa.cnpj);
  // Código do produto: justificado à direita com zeros (14 chars)
  const codigoProd = r(item.codigo || "000", 14, "R", "0");

  return (
    "54" +
    cnpjCampo +                   // 14
    r(modelo, 2) +                // 2
    r(nota.serie || "1", 3) +     // 3
    rZ(nota.numero, 6) +          // 6
    r(cfop, 4) +                  // 4 — cfop são 4 chars
    r(cst, 3) +                   // 3 — CST
    rZ(numItem + 1, 3) +          // 3
    codigoProd +                  // 14
    rN(item.quantidade || 1, 11) + // 11
    rN(item.valor_unitario || (item.valor_total / (item.quantidade || 1)), 12) + // 12
    rN(0, 12) +                   // 12 — desconto
    rN(0, 12) +                   // 12 — base ICMS
    rN(0, 12) +                   // 12 — valor ICMS
    rN(0, 12) +                   // 12 — IPI
    r("0000", 4)                  //  4 — alíquota ICMS
  );
}

// Registro 75 - Cadastro de produtos
// Layout: 2+8+8+14+8+53+6+13+13 = 125 chars + \n = 126
// Apenas emitir produtos que aparecem nos Reg.54
export function reg75(produto, periodoInicio, periodoFim) {
  const ncm = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  return (
    "75" +
    rData(periodoInicio) +           //  8
    rData(periodoFim) +              //  8
    r(produto.codigo || "000", 14) + // 14
    r(ncm, 8) +                      //  8
    r(produto.descricao, 53) +       // 53
    r(produto.unidade || "UN", 6) +  //  6
    rN(produto.valor_venda || 0, 13) + // 13
    rN(0, 13)                        // 13 IPI
  );
}

// Registro 90 - Encerramento
// Layout: 2+14+14+2+8+85+1 = 126 chars
// Não incluir tipos 10 e 11 nos totais
export function reg90(empresa, totais, totalLinhas) {
  const BR = r("", 85); // 85 espaços em branco obrigatórios
  // Filtrar tipos que não devem aparecer no Reg90 (10 e 11)
  const tiposValidos = Object.entries(totais).filter(([reg]) => reg !== "10" && reg !== "11");
  const linhas = tiposValidos.map(([reg, qtd]) =>
    "90" +
    limpaCNPJ(empresa.cnpj) +
    limpaIE(empresa.ie) +
    r(reg, 2) +
    rZ(qtd, 8) +
    BR +
    "1"
  );
  // Última linha: tipo 99 com total geral de registros
  linhas.push(
    "90" +
    limpaCNPJ(empresa.cnpj) +
    limpaIE(empresa.ie) +
    "99" +
    rZ(totalLinhas + linhas.length + 1, 8) +
    BR +
    "9"
  );
  return linhas.join("\r\n");
}

export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  // Montar dados da empresa a partir das configurações
  const cfg = (chave) => configs.find(c => c.chave === chave)?.valor || "";

  const empresa = {
    cnpj: cfg("cnpj") || "54043647000120",
    ie: cfg("inscricao_estadual") || "0048295510070",
    nome: cfg("razao_social") || "MG AUTOCENTER LTDA",
    municipio: cfg("municipio") || "Patos de Minas",
    uf: cfg("uf") || "MG",
    logradouro: cfg("endereco") || "",
    numero: cfg("numero") || "",
    complemento: cfg("complemento") || "",
    bairro: cfg("bairro") || "",
    cep: cfg("cep") || "",
    fone: cfg("telefone") || "",
    fax: cfg("fax") || "",
    responsavel: cfg("responsavel") || "",
    ie_sub: cfg("ie_substituto") || "",
  };

  const linhas = [];
  const totais = {};
  const addLinha = (reg, linha) => {
    linhas.push(linha);
    totais[reg] = (totais[reg] || 0) + 1;
  };

  // Reg 10 e 11
  addLinha("10", reg10(empresa, { inicio: periodoInicio, fim: periodoFim }));
  addLinha("11", reg11(empresa));

  // Filtrar notas do período
  const notasPeriodo = notas.filter(n => {
    const d = n.data_emissao || "";
    return d >= periodoInicio && d <= periodoFim && n.status !== "Rascunho";
  });

  // Reg 50 — todos primeiro, depois Reg 54 (SINTEGRA exige ordem crescente de tipo)
  const notasSintegra = notasPeriodo.filter(n => n.tipo === "NFe" || n.tipo === "NFCe");

  // Primeiro: todos os Reg.50
  for (const nota of notasSintegra) {
    addLinha("50", reg50(nota, empresa));
  }

  // Depois: todos os Reg.54 — coletar códigos de produtos para Reg.75
  const codigosNosItens = new Set();
  for (const nota of notasSintegra) {
    let itens = [];
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        if (Array.isArray(parsed)) itens = parsed;
      } catch {}
    }
    itens.forEach((item, idx) => {
      addLinha("54", reg54(nota, item, idx, empresa));
      if (item.codigo) codigosNosItens.add(item.codigo);
    });
  }

  // Reg 75 — apenas produtos que têm Reg.54 correspondente
  const produtosUnicos = new Map();
  estoque.forEach(p => {
    const cod = (p.codigo || "").trim();
    const desc = (p.descricao || "").trim();
    if (!cod || !desc || desc.length < 2) return;
    if (!codigosNosItens.has(cod)) return; // só produtos que aparecem no Reg.54
    if (!produtosUnicos.has(cod)) produtosUnicos.set(cod, p);
  });
  for (const produto of produtosUnicos.values()) {
    addLinha("75", reg75(produto, periodoInicio, periodoFim));
  }

  // Reg 90 - encerramento
  const fechamento = reg90(empresa, totais, linhas.length);
  const todasLinhas = [...linhas, fechamento].join("\r\n"); // CRLF padrão Windows; validador conta só os 126 chars de dados

  return { conteudo: todasLinhas, totalNotas: notasPeriodo.length };
}