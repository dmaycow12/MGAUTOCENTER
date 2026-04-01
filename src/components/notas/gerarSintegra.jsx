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
  const ieSoDigitos = (empresa.ie || "").replace(/\D/g, "");
  const ieUsar = ieSoDigitos || "0048295510070";
  const ieCampo = ieUsar.padEnd(14, " ").substring(0, 14);
  const fax = (empresa.fax || "").replace(/\D/g, "") || "0000000000";
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
    "3" + // Convênio 76/03 e 20/04
    "3" + // Totalidade das operações
    "1"   // Normal
  );
}

// Registro 11 - Dados do estabelecimento
// Layout: 2+34+5+22+15+8+28+12 = 126 chars
export function reg11(empresa) {
  const numeroDigitos = (empresa.numero || "1355").replace(/\D/g, "") || "1355";
  const numero = numeroDigitos.padStart(5, "0").slice(-5);
  const foneDigitos = (empresa.fone || "3438225092").replace(/\D/g, "") || "3438225092";
  return (
    "11" +
    r(empresa.logradouro || "RUA RUI BARBOSA", 34) +
    numero +
    r(empresa.complemento, 22) +
    r(empresa.bairro || "CENTRO", 15) +
    r((empresa.cep || "38700327").replace(/\D/g, ""), 8) +
    r(empresa.responsavel || "MAYCOW", 28) +
    r(foneDigitos, 12, "R", "0")
  );
}

// Registro 50 - Notas fiscais (cabeçalho)
// Layout: 2+14+14+8+2+2+3+6+4+1+13+13+13+13+13+4+1 = 126 chars
// SINTEGRA MG aceita apenas modelo 55 (NFe). NFCe (65) deve ser excluída.
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada";
  const codSit = nota.status === "Cancelada" ? "S" : "N";
  const cfop = isEntrada ? "1102" : "5405";
  const emitente = isEntrada ? "T" : "P";
  const cnpjDoc = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "");
  const cnpjUsar = cnpjDoc.length >= 11 ? cnpjDoc.padEnd(14, "0").substring(0, 14) : limpaCNPJ(empresa.cnpj);

  return (
    "50" +
    cnpjUsar +                                    // 14
    limpaIE(nota.cliente_ie || "") +              // 14
    rData(nota.data_emissao) +                    //  8
    r(nota.cliente_estado || empresa.uf, 2) +     //  2
    r("55", 2) +                                  //  2 — sempre 55 (NFe)
    rZ(nota.serie || "1", 3) +                    //  3
    rZ(nota.numero, 6) +                          //  6
    r(cfop, 4) +                                  //  4
    emitente +                                    //  1
    rN(nota.valor_total, 13) +                    // 13
    rN(0, 13) +                                   // 13 base ICMS
    rN(0, 13) +                                   // 13 valor ICMS
    rN(nota.valor_total, 13) +                    // 13 isentas
    rN(0, 13) +                                   // 13 outras
    r("0000", 4) +                                //  4 alíquota
    r(codSit, 1)                                  //  1 situação
  );
}

// Registro 54 - Itens das notas
// Layout: 2+14+2+3+6+4+3+3+14+11+12+12+12+12+12+4 = 126 chars
export function reg54(nota, item, numItem, empresa) {
  const cfop = nota.status === "Importada" ? "1102" : "5405";
  const cst = "060";
  const ncm = (item.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  const cnpjDoc54 = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "");
  const cnpjCampo = cnpjDoc54.length >= 11 ? cnpjDoc54.padEnd(14, "0").substring(0, 14) : limpaCNPJ(empresa.cnpj);
  // Código LEFT-align (igual ao Reg.75) para que o validador faça o match
  const codigoProd = r(item.codigo || "000", 14);

  return (
    "54" +
    cnpjCampo +                   // 14
    r("55", 2) +                  //  2 — sempre 55 (NFe)
    rZ(nota.serie || "1", 3) +    //  3 — mesmo formato do Reg.50
    rZ(nota.numero, 6) +          //  6
    r(cfop, 4) +                  //  4
    r(cst, 3) +                   //  3
    rZ(numItem + 1, 3) +          //  3
    codigoProd +                  // 14
    rN(item.quantidade || 1, 11) + // 11
    rN(item.valor_unitario || (item.valor_total / (item.quantidade || 1)), 12) + // 12
    rN(0, 12) +                   // 12 desconto
    rN(0, 12) +                   // 12 base ICMS
    rN(0, 12) +                   // 12 valor ICMS
    rN(0, 12) +                   // 12 IPI
    r("0000", 4)                  //  4 alíquota ICMS
  );
}

// Registro 75 - Cadastro de produtos
// Layout: 2+8+8+14+8+53+6+13+13 = 125 chars + \n = 126
export function reg75(produto, periodoInicio, periodoFim) {
  const ncm = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  // Código LEFT-align (igual ao Reg.54) para match do validador
  return (
    "75" +
    rData(periodoInicio) +           //  8
    rData(periodoFim) +              //  8
    r(produto.codigo || "000", 14) + // 14 — left-align igual ao Reg.54
    r(ncm, 8) +                      //  8
    r(produto.descricao, 53) +       // 53
    r(produto.unidade || "UN", 6) +  //  6
    rN(produto.valor_venda || 0, 13) + // 13
    rN(0, 13)                        // 13 IPI
  );
}

// Registro 90 - Encerramento
// Layout: 2+14+14+2+8+85+1 = 126 chars
// Retorna ARRAY de strings (não joined) — quem une é o gerarArquivoSintegra
export function reg90(empresa, totais, totalLinhas) {
  const BR = r("", 85);
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
  // Última linha: tipo 99 com total geral (todos os registros incluindo as linhas do Reg.90)
  const totalGeral = totalLinhas + linhas.length + 1; // +1 pela própria linha 99
  linhas.push(
    "90" +
    limpaCNPJ(empresa.cnpj) +
    limpaIE(empresa.ie) +
    "99" +
    rZ(totalGeral, 8) +
    BR +
    "9"
  );
  return linhas; // array, não string
}

export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
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

  addLinha("10", reg10(empresa, { inicio: periodoInicio, fim: periodoFim }));
  addLinha("11", reg11(empresa));

  const notasPeriodo = notas.filter(n => {
    const d = n.data_emissao || "";
    return d >= periodoInicio && d <= periodoFim && n.status !== "Rascunho";
  });

  // SINTEGRA MG aceita apenas NFe (modelo 55) — excluir NFCe
  // Deduplicar por número+série para evitar duplicidade
  const vistas = new Set();
  const notasSintegra = notasPeriodo.filter(n => {
    if (n.tipo !== "NFe") return false; // excluir NFCe e outros
    const chave = `${n.serie || "1"}_${n.numero}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  // Reg.50 — todos primeiro
  for (const nota of notasSintegra) {
    addLinha("50", reg50(nota, empresa));
  }

  // Reg.54 — depois, coletar códigos para Reg.75
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

  // Reg.75 — apenas produtos que aparecem nos Reg.54
  const produtosUnicos = new Map();
  estoque.forEach(p => {
    const cod = (p.codigo || "").trim();
    const desc = (p.descricao || "").trim();
    if (!cod || !desc || desc.length < 2) return;
    if (!codigosNosItens.has(cod)) return;
    if (!produtosUnicos.has(cod)) produtosUnicos.set(cod, p);
  });
  for (const produto of produtosUnicos.values()) {
    addLinha("75", reg75(produto, periodoInicio, periodoFim));
  }

  // Reg.90 retorna array — unir tudo com CRLF num único join
  const linhasReg90 = reg90(empresa, totais, linhas.length);
  const todasLinhas = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo: todasLinhas, totalNotas: notasPeriodo.length };
}