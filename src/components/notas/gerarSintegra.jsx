// Gerador de SINTEGRA - Layout Convênio ICMS 57/95
// Baseado no arquivo real do sistema antigo + legislação SEFAZ/MG oficial
//
// REGRAS DEFINITIVAS (fonte: SEFAZ/MG + CONFAZ):
// - NFe modelo 1/1-A (modelo 55): Registro 50 (por nota individual) + Reg. 54 (itens)
// - NFCe modelo 65: Registro 61 (totais DIÁRIOS por série/CFOP) + Reg. 61R (por alíquota)
// - NFSe: NÃO entra no SINTEGRA
// - Reg. 50 aceita APENAS modelos: 01, 03, 06, 22 (campo modelo = "01" para NFe)
// - Reg. 61 é agrupado por: data + modelo + série + subsérie + CFOP (uma linha por grupo)

// ============================================================
// HELPERS
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
function limpaDocumento(doc) {
  const d = (doc || "").replace(/\D/g, "");
  if (!d) return "00000000000000";
  return d.padStart(14, "0").slice(-14);
}
function limpaIE(ie) {
  const soDigitos = (ie || "").replace(/\D/g, "");
  if (!soDigitos || soDigitos.length < 5) return r("ISENTO", 14);
  return soDigitos.padEnd(14, " ").substring(0, 14);
}

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

// ============================================================
// REGISTRO 10 - Identificação da empresa
// Layout: 2+14+14+35+30+2+10+8+8+1+1+1 = 126 chars
// ============================================================
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
    "3" +                         //  1 estrutura Conv. 57/95 v. atual
    "3" +                         //  1 totalidade das operações
    "1"                           //  1 normal
  );
}

// ============================================================
// REGISTRO 11 - Dados do estabelecimento
// Layout: 2+34+5+22+15+8+28+12 = 126 chars
// ============================================================
export function reg11(empresa) {
  const numeroDigitos = (empresa.numero || "1355").replace(/\D/g, "") || "1355";
  const numero = numeroDigitos.padStart(5, "0").slice(-5);
  const foneDigitos = (empresa.fone || "034998791260").replace(/\D/g, "").padEnd(12, "0").substring(0, 12);
  return (
    "11" +
    r(empresa.logradouro || "RUA RUI BARBOSA", 34) +
    numero +
    r(empresa.complemento || "", 22) +
    r(empresa.bairro || "CENTRO", 15) +
    r((empresa.cep || "38700327").replace(/\D/g, ""), 8) +
    r(empresa.responsavel || "MAYCOW", 28) +
    r(foneDigitos, 12, "R", "0")
  );
}

// ============================================================
// REGISTRO 50 - NFe (modelo 55 = campo "01" no layout SINTEGRA)
// Somente para NFe modelo 1/1-A (código "01")
// NFCe vai no Registro 61 — NUNCA no Registro 50!
// Layout: 2+14+14+8+2+2+3+6+4+1+13+13+13+13+13+4+1 = 126 chars
// ============================================================
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada" || nota.status === "Lançada";
  const codSit = nota.status === "Cancelada" ? "S" : "N";
  const emitente = isEntrada ? "T" : "P";

  // Campo modelo no Registro 50: "01" para NFe modelo 55
  // (O validador SINTEGRA só aceita "01","03","06","22" no Reg.50)
  const modeloReg50 = "01";

  const cfopNota = (nota.cfop || "").replace(/\D/g, "");
  const cfop = cfopNota || (isEntrada ? "1403" : "5405");

  return (
    "50" +
    limpaDocumento(nota.cliente_cpf_cnpj) +        // 14
    limpaIE(nota.cliente_ie || "") +               // 14
    rData(nota.data_emissao) +                     //  8
    r(nota.cliente_estado || empresa.uf, 2) +      //  2
    r(modeloReg50, 2) +                            //  2 — "01" para NFe
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

// ============================================================
// REGISTRO 54 - Itens das NFe
// Layout: 2+14+2+3+6+4+3+3+14+11+12+12+12+12+12+4+1 = 126 chars
// ============================================================
export function reg54(nota, item, numItem, empresa) {
  const isEntrada = nota.status === "Importada" || nota.status === "Lançada";
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
    r("01", 2) +                    //  2 — "01" para NFe (igual ao Reg.50)
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

// ============================================================
// REGISTRO 61 - NFCe (modelo 65) — totais diários
// "Para documentos fiscais não emitidos por ECF: NFCe modelo 65"
// Uma linha por combinação de: data + modelo + série + CFOP
// Layout: 2+8+2+3+2+6+6+13+13+4+1 = 60 chars + brancos até 126
//   01: Tipo          "61"  2
//   02: Data          AAAAMMDD  8
//   03: Modelo        "65"  2
//   04: Série         3
//   05: Subsérie      2
//   06: Nº Inicial    6
//   07: Nº Final      6
//   08: Valor Total   13 (2 dec)
//   09: Base ICMS     13 (2 dec)
//   10: Alíquota      4
//   11: Situação      1 "N"
//   12: Brancos       até 126
// ============================================================
export function reg61(grupo) {
  // grupo: { data, serie, numInicial, numFinal, valorTotal }
  const numInicial = String(grupo.numInicial || "1").padStart(6, "0").slice(-6);
  const numFinal = String(grupo.numFinal || grupo.numInicial || "1").padStart(6, "0").slice(-6);
  const linha = (
    "61" +
    rData(grupo.data) +                   //  8 AAAAMMDD
    r("65", 2) +                          //  2 modelo
    r(grupo.serie || "1", 3) +            //  3 série
    r("  ", 2) +                          //  2 subsérie (brancos)
    numInicial +                          //  6
    numFinal +                            //  6
    rN(grupo.valorTotal, 13) +            // 13 valor total
    rN(0, 13) +                           // 13 base ICMS
    r("0000", 4) +                        //  4 alíquota
    "N"                                   //  1 situação
  );
  // Total acima = 2+8+2+3+2+6+6+13+13+4+1 = 60 chars — completar com brancos até 126
  return linha.padEnd(126, " ").substring(0, 126);
}

// ============================================================
// REGISTRO 75 - Cadastro de produtos
// Layout: 2+8+8+14+8+53+6+5+4+5+13 = 126 chars
// ============================================================
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

// ============================================================
// REGISTRO 90 - Encerramento
// ============================================================
export function reg90(empresa, totais, linhasAnteriores) {
  const BR = r("", 85);
  const CNPJ = limpaCNPJ(empresa.cnpj);
  const IE = (empresa.ie || "").replace(/\D/g, "").padEnd(14, " ").substring(0, 14);

  const tiposReg90 = ["50", "54", "61", "75"].filter(t => totais[t] > 0);
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
// FUNÇÃO PRINCIPAL
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

  // Filtrar notas do período (sem Rascunho, sem NFSe)
  const notasPeriodo = notas.filter(n => {
    const d = (n.data_emissao || "").substring(0, 10);
    if (d < periodoInicio || d > periodoFim) return false;
    if (n.status === "Rascunho") return false;
    if (n.tipo === "NFSe") return false;
    return true;
  });

  // ── NFe: Registro 50 + 54 ──────────────────────────────────
  const vistasNFe = new Set();
  const nfes = notasPeriodo.filter(n => {
    if (n.tipo !== "NFe") return false;
    const chave = `${n.serie || "1"}_${n.numero}`;
    if (vistasNFe.has(chave)) return false;
    vistasNFe.add(chave);
    return true;
  });

  for (const nota of nfes) {
    addLinha("50", reg50(nota, empresa));
  }

  // Reg.54 — itens das NFe
  const codigosNosItens = new Set();
  const itensPorCodigo = new Map();

  for (const nota of nfes) {
    let itens = [];
    const xmlStr = nota.xml_original || nota.xml_content || "";

    if (xmlStr) {
      try {
        const parsed = JSON.parse(xmlStr);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].descricao) {
          itens = parsed;
        } else {
          itens = parseXmlItens(xmlStr);
        }
      } catch {
        itens = parseXmlItens(xmlStr);
      }
    }

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

  // ── NFCe: Registro 61 (totais diários por série) ───────────
  // Agrupar por: data + série (uma linha de Reg.61 por dia/série)
  const nfces = notasPeriodo.filter(n => n.tipo === "NFCe" && n.status !== "Cancelada");

  const grupos61 = new Map(); // chave: "AAAAMMDD_serie"
  for (const nfce of nfces) {
    const data = rData(nfce.data_emissao); // AAAAMMDD
    const serie = String(nfce.serie || "1");
    const chave = `${data}_${serie}`;
    const num = parseInt(nfce.numero || "0", 10);
    if (!grupos61.has(chave)) {
      grupos61.set(chave, {
        data: nfce.data_emissao,
        serie,
        numInicial: num,
        numFinal: num,
        valorTotal: 0,
      });
    }
    const g = grupos61.get(chave);
    if (num < g.numInicial) g.numInicial = num;
    if (num > g.numFinal) g.numFinal = num;
    g.valorTotal += Number(nfce.valor_total || 0);
  }

  // Ordenar por data para saída organizada
  const grupos61Sorted = [...grupos61.values()].sort((a, b) =>
    rData(a.data).localeCompare(rData(b.data))
  );
  for (const grupo of grupos61Sorted) {
    addLinha("61", reg61(grupo));
  }

  // ── Reg.75 — cadastro de produtos (apenas NFe) ─────────────
  const produtosUnicos = new Map();

  estoque.forEach(p => {
    const cod = (p.codigo || "").trim();
    if (!cod || !p.descricao?.trim()) return;
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
    });
  }

  for (const produto of produtosUnicos.values()) {
    addLinha("75", reg75(produto, periodoInicio, periodoFim));
  }

  // ── Reg.90 — encerramento ──────────────────────────────────
  const linhasReg90 = reg90(empresa, totais, linhas.length);
  const todasLinhas = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo: todasLinhas, totalNotas: notasPeriodo.length };
}