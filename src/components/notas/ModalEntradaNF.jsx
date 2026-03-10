import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Package, DollarSign, FileText, CheckCircle, ChevronRight, ChevronLeft, AlertCircle, Search } from "lucide-react";

const GREEN = "#00ff00";
const GREEN_DARK = "#00dd00";
const FORMAS_PAGAMENTO = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Boleto", "Transferência", "A Prazo"];

// Formata YYYY-MM-DD para DD/MM/AAAA
function fmtData(str) {
  if (!str) return "—";
  const parts = str.substring(0, 10).split("-");
  if (parts.length !== 3) return str;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// localStorage para memória de mapeamento codigo -> estoque
const MAPA_KEY = "nf_produto_mapa";
function lerMapa() {
  try { return JSON.parse(localStorage.getItem(MAPA_KEY) || "{}"); } catch { return {}; }
}
function salvarMapa(mapa) {
  try { localStorage.setItem(MAPA_KEY, JSON.stringify(mapa)); } catch {}
}

function limparNamespaces(xml) {
  return xml.replace(/<(\/?)[a-zA-Z0-9_]+:([a-zA-Z0-9_]+)/g, "<$1$2");
}

function parsearXML(xmlOriginal) {
  const xml = limparNamespaces(xmlOriginal);
  const get = (tag) => { const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`)); return m ? m[1].trim() : ""; };
  const getAll = (tag) => {
    const results = []; const openTag = `<${tag}`; const closeTag = `</${tag}>`; let start = 0;
    while (true) {
      const openIdx = xml.indexOf(openTag, start); if (openIdx === -1) break;
      const tagEnd = xml.indexOf(">", openIdx); if (tagEnd === -1) break;
      const closeIdx = xml.indexOf(closeTag, tagEnd); if (closeIdx === -1) break;
      results.push(xml.substring(tagEnd + 1, closeIdx)); start = closeIdx + closeTag.length;
    }
    return results;
  };

  const chave = xml.match(/chNFe[">]*>?([0-9]{44})/)?.[1] || "";
  const numero = get("nNF"); const serie = get("serie");
  const valor = parseFloat(get("vNF") || "0");
  const dataEmissao = get("dhEmi")?.substring(0, 10) || get("dEmi") || "";
  const emitentes = [...xml.matchAll(/<xNome>([^<]*)<\/xNome>/g)];
  const emitente = emitentes[0]?.[1]?.trim() || "";
  const cnpjEmits = [...xml.matchAll(/<CNPJ>([^<]*)<\/CNPJ>/g)];
  const cnpjEmit = cnpjEmits[0]?.[1]?.trim() || "";
  const dest_nome = emitentes[1]?.[1]?.trim() || "";
  const emit_logr = get("xLgr"); const emit_nro = get("nro"); const emit_bairro = get("xBairro");
  const emit_mun = get("xMun"); const emit_uf = get("UF"); const emit_cep = get("CEP");
  const emit_ie = get("IE");

  const detNodes = getAll("det");
  const itens = detNodes.map(det => {
    const xProd = det.match(/<xProd>([^<]*)<\/xProd>/)?.[1] || "";
    const qCom = parseFloat(det.match(/<qCom>([^<]*)<\/qCom>/)?.[1] || "0");
    const vUnCom = parseFloat(det.match(/<vUnCom>([^<]*)<\/vUnCom>/)?.[1] || "0");
    const vProd = parseFloat(det.match(/<vProd>([^<]*)<\/vProd>/)?.[1] || "0");
    const cProd = det.match(/<cProd>([^<]*)<\/cProd>/)?.[1] || "";
    const cEAN = det.match(/<cEAN>([^<]*)<\/cEAN>/)?.[1] || "";
    const NCM = det.match(/<NCM>([^<]*)<\/NCM>/)?.[1] || "";
    const CFOP = det.match(/<CFOP>([^<]*)<\/CFOP>/)?.[1] || "";
    const uCom = det.match(/<uCom>([^<]*)<\/uCom>/)?.[1] || "";
    // Usa cProd (código interno do fornecedor) como código principal; EAN como fallback se disponível
    const codigoLimpo = cProd || ((cEAN && cEAN !== "SEM GTIN") ? cEAN : "");
    const eanLimpo = (cEAN && cEAN !== "SEM GTIN") ? cEAN : "";
    return { descricao: xProd, quantidade: qCom, valor_unitario: vUnCom, valor_total: vProd, codigo: codigoLimpo, ean: eanLimpo, ncm: NCM, cfop: CFOP, unidade: uCom, dar_entrada_estoque: true, estoqueVinculado: null };
  });

  const vBC = parseFloat(get("vBC") || "0"); const vICMS = parseFloat(get("vICMS") || "0");
  const vIPI = parseFloat(get("vIPI") || "0"); const vPIS = parseFloat(get("vPIS") || "0");
  const vCOFINS = parseFloat(get("vCOFINS") || "0"); const vDesc = parseFloat(get("vDesc") || "0");
  const vFrete = parseFloat(get("vFrete") || "0"); const vProd_total = parseFloat(get("vProd") || "0");
  const natOp = get("natOp"); const infCpl = get("infCpl");

  const pagamentos = [];
  for (const dp of getAll("detPag")) {
    const tPag = dp.match(/<tPag>([^<]*)<\/tPag>/)?.[1] || "";
    const vPag = parseFloat(dp.match(/<vPag>([^<]*)<\/vPag>/)?.[1] || "0");
    pagamentos.push({ tPag, vPag });
  }
  const dupNodes = getAll("dup");
  const boletos = dupNodes.map(dup => ({
    nDup: dup.match(/<nDup>([^<]*)<\/nDup>/)?.[1] || "",
    dVenc: dup.match(/<dVenc>([^<]*)<\/dVenc>/)?.[1] || "",
    vDup: parseFloat(dup.match(/<vDup>([^<]*)<\/vDup>/)?.[1] || "0"),
  }));

  const mapaForma = {
    "01": "Dinheiro", "02": "Cheque", "03": "Cartão de Crédito", "04": "Cartão de Débito",
    "05": "Crediário", "10": "Vale Alimentação", "15": "Boleto", "17": "PIX", "90": "Sem Pagamento", "99": "Outros",
  };
  let forma_pagamento_detectada = boletos.length > 0 ? "Boleto" : "PIX";
  if (pagamentos.length > 0) forma_pagamento_detectada = mapaForma[pagamentos[0].tPag] || forma_pagamento_detectada;

  return {
    chave, numero, serie, valor, dataEmissao, emitente, cnpjEmit, dest_nome,
    emit_logr, emit_nro, emit_bairro, emit_mun, emit_uf, emit_cep, emit_ie,
    itens, pagamentos, boletos, forma_pagamento_detectada,
    vBC, vICMS, vIPI, vPIS, vCOFINS, vDesc, vFrete, vProd_total, natOp, infCpl,
  };
}

// Componente de busca de produto do estoque
function BuscaProduto({ estoqueExistente, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtrados = query.length >= 2
    ? estoqueExistente.filter(e =>
        e.descricao?.toLowerCase().includes(query.toLowerCase()) ||
        e.codigo?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const selecionar = (item) => {
    onChange(item);
    setQuery(item.descricao);
    setOpen(false);
  };

  const limpar = () => { onChange(null); setQuery(""); };

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            value={value ? value.descricao : query}
            onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
            onFocus={() => setOpen(true)}
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none"
            style={{ borderColor: value ? GREEN : undefined }}
            placeholder="Buscar produto cadastrado..."
          />
        </div>
        {value && (
          <button onClick={limpar} className="text-gray-400 hover:text-white px-1">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && filtrados.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg z-10 shadow-xl max-h-40 overflow-y-auto">
          {filtrados.map(item => (
            <button key={item.id} onClick={() => selecionar(item)}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-all flex justify-between gap-2">
              <span className="truncate">{item.descricao}</span>
              <span className="text-gray-500 flex-shrink-0">{item.codigo || "—"}</span>
            </button>
          ))}
        </div>
      )}
      {value && <p className="text-xs mt-1" style={{ color: GREEN }}>✓ Vinculado: {value.descricao}</p>}
    </div>
  );
}

export default function ModalEntradaNF({ xmlTexto, onClose, onSalvo }) {
  const [aba, setAba] = useState("fiscal");
  const [dados, setDados] = useState(null);
  const [itens, setItens] = useState([]);
  const [financeiro, setFinanceiro] = useState({ forma_pagamento: "PIX", data_vencimento: "", data_pagamento: "", status: "Pendente", fornecedor: "", observacoes: "" });
  const [boletos, setBoletos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [estoqueExistente, setEstoqueExistente] = useState([]);
  const [fornecedorJaCadastrado, setFornecedorJaCadastrado] = useState(false);
  const [cadastrarFornecedor, setCadastrarFornecedor] = useState(false);
  const [nomeFornecedor, setNomeFornecedor] = useState("");
  const [erroDuplicada, setErroDuplicada] = useState("");

  useEffect(() => {
    const parsed = parsearXML(xmlTexto);
    const mapa = lerMapa();

    // Aplicar memória de mapeamento
    const itensComMapa = parsed.itens.map(item => {
      if (item.codigo && mapa[item.codigo]) {
        return { ...item, estoqueVinculado: mapa[item.codigo] };
      }
      return item;
    });

    setDados(parsed);
    setItens(itensComMapa);
    setBoletos(parsed.boletos || []);
    setNomeFornecedor(parsed.emitente || "");
    setFinanceiro(f => ({
      ...f,
      forma_pagamento: parsed.forma_pagamento_detectada || "PIX",
      fornecedor: parsed.emitente,
      data_vencimento: parsed.boletos?.length > 0 ? (parsed.boletos[0].dVenc || parsed.dataEmissao) : parsed.dataEmissao,
    }));

    Promise.all([
      base44.entities.Estoque.list("-created_date", 500),
      base44.entities.NotaFiscal.list("-created_date", 500),
      base44.entities.Cliente.list("-created_date", 500),
    ]).then(([est, nfs, clientes]) => {
      setEstoqueExistente(est);

      // Tentar auto-vincular por código ou descrição se não houver mapeamento salvo
      setItens(prev => prev.map(item => {
        if (item.estoqueVinculado) return item; // já tem mapeamento
        let encontrado = null;
        if (item.codigo) encontrado = est.find(e => e.codigo === item.codigo);
        if (!encontrado) encontrado = est.find(e => e.descricao?.trim().toLowerCase() === item.descricao.trim().toLowerCase());
        return encontrado ? { ...item, estoqueVinculado: { id: encontrado.id, descricao: encontrado.descricao } } : item;
      }));

      const chave = parsed.chave;
      if (chave) {
        const dup = nfs.find(n => n.chave_acesso === chave);
        if (dup) setErroDuplicada(`Esta nota fiscal já foi importada (NF ${dup.numero} em ${fmtData(dup.data_emissao)}).`);
      }

      const cnpjLimpo = parsed.cnpjEmit?.replace(/\D/g, "");
      if (cnpjLimpo) {
        const jaExiste = clientes.find(c => c.cpf_cnpj?.replace(/\D/g, "") === cnpjLimpo);
        setFornecedorJaCadastrado(!!jaExiste);
        if (!jaExiste) setCadastrarFornecedor(true);
      } else {
        setFornecedorJaCadastrado(false);
        setCadastrarFornecedor(true);
      }
    });
  }, []);

  const abasConfig = [
    { id: "fiscal", label: "Dados Fiscais", icon: FileText },
    { id: "estoque", label: "Entrada Estoque", icon: Package },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
  ];

  const finalizarImportacao = async () => {
    if (erroDuplicada) return setErro(erroDuplicada);
    setSalvando(true);
    setErro("");
    try {
      if (cadastrarFornecedor && !fornecedorJaCadastrado && nomeFornecedor) {
        const clientesAtuais = await base44.entities.Cliente.list("-created_date", 500);
        const cnpjLimpo = dados.cnpjEmit?.replace(/\D/g, "");
        const jaExiste = cnpjLimpo && clientesAtuais.find(c => c.cpf_cnpj?.replace(/\D/g, "") === cnpjLimpo);
        if (!jaExiste) {
          await base44.entities.Cliente.create({
            nome: nomeFornecedor, tipo: "Pessoa Jurídica", cpf_cnpj: dados.cnpjEmit || "",
            endereco: dados.emit_logr || "", numero: dados.emit_nro || "", bairro: dados.emit_bairro || "",
            cidade: dados.emit_mun || "", estado: dados.emit_uf || "", cep: dados.emit_cep || "",
            observacoes: "Fornecedor cadastrado automaticamente via importação de NF",
          });
        }
      }

      const itensParaSalvar = itens.map(i => ({ descricao: i.descricao, quantidade: i.quantidade, codigo: i.codigo }));
      await base44.entities.NotaFiscal.create({
        tipo: "NFe", numero: dados.numero, serie: dados.serie, status: "Importada",
        cliente_nome: dados.emitente, valor_total: dados.valor, chave_acesso: dados.chave,
        xml_content: JSON.stringify(itensParaSalvar), data_emissao: dados.dataEmissao,
        observacoes: `CNPJ Fornecedor: ${dados.cnpjEmit}`,
      });

      let estoqueAtual = await base44.entities.Estoque.list("-created_date", 500);
      const idsUsados = new Set();
      const mapaAtualizado = lerMapa();

      for (const item of itens) {
        if (!item.dar_entrada_estoque || !item.descricao) continue;

        // Salvar mapeamento se houver código e vínculo manual
        if (item.codigo && item.estoqueVinculado) {
          mapaAtualizado[item.codigo] = item.estoqueVinculado;
        }

        let existente = null;

        // Prioridade 1: vínculo manual/automático
        if (item.estoqueVinculado?.id) {
          existente = estoqueAtual.find(e => e.id === item.estoqueVinculado.id && !idsUsados.has(e.id));
        }
        // Prioridade 2: código
        if (!existente && item.codigo) {
          existente = estoqueAtual.find(e => e.codigo === item.codigo && !idsUsados.has(e.id));
        }
        // Prioridade 3: descrição
        if (!existente) {
          existente = estoqueAtual.find(e =>
            e.descricao?.trim().toLowerCase() === item.descricao.trim().toLowerCase() && !idsUsados.has(e.id)
          );
        }

        if (existente) {
          idsUsados.add(existente.id);
          const novaQtd = (existente.quantidade || 0) + item.quantidade;
          await base44.entities.Estoque.update(existente.id, {
            quantidade: novaQtd, valor_custo: item.valor_unitario,
            ncm: item.ncm || existente.ncm, cfop: item.cfop || existente.cfop,
          });
          estoqueAtual = estoqueAtual.map(e => e.id === existente.id ? { ...e, quantidade: novaQtd } : e);
        } else {
          const criado = await base44.entities.Estoque.create({
            descricao: item.descricao,
            codigo: item.codigo || "",
            quantidade: item.quantidade,
            valor_custo: item.valor_unitario, valor_venda: item.valor_unitario,
            unidade: item.unidade || "UN", fornecedor: dados.emitente,
            ncm: item.ncm || "", cfop: item.cfop || "",
            marca: item.marca || "",
            categoria: item.categoria || "",
          });
          if (criado?.id) {
            idsUsados.add(criado.id);
            estoqueAtual.push({ ...criado, quantidade: item.quantidade });
            if (item.codigo) mapaAtualizado[item.codigo] = { id: criado.id, descricao: item.descricao };
          }
        }
      }

      salvarMapa(mapaAtualizado);

      const isBoleto = financeiro.forma_pagamento === "Boleto" && boletos.length > 1;
      if (isBoleto) {
        for (const bol of boletos) {
          await base44.entities.Financeiro.create({
            tipo: "Despesa", categoria: "Compra de Peças / Materiais",
            descricao: `NF ${dados.numero} — ${nomeFornecedor || dados.emitente}${bol.nDup ? ` (Bol. ${bol.nDup})` : ""}`,
            valor: bol.vDup, forma_pagamento: "Boleto",
            data_vencimento: bol.dVenc || financeiro.data_vencimento,
            data_pagamento: "", status: "Pendente", observacoes: financeiro.observacoes,
          });
        }
      } else {
        await base44.entities.Financeiro.create({
          tipo: "Despesa", categoria: "Compra de Peças / Materiais",
          descricao: `NF ${dados.numero} — ${nomeFornecedor || dados.emitente}`,
          valor: dados.valor, forma_pagamento: financeiro.forma_pagamento,
          data_vencimento: financeiro.data_vencimento,
          data_pagamento: financeiro.status === "Pago" ? (financeiro.data_pagamento || new Date().toISOString().split("T")[0]) : "",
          status: financeiro.status, observacoes: financeiro.observacoes,
        });
      }

      onSalvo?.();
    } catch (e) {
      setErro("Erro ao finalizar: " + e.message);
    }
    setSalvando(false);
  };

  if (!dados) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-lg">Receber Nota Fiscal de Entrada</h2>
            <p className="text-gray-500 text-xs mt-0.5">NF {dados.numero || "—"} — {dados.emitente || "Fornecedor"}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-800 px-5 pt-3 gap-1">
          {abasConfig.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setAba(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all -mb-px ${aba === id ? "bg-gray-800 text-white border border-gray-700 border-b-gray-800" : "text-gray-500 hover:text-gray-300"}`}>
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ABA FISCAL */}
          {aba === "fiscal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoField label="Número / Série" value={`${dados.numero || "—"}${dados.serie ? `/${dados.serie}` : ""}`} />
                <InfoField label="Data de Emissão" value={fmtData(dados.dataEmissao)} />
                <InfoField label="Valor Total" value={`R$ ${Number(dados.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} highlight />
                <InfoField label="Fornecedor / Emitente" value={dados.emitente || "—"} className="col-span-2" />
                <InfoField label="CNPJ Emitente" value={dados.cnpjEmit || "—"} />
              </div>
              {dados.chave && (
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Chave de Acesso</p>
                  <p className="text-xs text-gray-300 font-mono break-all">{dados.chave}</p>
                </div>
              )}
              {erroDuplicada && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {erroDuplicada}
                </p>
              )}

              {!fornecedorJaCadastrado ? (
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium flex items-center gap-2" style={{ color: GREEN }}>
                      <AlertCircle className="w-4 h-4" /> Fornecedor não encontrado no cadastro
                    </p>
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={cadastrarFornecedor} onChange={e => setCadastrarFornecedor(e.target.checked)} className="accent-green-500" />
                      Cadastrar agora
                    </label>
                  </div>
                  {cadastrarFornecedor && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Nome do Fornecedor *</label>
                      <input
                        value={nomeFornecedor}
                        onChange={e => { setNomeFornecedor(e.target.value); setFinanceiro(f => ({ ...f, fornecedor: e.target.value })); }}
                        className="input-dark"
                        placeholder="Nome / Razão Social do fornecedor"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nome do Fornecedor</label>
                  <input
                    value={nomeFornecedor}
                    onChange={e => { setNomeFornecedor(e.target.value); setFinanceiro(f => ({ ...f, fornecedor: e.target.value })); }}
                    className="input-dark"
                    placeholder="Nome do fornecedor"
                  />
                  <p className="text-xs text-green-400 mt-1">✓ Fornecedor já cadastrado</p>
                </div>
              )}

              <p className="text-xs text-gray-500 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                Confira os dados acima e avance para configurar a entrada no estoque e o lançamento financeiro.
              </p>
              <div className="flex justify-end">
                <button onClick={() => setAba("estoque")}
                  className="flex items-center gap-2 text-black px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: GREEN }}
                  onMouseEnter={e => e.currentTarget.style.background = GREEN_DARK}
                  onMouseLeave={e => e.currentTarget.style.background = GREEN}>
                  Próximo: Estoque <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ABA ESTOQUE */}
          {aba === "estoque" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Marque os itens que devem entrar no estoque. Edite o código ou vincule a um produto existente.</p>
              {itens.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">Nenhum item encontrado no XML</p>
              ) : (
                <div className="space-y-2">
                  {itens.map((item, i) => (
                    <div key={i} className={`bg-gray-800 border rounded-xl p-3 transition-all ${item.dar_entrada_estoque ? "border-green-500/30" : "border-gray-700 opacity-60"}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={item.dar_entrada_estoque}
                          onChange={e => setItens(prev => prev.map((it, idx) => idx === i ? { ...it, dar_entrada_estoque: e.target.checked } : it))}
                          className="mt-1 accent-green-500 w-4 h-4 flex-shrink-0 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{item.descricao}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                            <span>Qtd: <span className="text-white">{item.quantidade}</span></span>
                            <span>Unit: <span className="text-white">R$ {Number(item.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                            <span>Total: <span className="font-medium" style={{ color: GREEN }}>R$ {Number(item.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                          </div>

                          {item.dar_entrada_estoque && (
                            <div className="mt-2 space-y-2">
                              {/* Descrição editável */}
                              <input
                                value={item.descricao}
                                onChange={e => setItens(prev => prev.map((it, idx) => idx === i ? { ...it, descricao: e.target.value } : it))}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
                                placeholder="Descrição para o estoque"
                              />
                              {/* Código editável */}
                              <div className="flex gap-2 items-center">
                                <span className="text-xs text-gray-500 flex-shrink-0">Código:</span>
                                <input
                                  value={item.codigo}
                                  onChange={e => setItens(prev => prev.map((it, idx) => idx === i ? { ...it, codigo: e.target.value } : it))}
                                  className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
                                  placeholder="Código / EAN (editável)"
                                />
                              </div>
                              {/* Busca produto existente */}
                              <BuscaProduto
                                estoqueExistente={estoqueExistente}
                                value={item.estoqueVinculado}
                                onChange={vinculado => setItens(prev => prev.map((it, idx) => idx === i ? { ...it, estoqueVinculado: vinculado } : it))}
                              />
                              {!item.estoqueVinculado && (
                                <>
                                  <p className="text-xs text-gray-500">Nenhum vínculo — será criado como novo produto no estoque</p>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <input
                                        value={item.marca || ""}
                                        onChange={e => setItens(prev => prev.map((it, idx) => idx === i ? { ...it, marca: e.target.value } : it))}
                                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
                                        placeholder="Marca (ex: Bosch, Cofap...)"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <input
                                        value={item.categoria || ""}
                                        onChange={e => setItens(prev => prev.map((it, idx) => idx === i ? { ...it, categoria: e.target.value } : it))}
                                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
                                        placeholder="Categoria (ex: Freios, Filtros...)"
                                      />
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between">
                <button onClick={() => setAba("fiscal")} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm px-4 py-2 border border-gray-700 rounded-lg transition-all">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                <button onClick={() => setAba("financeiro")}
                  className="flex items-center gap-2 text-black px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: GREEN }}
                  onMouseEnter={e => e.currentTarget.style.background = GREEN_DARK}
                  onMouseLeave={e => e.currentTarget.style.background = GREEN}>
                  Próximo: Financeiro <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ABA FINANCEIRO */}
          {aba === "financeiro" && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Valor da NF</span>
                <span className="font-bold text-xl" style={{ color: GREEN }}>R$ {Number(dados.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <F label="Forma de Pagamento">
                  <select value={financeiro.forma_pagamento} onChange={e => setFinanceiro(f => ({ ...f, forma_pagamento: e.target.value }))} className="input-dark">
                    {FORMAS_PAGAMENTO.map(fp => <option key={fp}>{fp}</option>)}
                  </select>
                </F>
                <F label="Status do Pagamento">
                  <select value={financeiro.status} onChange={e => setFinanceiro(f => ({ ...f, status: e.target.value }))} className="input-dark">
                    <option value="Pendente">Pendente</option>
                    <option value="Pago">Pago</option>
                    <option value="Atrasado">Atrasado</option>
                  </select>
                </F>

                {financeiro.forma_pagamento === "Boleto" && boletos.length > 0 ? (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                      <span className="font-medium" style={{ color: GREEN }}>{boletos.length} boleto(s) detectado(s) no XML</span> — cada um será lançado individualmente no financeiro
                    </p>
                    <div className="space-y-2">
                      {boletos.map((bol, i) => (
                        <div key={i} className="bg-gray-700 rounded-lg px-3 py-2 flex justify-between items-center text-xs">
                          <span className="text-gray-300">Boleto {bol.nDup || i + 1}</span>
                          <span className="text-white">Venc: <b>{fmtData(bol.dVenc)}</b></span>
                          <span className="font-bold" style={{ color: GREEN }}>R$ {Number(bol.vDup || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <F label="Data de Vencimento">
                    <input type="date" value={financeiro.data_vencimento} onChange={e => setFinanceiro(f => ({ ...f, data_vencimento: e.target.value }))} className="input-dark" />
                  </F>
                )}

                {financeiro.status === "Pago" && (
                  <F label="Data de Pagamento">
                    <input type="date" value={financeiro.data_pagamento} onChange={e => setFinanceiro(f => ({ ...f, data_pagamento: e.target.value }))} className="input-dark" />
                  </F>
                )}
                <F label="Fornecedor" className="md:col-span-2">
                  <input value={financeiro.fornecedor} onChange={e => setFinanceiro(f => ({ ...f, fornecedor: e.target.value }))} className="input-dark" placeholder="Nome do fornecedor" />
                </F>
                <F label="Observações" className="md:col-span-2">
                  <textarea value={financeiro.observacoes} onChange={e => setFinanceiro(f => ({ ...f, observacoes: e.target.value }))} className="input-dark" rows={2} />
                </F>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-2 text-sm">
                <p className="text-white font-medium mb-2">Resumo da operação:</p>
                <div className="flex items-center gap-2 text-gray-400"><FileText className="w-4 h-4 text-blue-400" /> NF importada como <span className="text-white font-medium">Importada</span></div>
                <div className="flex items-center gap-2 text-gray-400"><Package className="w-4 h-4 text-green-400" />{itens.filter(i => i.dar_entrada_estoque).length} iten(s) entram no estoque</div>
                <div className="flex items-center gap-2 text-gray-400"><DollarSign className="w-4 h-4" style={{ color: GREEN }} /> Lançamento de <span className="text-red-400 font-medium">Despesa</span> no financeiro — {financeiro.status}</div>
              </div>

              {erro && (
                <p className="text-red-400 text-xs flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {erro}
                </p>
              )}

              <div className="flex justify-between">
                <button onClick={() => setAba("estoque")} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm px-4 py-2 border border-gray-700 rounded-lg transition-all">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                <button onClick={finalizarImportacao} disabled={salvando}
                  className="flex items-center gap-2 text-black px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: GREEN }}
                  onMouseEnter={e => { if (!salvando) e.currentTarget.style.background = GREEN_DARK; }}
                  onMouseLeave={e => e.currentTarget.style.background = GREEN}>
                  {salvando ? "Salvando..." : "Finalizar Importação"}
                  {!salvando && <CheckCircle className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`.input-dark{width:100%;background:#1f2937;border:1px solid #374151;color:#fff;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input-dark:focus{border-color:#00ff00}.input-dark::placeholder{color:#6b7280}`}</style>
    </div>
  );
}

function InfoField({ label, value, highlight, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${highlight ? "text-base font-bold" : "text-white"}`} style={highlight ? { color: GREEN } : {}}>{value}</p>
    </div>
  );
}

function F({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}