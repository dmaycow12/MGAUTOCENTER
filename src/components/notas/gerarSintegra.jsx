// ============================================================
// GERADOR SINTEGRA — Convênio ICMS 57/95 — MG
// Ordem: 10 → 11 → 50 → 54 → 61 → 75 → 90
// ============================================================

// ---- HELPERS -----------------------------------------------
function rX(str, n) { return String(str ?? "").padEnd(n, " ").substring(0, n); }
function rN2(v, n)  { return String(Math.round(Math.abs(Number(v)||0)*100)).padStart(n,"0").slice(-n); }
function rN3(v, n)  { return String(Math.round(Math.abs(Number(v)||0)*1000)).padStart(n,"0").slice(-n); }
function rZ(v, n)   { const p=parseInt(String(v??0),10); return String(isNaN(p)?0:Math.abs(p)).padStart(n,"0").slice(-n); }
function rData(d)   { if(!d) return "00000000"; const c=String(d).substring(0,10).replace(/-/g,""); return c.length===8?c:"00000000"; }
function limpaCNPJ(c) { return (c||"").replace(/\D/g,"").padStart(14,"0").slice(-14); }
function limpaDoc(d)  { return (d||"").replace(/\D/g,"").padStart(14,"0").slice(-14); }
function limpaIEDest(ie) { const s=(ie||"").replace(/[^a-zA-Z0-9]/g,""); return (!s||s.length<5)?rX("ISENTO",14):rX(s,14); }
function limpaIEEmit(ie) { return rX((ie||"").replace(/\D/g,""),14); }
function cfop4(cfop,pad) { return ((cfop||pad||"5405")+"").replace(/\D/g,"").padStart(4,"0").slice(-4); }
function cst2(raw) { const s=String(raw||"00").replace(/\D/g,""); return (s||"00").slice(-2).padStart(2,"0"); }

// Extrai número-base (antes do "-")
function numBase(numero) {
  if (!numero) return "0";
  return String(numero).split("-")[0].replace(/\D/g,"") || "0";
}

// ---- PARSER XML (NF-e) -------------------------------------
function parseXmlItens(xmlStr) {
  if (!xmlStr || typeof xmlStr !== "string") return [];
  const itens = [];
  const detRegex = /<(?:\w+:)?det[\s\S]*?<\/(?:\w+:)?det>/gi;
  for (const det of (xmlStr.match(detRegex)||[])) {
    const get = tag => { const m=det.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]+)<\\/(?:\\w+:)?${tag}>`,"i")); return m?m[1].trim():""; };
    const qCom=parseFloat(get("qCom")||"1")||1;
    const vProd=parseFloat(get("vProd")||"0");
    itens.push({
      codigo:        (get("cProd")||"OUTROS").substring(0,14),
      descricao:     (get("xProd")||"PRODUTO").substring(0,53),
      ncm:           (get("NCM")||get("ncm")||"87089990").replace(/\D/g,"").padEnd(8,"0").substring(0,8),
      unidade:       (get("uCom")||"UN").substring(0,6),
      quantidade:    qCom,
      valor_unitario:(parseFloat(get("vUnCom")||"0")||(vProd/qCom)),
      valor_total:   vProd,
      cfop:          (get("CFOP")||get("cfop")||"").replace(/\D/g,""),
      cst:           cst2(get("CSOSN")||get("CST")||"00"),
    });
  }
  return itens;
}

// ---- COLETA ITENS DE UMA NOTA (+ irmãs) --------------------
function coletarItens(nota, irmas) {
  // 1. JSON de itens salvo no xml_original/xml_content
  for (const campo of [nota.xml_original, nota.xml_content]) {
    if (!campo) continue;
    try {
      const parsed = JSON.parse(campo);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].descricao) {
        return parsed.map(p => ({
          codigo:        String(p.codigo||p.estoque_id||"OUTROS").substring(0,14),
          descricao:     String(p.descricao||"PRODUTO").substring(0,53),
          ncm:           (p.ncm||"87089990").replace(/\D/g,"").padEnd(8,"0").substring(0,8),
          unidade:       String(p.unidade||"UN").substring(0,6),
          quantidade:    Number(p.quantidade)||1,
          valor_unitario:Number(p.valor_unitario||p.valor||0),
          valor_total:   Number(p.valor_total||0),
          cfop:          (p.cfop||"").replace(/\D/g,""),
          cst:           cst2(p.cst||"00"),
        }));
      }
    } catch { /* nada */ }
    const fromXml = parseXmlItens(campo);
    if (fromXml.length > 0) return fromXml;
  }

  // 2. Usa as irmãs: cada irmã = 1 item da NF
  if (irmas && irmas.length > 0) {
    return irmas.map(irma => {
      for (const campo of [irma.xml_original, irma.xml_content]) {
        if (!campo) continue;
        try {
          const p = JSON.parse(campo);
          if (Array.isArray(p) && p.length > 0 && p[0].descricao) return {
            codigo:        String(p[0].codigo||p[0].estoque_id||"OUTROS").substring(0,14),
            descricao:     String(p[0].descricao||"PRODUTO").substring(0,53),
            ncm:           (p[0].ncm||"87089990").replace(/\D/g,"").padEnd(8,"0").substring(0,8),
            unidade:       String(p[0].unidade||"UN").substring(0,6),
            quantidade:    Number(p[0].quantidade)||1,
            valor_unitario:Number(p[0].valor_unitario||p[0].valor||0),
            valor_total:   Number(p[0].valor_total||0),
            cfop:          (p[0].cfop||"").replace(/\D/g,""),
            cst:           cst2(p[0].cst||"00"),
          };
        } catch { /* nada */ }
        const fromXml = parseXmlItens(campo);
        if (fromXml.length > 0) return fromXml[0];
      }
      return { codigo:"OUTROS", descricao:"MERCADORIA", ncm:"87089990", unidade:"UN",
                quantidade:1, valor_unitario:Number(irma.valor_total)||0,
                valor_total:Number(irma.valor_total)||0, cfop:"5405", cst:"00" };
    });
  }

  // 3. Fallback: item único com valor total da nota
  return [{ codigo:"OUTROS", descricao:"MERCADORIA DIVERSA", ncm:"87089990", unidade:"UN",
             quantidade:1, valor_unitario:Number(nota.valor_total)||0,
             valor_total:Number(nota.valor_total)||0, cfop:cfop4(nota.cfop,"5405"), cst:"00" }];
}

// ============================================================
// REG 10 — 126 posições
// ============================================================
function reg10(emp, ini, fim) {
  const fax = (emp.fax||emp.fone||"").replace(/\D/g,"").padStart(10,"0").slice(-10);
  return "10"+limpaCNPJ(emp.cnpj)+limpaIEEmit(emp.ie)+rX(emp.nome,35)+rX(emp.municipio,30)+rX(emp.uf||"MG",2)+fax+rData(ini)+rData(fim)+"3"+"3"+"1";
}

// ============================================================
// REG 11 — 126 posições
// ============================================================
function reg11(emp) {
  const num  = (emp.numero||"1").replace(/\D/g,"").padStart(5,"0").slice(-5);
  const cep  = (emp.cep||"38700000").replace(/\D/g,"").padStart(8,"0").slice(-8);
  const fone = (emp.fone||"34000000000").replace(/\D/g,"").padStart(12,"0").slice(-12);
  return "11"+rX(emp.logradouro||"SEM ENDERECO",34)+num+rX(emp.complemento||"",22)+rX(emp.bairro||"",15)+cep+rX(emp.responsavel||emp.nome,28)+fone;
}

// ============================================================
// REG 50 — NFe saída, 126 posições
// ============================================================
function reg50(nota, emp) {
  const isEntrada = (nota.status==="Importada"||nota.status==="Lançada");
  const cf   = cfop4(nota.cfop, isEntrada?"1403":"5405");
  const num  = rZ(numBase(nota.numero), 6);
  const serie= rX(String(nota.serie||"1").replace(/\D/g,"")||"1", 3);
  const uf   = rX(nota.cliente_estado||emp.uf||"MG", 2);
  const vT   = Number(nota.valor_total)||0;
  return "50"+limpaDoc(nota.cliente_cpf_cnpj)+limpaIEDest(nota.cliente_ie)+rData(nota.data_emissao)+uf+"01"+serie+num+cf+(isEntrada?"T":"P")+rN2(vT,13)+rN2(0,13)+rN2(0,13)+rN2(vT,13)+rN2(0,13)+"0000"+"N";
}

// ============================================================
// REG 54 — itens, 126 posições
// Número de item: sequencial 1-based, 3 dígitos numéricos
// ============================================================
function reg54(nota, item, idx) {
  const isEntrada = (nota.status==="Importada"||nota.status==="Lançada");
  const cf   = cfop4(item.cfop||nota.cfop, isEntrada?"1403":"5405");
  const cst  = cst2(item.cst||"00");
  const num  = rZ(numBase(nota.numero), 6);   // número-BASE sem sufixo
  const serie= rX(String(nota.serie||"1").replace(/\D/g,"")||"1", 3);
  const qtd  = Number(item.quantidade)||1;
  const vUnit= Number(item.valor_unitario)||0;
  const vBrut= (qtd*vUnit)||Number(item.valor_total)||0;
  const cod  = rX(String(item.codigo||"OUTROS").substring(0,14), 14);
  const nrIt = rZ(idx+1, 3); // 001, 002, 003 ...

  const linha = "54"+limpaDoc(nota.cliente_cpf_cnpj)+"01"+serie+num+cf+cst+nrIt+cod+rN3(qtd,12)+rN2(vBrut,12)+rN2(0,12)+rN2(0,12)+rN2(0,12)+rN2(0,12)+"0000";
  if (linha.length!==126) console.warn(`[54] ${linha.length} chars — nota ${nota.numero} item ${idx+1}`);
  return linha;
}

// ============================================================
// REG 61 — NFCe totais diários, 126 posições
// 61(2)+BRANCOS(14)+BRANCOS(14)+DATA(8)+MOD(2)+SÉR(3)+SUBSÉR(2)+NR_INI(6)+NR_FIM(6)
// +VL_TOTAL(13)+BASE_ICMS(13)+ALIQ(4)+SIT(1)+BRANCOS(38) = 126
// ============================================================
function reg61(g) {
  const serie  = rX(String(g.serie||"1"), 3);
  const numIni = rZ(g.numInicial||1, 6);
  const numFim = rZ(g.numFinal||g.numInicial||1, 6);
  const linha  = "61"+rX("",14)+rX("",14)+rData(g.data)+"65"+serie+"  "+numIni+numFim+rN2(g.valorTotal,13)+rN2(0,13)+"0000"+"N"+rX("",38);
  if (linha.length!==126) console.warn(`[61] ${linha.length} chars`);
  return linha;
}

// ============================================================
// REG 75 — cadastro produto, 126 posições
// 75(2)+DtIni(8)+DtFim(8)+Cod(14)+NCM(8)+Desc(53)+Un(6)+AliqIPI(5)+AliqICMS(4)+Red(5)+Base(13)
// ============================================================
function reg75(prod, ini, fim) {
  const ncm = (prod.ncm||"87089990").replace(/\D/g,"").padEnd(8,"0").substring(0,8);
  const cod = rX(String(prod.codigo||"OUTROS").substring(0,14), 14);
  return "75"+rData(ini)+rData(fim)+cod+rX(ncm,8)+rX(prod.descricao||"PRODUTO",53)+rX(prod.unidade||"UN",6)+"00000"+"0000"+"00000"+rN2(0,13);
}

// ============================================================
// REG 90 — encerramento
// ============================================================
function reg90(emp, totais, totalAntes) {
  const CNPJ = limpaCNPJ(emp.cnpj);
  const IE   = limpaIEEmit(emp.ie);
  const BR   = rX("",85);
  const tipos = ["50","54","61","75"].filter(t=>(totais[t]||0)>0);
  const qtd90 = tipos.length+1;
  const total = totalAntes+qtd90;
  return [
    ...tipos.map(t=>"90"+CNPJ+IE+t+rZ(totais[t],8)+BR+String(qtd90)),
    "90"+CNPJ+IE+"99"+rZ(total,8)+BR+String(qtd90),
  ];
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  const cfg = k => (configs||[]).find(c=>c.chave===k)?.valor||"";

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
  const add = (tipo, linha) => { linhas.push(linha); totais[tipo]=(totais[tipo]||0)+1; };

  add("10", reg10(emp, periodoInicio, periodoFim));
  add("11", reg11(emp));

  // ── Filtra notas do período ──────────────────────────────
  const notasPeriodo = notas.filter(n => {
    const d = (n.data_emissao||"").substring(0,10);
    return d >= periodoInicio && d <= periodoFim
      && n.status !== "Rascunho"
      && n.status !== "Cancelada"
      && n.tipo  !== "NFSe";
  });

  // ══════════════════════════════════════════════════════════
  // NFe: agrupar por (série + número-BASE)
  // • Nota SEM sufixo (ex: "026967")   → representante principal
  // • Nota COM sufixo (ex: "026967-012") → irmã / item
  // Apenas a representante gera Reg.50 + Reg.54.
  // ══════════════════════════════════════════════════════════
  const grupos = new Map(); // chave "serie_numbase" → { rep, irmas[] }

  for (const n of notasPeriodo) {
    if (n.tipo !== "NFe") continue;
    const nb    = numBase(n.numero);
    const serie = String(n.serie||"1").replace(/\D/g,"")||"1";
    const chave = `${serie}_${nb}`;
    if (!grupos.has(chave)) grupos.set(chave, { rep: null, irmas: [] });
    const g = grupos.get(chave);

    if (String(n.numero).includes("-")) {
      g.irmas.push(n); // nota com sufixo = irmã (item)
    } else {
      g.rep = n;       // nota sem sufixo = representante
    }
  }

  // Se não há representante sem sufixo, promove a primeira irmã
  for (const g of grupos.values()) {
    if (!g.rep && g.irmas.length > 0) {
      g.rep   = g.irmas[0];
      g.irmas = g.irmas.slice(1);
    }
  }

  // Lista ordenada por data das representantes
  const nfes = [...grupos.values()]
    .filter(g => g.rep)
    .sort((a,b) => (a.rep.data_emissao||"").localeCompare(b.rep.data_emissao||""));

  // ── Reg.50 — um por NF-e representante ───────────────────
  for (const g of nfes) add("50", reg50(g.rep, emp));

  // ── Reg.54 + coleta de produtos para Reg.75 ──────────────
  const prodMap = new Map();

  for (const g of nfes) {
    const itens = coletarItens(g.rep, g.irmas);
    itens.forEach((item, idx) => {
      add("54", reg54(g.rep, item, idx));

      // Produto para Reg.75 — chave = código bruto sem padding
      const codKey = String(item.codigo||"OUTROS").substring(0,14).trim();
      if (!prodMap.has(codKey)) {
        const estoq = (estoque||[]).find(e => (e.codigo||"").trim() === codKey);
        prodMap.set(codKey, {
          codigo:    codKey,
          descricao: estoq?.descricao || item.descricao || "PRODUTO",
          ncm:       estoq?.ncm       || item.ncm       || "87089990",
          unidade:   estoq?.unidade   || item.unidade   || "UN",
        });
      }
    });
  }

  // ── Reg.61 — NFCe agrupadas por dia ──────────────────────
  const nfces = notasPeriodo
    .filter(n => n.tipo === "NFCe")
    .sort((a,b) => (a.data_emissao||"").localeCompare(b.data_emissao||""));

  const grp61 = new Map();
  for (const nfce of nfces) {
    const dk  = rData(nfce.data_emissao);
    const ser = String(nfce.serie||"1");
    const ck  = `${dk}_${ser}`;
    const num = parseInt(numBase(nfce.numero),10)||1;
    if (!grp61.has(ck)) grp61.set(ck, { data:nfce.data_emissao, serie:ser, numInicial:num, numFinal:num, valorTotal:0 });
    const g = grp61.get(ck);
    if (num < g.numInicial) g.numInicial = num;
    if (num > g.numFinal)   g.numFinal   = num;
    g.valorTotal += Number(nfce.valor_total||0);
  }
  for (const g of [...grp61.values()].sort((a,b) => rData(a.data).localeCompare(rData(b.data)))) {
    add("61", reg61(g));
  }

  // ── Reg.75 — catálogo de produtos ────────────────────────
  for (const p of prodMap.values()) add("75", reg75(p, periodoInicio, periodoFim));

  // ── Reg.90 — encerramento ─────────────────────────────────
  const r90 = reg90(emp, totais, linhas.length);
  const conteudo = [...linhas, ...r90].join("\r\n");

  return { conteudo, totalNotas: notasPeriodo.length };
}