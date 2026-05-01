// Gerador de SINTEGRA - MG (Convênio ICMS 57/95)
// Registros: 10, 11, 50, 54, 61, 75, 90

function r(str, n, dir = "L", pad = " ") {
  const s = String(str ?? "");
  if (dir === "L") return s.padEnd(n, pad).substring(0, n);
  return s.padStart(n, pad).slice(-n);
}
function rN(v, n) { return r(Math.round(Number(v || 0) * 100), n, "R", "0"); }
function rZ(v, n) { return r(String(Number(v || 0)), n, "R", "0"); }
function rData(d) {
  if (!d) return "00000000";
  const clean = String(d).substring(0, 10).replace(/-/g, "");
  return clean.length === 8 ? clean : "00000000";
}
function limpaCNPJ(c) { return (c || "").replace(/\D/g, "").padEnd(14, "0").substring(0, 14); }
function limpaIE(ie) {
  const s = (ie || "").replace(/\D/g, "");
  if (!s) return "ISENTO        ";
  return s.padEnd(14, " ").substring(0, 14);
}
function parseXmlItens(xmlStr) {
  if (!xmlStr || typeof xmlStr !== 'string') return [];
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
      codigo: (codMatch ? codMatch[1] : '000').substring(0, 14),
      descricao: xprodMatch ? xprodMatch[1].substring(0, 120) : 'PRODUTO',
      ncm: ncmMatch ? ncmMatch[1].replace(/\D/g, '').padEnd(8, '0').substring(0, 8) : '87089990',
      quantidade: parseFloat(qComMatch ? qComMatch[1] : '1'),
      valor_unitario: parseFloat(vUnComMatch ? vUnComMatch[1] : '0'),
      valor_total: parseFloat(vItemMatch ? vItemMatch[1] : '0'),
      unidade: unMatch ? unMatch[1].substring(0, 6) : 'UN',
    });
  }
  return itens;
}

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
    "3" +
    "3" +
    "1"
  );
}

// Registro 11 - Dados do estabelecimento
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

// Registro 50 - Notas fiscais (cabeçalho NFe modelo 55)
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada";
  const codSit = nota.status === "Cancelada" ? "S" : "N";
  const cfop = isEntrada ? "1102" : "5405";
  const emitente = isEntrada ? "T" : "P";
  const cnpjDoc = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "");
  const cnpjUsar = cnpjDoc.length === 11
    ? cnpjDoc.padStart(14, "0")
    : cnpjDoc.length === 14
    ? cnpjDoc
    : "00000000000000";

  return (
    "50" +
    cnpjUsar +
    limpaIE(nota.cliente_ie || "") +
    rData(nota.data_emissao) +
    r(nota.cliente_estado || empresa.uf, 2) +
    r("55", 2) +
    rZ(nota.serie || "1", 3) +
    rZ(nota.numero, 6) +
    r(cfop, 4) +
    emitente +
    rN(nota.valor_total, 13) +
    rN(0, 13) +
    rN(0, 13) +
    rN(nota.valor_total, 13) +
    rN(0, 13) +
    r("0000", 4) +
    r(codSit, 1)
  );
}

// Registro 54 - Itens das notas
export function reg54(nota, item, numItem, empresa) {
  const cfop = nota.status === "Importada" ? "1102" : "5405";
  const cst = "060";
  const ncm = (item.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  const cnpjDoc54 = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "");
  const cnpjCampo = cnpjDoc54.length === 11
    ? cnpjDoc54.padStart(14, "0")
    : cnpjDoc54.length === 14
    ? cnpjDoc54
    : "00000000000000";
  const codigoProd = r(item.codigo || "000", 14);

  return (
    "54" +
    cnpjCampo +
    r("55", 2) +
    rZ(nota.serie || "1", 3) +
    rZ(nota.numero, 6) +
    r(cfop, 4) +
    r(cst, 3) +
    rZ(numItem + 1, 3) +
    codigoProd +
    rN(item.quantidade || 1, 11) +
    rN(item.valor_unitario || (item.valor_total / (item.quantidade || 1)), 12) +
    rN(0, 12) +
    rN(0, 12) +
    rN(0, 12) +
    rN(0, 12) +
    r("0000", 4)
  );
}

// Registro 61 - Documentos fiscais venda consumidor final (NFCe modelo 65)
// Tipo 1: Resumo mensal por data/série → 126 caracteres
export function reg61(data, numInicial, numFinal, valorTotal) {
  let dataf = "00000000";
  if (data && data.length >= 10) {
    const [ano, mes, dia] = data.split('-');
    dataf = `${ano}${mes}${dia}`;
  }
  const numini = String(Math.max(0, Number(numInicial || 0))).padStart(6, "0").slice(-6);
  const numfim = String(Math.max(0, Number(numFinal || 0))).padStart(6, "0").slice(-6);
  const valtot = rN(valorTotal || 0, 14);
  
  return (
    "61" +
    " ".repeat(28) +
    dataf +
    "65" +
    numini +
    numfim +
    valtot +
    "0".repeat(60)
  );
}

// Registro 61R - Resumo por item (produto/código)
// Tipo: 61R + dados estruturados
export function reg61R(data, codigoNumerador, quantidade, valor) {
  let dataf = "0000000000";
  if (data && data.length >= 10) {
    dataf = data.substring(0, 10).replace(/-/g, "");
  }
  const cod = String(codigoNumerador || "0").padStart(20, " ").slice(-20);
  const qtd = rZ(quantidade || 0, 16);
  const val = rN(valor || 0, 13);
  
  return (
    "61R" +
    dataf +
    cod +
    qtd +
    val +
    "0".repeat(68)
  ).substring(0, 126);
}

// Registro 75 - Cadastro de produtos
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
    rZ(0, 5) +
    r("0000", 4) +
    rZ(0, 5) +
    rZ(0, 13)
  );
}

// Registro 90 - Encerramento
export function reg90(empresa, totais, linhasAnteriores) {
  const BR = r("", 85);
  const CNPJ = limpaCNPJ(empresa.cnpj);
  const IE = (empresa.ie || "").replace(/\D/g, "").padEnd(14, " ").substring(0, 14);

  const tiposReg90 = ["50", "54", "61", "61R", "75"].filter(t => totais[t] > 0);
  const totalLinhasReg90 = tiposReg90.length + 1;
  const totalGeral = linhasAnteriores + totalLinhasReg90;
  const numReg90 = String(totalLinhasReg90);

  const linhas = tiposReg90.map(tipo =>
    "90" + CNPJ + IE + tipo + rZ(totais[tipo], 8) + BR + numReg90
  );
  linhas.push("90" + CNPJ + IE + "99" + rZ(totalGeral, 8) + BR + numReg90);
  return linhas;
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
    const d = (n.data_emissao || "").substring(0, 10);
    return d >= periodoInicio && d <= periodoFim && n.status !== "Rascunho";
  });

  // NFe (modelo 55) para Reg.50/54
  const vistas = new Set();
  const notasSintegra = notasPeriodo.filter(n => {
    if (n.tipo !== "NFe") return false;
    const chave = `${n.serie || "1"}_${n.numero}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  // NFCe (modelo 65) agrupadas por data
  const nfcePorData = new Map();
  notasPeriodo
    .filter(n => n.tipo === "NFCe" && n.status !== "Cancelada")
    .forEach(n => {
      const data = (n.data_emissao || "").substring(0, 10);
      if (!nfcePorData.has(data)) {
        nfcePorData.set(data, { numInicial: 9999999, numFinal: 0, valorTotal: 0, itensMap: new Map() });
      }
      const g = nfcePorData.get(data);
      const num = parseInt(n.numero || "0", 10);
      if (num < g.numInicial) g.numInicial = num;
      if (num > g.numFinal) g.numFinal = num;
      g.valorTotal += parseFloat(n.valor_total || 0);
      
      // Coletar itens por código
      let itens = [];
      if (n.xml_content) {
        try {
          const parsed = JSON.parse(n.xml_content);
          itens = Array.isArray(parsed) ? parsed : parseXmlItens(n.xml_content);
        } catch {
          itens = parseXmlItens(n.xml_content);
        }
      }
      if (itens.length === 0) {
        itens = [{ codigo: "000", quantidade: 1, valor_total: n.valor_total || 0 }];
      }
      itens.forEach(item => {
        const cod = String(item.codigo || "000");
        const qtd = parseFloat(item.quantidade || 1);
        const val = parseFloat(item.valor_total || 0);
        if (g.itensMap.has(cod)) {
          const existing = g.itensMap.get(cod);
          existing.quantidade += qtd;
          existing.valor_total += val;
        } else {
          g.itensMap.set(cod, { quantidade: qtd, valor_total: val });
        }
      });
    });

  // Reg.50
  for (const nota of notasSintegra) {
    addLinha("50", reg50(nota, empresa));
  }

  // Reg.54
  const codigosNosItens = new Set();
  const itensPorCodigo = new Map();
  for (const nota of notasSintegra) {
    let itens = [];
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        itens = Array.isArray(parsed) ? parsed : parseXmlItens(nota.xml_content);
      } catch {
        itens = parseXmlItens(nota.xml_content);
      }
    }
    if (itens.length === 0) {
      itens = [{ codigo: "000", descricao: "PRODUTO", ncm: "87089990", unidade: "UN", quantidade: 1, valor_unitario: nota.valor_total || 0, valor_total: nota.valor_total || 0 }];
    }
    itens.forEach((item, idx) => {
      addLinha("54", reg54(nota, item, idx, empresa));
      if (item.codigo) {
        codigosNosItens.add(item.codigo);
        if (!itensPorCodigo.has(item.codigo)) itensPorCodigo.set(item.codigo, item);
      }
    });
  }

  // Reg.61 - Resumo mensal NFCe
  for (const [data, g] of nfcePorData.entries()) {
    addLinha("61", reg61(data, g.numInicial, g.numFinal, g.valorTotal));
    
    // Reg.61R - Resumo por item da NFCe
    for (const [cod, item] of g.itensMap.entries()) {
      addLinha("61R", reg61R(data, cod, item.quantidade, item.valor_total));
    }
  }

  // Reg.75
  const produtosUnicos = new Map();
  estoque.forEach(p => {
    const cod = (p.codigo || "").trim();
    const desc = (p.descricao || "").trim();
    if (!cod || !desc || desc.length < 2) return;
    if (!codigosNosItens.has(cod)) return;
    if (!produtosUnicos.has(cod)) produtosUnicos.set(cod, p);
  });
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

  // Reg.90
  const linhasReg90 = reg90(empresa, totais, linhas.length);
  const todasLinhas = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo: todasLinhas, totalNotas: notasPeriodo.length };
}