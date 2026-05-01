/**
 * GERADOR SINTEGRA MG - Convênio ICMS 57/95
 * Baseado em: https://github.com/nfephp-org/sped-sintegra
 * 
 * MG - Obrigados ao SINTEGRA:
 * - Contribuintes que usam Processamento Eletrônico de Dados (PED)
 * - Que emitem NF-e (Nota Fiscal Eletrônica)
 * - Que emitem CT-e (Conhecimento de Transporte)
 * - Que usam ECF (Equipamento Emissor de Cupom Fiscal)
 * 
 * DISPENSADOS:
 * - Quem transmite EFD (Escrituração Fiscal Digital)
 */

// ============== UTILIDADES ==============
function r(str, n, dir = "L", pad = " ") {
  const s = String(str ?? "");
  if (dir === "L") return s.padEnd(n, pad).substring(0, n);
  return s.padStart(n, pad).slice(-n);
}

function rN(v, decimals = 2) {
  const cents = Math.round(Number(v || 0) * Math.pow(10, decimals));
  const formatted = String(cents).padStart(decimals + 1, "0");
  return formatted;
}

function rZ(v, n) {
  return String(Number(v || 0)).padStart(n, "0").slice(-n);
}

function rData(d) {
  if (!d) return "00000000";
  const clean = String(d).substring(0, 10).replace(/-/g, "");
  if (clean.length !== 8) return "00000000";
  return clean;
}

function limpaCNPJ(c) {
  return (c || "").replace(/\D/g, "").padEnd(14, "0").substring(0, 14);
}

function limpaIE(ie) {
  const s = (ie || "").replace(/\D/g, "");
  if (!s || s === "0000000000000") return "ISENTO        ";
  return s.length <= 14 ? s.padEnd(14, " ") : s.substring(0, 14);
}

function parseXmlItens(xmlStr) {
  if (!xmlStr || typeof xmlStr !== "string") return [];
  const itens = [];
  const detRegex = /<det[\s\S]*?<\/det>/g;
  const matches = xmlStr.match(detRegex) || [];

  for (const det of matches) {
    const codMatch = det.match(/<code>([^<]+)<\/code>/) || det.match(/<XFCI>([^<]+)<\/XFCI>/);
    const xprodMatch = det.match(/<xProd>([^<]+)<\/xProd>/);
    const ncmMatch = det.match(/<NCM>([^<]+)<\/NCM>/) || det.match(/<ncm>([^<]+)<\/ncm>/);
    const qComMatch = det.match(/<qCom>([^<]+)<\/qCom>/) || det.match(/<qcom>([^<]+)<\/qcom>/);
    const vUnComMatch = det.match(/<vUnCom>([^<]+)<\/vUnCom>/) || det.match(/<vuncom>([^<]+)<\/vuncom>/);
    const vItemMatch = det.match(/<vItem>([^<]+)<\/vItem>/) || det.match(/<vitem>([^<]+)<\/vitem>/);
    const unMatch = det.match(/<uCom>([^<]+)<\/uCom>/) || det.match(/<ucom>([^<]+)<\/ucom>/);

    itens.push({
      codigo: (codMatch ? codMatch[1] : "000").substring(0, 14),
      descricao: xprodMatch ? xprodMatch[1].substring(0, 120) : "PRODUTO",
      ncm: ncmMatch ? ncmMatch[1].replace(/\D/g, "").padEnd(8, "0").substring(0, 8) : "87089990",
      quantidade: parseFloat(qComMatch ? qComMatch[1] : "1"),
      valor_unitario: parseFloat(vUnComMatch ? vUnComMatch[1] : "0"),
      valor_total: parseFloat(vItemMatch ? vItemMatch[1] : "0"),
      unidade: unMatch ? unMatch[1].substring(0, 6) : "UN",
    });
  }
  return itens;
}

// ============== REGISTROS ==============

/**
 * REGISTRO 10 - Identificação da empresa
 * Formato: 2+14+14+35+30+2+10+8+8+1+1+1 = 126 caracteres
 */
export function reg10(empresa, periodo) {
  const ieSoDigitos = (empresa.ie || "").replace(/\D/g, "");
  const ieCampo = ieSoDigitos.padEnd(14, " ").substring(0, 14);
  const faxDigitos = (empresa.fax || "").replace(/\D/g, "") || "0000000000";
  const faxCampo = faxDigitos.padStart(10, "0").slice(-10);

  return (
    "10" +
    limpaCNPJ(empresa.cnpj) +
    ieCampo +
    r(empresa.nome, 35) +
    r(empresa.municipio, 30) +
    r(empresa.uf, 2) +
    faxCampo +
    rData(periodo.inicio) +
    rData(periodo.fim) +
    "3" + // Código de identificação da estrutura (3=Misto obrigatório após 2004)
    "1" + // Código de identificação da natureza das operações (1=Totalidade, 2=Parcial, 3=Simples)
    "1"   // Código de finalidade (1=Normal, 2=Retificação, 3=Substituta)
  );
}

/**
 * REGISTRO 11 - Dados complementares do estabelecimento
 * Formato: 2+34+5+22+15+8+28+12 = 126 caracteres
 */
export function reg11(empresa) {
  const numeroDigitos = (empresa.numero || "1355").replace(/\D/g, "") || "1355";
  const numero = numeroDigitos.padStart(5, "0").slice(-5);
  const foneDigitos = (empresa.fone || "0000000000").replace(/\D/g, "") || "0000000000";
  const foneCampo = foneDigitos.padStart(12, "0").slice(-12);

  return (
    "11" +
    r(empresa.logradouro || "RUA", 34) +
    numero +
    r(empresa.complemento, 22) +
    r(empresa.bairro || "CENTRO", 15) +
    r((empresa.cep || "00000000").replace(/\D/g, ""), 8) +
    r(empresa.responsavel || "RESPONSAVEL", 28) +
    foneCampo
  );
}

/**
 * REGISTRO 50 - Notas fiscais (CABEÇALHO)
 * Somente modelo 55 (NFe). Modelos 02 e 65 (NFCe) vão para Registro 61.
 * Formato: 2+14+14+8+2+2+3+6+4+1+13+13+13+13+13+4+1 = 126 caracteres
 */
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada";
  const codSit = nota.status === "Cancelada" ? "S" : "N"; // S=Cancelado, N=Normal
  const cfop = isEntrada ? "1102" : "5405";
  const emitente = isEntrada ? "T" : "P"; // T=Terceiros, P=Próprio

  const cnpjDoc = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "").padEnd(14, "0").substring(0, 14);

  return (
    "50" +
    cnpjDoc +
    limpaIE(nota.cliente_ie || "") +
    rData(nota.data_emissao) +
    r(nota.cliente_estado || empresa.uf, 2) +
    r("55", 2) + // Sempre 55 (NFe)
    r(String(nota.serie || "1"), 3) + // Série alfanumérica
    rZ(nota.numero, 6) +
    r(cfop, 4) +
    emitente +
    rN(nota.valor_total, 2).padStart(13, "0") +
    rN(0, 2).padStart(13, "0") + // Base ICMS
    rN(0, 2).padStart(13, "0") + // Valor ICMS
    rN(nota.valor_total, 2).padStart(13, "0") + // Isentas
    rN(0, 2).padStart(13, "0") + // Outras
    r("0000", 4) + // Alíquota
    codSit // Situação
  );
}

/**
 * REGISTRO 54 - Itens das notas
 * Um para cada item de mercadoria no Registro 50
 * Formato: 2+14+2+3+6+4+3+3+14+11+12+12+12+12+12+4 = 126 caracteres
 */
export function reg54(nota, item, numItem, empresa) {
  const cfop = nota.status === "Importada" ? "1102" : "5405";
  const cst = "060";
  const ncm = (item.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  const cnpjDoc = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "").padEnd(14, "0").substring(0, 14);
  const codigoProd = r(item.codigo || "000", 14); // LEFT-ALIGN

  return (
    "54" +
    cnpjDoc +
    r("55", 2) + // Sempre 55 (NFe)
    r(String(nota.serie || "1"), 3) +
    rZ(nota.numero, 6) +
    r(cfop, 4) +
    r(cst, 3) +
    rZ(numItem + 1, 3) +
    codigoProd +
    rN(item.quantidade || 1, 3).padStart(11, "0") + // 8v3
    rN(item.valor_unitario || (item.valor_total / (item.quantidade || 1)), 2).padStart(12, "0") + // 10v2
    rN(0, 2).padStart(12, "0") + // Desconto
    rN(0, 2).padStart(12, "0") + // Base ICMS
    rN(0, 2).padStart(12, "0") + // Base ICMS ST
    rN(0, 2).padStart(12, "0") + // IPI
    r("0000", 4) // Alíquota
  );
}

/**
 * REGISTRO 61 - NF Venda a Consumidor (Modelo 65 - NFCe, Modelo 02)
 * Convênio ICMS 57/95 - Formato exato: 126 caracteres
 * Agrupa vendas a consumidor por dia/série
 */
export function reg61(data, serie, numInicial, numFinal, valorTotal, baseIcms = 0, valorIcms = 0, isentas = 0, outras = 0, aliquota = "0000", modelo = "65") {
  let dataFormatada = "00000000";
  if (data && data.length >= 10) {
    const [ano, mes, dia] = data.split("-");
    dataFormatada = `${ano}${mes}${dia}`; // AAAAMMDD
  }

  const ser = r(String(serie || "1"), 3); // Alfanumérico 1-3 chars
  const subserie = r("", 2);
  const numini = rZ(numInicial || 0, 6);
  const numfim = rZ(numFinal || 0, 6);
  const valtot = rN(valorTotal || 0, 2).padStart(13, "0");
  const baseIcm = rN(baseIcms || 0, 2).padStart(13, "0");
  const valIcm = rN(valorIcms || 0, 2).padStart(12, "0");
  const isen = rN(isentas || 0, 2).padStart(13, "0");
  const outr = rN(outras || 0, 2).padStart(13, "0");
  const aliq = rZ(aliquota || "0000", 4);
  const sit = "N"; // N=Normal, S=Cancelado

  let linha = "61" +
    " ".repeat(14) +
    " ".repeat(14) +
    dataFormatada +
    rZ(modelo, 2) +
    ser +
    subserie +
    numini +
    numfim +
    valtot +
    baseIcm +
    valIcm +
    isen +
    outr +
    aliq +
    sit;

  // Garantir exato 126 caracteres
  return linha.padEnd(126, " ").substring(0, 126);
}

/**
 * REGISTRO 75 - Cadastro de produtos
 * Para produtos mencionados nos Registros 54 e 61
 * Formato: 2+8+8+14+8+53+6+5+4+5+13 = 126 caracteres
 */
export function reg75(produto, periodoInicio, periodoFim) {
  const ncm = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);

  return (
    "75" +
    rData(periodoInicio) +
    rData(periodoFim) +
    r(produto.codigo || "000", 14) +
    r(ncm, 8) +
    r(produto.descricao, 53) +
    r(produto.unidade || "UN", 6) +
    rZ(0, 5) + // IPI
    r("0000", 4) + // ICMS
    rZ(0, 5) + // Redução BC
    rZ(0, 13) // Base ST
  );
}

/**
 * REGISTRO 90 - Encerramento com totalizadores
 * Uma linha por tipo de registro + linha "99" com total geral
 */
export function reg90(empresa, totais, linhasAnteriores) {
  const BR = r("", 85); // 85 brancos
  const CNPJ = limpaCNPJ(empresa.cnpj);
  const IE = (empresa.ie || "").replace(/\D/g, "").padEnd(14, " ").substring(0, 14);

  const tiposReg90 = ["50", "54", "61", "75"].filter(t => totais[t] > 0);
  const totalLinhasReg90 = tiposReg90.length + 1; // +1 para linha 99
  const totalGeral = linhasAnteriores + totalLinhasReg90;

  const linhas = tiposReg90.map(tipo =>
    "90" + CNPJ + IE + tipo + rZ(totais[tipo], 8) + BR + rZ(totalLinhasReg90, 2)
  );

  // Linha 99 com total geral
  linhas.push("90" + CNPJ + IE + "99" + rZ(totalGeral, 8) + BR + rZ(totalLinhasReg90, 2));

  return linhas;
}

/**
 * FUNÇÃO PRINCIPAL - Gera o arquivo SINTEGRA completo
 */
export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  const cfg = (chave) => configs.find(c => c.chave === chave)?.valor || "";

  const empresa = {
    cnpj: cfg("cnpj") || "54043647000120",
    ie: cfg("inscricao_estadual") || "0048295510070",
    nome: cfg("razao_social") || "MG AUTOCENTER LTDA",
    municipio: cfg("municipio") || "Patos de Minas",
    uf: cfg("uf") || "MG",
    logradouro: cfg("endereco") || "RUA BARBOSA",
    numero: cfg("numero") || "1355",
    complemento: cfg("complemento") || "",
    bairro: cfg("bairro") || "CENTRO",
    cep: cfg("cep") || "38700327",
    fone: cfg("telefone") || "3438225092",
    fax: cfg("fax") || "3438225092",
    responsavel: cfg("responsavel") || "MAYCOW",
  };

  const linhas = [];
  const totais = {};

  const addLinha = (reg, linha) => {
    linhas.push(linha);
    totais[reg] = (totais[reg] || 0) + 1;
  };

  // Registros obrigatórios
  addLinha("10", reg10(empresa, { inicio: periodoInicio, fim: periodoFim }));
  addLinha("11", reg11(empresa));

  // Filtrar notas do período (excluindo rascunhos)
  const notasPeriodo = notas.filter(n => {
    const d = (n.data_emissao || "").substring(0, 10);
    return d >= periodoInicio && d <= periodoFim && n.status !== "Rascunho";
  });

  // SEPARAR POR TIPO E MODELO
  const vistas = new Set();
  const notasNFe = notasPeriodo.filter(n => {
    if (n.tipo !== "NFe" || !n.xml_content) return false;
    const chave = `${n.serie || "1"}_${n.numero}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  const cfePorGrupo = new Map();
  notasPeriodo
    .filter(n => n.tipo === "NFCe" && n.status !== "Cancelada")
    .forEach(n => {
      const data = (n.data_emissao || "").substring(0, 10);
      const serie = n.serie || "1";
      const chave = `${data}_${serie}`;
      if (!cfePorGrupo.has(chave)) {
        cfePorGrupo.set(chave, {
          data,
          serie,
          numInicial: null,
          numFinal: null,
          valorTotal: 0,
        });
      }
      const g = cfePorGrupo.get(chave);
      const num = parseInt(n.numero || "0", 10);
      if (num > 0) {
        if (g.numInicial === null || num < g.numInicial) g.numInicial = num;
        if (g.numFinal === null || num > g.numFinal) g.numFinal = num;
      }
      g.valorTotal += parseFloat(n.valor_total || 0);
    });

  const codigosNosItens = new Set();
  const itensPorCodigo = new Map();

  // REGISTRO 50 + 54 - NFe (modelo 55)
  for (const nota of notasNFe) {
    let itens = [];
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        itens = Array.isArray(parsed) ? parsed : parseXmlItens(nota.xml_content);
      } catch {
        itens = parseXmlItens(nota.xml_content);
      }
    }

    // Só gera Reg.50/54 se há itens
    if (itens.length > 0) {
      addLinha("50", reg50(nota, empresa));
      itens.forEach((item, idx) => {
        addLinha("54", reg54(nota, item, idx, empresa));
        if (item.codigo) {
          codigosNosItens.add(item.codigo);
          if (!itensPorCodigo.has(item.codigo)) itensPorCodigo.set(item.codigo, item);
        }
      });
    }
  }

  // REGISTRO 61 - NFCe (modelo 65)
  for (const g of cfePorGrupo.values()) {
    if (g.numInicial !== null && g.numFinal !== null && g.numInicial > 0 && g.numFinal > 0) {
      addLinha("61", reg61(g.data, g.serie, g.numInicial, g.numFinal, g.valorTotal, 0, 0, 0, 0, "0000", "65"));
    }
  }

  // REGISTRO 75 - Produtos
  const produtosUnicos = new Map();

  // Prioridade 1: Estoque cadastrado
  estoque.forEach(p => {
    const cod = (p.codigo || "").trim();
    const desc = (p.descricao || "").trim();
    if (!cod || !desc || desc.length < 2) return;
    if (!codigosNosItens.has(cod)) return;
    if (!produtosUnicos.has(cod)) produtosUnicos.set(cod, p);
  });

  // Prioridade 2: Item da própria NF (fallback)
  for (const [cod, item] of itensPorCodigo.entries()) {
    if (produtosUnicos.has(cod)) continue;
    produtosUnicos.set(cod, {
      codigo: cod,
      descricao: item.descricao || "PRODUTO",
      ncm: item.ncm || "87089990",
      unidade: item.unidade || "UN",
      valor_venda: item.valor_unitario || 0,
    });
  }

  for (const produto of produtosUnicos.values()) {
    addLinha("75", reg75(produto, periodoInicio, periodoFim));
  }

  // REGISTRO 90 + 99
  const linhasReg90 = reg90(empresa, totais, linhas.length);

  const todasLinhas = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo: todasLinhas, totalNotas: notasPeriodo.length };
}