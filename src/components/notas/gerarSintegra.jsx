// Gerador de SINTEGRA - Layout padrão MG
// Registros: 10, 11, 50, 54, 75, 90

function r(str, n, dir = "L", pad = " ") {
  const s = String(str ?? "");
  if (dir === "L") return s.padEnd(n, pad).substring(0, n);
  return s.padStart(n, pad).slice(-n);
}
function rN(v, n) { return r(Math.round(Number(v || 0) * 100), n, "R", "0"); }
function rZ(v, n) { return r(String(Number(v || 0)), n, "R", "0"); }
function rData(d) { return d ? d.replace(/-/g, "") : "        "; }
function limpaCNPJ(c) { return (c || "").replace(/\D/g, "").padEnd(14, "0").substring(0, 14); }
function limpaIE(ie) { return (ie || "ISENTO").padEnd(14, " ").substring(0, 14); }

// Registro 10 - Identificação da empresa
export function reg10(empresa, periodo) {
  // IE: pega somente dígitos; se vazio usa a IE padrão da MG AUTOCENTER
  const ieSoDigitos = (empresa.ie || "").replace(/\D/g, "");
  const ieUsar = ieSoDigitos || "0048295510070";
  const ieCampo = ieUsar.padEnd(14, " ").substring(0, 14);
  const fax = (empresa.fax || "").replace(/\D/g, "") || "0000000000";
  // Campos fixos do layout:
  // pos 124 = código identificação estrutura: "3" = Convênio 76/03 e 20/04
  // pos 125 = natureza das operações: "3" = Totalidade das operações do informante
  // pos 126 = finalidade: "1" = Normal
  const COD_ESTRUTURA = "3";
  const NATUREZA = "3";
  const FINALIDADE = "1";
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
    COD_ESTRUTURA +
    NATUREZA +
    FINALIDADE
  );
}

// Registro 11 - Dados do estabelecimento
// Layout real (baseado em arquivo homologado): 2+34+5+22+15+8+28+12 = 126 chars
export function reg11(empresa) {
  const numeroDigitos = (empresa.numero || "1355").replace(/\D/g, "") || "1355";
  const numero = numeroDigitos.padStart(5, "0").slice(-5);
  const foneDigitos = (empresa.fone || "34998791260").replace(/\D/g, "") || "34998791260";
  const foneCampo = foneDigitos.padStart(12, "0").slice(-12);
  return (
    "11" +
    r(empresa.logradouro || "RUA RUI BARBOSA", 34) + // 34
    numero +                                          //  5
    r(empresa.complemento, 22) +                      // 22
    r(empresa.bairro || "CENTRO", 15) +               // 15
    r((empresa.cep || "38700327").replace(/\D/g, ""), 8) + //  8
    r(empresa.responsavel || "MAYCOW", 28) +          // 28
    foneCampo                                         // 12
  );
}

// Registro 50 - Notas fiscais (cabeçalho)
// NFSe NÃO entra no SINTEGRA — apenas NFe (55) e NFCe (65)
export function reg50(nota, empresa) {
  const isEntrada = nota.status === "Importada";
  const codSit = nota.status === "Cancelada" ? "S" : "N";
  const modelo = nota.tipo === "NFCe" ? "65" : "55";
  const cfop = isEntrada ? "1102" : "5405";

  return (
    "50" +
    limpaCNPJ(nota.cliente_cpf_cnpj || empresa.cnpj) +
    limpaIE(nota.cliente_ie || "") +
    rData(nota.data_emissao) +
    r(nota.cliente_estado || empresa.uf, 2) +
    r(modelo, 2) +
    rZ(nota.serie || "1", 3) +  // zero-preenchido: "001" e não "1  "
    rZ(nota.numero, 6) +
    r(cfop, 5) +
    r(nota.emitente_uf || empresa.uf, 2) +
    rN(nota.valor_total, 13) +
    rN(0, 13) + // base de cálculo ICMS
    rN(0, 12) + // valor do ICMS
    rN(nota.valor_total, 13) + // valor das operações isentas/outras
    rN(0, 13) + // outras
    r("0000", 4) + // alíquota ICMS
    r(codSit, 1)
  );
}

// Registro 54 - Itens das notas (se disponível)
export function reg54(nota, item, numItem, empresa) {
  const modelo = nota.tipo === "NFCe" ? "65" : "55";
  const cfop = nota.status === "Importada" ? "1102" : "5405";
  const ncm = (item.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);

  return (
    "54" +
    limpaCNPJ(nota.cliente_cpf_cnpj || empresa.cnpj) +
    r(modelo, 2) +
    r(nota.serie || "1", 3) +
    rZ(nota.numero, 6) +
    r(cfop, 5) +
    r(ncm, 8) +
    rZ(numItem + 1, 3) +
    r(item.codigo || "000", 14) +
    rN(item.quantidade || 1, 11) +
    rN(item.valor_unitario || item.valor_total / (item.quantidade || 1), 12) +
    rN(0, 12) + // desconto
    rN(0, 12) + // base ICMS
    rN(0, 12) + // valor ICMS
    rN(0, 12) + // base ICMS-ST
    rN(0, 12) + // valor ICMS-ST
    rN(item.valor_total, 12) + // valor total
    r("0", 4)   // alíquota ICMS
  );
}

// Registro 75 - Cadastro de produtos
// Layout exato: 2+8+8+14+8+53+6+13+13 = 125 chars (padrão SINTEGRA IN 68/95)
export function reg75(produto, periodoInicio, periodoFim) {
  const ncm = (produto.ncm || "87089990").replace(/\D/g, "").padEnd(8, "0").substring(0, 8);
  return (
    "75" +
    rData(periodoInicio) +           //  8 — data início período
    rData(periodoFim) +              //  8 — data fim período
    r(produto.codigo || "000", 14) + // 14 — código do produto/serviço
    r(ncm, 8) +                      //  8 — código NCM
    r(produto.descricao, 53) +       // 53 — descrição
    r(produto.unidade || "UN", 6) +  //  6 — unidade de medida
    rN(produto.valor_venda || 0, 13) + // 13 — valor unitário (2 dec. embutidos)
    rN(0, 13)                        // 13 — valor IPI (0 se não aplica)
  );
}

// Registro 90 - Encerramento
export function reg90(empresa, totais, totalLinhas) {
  const linhas = Object.entries(totais).map(([reg, qtd]) =>
    "90" +
    limpaCNPJ(empresa.cnpj) +
    limpaIE(empresa.ie) +
    r(reg, 2) +
    rZ(qtd, 8) +
    r("1", 1)
  );
  linhas.push(
    "90" +
    limpaCNPJ(empresa.cnpj) +
    limpaIE(empresa.ie) +
    r("99", 2) +
    rZ(totalLinhas + linhas.length + 1, 8) +
    r("9", 1)
  );
  return linhas.join("\r\n");
}

export function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  // Montar dados da empresa a partir das configurações
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

  // Reg 10 e 11
  addLinha("10", reg10(empresa, { inicio: periodoInicio, fim: periodoFim }));
  addLinha("11", reg11(empresa));

  // Filtrar notas do período
  const notasPeriodo = notas.filter(n => {
    const d = n.data_emissao || "";
    return d >= periodoInicio && d <= periodoFim && n.status !== "Rascunho";
  });

  // Reg 50 e 54 — apenas NFe e NFCe (NFSe não entra no SINTEGRA)
  const notasSintegra = notasPeriodo.filter(n => n.tipo === "NFe" || n.tipo === "NFCe");
  for (const nota of notasSintegra) {
    addLinha("50", reg50(nota, empresa));

    // Tentar extrair itens do xml_content
    let itens = [];
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        if (Array.isArray(parsed)) itens = parsed;
      } catch {}
    }
    itens.forEach((item, idx) => {
      addLinha("54", reg54(nota, item, idx, empresa));
    });
  }

  // Reg 75 - produtos do estoque
  const produtosUnicos = new Map();
  estoque.forEach(p => {
    const desc = (p.descricao || "").trim();
    const cod = (p.codigo || "").trim();
    // Ignorar produtos sem descrição válida ou com dados inválidos
    if (!desc || desc === "." || desc.length < 2) return;
    if (!cod || cod === "X" || cod === "x") return;
    if (!produtosUnicos.has(cod || p.id)) {
      produtosUnicos.set(cod || p.id, p);
    }
  });
  for (const produto of produtosUnicos.values()) {
    addLinha("75", reg75(produto, periodoInicio, periodoFim));
  }

  // Reg 90 - encerramento
  const fechamento = reg90(empresa, totais, linhas.length);
  const todasLinhas = [...linhas, fechamento].join("\r\n");

  return { conteudo: todasLinhas, totalNotas: notasPeriodo.length };
}