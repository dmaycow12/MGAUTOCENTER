// ============================================================
// GERADOR SINTEGRA — Convênio ICMS 57/95 — MG
//
// Ordem obrigatória dos registros no arquivo:
//   10 → 11 → 50 → 54 → 61 → 75 → 90
//
// Layout Reg.54 — 126 posições exatas:
//   54(2) CNPJ(14) MOD(2) SÉRIE(3) NUM(6) CFOP(4) CST(2) ITEM(3) COD(14)
//   QTD(12,3dec) VLBRUTO(12,2dec) DESC(12) BASEICMS(12) ICMS(12) IPI(12) ALIQ(4)
//   = 2+14+2+3+6+4+2+3+14+12+12+12+12+12+12+4 = 126 ✅
//
// Layout Reg.61 — 126 posições (MG/Conv.57/95):
//   61(2) BRANCOS(32) DATA(8) MOD(2) SÉRIE(3) SUBSÉRIE(2)
//   NR_INI(6) NR_FIM(6) VL_TOTAL(13) BASE_ICMS(13) ALIQ(4) SIT(1) BRANCOS(34)
//   = 2+32+8+2+3+2+6+6+13+13+4+1+34 = 126 ✅
// ============================================================

// ---- HELPERS -----------------------------------------------
function rX(str, n) {
  return String(str ?? "").padEnd(n, " ").substring(0, n);
}
function rN2(v, n) {
  // Numérico com 2 decimais implícitos (×100)
  const cents = Math.round(Math.abs(Number(v) || 0) * 100);
  return String(cents).padStart(n, "0").slice(-n);
}
function rN3(v, n) {
  // Numérico com 3 decimais implícitos (×1000) — quantidade no Reg.54
  const mil = Math.round(Math.abs(Number(v) || 0) * 1000);
  return String(mil).padStart(n, "0").slice(-n);
}
function rZ(v, n) {
  // Inteiro sem decimais, alinhado à direita com zeros
  const parsed = parseInt(String(v ?? 0), 10);
  return String(isNaN(parsed) ? 0 : parsed).padStart(n, "0").slice(-n);
}
function rData(d) {
  if (!d) return "00000000";
  const clean = String(d).substring(0, 10).replace(/-/g, "");
  return clean.length === 8 ? clean : "00000000";
}
function limpaCNPJ(c) {
  return (c || "").replace(/\D/g, "").padStart(14, "0").slice(-14);
}
function limpaDoc(doc) {
  const d = (doc || "").replace(/\D/g, "");
  if (!d) return "00000000000000";
  return d.padStart(14, "0").slice(-14);
}
function limpaIEDest(ie) {
  const s = (ie || "").replace(/[^a-zA-Z0-9]/g, "");
  if (!s || s.length < 5) return rX("ISENTO", 14);
  return rX(s, 14);
}
function limpaIEEmit(ie) {
  const s = (ie || "").replace(/\D/g, "");
  return rX(s, 14);
}
function extrairNumeroBase(numero) {
  if (!numero) return "0";
  // "125321-018" → "125321", "000146" → "000146"
  return String(numero).split("-")[0].replace(/\D/g, "") || "0";
}
function cfopLimpo(cfop, padrao) {
  const c = (cfop || padrao || "5405").replace(/\D/g, "");
  return c.padStart(4, "0").slice(-4);
}
function normalizaCst(cstRaw) {
  // CST pode ser "60", "500" (CSOSN), ou vazio — sempre retorna 2 dígitos numéricos
  const s = String(cstRaw || "00").replace(/\D/g, "");
  if (!s) return "00";
  return s.slice(-2).padStart(2, "0");
}

// ---- PARSER XML --------------------------------------------
function parseXmlItens(xmlStr) {
  if (!xmlStr || typeof xmlStr !== "string") return [];
  const itens = [];
  // Aceita <det> com ou sem namespace
  const detRegex = /<(?:\w+:)?det[\s\S]*?<\/(?:\w+:)?det>/gi;
  const matches = xmlStr.match(detRegex) || [];
  for (const det of matches) {
    const get = (tag) => {
      const m = det.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]+)<\\/(?:\\w+:)?${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };
    const cprod  = get("cProd");
    const xprod  = get("xProd");
    const ncmRaw = get("NCM") || get("ncm");
    const ncm    = ncmRaw.replace(/\D/g, "").padEnd(8, "0").substring(0, 8) || "87089990";
    const qCom   = parseFloat(get("qCom") || "1") || 1;
    const vProd  = parseFloat(get("vProd") || "0");
    const vUnCom = parseFloat(get("vUnCom") || "0") || (qCom ? vProd / qCom : vProd);
    const uCom   = (get("uCom") || "UN").substring(0, 6);
    const cfop   = get("CFOP") || get("cfop") || "";
    // CSOSN (Simples) ou CST (Regime Normal)
    const cstRaw = get("CSOSN") || get("CST") || "00";
    const cst    = normalizaCst(cstRaw);

    itens.push({
      codigo: (cprod || "OUTROS").substring(0, 14),
      descricao: (xprod || "PRODUTO").substring(0, 53),
      ncm,
      quantidade: qCom,
      valor_unitario: vUnCom,
      valor_total: vProd,
      unidade: uCom,
      cfop: cfop.replace(/\D/g, ""),
      cst,
    });
  }
  return itens;
}

// ============================================================
// REGISTRO 10 — Mestre do estabelecimento (126 posições)
// 10(2)+CNPJ(14)+IE(14)+Nome(35)+Mun(30)+UF(2)+Fax(10)+DtIni(8)+DtFim(8)+Cod(1)+Nat(1)+Fin(1)
// = 2+14+14+35+30+2+10+8+8+1+1+1 = 126 ✅
// ============================================================
function reg10(emp, periodoInicio, periodoFim) {
  const fax = (emp.fax || emp.fone || "").replace(/\D/g, "").padStart(10, "0").slice(-10);
  return (
    "10" +
    limpaCNPJ(emp.cnpj) +       // 14
    limpaIEEmit(emp.ie) +       // 14
    rX(emp.nome, 35) +          // 35
    rX(emp.municipio, 30) +     // 30
    rX(emp.uf || "MG", 2) +     //  2
    fax +                       // 10
    rData(periodoInicio) +      //  8
    rData(periodoFim) +         //  8
    "3" +                       //  1 código estrutura (3 = pós-2004)
    "3" +                       //  1 natureza (3 = totalidade)
    "1"                         //  1 finalidade (1 = normal)
  );
}

// ============================================================
// REGISTRO 11 — Dados do estabelecimento (126 posições)
// 11(2)+End(34)+Num(5)+Comp(22)+Bairro(15)+CEP(8)+Contato(28)+Fone(12)
// = 2+34+5+22+15+8+28+12 = 126 ✅
// ============================================================
function reg11(emp) {
  const num     = (emp.numero || "1").replace(/\D/g, "").padStart(5, "0").slice(-5);
  const cep     = (emp.cep || "38700000").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const fone    = (emp.fone || "34000000000").replace(/\D/g, "").padStart(12, "0").slice(-12);
  const contato = rX(emp.responsavel || emp.nome || "RESPONSAVEL", 28);
  return (
    "11" +
    rX(emp.logradouro || "SEM ENDERECO", 34) + // 34
    num +                                       //  5
    rX(emp.complemento || "", 22) +             // 22
    rX(emp.bairro || "", 15) +                  // 15
    cep +                                       //  8
    contato +                                   // 28
    fone                                        // 12
  );
}

// ============================================================
// REGISTRO 50 — NFe modelo 55, saídas (126 posições)
// 50(2)+CNPJ(14)+IE(14)+Data(8)+UF(2)+Mod(2)+Série(3)+Num(6)+CFOP(4)+Emit(1)
// +VlTotal(13)+BaseICMS(13)+ICMS(13)+Isentas(13)+Outras(13)+Aliq(4)+Sit(1)
// = 2+14+14+8+2+2+3+6+4+1+13+13+13+13+13+4+1 = 126 ✅
// ============================================================
function reg50(nota, emp) {
  // Para MG: todas as NFe emitidas pela empresa são saídas (emit = "P")
  // NFe de entrada (recebidas) normalmente não são geradas no Reg.50 de saída
  const isEntrada = (nota.status === "Importada" || nota.status === "Lançada");
  const emit  = isEntrada ? "T" : "P";
  const cfop  = cfopLimpo(nota.cfop, isEntrada ? "1403" : "5405");
  const num   = rZ(extrairNumeroBase(nota.numero), 6);
  const serie = rX(String(nota.serie || "1").replace(/\D/g, "") || "1", 3);
  const uf    = rX(nota.cliente_estado || emp.uf || "MG", 2);
  const sit   = "N"; // N = normal (canceladas já foram filtradas)
  const vTotal = Number(nota.valor_total) || 0;

  return (
    "50" +
    limpaDoc(nota.cliente_cpf_cnpj) +  // 14
    limpaIEDest(nota.cliente_ie) +     // 14
    rData(nota.data_emissao) +         //  8
    uf +                               //  2
    "01" +                             //  2 modelo (01 = NFe)
    serie +                            //  3
    num +                              //  6
    cfop +                             //  4
    emit +                             //  1
    rN2(vTotal, 13) +                  // 13 valor total
    rN2(0, 13) +                       // 13 base ICMS (0 = ST/isento)
    rN2(0, 13) +                       // 13 ICMS
    rN2(vTotal, 13) +                  // 13 isenta/não tributada
    rN2(0, 13) +                       // 13 outras
    "0000" +                           //  4 alíquota
    sit                                //  1 situação
  );
}

// ============================================================
// REGISTRO 54 — Itens das NFe (126 posições)
// 54(2)+CNPJ(14)+MOD(2)+SÉRIE(3)+NUM(6)+CFOP(4)+CST(2)+ITEM(3)+COD(14)
// +QTD(12,3dec)+VLBRUTO(12,2dec)+DESC(12)+BASEICMS(12)+ICMS(12)+IPI(12)+ALIQ(4)
// = 2+14+2+3+6+4+2+3+14+12+12+12+12+12+12+4 = 126 ✅
// ============================================================
function reg54(nota, item, numItemSeq) {
  const isEntrada = (nota.status === "Importada" || nota.status === "Lançada");
  const cfop    = cfopLimpo(item.cfop || nota.cfop, isEntrada ? "1403" : "5405");
  const cst     = normalizaCst(item.cst || "00");
  const num     = rZ(extrairNumeroBase(nota.numero), 6);
  const serie   = rX(String(nota.serie || "1").replace(/\D/g, "") || "1", 3);
  const qtd     = Number(item.quantidade) || 1;
  const vUnit   = Number(item.valor_unitario) || 0;
  const vBruto  = (qtd * vUnit) || Number(item.valor_total) || 0;
  // Código: apenas alfanumérico, máximo 14 chars
  const codProd = rX(String(item.codigo || "OUTROS").substring(0, 14), 14);
  // Número do item: sequencial 1-based, sempre numérico 3 dígitos
  const nrItem  = rZ(numItemSeq + 1, 3);

  const linha = (
    "54" +
    limpaDoc(nota.cliente_cpf_cnpj) + // 14
    "01" +                             //  2 modelo
    serie +                            //  3
    num +                              //  6
    cfop +                             //  4
    cst +                              //  2
    nrItem +                           //  3
    codProd +                          // 14
    rN3(qtd, 12) +                     // 12 quantidade (×1000)
    rN2(vBruto, 12) +                  // 12 valor bruto
    rN2(0, 12) +                       // 12 desconto
    rN2(0, 12) +                       // 12 base ICMS
    rN2(0, 12) +                       // 12 ICMS
    rN2(0, 12) +                       // 12 IPI
    "0000"                             //  4 alíquota
  );

  if (linha.length !== 126) {
    console.warn(`[Reg54] tamanho ${linha.length} ≠ 126 — nota ${nota.numero} item ${numItemSeq}`);
  }
  return linha;
}

// ============================================================
// REGISTRO 61 — NFCe modelo 65, totais por dia/série (126 posições)
// Conv. 57/95 item 17:
// 61(2)+BRANCOS(32)+DATA(8)+MOD(2)+SÉRIE(3)+SUBSÉRIE(2)
// +NR_INI(6)+NR_FIM(6)+VL_TOTAL(13)+BASE_ICMS(13)+ALIQ(4)+SIT(1)+BRANCOS(34)
// = 2+32+8+2+3+2+6+6+13+13+4+1+34 = 126 ✅
// ============================================================
function reg61(grupo) {
  const serie  = rX(String(grupo.serie || "1"), 3);
  const numIni = rZ(grupo.numInicial || 1, 6);
  const numFim = rZ(grupo.numFinal || grupo.numInicial || 1, 6);
  return (
    "61" +
    rX("", 32) +                      // 32 brancos
    rData(grupo.data) +               //  8 data de emissão
    "2D" +                            //  2 modelo (2D = NFCe modelo 65 no Reg.61)
    serie +                           //  3 série
    "  " +                            //  2 subsérie (brancos)
    numIni +                          //  6
    numFim +                          //  6
    rN2(grupo.valorTotal, 13) +       // 13 valor total
    rN2(0, 13) +                      // 13 base ICMS
    "0000" +                          //  4 alíquota
    "N" +                             //  1 situação
    rX("", 34)                        // 34 brancos
  );
}

// ============================================================
// REGISTRO 75 — Cadastro de produto/serviço (126 posições)
// 75(2)+DtIni(8)+DtFim(8)+Cod(14)+NCM(8)+Desc(53)+Un(6)+AliqIPI(5)+AliqICMS(4)+Red(5)+Base(13)
// = 2+8+8+14+8+53+6+5+4+5+13 = 126 ✅
// ============================================================
function reg75(produto, periodoInicio, periodoFim) {
  const ncm  = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  const cod  = rX(String(produto.codigo || "OUTROS").substring(0, 14), 14);
  const desc = rX(String(produto.descricao || "PRODUTO"), 53);
  const un   = rX(String(produto.unidade || "UN").substring(0, 6), 6);
  return (
    "75" +
    rData(periodoInicio) + //  8
    rData(periodoFim) +    //  8
    cod +                  // 14
    rX(ncm, 8) +           //  8 NCM (alfanumérico)
    desc +                 // 53
    un +                   //  6
    "00000" +              //  5 alíq. IPI
    "0000" +               //  4 alíq. ICMS
    "00000" +              //  5 red. base
    rN2(0, 13)             // 13 base ICMS
  );
}

// ============================================================
// REGISTRO 90 — Encerramento (126 posições)
// 90(2)+CNPJ(14)+IE(14)+TipoReg(2)+QtdReg(8)+Brancos(85)+QtdLin90(1)
// = 2+14+14+2+8+85+1 = 126 ✅
// NÃO incluir tipos 10 e 11 nos subtotais do Reg.90 (crítica 250-251)
// ============================================================
function reg90(emp, totais, totalLinhasAntes) {
  const CNPJ = limpaCNPJ(emp.cnpj);
  const IE   = limpaIEEmit(emp.ie);
  const BR   = rX("", 85);

  // Apenas tipos 50,54,61,75 (não incluir 10 e 11!)
  const tiposUsados = ["50","54","61","75"].filter(t => (totais[t] || 0) > 0);
  const qtdLinhas90 = tiposUsados.length + 1; // +1 para linha tipo "99"
  const totalGeral  = totalLinhasAntes + qtdLinhas90;

  const linhas = tiposUsados.map(tipo =>
    "90" + CNPJ + IE + tipo + rZ(totais[tipo], 8) + BR + String(qtdLinhas90)
  );
  linhas.push("90" + CNPJ + IE + "99" + rZ(totalGeral, 8) + BR + String(qtdLinhas90));
  return linhas;
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  const cfg = (chave) => (configs || []).find(c => c.chave === chave)?.valor || "";

  const emp = {
    cnpj:        cfg("cnpj")              || "54043647000120",
    ie:          cfg("inscricao_estadual") || "0048295510070",
    nome:        cfg("razao_social")       || "MG AUTOCENTER LTDA",
    municipio:   cfg("municipio")          || "Patos de Minas",
    uf:          cfg("uf")                 || "MG",
    logradouro:  cfg("endereco")           || "RUA SEM NOME",
    numero:      cfg("numero")             || "1",
    complemento: cfg("complemento")        || "",
    bairro:      cfg("bairro")             || "",
    cep:         cfg("cep")                || "38700000",
    fone:        cfg("telefone")           || "34000000000",
    fax:         cfg("fax")                || "",
    responsavel: cfg("responsavel")        || cfg("razao_social") || "MG AUTOCENTER",
  };

  const linhas = [];
  const totais = {};
  const add = (tipo, linha) => {
    linhas.push(linha);
    totais[tipo] = (totais[tipo] || 0) + 1;
  };

  add("10", reg10(emp, periodoInicio, periodoFim));
  add("11", reg11(emp));

  // ── Filtra notas do período ──────────────────────────────
  const notasPeriodo = notas.filter(n => {
    const d = (n.data_emissao || "").substring(0, 10);
    if (d < periodoInicio || d > periodoFim) return false;
    if (n.status === "Rascunho" || n.status === "Cancelada") return false;
    if (n.tipo === "NFSe") return false;
    return true;
  });

  // ── NFe → Reg.50 + Reg.54 (ordem: primeiro todos 50, depois todos 54) ──
  // Deduplicar: várias entradas com mesmo número-base/série → 1 Reg.50
  const vistasNFe = new Map();
  for (const n of notasPeriodo) {
    if (n.tipo !== "NFe") continue;
    const numBase = extrairNumeroBase(n.numero);
    const serie   = String(n.serie || "1").replace(/\D/g, "") || "1";
    const chave   = `${serie}_${numBase}`;
    if (!vistasNFe.has(chave)) {
      vistasNFe.set(chave, n);
    }
  }
  const nfes = [...vistasNFe.values()].sort((a, b) =>
    (a.data_emissao || "").localeCompare(b.data_emissao || "")
  );

  // Todos os Reg.50 primeiro
  for (const nota of nfes) {
    add("50", reg50(nota, emp));
  }

  // Todos os Reg.54 depois, coletando produtos para Reg.75
  const produtosMap = new Map();

  for (const nota of nfes) {
    let itens = [];
    const xmlStr = nota.xml_original || nota.xml_content || "";

    if (xmlStr) {
      try {
        const parsed = JSON.parse(xmlStr);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].descricao) {
          itens = parsed.map(p => ({
            codigo: String(p.codigo || p.estoque_id || "OUTROS").substring(0, 14),
            descricao: String(p.descricao || "PRODUTO").substring(0, 53),
            ncm: (p.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8),
            unidade: String(p.unidade || "UN").substring(0, 6),
            quantidade: Number(p.quantidade) || 1,
            valor_unitario: Number(p.valor_unitario || p.valor || 0),
            valor_total: Number(p.valor_total || 0),
            cfop: (p.cfop || "").replace(/\D/g, ""),
            cst: normalizaCst(p.cst || "00"),
          }));
        } else {
          itens = parseXmlItens(xmlStr);
        }
      } catch {
        itens = parseXmlItens(xmlStr);
      }
    }

    // Fallback: item genérico com valor total da nota
    if (itens.length === 0) {
      itens = [{
        codigo: "OUTROS",
        descricao: "MERCADORIA DIVERSA",
        ncm: "87089990",
        unidade: "UN",
        quantidade: 1,
        valor_unitario: Number(nota.valor_total) || 0,
        valor_total: Number(nota.valor_total) || 0,
        cfop: cfopLimpo(nota.cfop, "5405"),
        cst: "00",
      }];
    }

    itens.forEach((item, idx) => {
      add("54", reg54(nota, item, idx));

      const cod = rX(String(item.codigo || "OUTROS").substring(0, 14), 14).trimEnd();
      if (cod && !produtosMap.has(cod)) {
        const estoqueItem = (estoque || []).find(e => (e.codigo || "").trim() === cod);
        produtosMap.set(cod, {
          codigo: cod,
          descricao: estoqueItem?.descricao || item.descricao || "PRODUTO",
          ncm: estoqueItem?.ncm || item.ncm || "87089990",
          unidade: estoqueItem?.unidade || item.unidade || "UN",
        });
      }
    });
  }

  // ── NFCe → Reg.61 (ANTES do Reg.75 — ordem obrigatória) ──
  const nfces = notasPeriodo.filter(n => n.tipo === "NFCe");
  nfces.sort((a, b) => (a.data_emissao || "").localeCompare(b.data_emissao || ""));

  const grupos61 = new Map();
  for (const nfce of nfces) {
    const dataKey = rData(nfce.data_emissao);
    const serie   = String(nfce.serie || "1");
    const chave   = `${dataKey}_${serie}`;
    const num     = parseInt(extrairNumeroBase(nfce.numero), 10) || 1;

    if (!grupos61.has(chave)) {
      grupos61.set(chave, { data: nfce.data_emissao, serie, numInicial: num, numFinal: num, valorTotal: 0 });
    }
    const g = grupos61.get(chave);
    if (num < g.numInicial) g.numInicial = num;
    if (num > g.numFinal)   g.numFinal   = num;
    g.valorTotal += Number(nfce.valor_total || 0);
  }

  for (const g of [...grupos61.values()].sort((a, b) => rData(a.data).localeCompare(rData(b.data)))) {
    add("61", reg61(g));
  }

  // ── Reg.75 (DEPOIS do Reg.61) ────────────────────────────
  for (const produto of produtosMap.values()) {
    add("75", reg75(produto, periodoInicio, periodoFim));
  }

  // ── Reg.90 ───────────────────────────────────────────────
  const linhasReg90 = reg90(emp, totais, linhas.length);
  const conteudo    = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo, totalNotas: notasPeriodo.length };
}