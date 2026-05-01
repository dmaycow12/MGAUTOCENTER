// Gerador de SINTEGRA - Layout Convênio ICMS 57/95
// Fonte oficial: Manual de Orientação do Convênio 57/95 (CONFAZ)
//
// REGRAS:
// - NFe modelo 55: Registro 50 (individual) + 54 (itens) — modelo "01" no Reg.50/54
// - NFCe modelo 65: Registro 61 (totais diários por série) — modelo "65"
// - NFSe: NÃO entra no SINTEGRA

// ============================================================
// HELPERS
// ============================================================
function rX(str, n) {
  // Alfanumérico: preenche à direita com espaços, trunca
  return String(str ?? "").padEnd(n, " ").substring(0, n);
}
function rN(v, n) {
  // Numérico com 2 decimais implícitos: ex. 100.50 → "0000000010050" (13 dígitos)
  return String(Math.round(Number(v || 0) * 100)).padStart(n, "0").slice(-n);
}
function rZ(v, n) {
  // Inteiro formatado com zeros à esquerda
  return String(parseInt(String(v || 0), 10) || 0).padStart(n, "0").slice(-n);
}
function rData(d) {
  if (!d) return "00000000";
  const clean = String(d).substring(0, 10).replace(/-/g, "");
  return clean.length === 8 ? clean : "00000000";
}
function limpaCNPJ(c) {
  return (c || "").replace(/\D/g, "").padStart(14, "0").slice(-14);
}
function limpaDocumento(doc) {
  const d = (doc || "").replace(/\D/g, "");
  if (!d) return "00000000000000";
  return d.padStart(14, "0").slice(-14);
}
function limpaIE(ie) {
  const s = (ie || "").replace(/\D/g, "");
  if (!s || s.length < 5) return rX("ISENTO", 14);
  return rX(s, 14);
}
function limpaIEEmitente(ie) {
  // IE da própria empresa (emitente) — sem "ISENTO"
  const s = (ie || "").replace(/\D/g, "");
  return rX(s, 14);
}
function extrairNumero(numero) {
  // Remove traço e tudo depois — ex: "125321-001" → "125321"
  if (!numero) return "0";
  return String(numero).split("-")[0].replace(/\D/g, "") || "0";
}

function parseXmlItens(xmlStr) {
  if (!xmlStr || typeof xmlStr !== "string") return [];
  const itens = [];
  const detRegex = /<det[\s\S]*?<\/det>/g;
  const matches = xmlStr.match(detRegex) || [];
  for (const det of matches) {
    const get = (tag) => { const m = det.match(new RegExp(`<${tag}>([^<]+)</${tag}>`)); return m ? m[1] : ""; };
    const cprod = get("cProd");
    const xprod = get("xProd");
    const ncm = (get("NCM") || get("ncm")).replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
    const qCom = parseFloat(get("qCom") || "1");
    const vUnCom = parseFloat(get("vUnCom") || "0");
    const vProd = parseFloat(get("vProd") || "0");
    const uCom = get("uCom") || "UN";
    const cfop = get("CFOP") || get("cfop");
    const cstRaw = get("CST") || get("CSOSN") || "";
    // CST válido: 2 dígitos numéricos (ex: "00","10","20","30","40","41","50","51","60","70","90")
    // CSOSN: ex "101","102","103"... → para Reg.54 usar apenas últimos 2 dígitos ou "00"
    const cst = cstRaw.replace(/\D/g, "").slice(-2).padStart(2, "0") || "00";
    itens.push({
      codigo: cprod.substring(0, 14) || "000",
      descricao: xprod.substring(0, 120) || "PRODUTO",
      ncm,
      quantidade: qCom || 1,
      valor_unitario: vUnCom,
      valor_total: vProd,
      unidade: uCom.substring(0, 6) || "UN",
      cfop: cfop || null,
      cst,
    });
  }
  return itens;
}

// ============================================================
// REGISTRO 10 — Mestre do estabelecimento
// Layout: "10" + CNPJ(14) + IE(14) + Nome(35) + Mun(30) + UF(2) + Fax(10) + DtIni(8) + DtFim(8) + Cod1(1) + Cod2(1) + Cod3(1) = 126
// ============================================================
export function reg10(empresa, periodo) {
  const ie = limpaIEEmitente(empresa.ie);
  const fax = (empresa.fax || empresa.fone || "").replace(/\D/g, "").padStart(10, "0").slice(-10);
  return (
    "10" +
    limpaCNPJ(empresa.cnpj) +
    ie +
    rX(empresa.nome, 35) +
    rX(empresa.municipio, 30) +
    rX(empresa.uf || "MG", 2) +
    rX(fax, 10) +
    rData(periodo.inicio) +
    rData(periodo.fim) +
    "2" +   // estrutura versão atual do Conv. 57/95
    "3" +   // totalidade das operações
    "1"     // normal
  );
}

// ============================================================
// REGISTRO 11 — Dados complementares
// Layout: "11" + End(34) + Num(5) + Comp(22) + Bairro(15) + CEP(8) + Contato(28) + Fone(12) = 126
// ============================================================
export function reg11(empresa) {
  const num = (empresa.numero || "0").replace(/\D/g, "").padStart(5, "0").slice(-5);
  const cep = (empresa.cep || "00000000").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const fone = (empresa.fone || "0").replace(/\D/g, "").padStart(12, "0").slice(-12);
  return (
    "11" +
    rX(empresa.logradouro || "", 34) +
    num +
    rX(empresa.complemento || "", 22) +
    rX(empresa.bairro || "", 15) +
    cep +
    rX(empresa.responsavel || "", 28) +
    fone
  );
}

// ============================================================
// REGISTRO 50 — NFe (modelo 55)
// O campo Modelo no SINTEGRA para NFe é "01"
// Layout: "50" + CNPJ(14) + IE(14) + Data(8) + UF(2) + Mod(2) + Série(3) + Num(6) + CFOP(4) + Emit(1) + VlTotal(13) + BaseICMS(13) + ICMS(13) + Isenta(13) + Outras(13) + Aliq(4) + Sit(1) = 126
// ============================================================
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada" || nota.status === "Lançada";
  const emitente = isEntrada ? "T" : "P";
  const codSit = nota.status === "Cancelada" ? "S" : "N";
  const cfop = (nota.cfop || "").replace(/\D/g, "") || (isEntrada ? "1403" : "5405");
  const num = rZ(extrairNumero(nota.numero), 6);
  const serie = rX(String(nota.serie || "1").replace(/\D/g, "") || "1", 3);

  return (
    "50" +
    limpaDocumento(nota.cliente_cpf_cnpj) +    // 14 CNPJ/CPF destinatário
    limpaIE(nota.cliente_ie || "") +           // 14 IE destinatário
    rData(nota.data_emissao) +                 //  8
    rX(nota.cliente_estado || empresa.uf, 2) + //  2 UF
    "01" +                                     //  2 modelo ("01" para NFe)
    serie +                                    //  3
    num +                                      //  6
    rX(cfop, 4) +                              //  4
    emitente +                                 //  1
    rN(nota.valor_total, 13) +                 // 13 valor total
    rN(0, 13) +                                // 13 base ICMS
    rN(0, 13) +                                // 13 ICMS
    rN(nota.valor_total, 13) +                 // 13 isentas/outras (ST)
    rN(0, 13) +                                // 13 outras
    "0000" +                                   //  4 alíquota
    codSit                                     //  1 situação
  );
}

// ============================================================
// REGISTRO 54 — Itens das NFe
// Layout: "54" + CNPJ(14) + Mod(2) + Série(3) + Num(6) + CFOP(4) + CST(2) + Item(3) + CodProd(14) + Qtd(11) + VUnit(12) + Desc(12) + BaseICMS(12) + ICMS(12) + IPI(12) + AliqICMS(4) = 126
// ATENÇÃO: CST = 2 dígitos (sem o 3º dígito do CSOSN)
// ============================================================
export function reg54(nota, item, numItem) {
  const isEntrada = nota.status === "Importada" || nota.status === "Lançada";
  const cfop = (item.cfop || nota.cfop || "").replace(/\D/g, "") || (isEntrada ? "1403" : "5405");
  // CST: 2 dígitos. Para substituição tributária: "60". Default "00".
  const cst = (item.cst || "00").replace(/\D/g, "").slice(-2).padStart(2, "0");
  const num = rZ(extrairNumero(nota.numero), 6);
  const serie = rX(String(nota.serie || "1").replace(/\D/g, "") || "1", 3);
  const qtd = Number(item.quantidade) || 1;
  const vUnit = Number(item.valor_unitario) || (Number(item.valor_total || 0) / qtd);

  return (
    "54" +
    limpaDocumento(nota.cliente_cpf_cnpj) +  // 14
    "01" +                                    //  2 modelo
    serie +                                   //  3
    num +                                     //  6
    rX(cfop, 4) +                             //  4
    cst +                                     //  2
    rZ(numItem + 1, 3) +                      //  3
    rX(item.codigo || "000", 14) +            // 14
    rN(qtd, 11) +                             // 11
    rN(vUnit, 12) +                           // 12
    rN(0, 12) +                               // 12 desconto
    rN(0, 12) +                               // 12 base ICMS
    rN(0, 12) +                               // 12 ICMS
    rN(0, 12) +                               // 12 IPI
    "0000"                                    //  4 alíquota
  );
}

// ============================================================
// REGISTRO 61 — NFCe (modelo 65) — totais diários
// Layout CORRETO (Conv. 57/95):
//   "61" (2) + CNPJ(14) + IE(14) + DATA(8) + MOD(2) + SERIE(3) + SUBSERIE(2) + NR_INI(6) + NR_FIM(6) + VL_TOTAL(13) + BASE_ICMS(13) + ALIQ(4) + SITUACAO(1) = 88 chars + BRANCOS até 126
// ============================================================
export function reg61(grupo, empresa) {
  const num_ini = rZ(grupo.numInicial || 1, 6);
  const num_fim = rZ(grupo.numFinal || grupo.numInicial || 1, 6);
  const serie = rX(String(grupo.serie || "1"), 3);
  const linha = (
    "61" +
    limpaCNPJ(empresa.cnpj) +       // 14
    limpaIEEmitente(empresa.ie) +   // 14
    rData(grupo.data) +             //  8 AAAAMMDD
    "65" +                          //  2 modelo NFCe
    serie +                         //  3
    "  " +                          //  2 subsérie (brancos)
    num_ini +                       //  6
    num_fim +                       //  6
    rN(grupo.valorTotal, 13) +      // 13 valor total
    rN(0, 13) +                     // 13 base ICMS (ST substituído = 0)
    "0000" +                        //  4 alíquota
    "N"                             //  1 situação
  );
  // Total = 2+14+14+8+2+3+2+6+6+13+13+4+1 = 88 — preencher brancos até 126
  return linha.padEnd(126, " ");
}

// ============================================================
// REGISTRO 75 — Cadastro de produtos
// Layout: "75" + DtIni(8) + DtFim(8) + Cod(14) + NCM(8) + Desc(53) + Un(6) + AliqIPI(5) + AliqICMS(4) + Red(5) + BaseICMS(13) = 126
// ============================================================
export function reg75(produto, periodoInicio, periodoFim) {
  const ncm = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  return (
    "75" +
    rData(periodoInicio) +          //  8
    rData(periodoFim) +             //  8
    rX(produto.codigo || "000", 14) + // 14
    rX(ncm, 8) +                   //  8
    rX(produto.descricao || "PRODUTO", 53) + // 53
    rX(produto.unidade || "UN", 6) + //  6
    "00000" +                       //  5 alíquota IPI
    "0000" +                        //  4 alíquota ICMS
    "00000" +                       //  5 redução base
    rN(0, 13)                       // 13 base ICMS
  );
}

// ============================================================
// REGISTRO 90 — Encerramento
// Layout: "90" + CNPJ(14) + IE(14) + TipoReg(2) + QtdReg(8) + Brancos(85) + QtdTipos90(1) = 126
// ============================================================
export function reg90(empresa, totais, totalLinhasAntes) {
  const CNPJ = limpaCNPJ(empresa.cnpj);
  const IE = limpaIEEmitente(empresa.ie);
  const BR = rX("", 85);

  const tipos = ["10", "11", "50", "54", "61", "75"].filter(t => (totais[t] || 0) > 0);
  const qtdReg90 = tipos.length + 1; // +1 para o tipo "99"
  const totalGeral = totalLinhasAntes + qtdReg90;

  const linhas = tipos.map(tipo =>
    "90" + CNPJ + IE + tipo + rZ(totais[tipo], 8) + BR + String(qtdReg90)
  );
  linhas.push("90" + CNPJ + IE + "99" + rZ(totalGeral, 8) + BR + String(qtdReg90));
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
  const add = (tipo, linha) => {
    linhas.push(linha);
    totais[tipo] = (totais[tipo] || 0) + 1;
  };

  add("10", reg10(empresa, { inicio: periodoInicio, fim: periodoFim }));
  add("11", reg11(empresa));

  // Filtrar notas válidas do período (sem Rascunho, sem NFSe)
  const notasPeriodo = notas.filter(n => {
    const d = (n.data_emissao || "").substring(0, 10);
    if (d < periodoInicio || d > periodoFim) return false;
    if (n.status === "Rascunho" || n.status === "Cancelada") return false;
    if (n.tipo === "NFSe") return false;
    return true;
  });

  // ── NFe: Reg.50 + Reg.54 ──────────────────────────────────
  // Deduplica por série+número (só o número base, sem sufixo "-001")
  const vistasNFe = new Set();
  const nfes = notasPeriodo.filter(n => {
    if (n.tipo !== "NFe") return false;
    const numBase = extrairNumero(n.numero);
    const serie = String(n.serie || "1").replace(/\D/g, "") || "1";
    const chave = `${serie}_${numBase}`;
    if (vistasNFe.has(chave)) return false;
    vistasNFe.add(chave);
    return true;
  });

  // Gerar Reg.50 para cada NFe
  for (const nota of nfes) {
    add("50", reg50(nota, empresa));
  }

  // Gerar Reg.54 (itens) e coletar produtos para Reg.75
  const produtosMap = new Map(); // codigo → { codigo, descricao, ncm, unidade }

  for (const nota of nfes) {
    let itens = [];
    const xmlStr = nota.xml_original || nota.xml_content || "";

    if (xmlStr) {
      try {
        const parsed = JSON.parse(xmlStr);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].descricao) {
          itens = parsed.map(p => ({
            ...p,
            cst: (p.cst || "00").replace(/\D/g, "").slice(-2).padStart(2, "0"),
          }));
        } else {
          itens = parseXmlItens(xmlStr);
        }
      } catch {
        itens = parseXmlItens(xmlStr);
      }
    }

    if (itens.length === 0) {
      // Nota sem XML: gera item genérico
      itens = [{
        codigo: "000",
        descricao: "MERCADORIA DIVERSA",
        ncm: "87089990",
        unidade: "UN",
        quantidade: 1,
        valor_unitario: Number(nota.valor_total) || 0,
        valor_total: Number(nota.valor_total) || 0,
        cfop: nota.cfop || null,
        cst: "00",
      }];
    }

    itens.forEach((item, idx) => {
      add("54", reg54(nota, item, idx));

      // Coletar produto para Reg.75
      const cod = String(item.codigo || "").trim();
      if (cod && !produtosMap.has(cod)) {
        // Buscar no estoque primeiro; se não achar, usar dados do XML
        const estoqueItem = estoque.find(e => (e.codigo || "").trim() === cod);
        produtosMap.set(cod, {
          codigo: cod,
          descricao: estoqueItem?.descricao || item.descricao || "PRODUTO",
          ncm: estoqueItem?.ncm || item.ncm || "87089990",
          unidade: estoqueItem?.unidade || item.unidade || "UN",
        });
      }
    });
  }

  // Gerar Reg.75 para TODOS os produtos que aparecem no Reg.54
  for (const produto of produtosMap.values()) {
    add("75", reg75(produto, periodoInicio, periodoFim));
  }

  // ── NFCe: Reg.61 (totais diários por série) ────────────────
  const nfces = notasPeriodo.filter(n => n.tipo === "NFCe");

  const grupos61 = new Map(); // "AAAAMMDD_serie"
  for (const nfce of nfces) {
    const data = nfce.data_emissao; // manter formato original para rData
    const dataKey = rData(data);
    const serie = String(nfce.serie || "1");
    const chave = `${dataKey}_${serie}`;
    const num = parseInt(extrairNumero(nfce.numero), 10) || 1;

    if (!grupos61.has(chave)) {
      grupos61.set(chave, { data, serie, numInicial: num, numFinal: num, valorTotal: 0 });
    }
    const g = grupos61.get(chave);
    if (num < g.numInicial) g.numInicial = num;
    if (num > g.numFinal) g.numFinal = num;
    g.valorTotal += Number(nfce.valor_total || 0);
  }

  const grupos61Sorted = [...grupos61.values()].sort((a, b) =>
    rData(a.data).localeCompare(rData(b.data))
  );
  for (const grupo of grupos61Sorted) {
    add("61", reg61(grupo, empresa));
  }

  // ── Reg.90 — encerramento ──────────────────────────────────
  const linhasReg90 = reg90(empresa, totais, linhas.length);
  const todasLinhas = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo: todasLinhas, totalNotas: notasPeriodo.length };
}