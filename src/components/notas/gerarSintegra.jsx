// ============================================================
// GERADOR SINTEGRA — Convênio ICMS 57/95
//
// NFe  (modelo 55): Reg.50 (1 por nota) + Reg.54 (1 por item) + Reg.75 (cadastro produto)
// NFCe (modelo 65): Reg.61 (totais diários por série/data)
// NFSe             : NÃO entra no SINTEGRA
//
// Layout Reg.54 — 126 posições:
//   54(2) CNPJ(14) MOD(2) SÉRIE(3) NUM(6) CFOP(4) CST(2) ITEM(3) COD(14)
//   QTD(12,3dec) VLBRUTO(12,2dec) DESC(12,2dec) BASEICMS(12,2dec)
//   ICMS(12,2dec) IPI(12,2dec) ALIQ(4)
//   = 2+14+2+3+6+4+2+3+14+12+12+12+12+12+12+4 = 126 ✅
// ============================================================

// ---- HELPERS -----------------------------------------------
function rX(str, n) {
  // Alfanumérico: alinha à esquerda, completa com espaços
  return String(str ?? "").padEnd(n, " ").substring(0, n);
}
function rN2(v, n) {
  // Numérico com 2 decimais implícitos (×100)
  const cents = Math.round(Math.abs(Number(v) || 0) * 100);
  return String(cents).padStart(n, "0").slice(-n);
}
function rN3(v, n) {
  // Numérico com 3 decimais implícitos (×1000) — para quantidade no Reg.54
  const millesimos = Math.round(Math.abs(Number(v) || 0) * 1000);
  return String(millesimos).padStart(n, "0").slice(-n);
}
function rZ(v, n) {
  // Inteiro sem decimais, alinhado à direita com zeros
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
function limpaDoc(doc) {
  // Aceita CPF (11 dig) ou CNPJ (14 dig); preenche com zeros à esquerda até 14
  const d = (doc || "").replace(/\D/g, "");
  if (!d) return "00000000000000";
  return d.padStart(14, "0").slice(-14);
}
function limpaIEDest(ie) {
  // IE do destinatário — se não tiver, usa "ISENTO" alinhado à esquerda
  const s = (ie || "").replace(/[^a-zA-Z0-9]/g, "");
  if (!s || s.length < 5) return rX("ISENTO", 14);
  return rX(s, 14);
}
function limpaIEEmit(ie) {
  // IE do emitente (própria empresa) — sempre numérico sem "ISENTO"
  const s = (ie || "").replace(/\D/g, "");
  return rX(s, 14);
}
function extrairNumeroBase(numero) {
  // "125321-018" → "125321"; "000146" → "000146"
  if (!numero) return "0";
  return String(numero).split("-")[0].replace(/\D/g, "") || "0";
}
function cfopLimpo(cfop) {
  return (cfop || "5405").replace(/\D/g, "").padStart(4, "0").slice(-4);
}

// ---- PARSER XML --------------------------------------------
function parseXmlItens(xmlStr) {
  if (!xmlStr || typeof xmlStr !== "string") return [];
  const itens = [];
  const detRegex = /<det[\s\S]*?<\/det>/gi;
  const matches = xmlStr.match(detRegex) || [];
  for (const det of matches) {
    const get = (tag) => {
      const m = det.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };
    const cprod  = get("cProd");
    const xprod  = get("xProd");
    const ncm    = (get("NCM") || get("ncm")).replace(/\D/g, "").padEnd(8, "0").substring(0, 8) || "87089990";
    const qCom   = parseFloat(get("qCom") || "1") || 1;
    const vProd  = parseFloat(get("vProd") || "0");
    const vUnCom = parseFloat(get("vUnCom") || "0") || (vProd / qCom);
    const uCom   = (get("uCom") || "UN").substring(0, 6);
    const cfop   = (get("CFOP") || get("cfop") || "").replace(/\D/g, "");
    // CST: pode vir como "60" (2 dig) ou CSOSN "500" (3 dig) — pegamos últimos 2 dígitos
    const cstRaw = (get("CST") || get("CSOSN") || "00").replace(/\D/g, "");
    const cst    = cstRaw.slice(-2).padStart(2, "0");

    itens.push({
      codigo: (cprod || "PROD").substring(0, 14),
      descricao: (xprod || "PRODUTO").substring(0, 53),
      ncm,
      quantidade: qCom,
      valor_unitario: vUnCom,
      valor_total: vProd,
      unidade: uCom,
      cfop,
      cst,
    });
  }
  return itens;
}

// ============================================================
// REGISTRO 10 — Mestre (126 posições)
// 54(2)+CNPJ(14)+IE(14)+Nome(35)+Mun(30)+UF(2)+Fax(10)+DtIni(8)+DtFim(8)+Cod(1)+Nat(1)+Final(1)
// ============================================================
function reg10(emp, periodoInicio, periodoFim) {
  const fax = (emp.fax || emp.fone || "").replace(/\D/g, "").padStart(10, "0").slice(-10);
  return (
    "10" +
    limpaCNPJ(emp.cnpj) +
    limpaIEEmit(emp.ie) +
    rX(emp.nome, 35) +
    rX(emp.municipio, 30) +
    rX(emp.uf || "MG", 2) +
    rX(fax, 10) +
    rData(periodoInicio) +
    rData(periodoFim) +
    "3" +  // código estrutura (3 = Conv. 57/95 vigente, para fatos >= 01/01/2004)
    "3" +  // natureza (3 = totalidade das operações)
    "1"    // finalidade (1 = normal)
  );
}

// ============================================================
// REGISTRO 11 — Dados complementares (126 posições)
// 11(2)+End(34)+Num(5)+Comp(22)+Bairro(15)+CEP(8)+Contato(28)+Fone(12)
// ============================================================
function reg11(emp) {
  const num   = (emp.numero || "1").replace(/\D/g, "").padStart(5, "0").slice(-5);
  const cep   = (emp.cep || "00000000").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const fone  = (emp.fone || "0").replace(/\D/g, "").padStart(12, "0").slice(-12);
  const contato = emp.responsavel || emp.nome || "RESPONSAVEL";
  return (
    "11" +
    rX(emp.logradouro || "SEM ENDERECO", 34) +
    num +
    rX(emp.complemento || "", 22) +
    rX(emp.bairro || "", 15) +
    cep +
    rX(contato, 28) +
    fone
  );
}

// ============================================================
// REGISTRO 50 — NFe modelo 55 (126 posições)
// 50(2)+CNPJ(14)+IE(14)+Data(8)+UF(2)+Mod(2)+Série(3)+Num(6)+CFOP(4)+Emit(1)
// +VlTotal(13)+BaseICMS(13)+ICMS(13)+Isentas(13)+Outras(13)+Aliq(4)+Sit(1)
// ============================================================
function reg50(nota, emp) {
  const isEntrada = (nota.status === "Importada" || nota.status === "Lançada");
  const cfop = cfopLimpo(nota.cfop) || (isEntrada ? "1403" : "5405");
  const num  = rZ(extrairNumeroBase(nota.numero), 6);
  const serie = rX(String(nota.serie || "1").replace(/\D/g, "") || "1", 3);
  const uf    = rX(nota.cliente_estado || emp.uf || "MG", 2);
  const sit   = nota.status === "Cancelada" ? "S" : "N";
  const emit  = isEntrada ? "T" : "P";
  const vTotal = Number(nota.valor_total) || 0;

  return (
    "50" +
    limpaDoc(nota.cliente_cpf_cnpj) +   // 14
    limpaIEDest(nota.cliente_ie) +       // 14
    rData(nota.data_emissao) +           //  8
    uf +                                 //  2
    "01" +                               //  2 modelo NFe = "01" no SINTEGRA
    serie +                              //  3
    num +                                //  6
    cfop +                               //  4
    emit +                               //  1
    rN2(vTotal, 13) +                    // 13 valor total
    rN2(0, 13) +                         // 13 base ICMS
    rN2(0, 13) +                         // 13 ICMS
    rN2(vTotal, 13) +                    // 13 isentas/não-tributadas (ST)
    rN2(0, 13) +                         // 13 outras
    "0000" +                             //  4 alíquota
    sit                                  //  1 situação
  );
}

// ============================================================
// REGISTRO 54 — Itens das NFe (126 posições EXATAS)
// 54(2)+CNPJ(14)+MOD(2)+SÉRIE(3)+NUM(6)+CFOP(4)+CST(2)+ITEM(3)+COD(14)
// +QTD(12,3dec)+VLBRUTO(12,2dec)+DESC(12)+BASEICMS(12)+ICMS(12)+IPI(12)+ALIQ(4)
// = 2+14+2+3+6+4+2+3+14+12+12+12+12+12+12+4 = 126 ✅
// ============================================================
function reg54(nota, item, numItem) {
  const isEntrada = (nota.status === "Importada" || nota.status === "Lançada");
  const cfop  = cfopLimpo(item.cfop || nota.cfop) || (isEntrada ? "1403" : "5405");
  const cst   = String(item.cst || "00").replace(/\D/g, "").slice(-2).padStart(2, "0");
  const num   = rZ(extrairNumeroBase(nota.numero), 6);
  const serie = rX(String(nota.serie || "1").replace(/\D/g, "") || "1", 3);
  const qtd   = Number(item.quantidade) || 1;
  const vUnit = Number(item.valor_unitario) || 0;
  const vBruto = qtd * vUnit || Number(item.valor_total) || 0;

  // Código do produto: apenas 14 chars, alfanumérico
  const codProd = rX(String(item.codigo || "PROD").substring(0, 14), 14);

  const linha = (
    "54" +
    limpaDoc(nota.cliente_cpf_cnpj) +  // 14
    "01" +                              //  2 modelo
    serie +                             //  3
    num +                               //  6
    cfop +                              //  4
    cst +                               //  2
    rZ(numItem + 1, 3) +               //  3 número do item (sequencial 1-based)
    codProd +                           // 14
    rN3(qtd, 12) +                     // 12 quantidade (3 decimais × 1000)
    rN2(vBruto, 12) +                  // 12 valor bruto (qtd × vUnit)
    rN2(0, 12) +                       // 12 desconto
    rN2(0, 12) +                       // 12 base ICMS
    rN2(0, 12) +                       // 12 ICMS
    rN2(0, 12) +                       // 12 IPI
    "0000"                             //  4 alíquota
  );

  // Garantia de tamanho exato
  if (linha.length !== 126) {
    console.warn(`[Reg54] tamanho ${linha.length} ≠ 126 — nota ${nota.numero}, item ${numItem}`);
  }
  return linha;
}

// ============================================================
// REGISTRO 61 — NFCe modelo 65, totais diários (126 posições)
// 61(2)+CNPJ(14)+IE(14)+DATA(8)+MOD(2)+SÉRIE(3)+SUBSERIE(2)
// +NR_INI(6)+NR_FIM(6)+VLTOTAL(13)+BASEICMS(13)+ALIQ(4)+SIT(1) = 88 → pad até 126
// ============================================================
function reg61(grupo, emp) {
  const serie   = rX(String(grupo.serie || "1"), 3);
  const numIni  = rZ(grupo.numInicial || 1, 6);
  const numFim  = rZ(grupo.numFinal   || grupo.numInicial || 1, 6);
  const linha   = (
    "61" +
    limpaCNPJ(emp.cnpj) +      // 14
    limpaIEEmit(emp.ie) +      // 14
    rData(grupo.data) +        //  8
    "65" +                     //  2 modelo NFCe
    serie +                    //  3
    "  " +                     //  2 subsérie (brancos)
    numIni +                   //  6
    numFim +                   //  6
    rN2(grupo.valorTotal, 13)+ // 13
    rN2(0, 13) +               // 13 base ICMS
    "0000" +                   //  4 alíquota
    "N"                        //  1 situação
  );
  return linha.padEnd(126, " ");
}

// ============================================================
// REGISTRO 75 — Cadastro de produto (126 posições)
// 75(2)+DtIni(8)+DtFim(8)+Cod(14)+NCM(8)+Desc(53)+Un(6)+AliqIPI(5)+AliqICMS(4)+Red(5)+Base(13)
// = 2+8+8+14+8+53+6+5+4+5+13 = 126 ✅
// ============================================================
function reg75(produto, periodoInicio, periodoFim) {
  const ncm  = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  const desc = rX(String(produto.descricao || "PRODUTO"), 53);
  const un   = rX(String(produto.unidade   || "UN"), 6);
  const cod  = rX(String(produto.codigo    || "PROD").substring(0, 14), 14);
  return (
    "75" +
    rData(periodoInicio) + //  8
    rData(periodoFim)    + //  8
    cod                  + // 14
    rX(ncm, 8)           + //  8
    desc                 + // 53
    un                   + //  6
    "00000"              + //  5 alíquota IPI
    "0000"               + //  4 alíquota ICMS
    "00000"              + //  5 redução base
    rN2(0, 13)             // 13 base ICMS
  );
}

// ============================================================
// REGISTRO 90 — Encerramento
// 90(2)+CNPJ(14)+IE(14)+TipoReg(2)+QtdReg(8)+Brancos(85)+QtdLinhas90(1)
// ============================================================
function reg90(emp, totais, totalLinhasAntes) {
  const CNPJ = limpaCNPJ(emp.cnpj);
  const IE   = limpaIEEmit(emp.ie);
  const BR   = rX("", 85);

  const tiposUsados = ["10","11","50","54","61","75"].filter(t => (totais[t] || 0) > 0);
  const qtdTipos90  = tiposUsados.length + 1; // +1 para linha do tipo "99"
  const totalGeral  = totalLinhasAntes + qtdTipos90;

  const linhas = tiposUsados.map(tipo =>
    "90" + CNPJ + IE + tipo + rZ(totais[tipo], 8) + BR + String(qtdTipos90)
  );
  linhas.push("90" + CNPJ + IE + "99" + rZ(totalGeral, 8) + BR + String(qtdTipos90));
  return linhas;
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  const cfg = (chave) => (configs || []).find(c => c.chave === chave)?.valor || "";

  const emp = {
    cnpj:       cfg("cnpj")               || "54043647000120",
    ie:         cfg("inscricao_estadual")  || "0048295510070",
    nome:       cfg("razao_social")        || "MG AUTOCENTER LTDA",
    municipio:  cfg("municipio")           || "Patos de Minas",
    uf:         cfg("uf")                  || "MG",
    logradouro: cfg("endereco")            || "RUA SEM NOME",
    numero:     cfg("numero")              || "1",
    complemento:cfg("complemento")         || "",
    bairro:     cfg("bairro")             || "",
    cep:        cfg("cep")                 || "38700000",
    fone:       cfg("telefone")            || "0000000000",
    fax:        cfg("fax")                 || "",
    responsavel:cfg("responsavel")         || cfg("razao_social") || "MG AUTOCENTER LTDA",
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

  // ── NFe → Reg.50 + Reg.54 + Reg.75 ─────────────────────
  // Deduplicar por (série, número-base) — várias linhas da mesma nota devem virar 1
  const vistasNFe = new Map(); // chave → nota
  for (const n of notasPeriodo) {
    if (n.tipo !== "NFe") continue;
    const numBase = extrairNumeroBase(n.numero);
    const serie   = String(n.serie || "1").replace(/\D/g, "") || "1";
    const chave   = `${serie}_${numBase}`;
    if (!vistasNFe.has(chave)) {
      vistasNFe.set(chave, n);
    }
  }
  const nfes = [...vistasNFe.values()];

  // Ordena por data
  nfes.sort((a, b) => (a.data_emissao || "").localeCompare(b.data_emissao || ""));

  // Gera Reg.50
  for (const nota of nfes) {
    add("50", reg50(nota, emp));
  }

  // Gera Reg.54 + coleta produtos para Reg.75
  const produtosMap = new Map(); // codigo → dados produto

  for (const nota of nfes) {
    let itens = [];
    const xmlStr = nota.xml_original || nota.xml_content || "";

    if (xmlStr) {
      try {
        const parsed = JSON.parse(xmlStr);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].descricao) {
          // JSON de itens armazenados diretamente
          itens = parsed.map(p => ({
            codigo: String(p.codigo || p.estoque_id || "PROD").substring(0, 14),
            descricao: String(p.descricao || "PRODUTO").substring(0, 53),
            ncm: (p.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8),
            unidade: String(p.unidade || "UN").substring(0, 6),
            quantidade: Number(p.quantidade) || 1,
            valor_unitario: Number(p.valor_unitario || p.valor || 0),
            valor_total: Number(p.valor_total || 0),
            cfop: (p.cfop || "").replace(/\D/g, ""),
            cst: String(p.cst || "00").replace(/\D/g, "").slice(-2).padStart(2, "0"),
          }));
        } else {
          itens = parseXmlItens(xmlStr);
        }
      } catch {
        itens = parseXmlItens(xmlStr);
      }
    }

    // Se não tem itens, cria um item genérico a partir do valor total da nota
    if (itens.length === 0) {
      const codGenerico = "OUTROS";
      itens = [{
        codigo: codGenerico,
        descricao: "MERCADORIA DIVERSA",
        ncm: "87089990",
        unidade: "UN",
        quantidade: 1,
        valor_unitario: Number(nota.valor_total) || 0,
        valor_total: Number(nota.valor_total) || 0,
        cfop: cfopLimpo(nota.cfop),
        cst: "00",
      }];
    }

    itens.forEach((item, idx) => {
      add("54", reg54(nota, item, idx));

      // Acumula produto para Reg.75
      const cod = String(item.codigo || "PROD").substring(0, 14).trim();
      if (cod && !produtosMap.has(cod)) {
        // Busca no estoque; fallback para dados do XML
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

  // Gera Reg.75 para todos os produtos do Reg.54
  for (const produto of produtosMap.values()) {
    add("75", reg75(produto, periodoInicio, periodoFim));
  }

  // ── NFCe → Reg.61 (totais diários por série) ────────────
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

  const grupos61Sorted = [...grupos61.values()].sort((a, b) =>
    rData(a.data).localeCompare(rData(b.data))
  );
  for (const g of grupos61Sorted) {
    add("61", reg61(g, emp));
  }

  // ── Reg.90 ───────────────────────────────────────────────
  const linhasReg90 = reg90(emp, totais, linhas.length);
  const conteudo    = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo, totalNotas: notasPeriodo.length };
}