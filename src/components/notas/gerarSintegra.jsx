// Gerador de SINTEGRA - Layout padrão MG
// Registros: 10, 11, 50, 54, 75, 90

function r(str, n, dir = "L", pad = " ") {
  const s = String(str ?? "");
  if (dir === "L") return s.padEnd(n, pad).substring(0, n);
  return s.padStart(n, pad).slice(-n);
}
function rN(v, n) { return r(Math.round(Number(v || 0) * 100), n, "R", "0"); }
function rZ(v, n) { return r(String(Number(v || 0)), n, "R", "0"); }
function rData(d) {
  if (!d) return "00000000"; // data inválida vira zeros
  const clean = String(d).substring(0, 10).replace(/-/g, "");
  return clean.length === 8 ? clean : "00000000";
}
function limpaCNPJ(c) { return (c || "").replace(/\D/g, "").padEnd(14, "0").substring(0, 14); }
function limpaIE(ie) {
  const s = (ie || "").replace(/\D/g, "");
  if (!s) return "ISENTO        "; // 14 chars: "ISENTO" + 8 espaços
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
  // CPF (11 dígitos) deve ser preenchido com zeros à ESQUERDA até 14 posições
  // CNPJ (14 dígitos) usa como está
  const cnpjUsar = cnpjDoc.length === 11
    ? cnpjDoc.padStart(14, "0")
    : cnpjDoc.length === 14
    ? cnpjDoc
    : "00000000000000";

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
  const cnpjCampo = cnpjDoc54.length === 11
    ? cnpjDoc54.padStart(14, "0")
    : cnpjDoc54.length === 14
    ? cnpjDoc54
    : "00000000000000";
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

// Registro 61 - Documentos fiscais venda consumidor final (NFCe modelo 65, NF modelo 02)
// Layout Convênio ICMS 57/95: 117 caracteres
// Pos 01-02: "61" | 03-16: brancos (14) | 17-30: brancos (14) | 31-38: DDMMAAAA
// 39-40: modelo (02/65) | 41-43: série (3 X) | 44-45: subsérie (2 X)
// 46-51: nº inicial (6 N) | 52-57: nº final (6 N) | 58-71: valor total (14 N 2dec)
// 72-85: ICMS (14 N 2dec) | 86-89: alíquota (4 N 2dec) | 90-103: isento (14 N 2dec)
// 104-117: outros (14 N 2dec)
export function reg61(data, modelo, serie, subserie, numInicial, numFinal, valorTotal, icmsTotal, aliquota, valorIsento, valorOutros) {
  // Data DDMMAAAA
  let dataf = "00000000";
  if (data && data.length >= 10) {
    const [ano, mes, dia] = data.split('-');
    dataf = `${dia}${mes}${ano}`;
  }
  
  // Modelo 2 dígitos
  const modelof = String(modelo || "65").padStart(2, "0").slice(-2);
  
  // Série 3 caracteres LEFT
  const serief = r(serie || "", 3);
  
  // Subsérie 2 caracteres LEFT (geralmente vazio ou "00")
  const subseriief = r(subserie || "", 2);
  
  // Números 6 dígitos RIGHT
  const numini = String(Math.max(0, Number(numInicial || 0))).padStart(6, "0").slice(-6);
  const numfim = String(Math.max(0, Number(numFinal || 0))).padStart(6, "0").slice(-6);
  
  // Valores 14 dígitos (2 decimais = centavos) RIGHT
  const valtot = rN(valorTotal || 0, 14);
  const valicm = rN(icmsTotal || 0, 14);
  const valisen = rN(valorIsento || 0, 14);
  const valout = rN(valorOutros || 0, 14);
  
  // Alíquota 4 dígitos (2 decimais: 18% = "1800") RIGHT
  const aliq = String(Math.round((aliquota || 0) * 100)).padStart(4, "0").slice(-4);
  
  return (
    "61" +
    " ".repeat(14) +  // pos 03-16: brancos CNPJ
    " ".repeat(14) +  // pos 17-30: brancos IE
    dataf +           // pos 31-38: data
    modelof +         // pos 39-40: modelo
    serief +          // pos 41-43: série
    subseriief +      // pos 44-45: subsérie
    numini +          // pos 46-51: nº inicial
    numfim +          // pos 52-57: nº final
    valtot +          // pos 58-71: valor total
    valicm +          // pos 72-85: ICMS
    aliq +            // pos 86-89: alíquota
    valisen +         // pos 90-103: isento
    valout            // pos 104-117: outros
  );
}

// Registro 75 - Cadastro de produtos
// Layout Conv. ICMS 76/03 item 20: 2+8+8+14+8+53+6+5+4+5+13 = 126 chars
// Campos: tipo+dtIni+dtFim+codProd+NCM+desc+unid+aliqIPI+aliqICMS+reducBC+baseST
export function reg75(produto, periodoInicio, periodoFim) {
  const ncm = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  return (
    "75" +
    rData(periodoInicio) +            //  8 data inicial
    rData(periodoFim) +               //  8 data final
    r(produto.codigo || "000", 14) +  // 14 código left-align (igual Reg.54)
    r(ncm, 8) +                       //  8 NCM
    r(produto.descricao, 53) +        // 53 descrição
    r(produto.unidade || "UN", 6) +   //  6 unidade
    rZ(0, 5) +                        //  5 alíquota IPI (com 2 decimais, ex: 00000)
    r("0000", 4) +                    //  4 alíquota ICMS (com 2 decimais, ex: 0000)
    rZ(0, 5) +                        //  5 % redução BC ICMS (com 2 decimais)
    rZ(0, 13)                         // 13 base cálculo ICMS ST
  );
}

// Registro 90 - Encerramento
// SINTEGRA MG: uma linha por tipo (50,54,75) + linha "99" com total GERAL de todos os registros
// Tipos 10 e 11 NÃO devem aparecer no reg90
export function reg90(empresa, totais, linhasAnteriores) {
  const BR = r("", 85);
  const CNPJ = limpaCNPJ(empresa.cnpj);
  const IE = (empresa.ie || "").replace(/\D/g, "").padEnd(14, " ").substring(0, 14);

  const tiposReg90 = ["50", "54", "61", "75"].filter(t => totais[t] > 0);
  // Linhas do Reg.90: uma por tipo + a linha "99"
  const totalLinhasReg90 = tiposReg90.length + 1;
  // Total GERAL = todas as linhas anteriores (10,11,50,54,75) + todas as linhas do reg90
  const totalGeral = linhasAnteriores + totalLinhasReg90;
  // Campo 07 do Reg.90 = Número de registros tipo 90 no arquivo (não é o literal "9"!)
  const numReg90 = String(totalLinhasReg90);

  const linhas = tiposReg90.map(tipo =>
    "90" + CNPJ + IE + tipo + rZ(totais[tipo], 8) + BR + numReg90
  );
  // A linha "99" informa o total GERAL de todas as linhas do arquivo
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
    const d = (n.data_emissao || "").substring(0, 10); // suporta datetime com hora
    return d >= periodoInicio && d <= periodoFim && n.status !== "Rascunho";
  });

  // Separar NFe (modelo 55) para Reg.50/54 e NFCe (modelo 65) para Reg.61
  const vistas = new Set();
  const notasSintegra = notasPeriodo.filter(n => {
    if (n.tipo !== "NFe") return false;
    const chave = `${n.serie || "1"}_${n.numero}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });

  // NFCe agrupadas por data+série+subsérie para Reg.61
  const nfcePorGrupo = new Map();
  notasPeriodo
    .filter(n => n.tipo === "NFCe" && n.status !== "Cancelada")
    .forEach(n => {
      const data = (n.data_emissao || "").substring(0, 10);
      const serie = n.serie || "1";
      const subserie = "00"; // padrão
      const chave = `${data}_${serie}_${subserie}`;
      if (!nfcePorGrupo.has(chave)) {
        nfcePorGrupo.set(chave, { data, serie, subserie, numInicial: 9999999, numFinal: 0, valorTotal: 0, icmsTotal: 0, valorIsento: 0, valorOutros: 0 });
      }
      const g = nfcePorGrupo.get(chave);
      const num = parseInt(n.numero || "0", 10);
      if (num < g.numInicial) g.numInicial = num;
      if (num > g.numFinal) g.numFinal = num;
      g.valorTotal += parseFloat(n.valor_total || 0);
      // ICMS e isento: estimados, poderia vir do XML
      g.icmsTotal += 0; // valor ICMS extraído do XML (implementar se houver)
      g.valorIsento += 0;
      g.valorOutros += 0;
    });

  // Reg.50 — todos primeiro
  for (const nota of notasSintegra) {
    addLinha("50", reg50(nota, empresa));
  }

  // Reg.54 — depois, coletar dados dos produtos para Reg.75
  const codigosNosItens = new Set();
  const itensPorCodigo = new Map(); // fallback para Reg.75 quando não há estoque
  for (const nota of notasSintegra) {
    let itens = [];
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        if (Array.isArray(parsed)) {
          itens = parsed;
        } else {
          itens = parseXmlItens(nota.xml_content);
        }
      } catch {
        itens = parseXmlItens(nota.xml_content);
      }
    }
    // Se não há itens, criar item padrão com valor total da nota
    if (itens.length === 0) {
      itens = [{
        codigo: "000",
        descricao: "PRODUTO",
        ncm: "87089990",
        unidade: "UN",
        quantidade: 1,
        valor_unitario: nota.valor_total || 0,
        valor_total: nota.valor_total || 0,
      }];
    }
    itens.forEach((item, idx) => {
      addLinha("54", reg54(nota, item, idx, empresa));
      if (item.codigo) {
        codigosNosItens.add(item.codigo);
        if (!itensPorCodigo.has(item.codigo)) itensPorCodigo.set(item.codigo, item);
      }
    });
  }

  // Reg.61 — NFCe agrupadas por data/série/subsérie
  for (const g of nfcePorGrupo.values()) {
    addLinha("61", reg61(g.data, "65", g.serie, g.subserie, g.numInicial, g.numFinal, g.valorTotal, g.icmsTotal, 18, g.valorIsento, g.valorOutros));
  }

  // Reg.75 — primeiro busca no estoque, depois usa item da NF como fallback
  const produtosUnicos = new Map();
  // Prioridade 1: estoque cadastrado
  estoque.forEach(p => {
    const cod = (p.codigo || "").trim();
    const desc = (p.descricao || "").trim();
    if (!cod || !desc || desc.length < 2) return;
    if (!codigosNosItens.has(cod)) return;
    if (!produtosUnicos.has(cod)) produtosUnicos.set(cod, p);
  });
  // Prioridade 2: item da própria NF (fallback para produtos não cadastrados)
  for (const [cod, item] of itensPorCodigo.entries()) {
    if (produtosUnicos.has(cod)) continue; // já tem no estoque
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

  // Reg.90 retorna array — unir tudo com CRLF num único join
  const linhasReg90 = reg90(empresa, totais, linhas.length);
  const todasLinhas = [...linhas, ...linhasReg90].join("\r\n");

  return { conteudo: todasLinhas, totalNotas: notasPeriodo.length };
}