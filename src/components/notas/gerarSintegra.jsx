// ============================================================
// GERADOR SINTEGRA — Convênio ICMS 57/95 — MG
//
// Ordem obrigatória: 10 → 11 → 50 → 54 → 61 → 75 → 90
//
// Reg.54 — 126 posições:
//   54(2)+CNPJ(14)+MOD(2)+SÉR(3)+NUM(6)+CFOP(4)+CST(2)+ITEM(3)+COD(14)
//   +QTD(12,3dec)+VLBRUTO(12,2dec)+DESC(12)+BASEICMS(12)+ICMS(12)+IPI(12)+ALIQ(4)
//   = 2+14+2+3+6+4+2+3+14+12+12+12+12+12+12+4 = 126
//
// Reg.61 — 88 posições úteis + 38 brancos = 126:
//   61(2)+CNPJ(14)+IE(14)+DATA(8)+MOD(2)+SÉR(3)+SUBSÉR(2)+NR_INI(6)+NR_FIM(6)
//   +VL_TOTAL(13)+BASE_ICMS(13)+ALIQ(4)+SIT(1)+BRANCOS(38)
//   = 2+14+14+8+2+3+2+6+6+13+13+4+1+38 = 126
// ============================================================

// ---- HELPERS -----------------------------------------------
function rX(str, n) {
  return String(str ?? "").padEnd(n, " ").substring(0, n);
}
function rN2(v, n) {
  const cents = Math.round(Math.abs(Number(v) || 0) * 100);
  return String(cents).padStart(n, "0").slice(-n);
}
function rN3(v, n) {
  const mil = Math.round(Math.abs(Number(v) || 0) * 1000);
  return String(mil).padStart(n, "0").slice(-n);
}
function rZ(v, n) {
  const p = parseInt(String(v ?? 0), 10);
  return String(isNaN(p) ? 0 : Math.abs(p)).padStart(n, "0").slice(-n);
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
  return d.padStart(14, "0").slice(-14);
}
function limpaIEDest(ie) {
  const s = (ie || "").replace(/[^a-zA-Z0-9]/g, "");
  if (!s || s.length < 5) return rX("ISENTO", 14);
  return rX(s, 14);
}
function limpaIEEmit(ie) {
  return rX((ie || "").replace(/\D/g, ""), 14);
}
function numBase(numero) {
  if (!numero) return "0";
  return String(numero).split("-")[0].replace(/\D/g, "") || "0";
}
function cfop4(cfop, padrao) {
  const c = ((cfop || padrao || "5405") + "").replace(/\D/g, "");
  return c.padStart(4, "0").slice(-4);
}
function cst2(raw) {
  const s = String(raw || "00").replace(/\D/g, "");
  return (s || "00").slice(-2).padStart(2, "0");
}

// ---- PARSER XML (NF-e) -------------------------------------
function parseXmlItens(xmlStr) {
  if (!xmlStr || typeof xmlStr !== "string") return [];
  const itens = [];
  const detRegex = /<(?:\w+:)?det[\s\S]*?<\/(?:\w+:)?det>/gi;
  for (const det of (xmlStr.match(detRegex) || [])) {
    const get = (tag) => {
      const m = det.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]+)<\\/(?:\\w+:)?${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };
    const qCom  = parseFloat(get("qCom") || "1") || 1;
    const vProd = parseFloat(get("vProd") || "0");
    itens.push({
      codigo:        (get("cProd") || "OUTROS").substring(0, 14),
      descricao:     (get("xProd") || "PRODUTO").substring(0, 53),
      ncm:           (get("NCM") || get("ncm") || "87089990").replace(/\D/g, "").padEnd(8,"0").substring(0, 8),
      unidade:       (get("uCom") || "UN").substring(0, 6),
      quantidade:    qCom,
      valor_unitario:(parseFloat(get("vUnCom") || "0") || (vProd / qCom)),
      valor_total:   vProd,
      cfop:          (get("CFOP") || get("cfop") || "").replace(/\D/g, ""),
      cst:           cst2(get("CSOSN") || get("CST") || "00"),
    });
  }
  return itens;
}

// ---- COLETA ITENS DE UMA NOTA ------------------------------
function coletarItens(nota, todasNotas) {
  // 1. Tenta XML da nota principal
  const xmlStr = nota.xml_original || nota.xml_content || "";
  if (xmlStr) {
    try {
      const parsed = JSON.parse(xmlStr);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].descricao) {
        return parsed.map(p => ({
          codigo:        String(p.codigo || p.estoque_id || "OUTROS").substring(0, 14),
          descricao:     String(p.descricao || "PRODUTO").substring(0, 53),
          ncm:           (p.ncm || "87089990").replace(/\D/g, "").padEnd(8,"0").substring(0, 8),
          unidade:       String(p.unidade || "UN").substring(0, 6),
          quantidade:    Number(p.quantidade) || 1,
          valor_unitario:Number(p.valor_unitario || p.valor || 0),
          valor_total:   Number(p.valor_total || 0),
          cfop:          (p.cfop || "").replace(/\D/g, ""),
          cst:           cst2(p.cst || "00"),
        }));
      }
    } catch { /* não é JSON */ }
    const fromXml = parseXmlItens(xmlStr);
    if (fromXml.length > 0) return fromXml;
  }

  // 2. Coleta itens das notas irmãs (mesmo número-base, sufixos diferentes)
  // Ex: nota "026967" agrupa "026967-001","026967-012","026967-022"...
  // Cada nota-irmã com sufixo representa 1 item da NF-e original
  const base = numBase(nota.numero);
  const serie = String(nota.serie || "1").replace(/\D/g, "") || "1";
  const irmas = todasNotas.filter(n => {
    if (n.id === nota.id) return false;
    if (numBase(n.numero) !== base) return false;
    if ((String(n.serie || "1").replace(/\D/g, "") || "1") !== serie) return false;
    // só as que têm sufixo (são itens)
    return String(n.numero).includes("-");
  });

  if (irmas.length > 0) {
    // Cada nota-irmã é tratada como 1 item
    return irmas.map(irma => {
      const xmlI = irma.xml_original || irma.xml_content || "";
      // Tenta pegar item do XML da irmã
      if (xmlI) {
        try {
          const p = JSON.parse(xmlI);
          if (Array.isArray(p) && p.length > 0) {
            return {
              codigo:        String(p[0].codigo || p[0].estoque_id || "OUTROS").substring(0, 14),
              descricao:     String(p[0].descricao || "PRODUTO").substring(0, 53),
              ncm:           (p[0].ncm || "87089990").replace(/\D/g, "").padEnd(8,"0").substring(0,8),
              unidade:       String(p[0].unidade || "UN").substring(0, 6),
              quantidade:    Number(p[0].quantidade) || 1,
              valor_unitario:Number(p[0].valor_unitario || p[0].valor || 0),
              valor_total:   Number(p[0].valor_total || 0),
              cfop:          (p[0].cfop || "").replace(/\D/g,""),
              cst:           cst2(p[0].cst || "00"),
            };
          }
        } catch { /* nada */ }
        const fromXml = parseXmlItens(xmlI);
        if (fromXml.length > 0) return fromXml[0];
      }
      // Fallback: usa valor total da nota-irmã como item genérico
      return {
        codigo:        "OUTROS",
        descricao:     "MERCADORIA",
        ncm:           "87089990",
        unidade:       "UN",
        quantidade:    1,
        valor_unitario:Number(irma.valor_total) || 0,
        valor_total:   Number(irma.valor_total) || 0,
        cfop:          cfop4(irma.cfop, "5405"),
        cst:           "00",
      };
    });
  }

  // 3. Fallback: item único com valor total
  return [{
    codigo:        "OUTROS",
    descricao:     "MERCADORIA DIVERSA",
    ncm:           "87089990",
    unidade:       "UN",
    quantidade:    1,
    valor_unitario:Number(nota.valor_total) || 0,
    valor_total:   Number(nota.valor_total) || 0,
    cfop:          cfop4(nota.cfop, "5405"),
    cst:           "00",
  }];
}

// ============================================================
// REG 10 — 126 posições
// ============================================================
function reg10(emp, ini, fim) {
  const fax = (emp.fax || emp.fone || "").replace(/\D/g, "").padStart(10, "0").slice(-10);
  return (
    "10" +
    limpaCNPJ(emp.cnpj) +    // 14
    limpaIEEmit(emp.ie) +    // 14
    rX(emp.nome, 35) +       // 35
    rX(emp.municipio, 30) +  // 30
    rX(emp.uf || "MG", 2) +  //  2
    fax +                    // 10
    rData(ini) +             //  8
    rData(fim) +             //  8
    "3" +                    //  1
    "3" +                    //  1
    "1"                      //  1
  );                         // = 126
}

// ============================================================
// REG 11 — 126 posições
// ============================================================
function reg11(emp) {
  const num  = (emp.numero || "1").replace(/\D/g, "").padStart(5, "0").slice(-5);
  const cep  = (emp.cep || "38700000").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const fone = (emp.fone || "34000000000").replace(/\D/g, "").padStart(12, "0").slice(-12);
  return (
    "11" +
    rX(emp.logradouro || "SEM ENDERECO", 34) + // 34
    num +                                       //  5
    rX(emp.complemento || "", 22) +             // 22
    rX(emp.bairro || "", 15) +                  // 15
    cep +                                       //  8
    rX(emp.responsavel || emp.nome, 28) +       // 28
    fone                                        // 12
  );                                            // = 126
}

// ============================================================
// REG 50 — NFe saída, 126 posições
// ============================================================
function reg50(nota, emp) {
  const isEntrada = (nota.status === "Importada" || nota.status === "Lançada");
  const emit  = isEntrada ? "T" : "P";
  const cf    = cfop4(nota.cfop, isEntrada ? "1403" : "5405");
  const num   = rZ(numBase(nota.numero), 6);
  const serie = rX(String(nota.serie || "1").replace(/\D/g, "") || "1", 3);
  const uf    = rX(nota.cliente_estado || emp.uf || "MG", 2);
  const vT    = Number(nota.valor_total) || 0;
  return (
    "50" +
    limpaDoc(nota.cliente_cpf_cnpj) + // 14
    limpaIEDest(nota.cliente_ie) +    // 14
    rData(nota.data_emissao) +        //  8
    uf +                              //  2
    "01" +                            //  2 (modelo NFe no SINTEGRA = 01)
    serie +                           //  3
    num +                             //  6
    cf +                              //  4
    emit +                            //  1
    rN2(vT, 13) +                     // 13 valor total
    rN2(0, 13) +                      // 13 base ICMS
    rN2(0, 13) +                      // 13 ICMS
    rN2(vT, 13) +                     // 13 isenta
    rN2(0, 13) +                      // 13 outras
    "0000" +                          //  4 alíquota
    "N"                               //  1 situação
  );                                  // = 126
}

// ============================================================
// REG 54 — itens, 126 posições
// ============================================================
function reg54(nota, item, idx) {
  const isEntrada = (nota.status === "Importada" || nota.status === "Lançada");
  const cf    = cfop4(item.cfop || nota.cfop, isEntrada ? "1403" : "5405");
  const cst   = cst2(item.cst || "00");
  const num   = rZ(numBase(nota.numero), 6);
  const serie = rX(String(nota.serie || "1").replace(/\D/g, "") || "1", 3);
  const qtd   = Number(item.quantidade) || 1;
  const vUnit = Number(item.valor_unitario) || 0;
  const vBrut = (qtd * vUnit) || Number(item.valor_total) || 0;
  const cod   = rX(String(item.codigo || "OUTROS").substring(0, 14), 14);
  const nrIt  = rZ(idx + 1, 3); // sequencial 1-based, sempre numérico

  const linha = (
    "54" +
    limpaDoc(nota.cliente_cpf_cnpj) + // 14
    "01" +                             //  2
    serie +                            //  3
    num +                              //  6
    cf +                               //  4
    cst +                              //  2
    nrIt +                             //  3
    cod +                              // 14
    rN3(qtd, 12) +                     // 12
    rN2(vBrut, 12) +                   // 12
    rN2(0, 12) +                       // 12
    rN2(0, 12) +                       // 12
    rN2(0, 12) +                       // 12
    rN2(0, 12) +                       // 12
    "0000"                             //  4
  );                                   // = 126
  if (linha.length !== 126) console.warn(`[54] ${linha.length} chars — ${nota.numero} item ${idx}`);
  return linha;
}

// ============================================================
// REG 61 — NFCe totais diários, 126 posições
// Layout Conv.57/95 item 17:
// 61(2)+CNPJ(14)+IE(14)+DATA(8)+MOD(2)+SÉR(3)+SUBSÉR(2)+NR_INI(6)+NR_FIM(6)
// +VL_TOTAL(13)+BASE_ICMS(13)+ALIQ(4)+SIT(1)+BRANCOS(38)
// = 2+14+14+8+2+3+2+6+6+13+13+4+1+38 = 126
// ============================================================
function reg61(g, emp) {
  const serie  = rX(String(g.serie || "1"), 3);
  const numIni = rZ(g.numInicial || 1, 6);
  const numFim = rZ(g.numFinal || g.numInicial || 1, 6);
  const linha  = (
    "61" +
    limpaCNPJ(emp.cnpj) +    // 14
    limpaIEEmit(emp.ie) +    // 14
    rData(g.data) +          //  8
    "2D" +                   //  2 modelo 2D = código NFCe no Reg.61
    serie +                  //  3
    "  " +                   //  2 subsérie
    numIni +                 //  6
    numFim +                 //  6
    rN2(g.valorTotal, 13) +  // 13
    rN2(0, 13) +             // 13
    "0000" +                 //  4
    "N" +                    //  1
    rX("", 38)               // 38
  );                         // = 126
  if (linha.length !== 126) console.warn(`[61] ${linha.length} chars`);
  return linha;
}

// ============================================================
// REG 75 — cadastro produto, 126 posições
// 75(2)+DtIni(8)+DtFim(8)+Cod(14)+NCM(8)+Desc(53)+Un(6)+AliqIPI(5)+AliqICMS(4)+Red(5)+Base(13)
// = 2+8+8+14+8+53+6+5+4+5+13 = 126
// ============================================================
function reg75(prod, ini, fim) {
  const ncm = (prod.ncm || "87089990").replace(/\D/g, "").padEnd(8,"0").substring(0, 8);
  const cod = rX(String(prod.codigo || "OUTROS").substring(0, 14), 14);
  return (
    "75" +
    rData(ini) +           //  8
    rData(fim) +           //  8
    cod +                  // 14
    rX(ncm, 8) +           //  8
    rX(prod.descricao || "PRODUTO", 53) + // 53
    rX(prod.unidade || "UN", 6) +         //  6
    "00000" +              //  5
    "0000" +               //  4
    "00000" +              //  5
    rN2(0, 13)             // 13
  );                       // = 126
}

// ============================================================
// REG 90 — encerramento (NÃO conta tipos 10 e 11)
// ============================================================
function reg90(emp, totais, totalAntes) {
  const CNPJ = limpaCNPJ(emp.cnpj);
  const IE   = limpaIEEmit(emp.ie);
  const BR   = rX("", 85);
  const tipos = ["50","54","61","75"].filter(t => (totais[t] || 0) > 0);
  const qtd90 = tipos.length + 1;
  const total = totalAntes + qtd90;
  return [
    ...tipos.map(t => "90" + CNPJ + IE + t + rZ(totais[t], 8) + BR + String(qtd90)),
    "90" + CNPJ + IE + "99" + rZ(total, 8) + BR + String(qtd90),
  ];
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  const cfg = k => (configs || []).find(c => c.chave === k)?.valor || "";

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
    responsavel: cfg("responsavel")        || cfg("razao_social") || "RESPONSAVEL",
  };

  const linhas = [];
  const totais = {};
  const add = (tipo, linha) => { linhas.push(linha); totais[tipo] = (totais[tipo] || 0) + 1; };

  add("10", reg10(emp, periodoInicio, periodoFim));
  add("11", reg11(emp));

  // ── Filtra notas do período ──────────────────────────────
  const notasPeriodo = notas.filter(n => {
    const d = (n.data_emissao || "").substring(0, 10);
    return d >= periodoInicio && d <= periodoFim
      && n.status !== "Rascunho"
      && n.status !== "Cancelada"
      && n.tipo !== "NFSe";
  });

  // ── NFe: deduplicar por (série, número-base) ─────────────
  // Mantém a nota representante (sem sufixo preferida)
  const nfeMap = new Map(); // "serie_numbase" → nota
  for (const n of notasPeriodo) {
    if (n.tipo !== "NFe") continue;
    const nb    = numBase(n.numero);
    const serie = String(n.serie || "1").replace(/\D/g, "") || "1";
    const chave = `${serie}_${nb}`;
    const atual = nfeMap.get(chave);
    // Prefere nota sem sufixo (número base puro)
    if (!atual || (!String(n.numero).includes("-") && String(atual.numero).includes("-"))) {
      nfeMap.set(chave, n);
    }
  }
  const nfes = [...nfeMap.values()].sort((a, b) =>
    (a.data_emissao || "").localeCompare(b.data_emissao || "")
  );

  // ── Reg.50 (todos primeiro) ──────────────────────────────
  for (const nota of nfes) add("50", reg50(nota, emp));

  // ── Reg.54 + coleta produtos para Reg.75 ─────────────────
  const prodMap = new Map();

  for (const nota of nfes) {
    const itens = coletarItens(nota, notasPeriodo);
    itens.forEach((item, idx) => {
      add("54", reg54(nota, item, idx));
      const cod = rX(String(item.codigo || "OUTROS").substring(0, 14), 14).trimEnd();
      if (cod && !prodMap.has(cod)) {
        const estoq = (estoque || []).find(e => (e.codigo || "").trim() === cod);
        prodMap.set(cod, {
          codigo:    cod,
          descricao: estoq?.descricao || item.descricao || "PRODUTO",
          ncm:       estoq?.ncm || item.ncm || "87089990",
          unidade:   estoq?.unidade || item.unidade || "UN",
        });
      }
    });
  }

  // ── Reg.61 (NFCe, ANTES do 75) ───────────────────────────
  const nfces = notasPeriodo.filter(n => n.tipo === "NFCe");
  nfces.sort((a, b) => (a.data_emissao || "").localeCompare(b.data_emissao || ""));

  const grp61 = new Map();
  for (const nfce of nfces) {
    const dk  = rData(nfce.data_emissao);
    const ser = String(nfce.serie || "1");
    const ck  = `${dk}_${ser}`;
    const num = parseInt(numBase(nfce.numero), 10) || 1;
    if (!grp61.has(ck)) grp61.set(ck, { data: nfce.data_emissao, serie: ser, numInicial: num, numFinal: num, valorTotal: 0 });
    const g = grp61.get(ck);
    if (num < g.numInicial) g.numInicial = num;
    if (num > g.numFinal)   g.numFinal   = num;
    g.valorTotal += Number(nfce.valor_total || 0);
  }
  for (const g of [...grp61.values()].sort((a, b) => rData(a.data).localeCompare(rData(b.data)))) {
    add("61", reg61(g, emp));
  }

  // ── Reg.75 (DEPOIS do 61) ────────────────────────────────
  for (const p of prodMap.values()) add("75", reg75(p, periodoInicio, periodoFim));

  // ── Reg.90 ───────────────────────────────────────────────
  const r90 = reg90(emp, totais, linhas.length);
  const conteudo = [...linhas, ...r90].join("\r\n");

  return { conteudo, totalNotas: notasPeriodo.length };
}