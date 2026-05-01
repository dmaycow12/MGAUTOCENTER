// Gerador de SINTEGRA - Layout padrão MG
// Baseado no arquivo real do sistema antigo (Janeiro/2026)
// Registros: 10, 11, 50, 54, 75, 90

// ============================================================
// REGRAS DO SINTEGRA MG (verificadas no arquivo de referência)
// - Notas de SAÍDA próprias (NFe/NFCe emitidas): emitente = "P"
// - Notas de ENTRADA (compras, Importadas/Lançadas): emitente = "T"
// - NFe modelo 55, NFCe modelo 65 — ambos entram
// - NFSe NÃO entra no SINTEGRA
// - CFOP de saída padrão: 5405 (peças com ST)
// - CFOP de entrada padrão: lido do item, ou 1403 default
// ============================================================

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

// CPF: preencher com zeros à esquerda até 14 dígitos
function limpaDocumento(doc) {
  const d = (doc || "").replace(/\D/g, "");
  if (!d) return "00000000000000";
  return d.padStart(14, "0").slice(-14);
}

// IE: somente dígitos — se não numérica, usa "ISENTO" com 14 chars
function limpaIE(ie) {
  const soDigitos = (ie || "").replace(/\D/g, "");
  if (!soDigitos || soDigitos.length < 5) return r("ISENTO", 14);
  return soDigitos.padEnd(14, " ").substring(0, 14);
}

// Extrai itens de XML de NFe
function parseXmlItens(xmlStr) {
  if (!xmlStr || typeof xmlStr !== 'string') return [];
  const itens = [];
  const detRegex = /<det[\s\S]*?<\/det>/g;
  const matches = xmlStr.match(detRegex) || [];
  for (const det of matches) {
    const xprodMatch = det.match(/<xProd>([^<]+)<\/xProd>/);
    const ncmMatch = det.match(/<NCM>([^<]+)<\/NCM>/) || det.match(/<ncm>([^<]+)<\/ncm>/);
    const qComMatch = det.match(/<qCom>([^<]+)<\/qCom>/);
    const vUnComMatch = det.match(/<vUnCom>([^<]+)<\/vUnCom>/);
    const vProdMatch = det.match(/<vProd>([^<]+)<\/vProd>/);
    const unMatch = det.match(/<uCom>([^<]+)<\/uCom>/);
    const cprodMatch = det.match(/<cProd>([^<]+)<\/cProd>/);
    const cfopMatch = det.match(/<CFOP>([^<]+)<\/CFOP>/);
    const cstMatch = det.match(/<CST>([^<]+)<\/CST>/) || det.match(/<CSOSN>([^<]+)<\/CSOSN>/);
    itens.push({
      codigo: cprodMatch ? cprodMatch[1].substring(0, 14) : '000',
      descricao: xprodMatch ? xprodMatch[1].substring(0, 120) : 'PRODUTO',
      ncm: ncmMatch ? ncmMatch[1].replace(/\D/g, '').padEnd(8, '0').substring(0, 8) : '87089990',
      quantidade: parseFloat(qComMatch ? qComMatch[1] : '1'),
      valor_unitario: parseFloat(vUnComMatch ? vUnComMatch[1] : '0'),
      valor_total: parseFloat(vProdMatch ? vProdMatch[1] : '0'),
      unidade: unMatch ? unMatch[1].substring(0, 6) : 'UN',
      cfop: cfopMatch ? cfopMatch[1] : null,
      cst: cstMatch ? cstMatch[1].padStart(3, '0') : '060',
    });
  }
  return itens;
}

// Registro 10 - Identificação da empresa
export function reg10(empresa, periodo) {
  const ieSoDigitos = (empresa.ie || "").replace(/\D/g, "");
  const ieUsar = ieSoDigitos || "0048295510070";
  const ieCampo = ieUsar.padEnd(14, " ").substring(0, 14);
  const fax = (empresa.fax || empresa.fone || "").replace(/\D/g, "").padEnd(10, "0").substring(0, 10);
  return (
    "10" +
    limpaCNPJ(empresa.cnpj) +    // 14
    ieCampo +                     // 14
    r(empresa.nome, 35) +         // 35
    r(empresa.municipio, 30) +    // 30
    r(empresa.uf, 2) +            //  2
    r(fax, 10) +                  // 10
    rData(periodo.inicio) +       //  8
    rData(periodo.fim) +          //  8
    "3" +                         //  1 Convênio 76/03 e 20/04
    "3" +                         //  1 Totalidade das operações
    "1"                           //  1 Normal
  );
}

// Registro 11 - Dados do estabelecimento
export function reg11(empresa) {
  const numeroDigitos = (empresa.numero || "1355").replace(/\D/g, "") || "1355";
  const numero = numeroDigitos.padStart(5, "0").slice(-5);
  const foneDigitos = (empresa.fone || "3438225092").replace(/\D/g, "").padEnd(12, "0").substring(0, 12);
  return (
    "11" +
    r(empresa.logradouro || "RUA RUI BARBOSA", 34) +   // 34
    numero +                                            //  5
    r(empresa.complemento || "", 22) +                 // 22
    r(empresa.bairro || "CENTRO", 15) +                // 15
    r((empresa.cep || "38700327").replace(/\D/g, ""), 8) + //  8
    r(empresa.responsavel || "MAYCOW", 28) +           // 28
    r(foneDigitos, 12, "R", "0")                       // 12
  );
}

// Registro 50 - Cabeçalho de notas fiscais
// CFOP: para notas de saída (P) usa o cfop da nota ou 5405 default
//        para notas de entrada (T) usa o cfop da nota ou 1403 default
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada" || nota.status === "Lançada";
  const codSit = nota.status === "Cancelada" ? "S" : "N";
  const emitente = isEntrada ? "T" : "P";
  const modelo = nota.tipo === "NFCe" ? "65" : "55";

  // CFOP: tentar ler do campo da nota, senão usar default
  const cfopNota = (nota.cfop || "").replace(/\D/g, "");
  const cfop = cfopNota || (isEntrada ? "1403" : "5405");

  return (
    "50" +
    limpaDocumento(nota.cliente_cpf_cnpj) +        // 14
    limpaIE(nota.cliente_ie || "") +               // 14
    rData(nota.data_emissao) +                     //  8
    r(nota.cliente_estado || empresa.uf, 2) +      //  2
    r(modelo, 2) +                                 //  2 — 55 (NFe) ou 65 (NFCe)
    rZ(nota.serie || "1", 3) +                     //  3
    rZ(nota.numero, 6) +                           //  6
    r(cfop, 4) +                                   //  4
    emitente +                                     //  1
    rN(nota.valor_total, 13) +                     // 13 valor total
    rN(0, 13) +                                    // 13 base ICMS
    rN(0, 13) +                                    // 13 valor ICMS
    rN(nota.valor_total, 13) +                     // 13 isentas/outras
    rN(0, 13) +                                    // 13 outras
    r("0000", 4) +                                 //  4 alíquota ICMS
    r(codSit, 1)                                   //  1 situação
  );
}

// Registro 54 - Itens das notas
export function reg54(nota, item, numItem, empresa) {
  const isEntrada = nota.status === "Importada" || nota.status === "Lançada";
  const modelo = nota.tipo === "NFCe" ? "65" : "55";

  // CFOP do item (lido do XML) tem prioridade; senão usa da nota ou default
  const cfopItem = (item.cfop || "").replace(/\D/g, "");
  const cfopNota = (nota.cfop || "").replace(/\D/g, "");
  const cfop = cfopItem || cfopNota || (isEntrada ? "1403" : "5405");

  const cst = (item.cst || "060").padStart(3, "0").substring(0, 3);
  const ncm = (item.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  const cnpjCampo = limpaDocumento(nota.cliente_cpf_cnpj);
  const codigoProd = r(item.codigo || "000", 14);
  const qtd = Number(item.quantidade) || 1;
  const vUnit = Number(item.valor_unitario) || (Number(item.valor_total || 0) / qtd);

  return (
    "54" +
    cnpjCampo +                     // 14
    r(modelo, 2) +                  //  2
    rZ(nota.serie || "1", 3) +      //  3
    rZ(nota.numero, 6) +            //  6
    r(cfop, 4) +                    //  4
    r(cst, 3) +                     //  3
    rZ(numItem + 1, 3) +            //  3
    codigoProd +                    // 14
    rN(qtd, 11) +                   // 11
    rN(vUnit, 12) +                 // 12
    rN(0, 12) +                     // 12 desconto
    rN(0, 12) +                     // 12 base ICMS
    rN(0, 12) +                     // 12 valor ICMS
    rN(0, 12) +                     // 12 IPI
    r("0000", 4)                    //  4 alíquota ICMS
  );
}

// Registro 75 - Cadastro de produtos
export function reg75(produto, periodoInicio, periodoFim) {
  const ncm = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  return (
    "75" +
    rData(periodoInicio) +            //  8
    rData(periodoFim) +               //  8
    r(produto.codigo || "000", 14) +  // 14
    r(ncm, 8) +                       //  8
    r(produto.descricao, 53) +        // 53
    r(produto.unidade || "UN", 6) +   //  6
    rZ(0, 5) +                        //  5 alíq. IPI
    r("0000", 4) +                    //  4 alíq. ICMS
    rZ(0, 5) +                        //  5 % red. BC
    rZ(0, 13)                         // 13 base ST
  );
}

// Registro 90 - Encerramento
export function reg90(empresa, totais, linhasAnteriores) {
  const BR = r("", 85);
  const CNPJ = limpaCNPJ(empresa.cnpj);
  const IE = (empresa.ie || "").replace(/\D/g, "").padEnd(14, " ").substring(0, 14);

  const tiposReg90 = ["50", "54", "75"].filter(t => totais[t] > 0);
  const totalLinhasReg90 = tiposReg90.length + 1;
  const totalGeral = linhasAnteriores + totalLinhasReg90;
  const numReg90 = String(totalLinhasReg90);

  const linhas = tiposReg90.map(tipo =>
    "90" + CNPJ + IE + tipo + rZ(totais[tipo], 8) + BR + numReg90
  );
  linhas.push("90" + CNPJ + IE + "99" + rZ(totalGeral, 8) + BR + numReg90);
  return linhas;
}

// ============================================================
// Função principal
// ============================================================
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

  // Filtrar notas do período (excluindo Rascunho e NFSe)
  const notasPeriodo = notas.filter(n => {
    const d = (n.data_emissao || "").substring(0, 10);
    if (d < periodoInicio || d > periodoFim) return false;
    if (n.status === "Rascunho") return false;
    if (n.tipo === "NFSe") return false; // NFSe não entra no SINTEGRA
    return true;
  });

  // Deduplicar por tipo+série+número
  const vistas = new Set();
  const notasSintegra = notasPeriodo.filter(n => {
    const chave = `${n.tipo}_${n.serie || "1"}_${n.numero}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  // Reg.50 — cabeçalhos
  for (const nota of notasSintegra) {
    addLinha("50", reg50(nota, empresa));
  }

  // Reg.54 — itens + coleta de produtos para Reg.75
  const codigosNosItens = new Set();
  const itensPorCodigo = new Map();

  for (const nota of notasSintegra) {
    let itens = [];

    // Tentar ler itens do xml_content
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].descricao) {
          itens = parsed;
        } else {
          itens = parseXmlItens(nota.xml_content);
        }
      } catch {
        itens = parseXmlItens(nota.xml_content);
      }
    }

    // Tentar xml_original se ainda sem itens
    if (itens.length === 0 && nota.xml_original) {
      itens = parseXmlItens(nota.xml_original);
    }

    // Fallback: item genérico com valor total da nota
    if (itens.length === 0) {
      itens = [{
        codigo: "000",
        descricao: "MERCADORIA",
        ncm: "87089990",
        unidade: "UN",
        quantidade: 1,
        valor_unitario: nota.valor_total || 0,
        valor_total: nota.valor_total || 0,
        cfop: null,
        cst: "060",
      }];
    }

    itens.forEach((item, idx) => {
      addLinha("54", reg54(nota, item, idx, empresa));
      const cod = (item.codigo || "").trim();
      if (cod && cod !== "000") {
        codigosNosItens.add(cod);
        if (!itensPorCodigo.has(cod)) itensPorCodigo.set(cod, item);
      }
    });
  }

  // Reg.75 — cadastro de produtos (estoque primeiro, depois itens da NF)
  const produtosUnicos = new Map();

  // Prioridade 1: estoque cadastrado
  estoque.forEach(p => {
    const cod = (p.codigo || "").trim();
    if (!cod || !p.descricao?.trim()) return;
    if (!codigosNosItens.has(cod)) return;
    if (!produtosUnicos.has(cod)) produtosUnicos.set(cod, p);
  });

  // Prioridade 2: item da própria NF
  for (const [cod, item] of itensPorCodigo.entries()) {
    if (produtosUnicos.has(cod)) continue;
    produtosUnicos.set(cod, {
      codigo: cod,
      descricao: item.descricao || "PRODUTO",
      ncm: item.ncm || "87089990",
      unidade: item.unidade || "UN",
    });
  }

  for (const produto of produtosUnicos.values()) {
    addLinha("75", reg75(produto, periodoInicio, periodoFim));
  }

  // Reg.90 — encerramento
  const linhasReg90 = reg90(empresa, totais, linhas.length);
  const todasLinhas = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo: todasLinhas, totalNotas: notasSintegra.length };
}