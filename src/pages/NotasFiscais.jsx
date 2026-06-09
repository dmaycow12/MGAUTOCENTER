import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import {
  FileText, Plus, Upload, Search, Trash2, X,
  CheckCircle, AlertCircle, PlusCircle, MinusCircle, RefreshCw, ChevronLeft, ChevronRight, LayoutGrid, List, BarChart2, Pencil, Ban, LogIn, Code, Download
} from "lucide-react";
import ModalEntradaNF from "@/components/notas/ModalEntradaNF";
import ModalSintegra from "@/components/notas/ModalSintegra";
import ModalXML from "@/components/notas/ModalXML";
import ModalPreVisualizacao from "@/components/notas/ModalPreVisualizacao";
import ModalValidacaoXmlPdf from "@/components/notas/ModalValidacaoXmlPdf";
import SearchableSelect from "@/components/notas/SearchableSelect";
import { gerarDadosAdicionaisDaVenda, gerarInfoParcelas } from "@/components/notas/gerarDadosAdicionais";

import JSZip from "jszip";

const STATUS_COLOR = {
  Rascunho: "bg-gray-500/10 text-gray-400",
  "Homologada": "bg-yellow-500/10 text-yellow-400",
  "Pré-visualização": "bg-yellow-500/10 text-yellow-400",
  Emitida: "bg-green-500/10 text-green-400",
  Lançada: "bg-green-500/10 text-green-400",
  Cancelada: "bg-red-500/10 text-red-400",
  Importada: "bg-blue-500/10 text-blue-400",
};

const FORMAS_PAGAMENTO = ["A Combinar", "Boleto", "Cartão", "Cheque", "Dinheiro", "PIX", "Transferência"];

// Normaliza formas de pagamento da venda para os valores aceitos na NF
function normalizarFormaPagamento(fp) {
  if (!fp) return "A Combinar";
  const fpUp = fp.toUpperCase();
  if (fpUp.includes("CART")) return "Cartão";
  if (fpUp === "PIX") return "PIX";
  if (fpUp.includes("DINHEIRO") || fpUp === "DINHEIRO") return "Dinheiro";
  if (fpUp.includes("BOLETO")) return "Boleto";
  if (fpUp.includes("TRANSF")) return "Transferência";
  if (fpUp.includes("CHEQUE")) return "Cheque";
  // Se já for um valor válido, retorna ele mesmo
  if (FORMAS_PAGAMENTO.includes(fp)) return fp;
  return "A Combinar";
}

function defaultItem() {
  return { descricao: "", quantidade: 1, valor_unitario: 0, valor_total: 0 };
}

function defaultForm() {
  return {
    tipo: "NFSe",
    numero: "",
    serie: "1",
    natureza_operacao: "Venda de mercadoria",
    tipo_documento: "1",
    data_emissao: new Date().toISOString().split("T")[0],
    forma_pagamento: "A Combinar",
    parcelas: 1,
    parcelas_detalhes: [],
    observacoes: "",
    dados_adicionais: "",
    cliente_id: "",
    cliente_im: "",
    cliente_nome: "",
    cliente_cpf_cnpj: "",
    cliente_ie: "",
    cliente_email: "",
    cliente_telefone: "",
    cliente_endereco: "",
    cliente_numero: "",
    cliente_bairro: "",
    cliente_cep: "",
    cliente_cidade: "",
    cliente_estado: "",
    ordem_venda_id: "",
    items: [defaultItem()],
    valor_total: 0,
  };
}

function NoACInput({ value, onChange, placeholder, maxLength, className = "input-dark", type = "text" }) {
  return (
    <input
      type={type}
      autoComplete="new-password"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
    />
  );
}

export default function NotasFiscais() {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState(() => { try { const s = localStorage.getItem("nf_filtroTipo"); return s ? JSON.parse(s) : ["Saída"]; } catch { return ["Saída"]; } });
  const [filtroModeloNF, setFiltroModeloNF] = useState(() => { try { const s = localStorage.getItem("nf_filtroModelo"); const parsed = s ? JSON.parse(s) : null; return parsed && parsed.length > 0 ? parsed : ["NFe", "NFCe", "NFSe"]; } catch { return ["NFe", "NFCe", "NFSe"]; } });
  const [gerandoZip, setGerandoZip] = useState(false);
  const [showImportBackup, setShowImportBackup] = useState(false);
  const [importandoBackup, setImportandoBackup] = useState(false);
  const [resultadoImportBackup, setResultadoImportBackup] = useState(null);
  const [nfseParaImportar, setNfseParaImportar] = useState(null);
  const [autorizandoMassa, setAutorizandoMassa] = useState(false);
  const [showSintegra, setShowSintegra] = useState(false);
  const [buscandoSefaz, setBuscandoSefaz] = useState(false);
  const [atualizandoStatus, setAtualizandoStatus] = useState(null);

  const [notaIdParaEntrada, setNotaIdParaEntrada] = useState(null);
  const hoje = new Date();
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const [filtroMes, setFiltroMes] = useState(() => { try { const s = localStorage.getItem("nf_filtroMes"); return s ? Number(s) : hoje.getMonth() + 1; } catch { return hoje.getMonth() + 1; } });
  const [filtroAno, setFiltroAno] = useState(() => { try { const s = localStorage.getItem("nf_filtroAno"); return s ? Number(s) : hoje.getFullYear(); } catch { return hoje.getFullYear(); } });
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(false);
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const [customRange, setCustomRange] = useState(null);
  const periodoDropRef = useRef(null);

  const pad = n => String(n).padStart(2, "0");
  
  const ultimoDiaDoMes = (ano, mes) => {
    return new Date(ano, mes, 0).getDate();
  };
  
  const periodoRange = usandoOutroPeriodo && customRange
    ? customRange
    : { 
        inicio: `${filtroAno}-${pad(filtroMes)}-01`, 
        fim: `${filtroAno}-${pad(filtroMes)}-${pad(ultimoDiaDoMes(filtroAno, filtroMes))}` 
      };

  const navegarMes = (direcao) => {
    setUsandoOutroPeriodo(false);
    setCustomRange(null);
    let novoMes = filtroMes + direcao;
    let novoAno = filtroAno;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setFiltroMes(novoMes);
    setFiltroAno(novoAno);
    localStorage.setItem("nf_filtroMes", novoMes);
    localStorage.setItem("nf_filtroAno", novoAno);
  };

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    setCustomRange({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
    setUsandoOutroPeriodo(true);
    setPeriodoDropOpen(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) setPeriodoDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [viewMode, setViewMode] = useState(() => localStorage.getItem("notas_viewmode") || "table");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showEntrada, setShowEntrada] = useState(false);
  const [xmlTexto, setXmlTexto] = useState("");
  const [xmlParaEntrada, setXmlParaEntrada] = useState("");
  const [importando, setImportando] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(defaultForm());
  const [emitindo, setEmitindo] = useState(false);
  const [transmitindo, setTransmitindo] = useState(null);
  const [preVisualizando, setPreVisualizando] = useState(null);
  const [modalPreview, setModalPreview] = useState(null);
  const [aguardandoEmissao, setAguardandoEmissao] = useState(false);
  const [pollingNotaId, setPollingNotaId] = useState(null);
  const pollingIntervalRef = useRef(null);
  const currentEditIdRef = useRef(null);
  const [msgFeedback, setMsgFeedback] = useState(null);
  const [temSpedy, setTemSpedy] = useState(false);
  const [abaForm, setAbaForm] = useState("cliente");
  const [errosForm, setErrosForm] = useState({});
  const [configsNF, setConfigsNF] = useState([]);
  const [avisoExclusao, setAvisoExclusao] = useState(null);
  const [xmlModal, setXmlModal] = useState(null);
  const [validandoXmlPdf, setValidandoXmlPdf] = useState(false);
  const [resultadoValidacao, setResultadoValidacao] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("emitir") === "1") {
      (async () => {
        const tipo = params.get("tipo") || "NFSe";
        const venda_id = params.get("os_id") || "";
        const cliente_id_param = params.get("cliente_id") || "";
        const cliente_nome_param = params.get("cliente_nome") || "";
        window.history.replaceState({}, "", window.location.pathname);

        const [{ clientes: clientesList, estoque: estoqueData }, vendaData] = await Promise.all([
          load(),
          venda_id ? base44.entities.Vendas.filter({ id: venda_id }, "-created_date", 1) : Promise.resolve([]),
        ]);

        const venda = vendaData[0];
        let items = [defaultItem()];
        let valor_total = 0;

        if (venda) {
          if (tipo === "NFSe") {
            const servs = venda.servicos || [];
            if (servs.length > 0) {
              items = servs.map(s => ({
                descricao: s.descricao || "",
                quantidade: Number(s.quantidade ?? 1),
                valor_unitario: Number(s.valor || 0),
                valor_total: Number(s.valor || 0) * Number(s.quantidade ?? 1),
              }));
            }
          } else {
            const pecas = venda.pecas || [];
            if (pecas.length > 0) {
              items = pecas.map(p => {
                const estoqueItem = estoqueData.find(e => e.id === p.estoque_id);
                return {
                  descricao: p.descricao || "",
                  codigo: p.codigo || estoqueItem?.codigo || "",
                  estoque_id: p.estoque_id || "",
                  quantidade: Number(p.quantidade || 1),
                  valor_unitario: Number(p.valor_unitario || 0),
                  valor_total: Number(p.valor_total || 0),
                  ncm: estoqueItem?.ncm || "87089990",
                  cfop: estoqueItem?.cfop || "5405",
                  cest: estoqueItem?.cest || "",
                  unidade: estoqueItem?.unidade || "UN",
                };
              });
            }
          }
          valor_total = items.reduce((sum, it) => sum + it.valor_total, 0);
        }

        const clienteIdFinal = venda?.cliente_id || cliente_id_param;
        const clienteNomeBusca = venda?.cliente_nome || cliente_nome_param || "";
        const c = clientesList?.find(cl => cl.id === clienteIdFinal)
          || (clienteNomeBusca ? clientesList?.find(cl => cl.nome?.toLowerCase() === clienteNomeBusca.toLowerCase()) : null);

        // Determina forma_pagamento: prioriza a primeira parcela da venda, depois o campo geral
        const formaPagamentoRaw = venda?.parcelas_detalhes?.[0]?.forma_pagamento || venda?.forma_pagamento || "A Combinar";
        const formaPagamentoVenda = normalizarFormaPagamento(formaPagamentoRaw);
        // Normaliza também as formas de pagamento dentro das parcelas_detalhes
        const parcelasDetalhesNormalizadas = (venda?.parcelas_detalhes || []).map(p => ({
          ...p,
          forma_pagamento: normalizarFormaPagamento(p.forma_pagamento),
        }));

        const dadosCliente = c ? {
          cliente_id: c.id,
          cliente_nome: c.nome || cliente_nome_param,
          cliente_nome_fantasia: c.nome_fantasia || venda?.cliente_nome_fantasia || "",
          cliente_cpf_cnpj: c.cpf_cnpj || venda?.cliente_cpf_cnpj || "",
          cliente_ie: c.rg_ie || "",
          cliente_im: c.inscricao_municipal || "",
          cliente_email: c.email || venda?.cliente_email || "",
          cliente_telefone: c.telefone || venda?.cliente_telefone || "",
          cliente_endereco: c.endereco || venda?.cliente_endereco || "",
          cliente_numero: c.numero || "",
          cliente_bairro: c.bairro || venda?.cliente_bairro || "",
          cliente_cep: c.cep || "",
          cliente_cidade: c.cidade || venda?.cliente_cidade || "",
          cliente_estado: c.estado || venda?.cliente_estado || "",
          forma_pagamento: formaPagamentoVenda,
          parcelas: venda?.parcelas || 1,
          parcelas_detalhes: parcelasDetalhesNormalizadas,
        } : {
          cliente_id: cliente_id_param,
          cliente_nome: cliente_nome_param,
          cliente_cpf_cnpj: venda?.cliente_cpf_cnpj || "",
          cliente_email: venda?.cliente_email || "",
          cliente_telefone: venda?.cliente_telefone || "",
          cliente_endereco: venda?.cliente_endereco || "",
          cliente_bairro: venda?.cliente_bairro || "",
          cliente_cidade: venda?.cliente_cidade || "",
          cliente_estado: venda?.cliente_estado || "",
          forma_pagamento: formaPagamentoVenda,
          parcelas: venda?.parcelas || 1,
          parcelas_detalhes: parcelasDetalhesNormalizadas,
        };

        const isConsumidor = !dadosCliente.cliente_cpf_cnpj?.trim() || (dadosCliente.cliente_nome || "").toUpperCase() === "CONSUMIDOR";
        const tipoFinal = isConsumidor ? "NFCe" : tipo;

        const dados_adicionais = gerarDadosAdicionaisDaVenda(venda);

        const dataEmissaoVenda = venda?.data_entrada || new Date().toISOString().split('T')[0];

        // Sempre gera parcelas usando a data da venda (data_entrada) como base
        const qtdP = dadosCliente.parcelas || 1;
        const fpP = dadosCliente.forma_pagamento || 'A Combinar';
        const parcelasFinais = gerarParcelas(qtdP, fpP, valor_total, dataEmissaoVenda);

        setForm({ ...defaultForm(), tipo: tipoFinal, ordem_venda_id: venda_id, ...dadosCliente, parcelas_detalhes: parcelasFinais, valor_total, items, dados_adicionais, data_emissao: dataEmissaoVenda });
        setAbaForm("cliente");
        setShowForm(true);
      })();
    } else {
      load();
    }
  }, []);

  const proximoNumero = (notasList, tipo) => {
    const chaveConfig = tipo === 'NFCe' ? 'nfce_ultimo_numero' : tipo === 'NFe' ? 'nfe_ultimo_numero' : 'nfse_ultimo_dps';
    const cfgUltimo = configsNF.find(c => c.chave === chaveConfig);
    const ultimoSalvo = parseInt(cfgUltimo?.valor || '0', 10);
    return String(ultimoSalvo + 1);
  };

  const proximaSerie = (notasList, tipo) => {
    if (tipo === 'NFSe') return '900';
    const chaveConfig = tipo === 'NFe' ? 'nfe_serie' : 'nfce_serie';
    const cfgSerie = configsNF.find(c => c.chave === chaveConfig);
    return cfgSerie?.valor || '1';
  };

  const load = async () => {
    const [n, c, configs, vendas, est, srv] = await Promise.all([
      base44.entities.NotaFiscal.list("-created_date", 500),
      base44.entities.Cadastro.list("-created_date", 500),
      base44.entities.Configuracao.list("-created_date", 100),
      base44.entities.Vendas.list("-created_date", 500),
      base44.entities.Estoque.list("-created_date", 500),
      base44.entities.Servico.list("-created_date", 500),
    ]);
    setNotas(n);
    setClientes(c);
    setVendas(vendas);
    setEstoque(est);
    setServicos(srv);
    setConfigsNF(configs);
    setTemSpedy(true);
    setLoading(false);
    return { clientes: c, estoque: est };
  };

  const filtradas = notas.filter(n => {
    if (filtroTipo.length === 0 || filtroModeloNF.length === 0) return false;
    const isDevolucaoNota = n.observacoes === "DEVOLUÇÃO";
    const isEntrada = !isDevolucaoNota && (n.status === "Importada" || n.status === "Lançada");
    const matchTipo = filtroTipo.length === 0 || (filtroTipo.includes("Saída") && !isEntrada) || (filtroTipo.includes("Entrada") && isEntrada);
    const matchModelo = filtroModeloNF.length === 0 || filtroModeloNF.includes(n.tipo);
    if (!matchTipo || !matchModelo) return false;
    if (n.data_emissao && (n.data_emissao < periodoRange.inicio || n.data_emissao > periodoRange.fim)) return false;
    if (search) {
      const s = search.toLowerCase();
      return (n.cliente_nome || "").toLowerCase().includes(s) || (n.numero || "").includes(s) || (n.chave_acesso || "").includes(s);
    }
    return true;
  }).sort((a, b) => {
    const dateA = a.data_emissao || "";
    const dateB = b.data_emissao || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0);
  });

  const totalNFeEmitida = filtradas.filter(n => n.tipo === 'NFe' && n.status === 'Emitida').reduce((s, n) => s + Number(n.valor_total || 0), 0);
  const totalNFCeEmitida = filtradas.filter(n => n.tipo === 'NFCe' && n.status === 'Emitida').reduce((s, n) => s + Number(n.valor_total || 0), 0);
  const totalNFSeEmitida = filtradas.filter(n => n.tipo === 'NFSe' && n.status === 'Emitida').reduce((s, n) => s + Number(n.valor_total || 0), 0);
  const totalEmitidas = totalNFeEmitida + totalNFCeEmitida + totalNFSeEmitida;
  const totalNFeLancada = filtradas.filter(n => n.tipo === 'NFe' && n.status === 'Lançada').reduce((s, n) => s + Number(n.valor_total || 0), 0);
  const totalNFSeLancada = filtradas.filter(n => n.tipo === 'NFSe' && n.status === 'Lançada').reduce((s, n) => s + Number(n.valor_total || 0), 0);

  const clientesFiltrados = clientes.filter(c => {
    const isConsumidor = c.nome?.toUpperCase() === "CONSUMIDOR";
    const temDocumento = !!(c.cpf_cnpj && c.cpf_cnpj.trim());
    if (form.tipo === "NFSe") return !isConsumidor && temDocumento;
    return true;
  });

  const preencherCodigoMunicipio = async (cidade, estado) => {
    if (!cidade || !estado) return;
    try {
      const res = await base44.functions.invoke('buscarCodigoMunicipio', { cidade, estado });
      if (res.data?.codigo) {
        setForm(f => ({ ...f, codigo_municipio_tomador: res.data.codigo }));
      }
    } catch (e) {}
  };

  const selecionarCliente = (clienteId) => {
    const c = clientes.find(cl => cl.id === clienteId);
    if (!c) { setForm(f => ({ ...f, cliente_id: "", cliente_nome: "" })); return; }
    setForm(f => ({
      ...f,
      cliente_id: c.id,
      cliente_nome: c.nome || "",
      cliente_nome_fantasia: c.nome_fantasia || "",
      cliente_cpf_cnpj: c.cpf_cnpj || "",
      cliente_ie: c.rg_ie || "",
      cliente_im: c.inscricao_municipal || "",
      cliente_email: c.email || "",
      cliente_telefone: c.telefone || "",
      cliente_endereco: c.endereco || '',
      cliente_numero: c.numero || "",
      cliente_bairro: c.bairro || "",
      cliente_cep: c.cep || "",
      cliente_cidade: c.cidade || "",
      cliente_estado: c.estado || "",
    }));
    if (c.cidade && c.estado) {
      preencherCodigoMunicipio(c.cidade, c.estado);
    }
  };

  const atualizarItem = (idx, campo, valor) => {
    setErrosForm(e => {
      if (!e.items) return e;
      const novosItemErros = [...(e.items || [])];
      if (novosItemErros[idx]) { novosItemErros[idx] = { ...novosItemErros[idx], [campo]: undefined }; }
      return { ...e, items: novosItemErros };
    });
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [campo]: valor };
      if (campo === "quantidade" || campo === "valor_unitario") {
        items[idx].valor_total = Number(items[idx].quantidade) * Number(items[idx].valor_unitario);
      }
      if (campo === "valor_total") {
        items[idx].valor_unitario = items[idx].quantidade > 0
          ? Number(valor) / Number(items[idx].quantidade)
          : Number(valor);
      }
      const total = items.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      return { ...f, items, valor_total: total };
    });
  };

  const atualizarItemCompleto = (idx, dados) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], ...dados };
      const total = items.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      return { ...f, items, valor_total: total };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, defaultItem()] }));
  const removeItem = (idx) => {
    setForm(f => {
      const items = f.items.filter((_, i) => i !== idx);
      const total = items.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      return { ...f, items, valor_total: total };
    });
  };

  const atualizarStatusNota = async (nota) => {
    setAtualizandoStatus(nota.id);
    try {
      const res = await base44.functions.invoke('consultarStatusNotas', { nota_id: nota.id, ref: nota.spedy_id, tipo: nota.tipo });
      if (res.data?.sucesso) {
        feedback('sucesso', `Status atualizado: ${res.data.status || 'OK'}`);
        load();
      } else {
        feedback('erro', res.data?.erro || 'Erro ao consultar status.');
      }
    } catch (e) {
      feedback('erro', 'Erro: ' + e.message);
    }
    setAtualizandoStatus(null);
  };

  const cancelarNota = async (nota) => {
    if (!confirm(`Cancelar a nota ${nota.tipo} nº ${nota.numero || ''}? Esta ação não pode ser desfeita.`)) return;
    try {
      feedback('sucesso', 'Solicitando cancelamento...');
      const res = await base44.functions.invoke('cancelarNota', { nota_id: nota.id, ref: nota.spedy_id, tipo: nota.tipo });
      if (res.data?.sucesso) {
        feedback('sucesso', 'Nota cancelada com sucesso.');
        load();
      } else {
        feedback('erro', res.data?.erro || 'Erro ao cancelar.');
      }
    } catch (e) {
      feedback('erro', 'Erro: ' + e.message);
    }
  };

  const cancelarLancamento = async (nota) => {
    if (!confirm(`Cancelar o lançamento da NF ${nota.numero || ""}? Isso voltará o status para "Importada" para que possa ser relançada.`)) return;
    try {
      const obsNF = `NF ${nota.numero}`;
      const estoqueAtual = await base44.entities.Estoque.list("-created_date", 1000);
      let revertidos = 0;
      for (const prod of estoqueAtual) {
        const historico = Array.isArray(prod.historico) ? prod.historico : [];
        const entradasNF = historico.filter(h => h.tipo === "entrada" && h.observacao === obsNF);
        if (entradasNF.length === 0) continue;
        const qtdEntrou = entradasNF.reduce((acc, h) => acc + Number(h.quantidade || 0), 0);
        const novaQtd = Math.max(0, (prod.quantidade || 0) - qtdEntrou);
        const historicoLimpo = historico.filter(h => !(h.tipo === "entrada" && h.observacao === obsNF));
        await base44.entities.Estoque.update(prod.id, { quantidade: novaQtd, historico: historicoLimpo });
        revertidos++;
      }
      const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
      const vinculados = financeiros.filter(f => f.descricao?.includes(obsNF));
      for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
      await base44.entities.NotaFiscal.update(nota.id, { status: "Importada" });
      feedback("sucesso", `Lançamento cancelado. ${revertidos} produto(s) revertido(s) no estoque. Nota voltou para Importada.`);
      load();
    } catch (e) {
      feedback("erro", "Erro ao cancelar lançamento: " + e.message);
    }
  };

  const excluir = async (id) => {
    const nota = notas.find(n => n.id === id);
    if (nota?.status === 'Emitida' || nota?.status === 'Lançada') {
      setAvisoExclusao(nota);
      return;
    }
    if (!confirm("Excluir esta nota fiscal?")) return;
    if (nota?.numero) {
      const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
      const vinculados = financeiros.filter(f => f.descricao?.includes(`NF ${nota.numero}`));
      for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
    }
    if (nota?.status === 'Emitida' && (nota?.tipo === 'NFe' || nota?.tipo === 'NFCe') && nota?.xml_content) {
      try {
        const items = JSON.parse(nota.xml_content);
        for (const it of items) {
          if (it.estoque_id) {
            const estoqueItems = await base44.entities.Estoque.filter({ id: it.estoque_id });
            if (estoqueItems.length > 0) {
              await base44.entities.Estoque.update(it.estoque_id, { quantidade: (Number(estoqueItems[0].quantidade) || 0) + (Number(it.quantidade) || 1) });
            }
          }
        }
      } catch (_) {}
    }
    try { await base44.entities.NotaFiscal.delete(id); } catch (_) {}
    load();
  };

  const importarXML = async () => {
    if (!xmlTexto.trim()) return alert("Cole o conteúdo do XML.");
    setImportando(true);
    if (xmlTexto.includes('<tpEvento>110111</tpEvento>') || xmlTexto.includes('<procCancNFe')) {
      const chaveM = xmlTexto.match(/<chNFe>(\d{44})<\/chNFe>/);
      const notas2 = chaveM ? await base44.entities.NotaFiscal.list('-created_date', 500) : [];
      const notaEx = notas2.find(n => n.chave_acesso === chaveM?.[1]);
      if (notaEx) await base44.entities.NotaFiscal.update(notaEx.id, { status: 'Cancelada', xml_original: xmlTexto });
      else if (chaveM) await base44.entities.NotaFiscal.create({ tipo:'NFe', status:'Cancelada', chave_acesso: chaveM[1], xml_original: xmlTexto });
      feedback('sucesso', notaEx ? `NF ${notaEx.numero} marcada como Cancelada.` : 'Nota cancelada importada.');
      load(); setXmlTexto(""); setShowImport(false); setImportando(false); return;
    }
    setXmlParaEntrada(xmlTexto);
    setXmlTexto(""); setShowImport(false); setImportando(false); setShowEntrada(true);
  };

  const gerarParcelas = (qtd, formaPgto, total, dataBase) => {
    const valorParcela = total / (qtd || 1);
    const hoje = dataBase || new Date().toISOString().split('T')[0];
    return Array.from({ length: qtd }, (_, i) => {
      const dt = new Date(hoje + 'T12:00:00');
      dt.setMonth(dt.getMonth() + i);
      const ano = dt.getFullYear();
      const mes = String(dt.getMonth() + 1).padStart(2, '0');
      const dia = String(dt.getDate()).padStart(2, '0');
      return {
        numero: i + 1,
        forma_pagamento: formaPgto,
        vencimento: `${ano}-${mes}-${dia}`,
        valor: parseFloat(valorParcela.toFixed(2)),
      };
    });
  };

  const feedback = (tipo, msg) => {
    setMsgFeedback({ tipo, msg });
    setTimeout(() => setMsgFeedback(null), 6000);
  };

  const iniciarPolling = (notaId, ref) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setPollingNotaId(notaId);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await base44.functions.invoke('consultarStatusNotas', { nota_id: notaId, ref });
        const status = res.data?.status;
        if (status && status !== 'Processando' && status !== 'Aguardando Sefin Nacional') {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setPollingNotaId(null);
          setAguardandoEmissao(false);
          if (status === 'Emitida') {
            feedback('sucesso', 'Nota fiscal autorizada com sucesso!');
          } else {
            feedback('erro', `Nota com status: ${status}`);
          }
          load();
        }
      } catch (_) {}
    }, 5000);
  };

  React.useEffect(() => {
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, []);

  // Atualiza dados adicionais automaticamente quando parcelas ou forma de pagamento mudam
  // Usa ref para evitar sobrescrever ao carregar o form inicial
  const formLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (!showForm) { formLoadedRef.current = false; return; }
    if (!formLoadedRef.current) { formLoadedRef.current = true; return; }
    const parcelasStr = gerarInfoParcelas(form.parcelas_detalhes, form.forma_pagamento);
    setForm(f => {
      const dadosAtuais = f.dados_adicionais || '';
      const idxParc = dadosAtuais.indexOf('Parc. ');
      const base = idxParc > 0 ? dadosAtuais.substring(0, idxParc).replace(/\s*\|\s*$/, '') : dadosAtuais;
      const novosDados = [base, parcelasStr].filter(Boolean).join(' | ');
      if (novosDados === dadosAtuais) return f;
      return { ...f, dados_adicionais: novosDados };
    });
  }, [form.parcelas_detalhes, form.forma_pagamento]);

  const validarForm = (f) => {
    const erros = {};
    if (!f.cliente_nome?.trim()) erros.cliente_nome = "Nome do cliente é obrigatório";
    if (!f.valor_total || f.valor_total <= 0) erros.valor_total = "Valor total deve ser maior que zero";
    if (f.tipo === "NFSe" || f.tipo === "NFe") {
      if (!f.cliente_cpf_cnpj?.trim()) erros.cliente_cpf_cnpj = `${f.tipo} exige CPF ou CNPJ do cliente`;
    }
    if (f.tipo === "NFe") {
      if (!f.cliente_endereco?.trim()) erros.cliente_endereco = "NFe exige endereço do destinatário";
      if (!f.cliente_cidade?.trim()) erros.cliente_cidade = "NFe exige cidade do destinatário";
      if (!f.cliente_estado?.trim()) erros.cliente_estado = "NFe exige UF do destinatário";
      if (!f.cliente_cep?.trim()) erros.cliente_cep = "NFe exige CEP do destinatário";
    }
    const itemErros = f.items.map((it) => {
      const ie = {};
      if (!it.descricao?.trim()) ie.descricao = "Descrição obrigatória";
      if (!it.valor_total || Number(it.valor_total) <= 0) ie.valor_total = "Valor deve ser maior que zero";
      if (f.tipo !== "NFSe") {
        if (!it.ncm?.trim()) ie.ncm = "NCM obrigatório";
        if (!it.cfop?.trim()) ie.cfop = "CFOP obrigatório";
      }
      return ie;
    });
    const temErroItem = itemErros.some(ie => Object.keys(ie).length > 0);
    if (temErroItem) erros.items = itemErros;
    return erros;
  };

  const emitirNota = async (rascunhoNota = null) => {
    let f = form;
    if (rascunhoNota) {
      const clienteVinculado = clientes.find(c => c.id === rascunhoNota.cliente_id);
      if ((rascunhoNota.tipo === 'NFe' || rascunhoNota.tipo === 'NFSe') && !clienteVinculado?.cpf_cnpj?.trim()) {
        alert('Esta nota exige um cliente com CPF ou CNPJ cadastrado.');
        setTransmitindo(null);
        return;
      }
      // Usa parcelas_detalhes da venda original se existirem, senão regenera
      const vendaOriginal = rascunhoNota.ordem_venda_id ? vendas.find(v => v.id === rascunhoNota.ordem_venda_id) : null;
      const qtdParcelas = vendaOriginal?.parcelas || rascunhoNota.parcelas || 1;
      const fpParcelas = vendaOriginal?.forma_pagamento || rascunhoNota.forma_pagamento || 'A Combinar';
      let parcelasRegeneradas = [];
      if (vendaOriginal?.parcelas_detalhes?.length > 0) {
        parcelasRegeneradas = vendaOriginal.parcelas_detalhes;
      } else {
        const valorTotal = vendaOriginal?.valor_total || rascunhoNota.valor_total || 0;
        const dataEntrada = vendaOriginal?.data_entrada || new Date().toISOString().split('T')[0];
        parcelasRegeneradas = gerarParcelas(qtdParcelas, fpParcelas, valorTotal, dataEntrada);
      }
      
      f = {
        ...defaultForm(),
        tipo: rascunhoNota.tipo,
        cliente_id: rascunhoNota.cliente_id,
        cliente_nome: rascunhoNota.cliente_nome || clienteVinculado?.nome || '',
        cliente_cpf_cnpj: rascunhoNota.cliente_cpf_cnpj || clienteVinculado?.cpf_cnpj || '',
        cliente_ie: rascunhoNota.cliente_ie || clienteVinculado?.rg_ie || '',
        cliente_email: rascunhoNota.cliente_email || clienteVinculado?.email || '',
        cliente_telefone: clienteVinculado?.telefone || '',
        cliente_endereco: clienteVinculado?.endereco || '',
        cliente_numero: clienteVinculado?.numero || '',
        cliente_bairro: clienteVinculado?.bairro || '',
        cliente_cep: clienteVinculado?.cep || '',
        cliente_cidade: clienteVinculado?.cidade || '',
        cliente_estado: clienteVinculado?.estado || '',
        ordem_venda_id: rascunhoNota.ordem_venda_id,
        valor_total: rascunhoNota.valor_total,
        observacoes: rascunhoNota.observacoes,
        dados_adicionais: rascunhoNota.dados_adicionais || '',
        forma_pagamento: rascunhoNota.forma_pagamento || 'A Combinar',
        parcelas: qtdParcelas,
        parcelas_detalhes: parcelasRegeneradas,
        data_emissao: rascunhoNota.data_emissao,
        items: (() => {
          if (rascunhoNota.xml_content) {
            try {
              const p = JSON.parse(rascunhoNota.xml_content);
              if (Array.isArray(p) && p.length > 0 && p[0].descricao) return p;
            } catch {}
          }
          return [{ descricao: rascunhoNota.observacoes || 'Serviço/Produto', quantidade: 1, valor_unitario: rascunhoNota.valor_total, valor_total: rascunhoNota.valor_total }];
        })(),
      };
    }

    if (!rascunhoNota) {
      const erros = validarForm(f);
      if (Object.keys(erros).length > 0) {
        setErrosForm(erros);
        if (erros.cliente_nome || erros.cliente_cpf_cnpj || erros.cliente_endereco || erros.cliente_cidade || erros.cliente_estado || erros.cliente_cep) {
          setAbaForm("cliente");
        } else if (erros.items || erros.valor_total) {
          setAbaForm("itens");
        }
        return;
      }
      setErrosForm({});
    }

    if (!f.cliente_nome) return alert("Informe o nome do cliente.");
    if (!f.valor_total || f.valor_total <= 0) return alert("Informe o valor total.");

    const isConsumidor = f.cliente_nome?.toUpperCase() === "CONSUMIDOR";
    if (f.tipo === "NFSe") {
      if (isConsumidor) return alert("NFSe não aceita o cliente CONSUMIDOR.");
      if (!f.cliente_cpf_cnpj?.trim()) return alert("NFSe exige cliente com CPF ou CNPJ cadastrado.");
    }
    if (f.tipo === "NFe") {
      if (isConsumidor) return alert("NFe não aceita CONSUMIDOR.");
      if (!f.cliente_cpf_cnpj?.trim()) return alert("NFe exige cliente com CPF ou CNPJ cadastrado.");
    }

    if (rascunhoNota) setTransmitindo(rascunhoNota.id);
    else {
      setEmitindo(true);
      setShowForm(false);
      setAguardandoEmissao(true);
    }

    if (!rascunhoNota && !currentEditIdRef.current) {
      const { _editId, ...dadosForm } = f;
      const novoRascunho = await base44.entities.NotaFiscal.create({ ...dadosForm, status: 'Rascunho', xml_content: JSON.stringify(f.items || []) });
      currentEditIdRef.current = novoRascunho.id;
      setForm(prev => ({ ...prev, _editId: novoRascunho.id }));
    }

    try {
      const clienteVinculado = clientes.find(c => c.id === f.cliente_id);
      const codigoMunicipioTomador = f.codigo_municipio_tomador || 
        (clienteVinculado?.codigo_municipio ? clienteVinculado.codigo_municipio : undefined);

      const payload = {
        ...f,
        nota_id: rascunhoNota?.id || currentEditIdRef.current || null,
        data_emissao: f.data_emissao || new Date().toISOString().split('T')[0],
        serie_manual: f.serie || '1',
        items: f.items.map(it => ({
          ...it,
          valor_unitario: Number(it.valor_unitario) || (Number(it.valor_total) / (Number(it.quantidade) || 1)),
          quantidade: Number(it.quantidade) || 1,
          valor_total: Number(it.valor_total) || 0,
        })),
        valor_total: Number(f.valor_total) || 0,
        ...(codigoMunicipioTomador ? { codigo_municipio_tomador: codigoMunicipioTomador } : {}),
      };
      const response = await base44.functions.invoke("emitirNotaFiscal", payload);

      const statusRetorno = response.data?.status;
      if (response.data?.sucesso && statusRetorno === 'Processando') {
        const notaIdParaPolling = rascunhoNota?.id || currentEditIdRef.current;
        feedback('sucesso', 'Nota enviada! Aguardando autorização da SEFAZ...');
        currentEditIdRef.current = null;
        setForm(defaultForm());
        load();
        if (notaIdParaPolling) {
          const notaAtualizada = await base44.entities.NotaFiscal.filter({ id: notaIdParaPolling });
          iniciarPolling(notaIdParaPolling, notaAtualizada[0]?.spedy_id || response.data?.ref);
        }
      } else if (response.data?.sucesso) {
        feedback('sucesso', `Nota ${f.tipo} transmitida com sucesso! ${response.data.mensagem || ''}`);
        currentEditIdRef.current = null;
        setForm(defaultForm());
        setAguardandoEmissao(false);
        load();
      } else {
        feedback("erro", response.data?.erro || "Erro ao emitir.");
        load();
      }
    } catch (e) {
      feedback("erro", "Erro: " + e.message);
      load();
    }
    setEmitindo(false);
    if (!pollingNotaId) setAguardandoEmissao(false);
    setTransmitindo(null);
  };

  const iniciarPreVisualizacao = async (nota) => {
    setPreVisualizando(nota.id);
    feedback('sucesso', 'Enviando para homologação — gerando DANFE de pré-visualização...');
    try {
      const res = await base44.functions.invoke('preVisualizarNota', { nota_id: nota.id });
      if (res.data?.sucesso) {
        setMsgFeedback(null);
        feedback('sucesso', 'Homologada! Clique em "Autorizar" na lista para emitir.');
        load();
      } else if (res.data?.pode_tentar_novamente) {
        feedback('erro', res.data.erro);
        load();
      } else {
        await base44.entities.NotaFiscal.update(nota.id, { status: 'Erro' });
        feedback('erro', res.data?.erro || 'Erro na homologação.');
        load();
      }
    } catch (e) {
      let msgErro = e.message || 'Erro desconhecido';
      if (e.response?.data?.erro) msgErro = e.response.data.erro;
      else if (e.response?.data?.message) msgErro = e.response.data.message;
      else if (typeof e.response?.data === 'string') msgErro = e.response.data;
      feedback('erro', 'Erro na homologação: ' + msgErro);
      load();
    }
    setPreVisualizando(null);
  };

  const autorizarEmitir = async (nota_id) => {
    setModalPreview(null);
    const notaAtual = notas.find(n => n.id === nota_id);
    if (!notaAtual) return;
    emitirNota(notaAtual);
  };

  const editarNota = (nota) => {
    if (nota.status === 'Emitida') {
      feedback('erro', 'Notas com status Emitida não podem ser editadas.');
      return;
    }
    let itensSalvos = [defaultItem()];
    if (nota.xml_content) {
      try {
        const p = JSON.parse(nota.xml_content);
        if (Array.isArray(p) && p.length > 0) {
          itensSalvos = p.map(i => ({
            descricao: i.descricao || '',
            quantidade: i.quantidade || 1,
            valor_unitario: i.valor_unitario || 0,
            valor_total: i.valor_total || 0,
            ncm: i.ncm || '',
            cfop: i.cfop || '',
            cest: i.cest || '',
            unidade: i.unidade || 'UN',
            codigo: i.codigo || ''
          }));
        }
      } catch {}
    }
    const fpNota = nota.forma_pagamento || 'A Combinar';
    const qtdParcelas = nota.parcelas || 1;
    const vendaOriginalEdit = nota.ordem_venda_id ? vendas.find(v => v.id === nota.ordem_venda_id) : null;
    const dataBaseEdit = vendaOriginalEdit?.data_entrada || nota.data_emissao;
    const parcelasExistentes = nota.parcelas_detalhes?.length > 0
      ? nota.parcelas_detalhes
      : gerarParcelas(qtdParcelas, fpNota, nota.valor_total || 0, dataBaseEdit);

    // Regenera dados adicionais se estiverem incompletos (sem info de parcelas)
    let dadosAdicionais = nota.dados_adicionais || '';
    if (dadosAdicionais && !dadosAdicionais.includes('Parc.') && parcelasExistentes.length > 0) {
      const parcelasStr = gerarInfoParcelas(parcelasExistentes, fpNota);
      if (parcelasStr) dadosAdicionais = [dadosAdicionais, parcelasStr].join(' | ');
    }

    setForm({
      ...defaultForm(),
      tipo: nota.tipo || 'NFSe',
      numero: nota.numero || '',
      serie: nota.serie || '1',
      data_emissao: nota.data_emissao || new Date().toISOString().split('T')[0],
      cliente_id: nota.cliente_id || '',
      cliente_nome: nota.cliente_nome || '',
      cliente_cpf_cnpj: nota.cliente_cpf_cnpj || '',
      cliente_ie: nota.cliente_ie || '',
      cliente_email: nota.cliente_email || '',
      cliente_telefone: nota.cliente_telefone || '',
      cliente_endereco: nota.cliente_endereco || '',
      cliente_numero: nota.cliente_numero || '',
      cliente_bairro: nota.cliente_bairro || '',
      cliente_cep: nota.cliente_cep || '',
      cliente_cidade: nota.cliente_cidade || '',
      cliente_estado: nota.cliente_estado || '',
      ordem_venda_id: nota.ordem_venda_id || '',
      valor_total: nota.valor_total || 0,
      observacoes: nota.observacoes || '',
      forma_pagamento: fpNota,
      parcelas: qtdParcelas,
      parcelas_detalhes: parcelasExistentes,
      dados_adicionais: dadosAdicionais,
      items: itensSalvos,
      _editId: nota.id,
    });
    currentEditIdRef.current = nota.id;
    setAbaForm('cliente');
    setShowForm(true);
  };

  const salvarRascunho = async () => {
    const editId = currentEditIdRef.current || form._editId;
    if (editId) {
      const { _editId, ...dados } = form;
      await base44.entities.NotaFiscal.update(editId, { ...dados, status: 'Rascunho', xml_content: JSON.stringify(form.items || []) });
    } else {
      await base44.entities.NotaFiscal.create({ ...form, status: 'Rascunho', xml_content: JSON.stringify(form.items || []) });
    }
    currentEditIdRef.current = null;
    setShowForm(false);
    setForm(defaultForm());
    feedback('sucesso', 'Salvo como rascunho.');
    load();
  };

  const downloadPdf = async (url, nome) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const buffer = await blob.slice(0, 4).arrayBuffer();
      const header = new Uint8Array(buffer);
      const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
      if (!isPdfValid) throw new Error('Arquivo não é um PDF válido');
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      feedback('erro', `Erro ao baixar: ${e.message}`);
    }
  };

  const nomeArquivoPdf = (nota) => {
    const cliente = (nota.cliente_nome || 'cliente').replace(/[^a-zA-Z0-9À-ÿ\s]/g, '').trim().replace(/\s+/g, '-').substring(0, 30);
    const tipo = (nota.tipo || 'nf').toLowerCase();
    const num = nota.numero || nota.id;
    return `${cliente}-${tipo}-${num}.pdf`;
  };

  const abrirDanfeNfce = async (nota) => {
    feedback('sucesso', 'Carregando DANFE NFCe...');
    try {
      const res = await base44.functions.invoke('danfeNfce', { nota_id: nota.id });
      const data = res.data;
      if (data?.erro) { feedback('erro', data.erro); return; }
      if (data?.pdf_url) {
        window.open(data.pdf_url, '_blank');
        setMsgFeedback(null);
        load();
        return;
      }
      if (data?.html) {
        const blob = new Blob([data.html], { type: 'text/html; charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        setMsgFeedback(null);
        load();
      }
    } catch (e) {
      feedback('erro', e.message);
    }
  };

  const abrirPdfNota = async (nota) => {
    if (nota.tipo === 'NFCe') {
      await abrirDanfeNfce(nota);
      return;
    }
    feedback('sucesso', 'Buscando PDF...');
    try {
      const res = await base44.functions.invoke('proxyPdfNota', { nota_id: nota.id });
      const data = res.data;
      if (data?.pdf_url) {
        window.open(data.pdf_url, '_blank');
        setMsgFeedback(null);
        load();
        return;
      }
      if (data?.processando) { feedback('erro', data.mensagem || 'SEFAZ ainda processando.'); return; }
      if (nota.pdf_url) {
        window.open(nota.pdf_url, '_blank');
        setMsgFeedback(null);
        return;
      }
      let erroMsg = data?.erro || 'PDF não disponível.';
      if (data?.detalhes) erroMsg += `\n\nDetalhes: ${data.detalhes}`;
      feedback('erro', erroMsg);
    } catch (e) {
      feedback('erro', e.message);
    }
  };

  const baixarPdfNota = async (nota) => {
    if (nota.tipo === 'NFCe') {
      let pdfUrl = nota.pdf_url && !nota.pdf_url.endsWith('.html') ? nota.pdf_url : null;
      if (!pdfUrl) {
        feedback('sucesso', 'Gerando PDF da NFCe...');
        try {
          const res = await base44.functions.invoke('danfeNfce', { nota_id: nota.id });
          const data = res.data;
          if (data?.pdf_url) { pdfUrl = data.pdf_url; load(); }
          else { feedback('erro', data?.erro || 'PDF não disponível.'); return; }
        } catch (e) { feedback('erro', e.message); return; }
      }
      await downloadPdf(pdfUrl, nomeArquivoPdf(nota));
      setMsgFeedback(null);
      return;
    }
    let pdfUrl = nota.pdf_url;
    if (!pdfUrl) {
      feedback('sucesso', 'Buscando PDF na Focus NFe...');
      try {
        const res = await base44.functions.invoke('proxyPdfNota', { nota_id: nota.id });
        const data = res.data;
        if (data?.pdf_url) { pdfUrl = data.pdf_url; load(); }
        else { feedback('erro', data?.erro || 'PDF não disponível.'); return; }
      } catch (e) { feedback('erro', e.message); return; }
    }
    await downloadPdf(pdfUrl, nomeArquivoPdf(nota));
    setMsgFeedback(null);
  };

  const gerarExcelNotas = (notasList) => {
    const cabecalho = ["Tipo","Número","Série","Status","Cliente","CPF/CNPJ","Data Emissão","Valor Total","Chave Acesso","Observações"];
    const linhas = notasList.map(n => [
      n.tipo || "",
      n.numero || "",
      n.serie || "",
      n.status || "",
      n.cliente_nome || "",
      n.cliente_cpf_cnpj || "",
      n.data_emissao || "",
      Number(n.valor_total || 0).toFixed(2).replace(".", ","),
      n.chave_acesso || "",
      n.observacoes || "",
    ]);
    const toCSV = (rows) => rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const csvContent = toCSV([cabecalho, ...linhas]);
    return "\uFEFF" + csvContent;
  };

  const exportarZip = async () => {
    const todasNotas = filtradas;
    if (todasNotas.length === 0) return alert("Nenhuma nota no filtro atual.");
    setGerandoZip(true);
    feedback("sucesso", `Preparando ZIP com ${todasNotas.length} nota(s)...`);
    try {
      const zip = new JSZip();
      const getXml = async (nota) => {
        if (nota.xml_original?.trim().startsWith("<")) return nota.xml_original;
        if (nota.xml_content?.trim().startsWith("<")) return nota.xml_content;
        if (nota.xml_url) {
          try { const r = await fetch(nota.xml_url); const t = await r.text(); if (t?.trim().startsWith("<")) return t; } catch (_) {}
        }
        return null;
      };
      const isEntrada = (n) => n.observacoes !== "DEVOLUÇÃO" && (n.status === "Importada" || n.status === "Lançada");
      const pastas = {
        "Notas de Entrada/NFe":   todasNotas.filter(n => isEntrada(n) && n.tipo === "NFe"),
        "Notas de Entrada/NFSe":  todasNotas.filter(n => isEntrada(n) && n.tipo === "NFSe"),
        "Notas de Saida/NFe":     todasNotas.filter(n => !isEntrada(n) && n.tipo === "NFe"),
        "Notas de Saida/NFSe":    todasNotas.filter(n => !isEntrada(n) && n.tipo === "NFSe"),
        "Notas de Saida/NFCe":    todasNotas.filter(n => !isEntrada(n) && n.tipo === "NFCe"),
      };
      for (const [pasta, notasPasta] of Object.entries(pastas)) {
        for (const nota of notasPasta) {
          const base = `${nota.tipo}-${nota.numero || nota.id}`;
          const xml = await getXml(nota);
          if (xml) zip.file(`${pasta}/${base}.xml`, xml);
          if (nota.pdf_url) {
            try {
              const r = await fetch(nota.pdf_url);
              if (r.ok) { const b = await r.blob(); zip.file(`${pasta}/${base}.pdf`, b); }
            } catch (_) {}
          }
        }
      }
      const csvContent = gerarExcelNotas(todasNotas);
      zip.file(`Relatorio_Notas_${periodoRange.inicio}_${periodoRange.fim}.csv`, csvContent);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NF_${periodoRange.inicio}_${periodoRange.fim}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setMsgFeedback(null);
    } catch (e) {
      feedback("erro", "Erro ao gerar ZIP: " + e.message);
    }
    setGerandoZip(false);
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-1.5">
      {msgFeedback && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${msgFeedback.tipo === "sucesso" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {msgFeedback.tipo === "sucesso" ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span className="whitespace-pre-wrap break-words max-h-48 overflow-y-auto flex-1">{msgFeedback.msg}</span>
        </div>
      )}

      <div className="flex gap-0.5">
        <button onClick={() => { setForm(f => ({ ...f, numero: '', serie: proximaSerie(notas, f.tipo) })); setShowForm(true); }} className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e => e.currentTarget.style.background = "#00dd00"} onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
          <Plus className="w-4 h-4" /> Emitir
        </button>

        <div className={`flex-1 flex items-center h-9 rounded-lg text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
          <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}><ChevronLeft className="w-3 h-3" /></button>
          <span className="flex-1 text-center truncate">{MESES[filtroMes - 1]} - {filtroAno}</span>
          <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}><ChevronRight className="w-3 h-3" /></button>
        </div>
      </div>

      <div className="flex gap-0.5">
        <button onClick={() => { const novo = filtroTipo.includes("Saída") ? filtroTipo.filter(x => x !== "Saída") : [...filtroTipo, "Saída"]; setFiltroTipo(novo); localStorage.setItem("nf_filtroTipo", JSON.stringify(novo)); }} className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${filtroTipo.includes("Saída") ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>Saída</button>
        <button onClick={() => { const novo = filtroTipo.includes("Entrada") ? filtroTipo.filter(x => x !== "Entrada") : [...filtroTipo, "Entrada"]; setFiltroTipo(novo); localStorage.setItem("nf_filtroTipo", JSON.stringify(novo)); }} className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${filtroTipo.includes("Entrada") ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>Entrada</button>
        <button onClick={() => { const novo = filtroModeloNF.includes("NFe") ? filtroModeloNF.filter(x => x !== "NFe") : [...filtroModeloNF, "NFe"]; setFiltroModeloNF(novo); localStorage.setItem("nf_filtroModelo", JSON.stringify(novo)); }} className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${filtroModeloNF.includes("NFe") ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>NFe</button>
        <button onClick={() => { const novo = filtroModeloNF.includes("NFCe") ? filtroModeloNF.filter(x => x !== "NFCe") : [...filtroModeloNF, "NFCe"]; setFiltroModeloNF(novo); localStorage.setItem("nf_filtroModelo", JSON.stringify(novo)); }} className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${filtroModeloNF.includes("NFCe") ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>NFCe</button>
        <button onClick={() => { const novo = filtroModeloNF.includes("NFSe") ? filtroModeloNF.filter(x => x !== "NFSe") : [...filtroModeloNF, "NFSe"]; setFiltroModeloNF(novo); localStorage.setItem("nf_filtroModelo", JSON.stringify(novo)); }} className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${filtroModeloNF.includes("NFSe") ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>NFSe</button>
      </div>

      <div className="flex gap-0.5">
        <button
          onClick={async () => {
            setBuscandoSefaz(true);
            try {
              const res = await base44.functions.invoke('consultarNotasRecebidas', {});
              const data = res.data;
              if (data?.sucesso) { feedback('sucesso', data.mensagem || 'Consulta concluída.'); load(); }
              else { feedback('erro', data?.erro || 'Erro ao buscar notas recebidas.'); }
            } catch (e) { feedback('erro', 'Erro: ' + e.message); }
            setBuscandoSefaz(false);
          }}
          disabled={buscandoSefaz}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{background:"#00ff00", color:"#000"}}
          onMouseEnter={e => { if (!buscandoSefaz) e.currentTarget.style.background = "#00dd00"; }}
          onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
        >
          {buscandoSefaz ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {buscandoSefaz ? 'Importando...' : 'Importar'}
        </button>
        <button
          onClick={async () => {
            setBuscandoSefaz(true);
            try {
              const res = await base44.functions.invoke('importarNfseRecebidas', {});
              const data = res.data;
              if (data?.sucesso) { feedback('sucesso', data.mensagem || 'NFSe importadas com sucesso.'); load(); }
              else { feedback('erro', data?.erro || 'Erro ao importar NFSe.'); }
            } catch (e) { feedback('erro', 'Erro: ' + e.message); }
            setBuscandoSefaz(false);
          }}
          disabled={buscandoSefaz}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{background:"#00ff00", color:"#000"}}
          onMouseEnter={e => { if (!buscandoSefaz) e.currentTarget.style.background = "#00dd00"; }}
          onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
        >
          {buscandoSefaz ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {buscandoSefaz ? 'Importando...' : 'NFSe'}
        </button>
        <button onClick={() => setShowSintegra(true)} className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
          <BarChart2 className="w-4 h-4" /> Sintegra
        </button>
        <button
          onClick={async () => {
            const preVisualizadas = notas.filter(n => n.status === 'Homologada');
            if (preVisualizadas.length === 0) { feedback('erro', 'Nenhuma nota em Pré-visualização para autorizar.'); return; }
            if (!confirm(`Autorizar ${preVisualizadas.length} nota(s) em Pré-visualização?`)) return;
            setAutorizandoMassa(true);
            let ok = 0; let erros = 0;
            for (const nota of preVisualizadas) {
              try {
                const items = (() => { try { const p = JSON.parse(nota.xml_content); if (Array.isArray(p) && p.length > 0 && p[0].descricao) return p; } catch {} return [{ descricao: nota.observacoes || 'Produto/Serviço', quantidade: 1, valor_unitario: nota.valor_total, valor_total: nota.valor_total }]; })();
                const res = await base44.functions.invoke('emitirNotaFiscal', { ...nota, nota_id: nota.id, items });
                if (res.data?.sucesso) ok++; else erros++;
              } catch { erros++; }
              await new Promise(r => setTimeout(r, 800));
            }
            setAutorizandoMassa(false);
            feedback('sucesso', `Autorização concluída: ${ok} emitida(s), ${erros} erro(s).`);
            load();
          }}
          disabled={autorizandoMassa}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{background:"#00ff00", color:"#000"}}
          onMouseEnter={e => { if (!autorizandoMassa) e.currentTarget.style.background="#00dd00"; }}
          onMouseLeave={e => e.currentTarget.style.background="#00ff00"}
        >
          {autorizandoMassa ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {autorizandoMassa ? 'Autorizando...' : 'Autorizar'}
        </button>
        <button onClick={() => exportarZip()} disabled={gerandoZip} className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all disabled:opacity-50" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
           {gerandoZip ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {gerandoZip ? 'Exportando...' : 'Exportar'}
         </button>
        <button 
          onClick={async () => {
            setValidandoXmlPdf(true);
            try {
              const res = await base44.functions.invoke('validarNotasXmlPdf', {});
              setResultadoValidacao(res.data);
              feedback('sucesso', `Validação concluída: ${res.data.notasComXml} com XML, ${res.data.notasSemXml} sem XML`);
            } catch (e) {
              feedback('erro', 'Erro ao validar: ' + e.message);
            }
            setValidandoXmlPdf(false);
          }}
          disabled={validandoXmlPdf}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{background:"#ff9500", color:"#000"}}
          onMouseEnter={e => { if (!validandoXmlPdf) e.currentTarget.style.background = "#dd7700"; }}
          onMouseLeave={e => e.currentTarget.style.background = "#ff9500"}
        >
          {validandoXmlPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />} 
          {validandoXmlPdf ? 'Validando...' : 'Validar XML/PDF'}
        </button>
        </div>

      <div className="flex gap-0.5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar nota..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <button onClick={() => { setViewMode("table"); localStorage.setItem("notas_viewmode","table"); }} className="px-2 py-1.5 transition-all" style={{background:viewMode==="table"?"#062C9B":"transparent",color:viewMode==="table"?"#fff":"#6b7280"}} title="Lista"><List className="w-5 h-5"/></button>
          <button onClick={() => { setViewMode("cards"); localStorage.setItem("notas_viewmode","cards"); }} className="px-2 py-1.5 transition-all" style={{background:viewMode==="cards"?"#062C9B":"transparent",color:viewMode==="cards"?"#fff":"#6b7280"}} title="Cards"><LayoutGrid className="w-5 h-5"/></button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: 'NFe Entrada', value: totalNFeLancada, color: '#3b82f6' },
          { label: 'NFSe Entrada', value: totalNFSeLancada, color: '#3b82f6' },
          { label: 'NFe Emitida', value: totalNFeEmitida, color: '#00ff00' },
          { label: 'NFCe Emitida', value: totalNFCeEmitida, color: '#00ff00' },
          { label: 'NFSe Emitida', value: totalNFSeEmitida, color: '#00ff00' },
          { label: 'Total NF Emitidas', value: totalEmitidas, color: '#facc15' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1">
            <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wide">{label}</p>
            <p className="font-bold text-sm" style={{ color }}>R$ {Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhuma nota fiscal encontrada</p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtradas.map(nota => (
            <div key={nota.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="bg-orange-500/10 text-orange-400 text-xs px-2 py-0.5 rounded-full font-medium">{nota.tipo}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[nota.status]||"bg-gray-500/10 text-gray-400"}`}>{nota.status}</span>
                </div>
                <div className="flex gap-1">
                  {nota.status === 'Rascunho' && temSpedy && <button title="Homologar" onClick={() => iniciarPreVisualizacao(nota)} disabled={!!preVisualizando} className="w-7 h-7 flex items-center justify-center text-yellow-400 hover:text-yellow-300 rounded-lg transition-all disabled:opacity-50">{preVisualizando === nota.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <FileText className="w-3.5 h-3.5"/>}</button>}
                  {nota.status === "Homologada" && temSpedy && <button title="Autorizar" onClick={() => emitirNota(nota)} disabled={!!transmitindo} className="w-7 h-7 flex items-center justify-center text-green-400 hover:text-green-300 rounded-lg disabled:opacity-50">{transmitindo === nota.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <CheckCircle className="w-3.5 h-3.5"/>}</button>}
                  {nota.status !== 'Emitida' && nota.status !== 'Processando' && nota.status !== 'Aguardando Sefin Nacional' && nota.status !== 'Cancelada' && nota.status !== 'Rascunho' && <button onClick={() => editarNota(nota)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-yellow-400 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5"/></button>}
                  <button title={temXmlSalvo(nota) ? "Ver XML" : "Sem XML"} onClick={() => { if (temXmlSalvo(nota)) setXmlModal({ ...nota, xml_content: nota.xml_original || nota.xml_content }); }} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: temXmlSalvo(nota) ? "#00ff00" : "#ff0000" }}><Code className="w-3.5 h-3.5"/></button>
                  <button title="Abrir PDF" onClick={() => abrirPdfNota(nota)} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: nota.pdf_url ? "#00ff00" : "#ef4444" }}><FileText className="w-3.5 h-3.5"/></button>
                  {nota.pdf_url && <button title="Baixar PDF" onClick={() => baixarPdfNota(nota)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-400 rounded-lg"><Download className="w-3.5 h-3.5"/></button>}
                  {(nota.status === 'Emitida' || nota.status === 'Processando' || nota.status === 'Aguardando Sefin Nacional') && <button title="Cancelar" onClick={() => cancelarNota(nota)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-orange-400 rounded-lg"><Ban className="w-3.5 h-3.5"/></button>}
                  {nota.status === 'Lançada' && <button title="Cancelar Lançamento" onClick={() => cancelarLancamento(nota)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-orange-400 rounded-lg"><Ban className="w-3.5 h-3.5"/></button>}
                  {nota.status === 'Importada' && <button title="Cancelar" onClick={async () => { if (!confirm('Marcar como Cancelada?')) return; await base44.entities.NotaFiscal.update(nota.id, { status: 'Cancelada' }); load(); }} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg"><Ban className="w-3.5 h-3.5"/></button>}
                  <button onClick={() => excluir(nota.id)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>
              <p className="text-white font-semibold text-sm">{nota.cliente_nome || "—"}</p>
              <p className="text-gray-500 text-xs">Nº {nota.numero || "—"} • {nota.data_emissao || "—"}</p>
              <p className="font-bold" style={{color:"#00ff00"}}>R$ {Number(nota.valor_total||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 hidden md:table-cell">Emissão</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(nota => (
                  <tr key={nota.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-all">
                    <td className="px-4 py-3">
                      <span className="bg-orange-500/10 text-orange-400 text-xs px-2 py-1 rounded-full font-medium">{nota.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs">{nota.numero || "—"}</td>
                    <td className="px-4 py-3 text-white">{nota.cliente_nome || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{nota.data_emissao || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[nota.status] || "bg-gray-500/10 text-gray-400"}`}>{nota.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{color:"#00ff00"}}>
                      R$ {Number(nota.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {nota.status === "Rascunho" && temSpedy && (
                          <button title="Enviar para Homologação" onClick={() => { if (preVisualizando) return; iniciarPreVisualizacao(nota); }} disabled={preVisualizando !== null}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-all disabled:opacity-50">
                            {preVisualizando === nota.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            {preVisualizando === nota.id ? "..." : "Homologar"}
                          </button>
                        )}
                        {nota.status === "Homologada" && temSpedy && (
                          <button title="Autorizar e Emitir" onClick={() => { if (transmitindo) return; emitirNota(nota); }} disabled={transmitindo !== null} className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-all disabled:opacity-50">
                            {transmitindo === nota.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            {transmitindo === nota.id ? "..." : "Autorizar"}
                          </button>
                        )}
                        <button title={temXmlSalvo(nota) ? "Ver XML" : "Sem XML"} onClick={() => { if (temXmlSalvo(nota)) setXmlModal({ ...nota, xml_content: nota.xml_original || nota.xml_content }); }}
                           className="p-1 transition-all"
                           style={{ color: temXmlSalvo(nota) ? "#00ff00" : "#ff0000" }}>
                           <Code className="w-4 h-4" />
                         </button>
                        {(nota.status === "Importada") && (
                          <button title="Lançar Entrada" onClick={async () => {
                            const xmlOriginal = nota.xml_original?.trim() || "";
                            const xmlContent = nota.xml_content?.trim() || "";
                            const xmlDisponivel = xmlOriginal.startsWith("<") ? xmlOriginal : (xmlContent.startsWith("<") ? xmlContent : "");
                            if (xmlDisponivel) {
                              if (xmlDisponivel.includes('<tpEvento>110111</tpEvento>') || xmlDisponivel.includes('<procCancNFe')) {
                                await base44.entities.NotaFiscal.update(nota.id, { status: 'Cancelada', xml_original: xmlDisponivel });
                                feedback('sucesso', 'Esta nota está cancelada. Status atualizado para Cancelada.'); load(); return;
                              }
                              setNotaIdParaEntrada(nota.id);
                              setXmlParaEntrada(xmlDisponivel);
                              setShowEntrada(true);
                            } else if (nota.xml_url) {
                              feedback('sucesso', 'Carregando XML...');
                              try {
                                const r = await fetch(nota.xml_url);
                                const xmlText = await r.text();
                                setMsgFeedback(null);
                                setNotaIdParaEntrada(nota.id);
                                setXmlParaEntrada(xmlText);
                                setShowEntrada(true);
                              } catch (e) { feedback('erro', 'Erro ao carregar XML: ' + e.message); }
                            } else if (nota.chave_acesso) {
                              feedback('sucesso', 'Buscando XML na SEFAZ...');
                              try {
                                const res = await base44.functions.invoke('buscarXmlNota', { chave_acesso: nota.chave_acesso, nota_id: nota.id });
                                if (res.data?.cancelada) {
                                  feedback('erro', 'Esta nota foi cancelada pelo fornecedor. Status atualizado para Cancelada.');
                                  load();
                                } else if (res.data?.sucesso && res.data?.xml) {
                                  setMsgFeedback(null);
                                  setNotaIdParaEntrada(nota.id);
                                  setXmlParaEntrada(res.data.xml);
                                  setShowEntrada(true);
                                } else {
                                  feedback('erro', 'XML não disponível na SEFAZ ainda. Use "Importar XML" para carregar o arquivo manualmente, ou aguarde a manifestação ser processada.');
                                }
                              } catch (e) { feedback('erro', 'Erro ao buscar XML: ' + e.message); }
                            } else {
                              feedback('erro', 'Nota sem chave de acesso. Use "Importar XML" para carregar o arquivo manualmente.');
                            }
                          }} className="p-1 text-blue-400 hover:text-blue-300 transition-all" title="Lançar Entrada">
                            <LogIn className="w-4 h-4" />
                          </button>
                        )}
                        {nota.status !== 'Emitida' && nota.status !== 'Processando' && nota.status !== 'Aguardando Sefin Nacional' && nota.status !== 'Importada' && nota.status !== 'Lançada' && nota.status !== 'Cancelada' && (
                          <button title="Editar" onClick={() => editarNota(nota)} className="p-1 text-gray-500 hover:text-yellow-400 transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button title="Abrir PDF" onClick={() => abrirPdfNota(nota)} className="p-1 transition-all" style={{ color: nota.pdf_url ? "#00ff00" : "#ef4444" }}>
                          <FileText className="w-4 h-4" />
                        </button>
                        {nota.pdf_url && (
                          <button title="Baixar PDF" onClick={() => baixarPdfNota(nota)} className="p-1 text-gray-400 hover:text-blue-400 transition-all">
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {(nota.status === 'Processando' || nota.status === 'Aguardando Sefin Nacional' || nota.status === 'Erro de Sincronia Governamental') && (
                          <button title="Atualizar Status" onClick={() => atualizarStatusNota(nota)} disabled={atualizandoStatus === nota.id} className="p-1 text-gray-500 hover:text-cyan-400 transition-all disabled:opacity-50">
                            {atualizandoStatus === nota.id ? <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                        )}
                        {(nota.status === 'Emitida' || nota.status === 'Processando' || nota.status === 'Aguardando Sefin Nacional') && (
                          <button title="Cancelar Nota" onClick={() => cancelarNota(nota)} className="p-1 text-gray-500 hover:text-orange-400 transition-all">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        {nota.status === 'Lançada' && (
                          <button title="Cancelar Lançamento" onClick={() => cancelarLancamento(nota)} className="p-1 text-gray-500 hover:text-orange-400 transition-all">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        {nota.status === 'Importada' && (
                          <button title="Marcar como Cancelada" onClick={async () => {
                            if (!confirm('Marcar esta nota como Cancelada?')) return;
                            await base44.entities.NotaFiscal.update(nota.id, { status: 'Cancelada' });
                            load();
                          }} className="p-1 text-gray-500 hover:text-red-400 transition-all">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => excluir(nota.id)} className="p-1 text-gray-500 hover:text-red-400 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h2 className="text-white font-semibold">Importar XML de Nota Fiscal</h2>
                <p className="text-gray-500 text-xs mt-0.5">Notas de entrada (compras) ou saída emitidas na SEFAZ</p>
              </div>
              <button onClick={() => setShowImport(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Selecionar arquivo XML</label>
                <label className="flex items-center justify-center gap-3 w-full border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl p-6 cursor-pointer transition-all group">
                  <Upload className="w-5 h-5 text-gray-500 group-hover:text-orange-400 transition-all" />
                  <span className="text-gray-500 group-hover:text-gray-300 text-sm transition-all">Clique para selecionar o arquivo .xml</span>
                  <input type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setXmlTexto(ev.target.result);
                    reader.readAsText(file, "UTF-8");
                  }} />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-gray-600 text-xs">ou cole o XML abaixo</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              <textarea value={xmlTexto} onChange={e => setXmlTexto(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-green-400 font-mono rounded-lg p-3 text-xs focus:outline-none focus:border-orange-500 resize-none"
                rows={8} placeholder='<?xml version="1.0" encoding="UTF-8"?>&#10;<nfeProc>...</nfeProc>' />
              {xmlTexto && (
                <p className="text-green-400 text-xs flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> XML carregado ({(xmlTexto.length / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { setShowImport(false); setXmlTexto(""); }} className="px-4 py-2 text-sm text-white rounded-lg font-medium" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>Cancelar</button>
              <button onClick={importarXML} disabled={importando || !xmlTexto.trim()} className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50" style={{background: "#062C9B"}} onMouseEnter={e => !importando && (e.currentTarget.style.background = "#041a4d")} onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}>
                {importando ? "Importando..." : "Importar XML"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-white font-semibold text-lg">Emitir Nota Fiscal</h2>
                {!temSpedy && <p className="text-yellow-400 text-xs mt-0.5">⚠️ Focus NFe não configurada — será salvo como rascunho</p>}
                {temSpedy && <p className="text-green-400 text-xs mt-0.5">✓ Focus NFe configurada — será transmitida automaticamente</p>}
              </div>
              <button onClick={() => { setShowForm(false); currentEditIdRef.current = null; }}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>

            <div className="px-5 pt-4 flex-shrink-0 grid grid-cols-1 gap-4">
              <F label="Tipo de Nota Fiscal">
                {(() => {
                  const isConsumidorExplicito = form.cliente_nome?.toUpperCase() === "CONSUMIDOR";
                  if (isConsumidorExplicito) {
                    return <div className="input-dark text-gray-300 cursor-not-allowed opacity-80">NFCe — Consumidor</div>;
                  }
                  return (
                    <select value={form.tipo} onChange={e => {
                      const novoTipo = e.target.value;
                      let serie = proximaSerie(notas, novoTipo);
                      setForm(f => ({ ...f, tipo: novoTipo, numero: '', serie }));
                    }} className="input-dark">
                      <option value="NFSe">NFSe — Serviço</option>
                      <option value="NFe">NFe — Produto</option>
                      <option value="NFCe">NFCe — Consumidor</option>
                    </select>
                  );
                })()}
              </F>
            </div>

            {form.tipo === "NFe" && (
              <div className="px-5 pt-3 flex-shrink-0 grid grid-cols-2 gap-4">
                <F label="Natureza da Operação *">
                  <NoACInput value={form.natureza_operacao} onChange={e => setForm(f => ({ ...f, natureza_operacao: e.target.value }))} placeholder="Venda de mercadoria" />
                </F>
                <F label="Tipo *">
                  <select value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))} className="input-dark">
                    <option value="1">Saída</option>
                    <option value="0">Entrada</option>
                  </select>
                </F>
              </div>
            )}

            <div className="px-5 pt-3 flex-shrink-0 flex gap-1 border-b border-gray-800">
              {[["cliente", "1. Cliente"], ["itens", form.tipo === "NFSe" ? "2. Serviços" : "2. Produtos"], ["pagamento", "3. Pagamento"]].map(([aba, label]) => (
                <button key={aba} onClick={() => setAbaForm(aba)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all -mb-px ${abaForm === aba ? "bg-gray-800 text-white border border-gray-700 border-b-gray-800" : "text-gray-500 hover:text-gray-300"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {abaForm === "cliente" && (
                <div className="space-y-4">
                  <F label="Nome / Razão Social *">
                    <SearchableSelect
                      placeholder="Digite o nome, fantasia ou CPF/CNPJ..."
                      options={clientesFiltrados.map(c => ({ value: c.id, label: c.nome, sublabel: [c.nome_fantasia, c.cpf_cnpj].filter(Boolean).join(' • ') }))}
                      onSelect={opt => selecionarCliente(opt.value)}
                      initialValue={form.cliente_nome || ''}
                    />
                  </F>
                  <F label="Nome Social / Fantasia">
                    <NoACInput value={form.cliente_nome_fantasia || ''} onChange={e => setForm(f => ({ ...f, cliente_nome_fantasia: e.target.value }))} placeholder="" />
                  </F>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="CPF / CNPJ">
                      <NoACInput value={form.cliente_cpf_cnpj} onChange={e => { setForm(f => ({ ...f, cliente_cpf_cnpj: e.target.value })); setErrosForm(e2 => ({...e2, cliente_cpf_cnpj: undefined})); }} placeholder="" className={`input-dark ${errosForm.cliente_cpf_cnpj ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_cpf_cnpj && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_cpf_cnpj}</p>}
                    </F>
                    <F label="Inscrição Estadual (IE)">
                      <NoACInput value={form.cliente_ie || ''} onChange={e => setForm(f => ({ ...f, cliente_ie: e.target.value }))} placeholder="" />
                    </F>
                    <F label="Inscrição Municipal (IM)">
                      <NoACInput value={form.cliente_im || ''} onChange={e => setForm(f => ({ ...f, cliente_im: e.target.value }))} placeholder="" />
                    </F>
                    <F label="Telefone Contato">
                      <NoACInput value={form.cliente_telefone} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))} placeholder="" />
                    </F>
                    <F label="Endereço" className="col-span-1">
                      <NoACInput value={form.cliente_endereco} onChange={e => { setForm(f => ({ ...f, cliente_endereco: e.target.value })); setErrosForm(e2 => ({...e2, cliente_endereco: undefined})); }} placeholder="" className={`input-dark ${errosForm.cliente_endereco ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_endereco && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_endereco}</p>}
                    </F>
                    <F label="Número">
                      <NoACInput value={form.cliente_numero || ''} onChange={e => setForm(f => ({ ...f, cliente_numero: e.target.value }))} placeholder="" />
                    </F>
                    <F label="Bairro">
                      <NoACInput value={form.cliente_bairro} onChange={e => setForm(f => ({ ...f, cliente_bairro: e.target.value }))} placeholder="" />
                    </F>
                    <F label="Cidade">
                      <NoACInput value={form.cliente_cidade} onChange={e => {
                        const novaCidade = e.target.value;
                        setForm(f => {
                          if (novaCidade && f.cliente_estado) preencherCodigoMunicipio(novaCidade, f.cliente_estado);
                          return { ...f, cliente_cidade: novaCidade };
                        });
                        setErrosForm(e2 => ({...e2, cliente_cidade: undefined}));
                      }} placeholder="" className={`input-dark ${errosForm.cliente_cidade ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_cidade && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_cidade}</p>}
                    </F>
                    <F label="CEP">
                      <NoACInput value={form.cliente_cep} onChange={e => { setForm(f => ({ ...f, cliente_cep: e.target.value })); setErrosForm(e2 => ({...e2, cliente_cep: undefined})); }} placeholder="" className={`input-dark ${errosForm.cliente_cep ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_cep && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_cep}</p>}
                    </F>
                    <F label="Estado (UF)">
                      <NoACInput value={form.cliente_estado} onChange={e => {
                        const novoEstado = e.target.value.toUpperCase();
                        setForm(f => ({ ...f, cliente_estado: novoEstado }));
                        setErrosForm(e2 => ({...e2, cliente_estado: undefined}));
                        if (form.cliente_cidade && novoEstado) preencherCodigoMunicipio(form.cliente_cidade, novoEstado);
                      }} placeholder="" maxLength={2} className={`input-dark ${errosForm.cliente_estado ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_estado && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_estado}</p>}
                    </F>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => setAbaForm("itens")} className="text-black px-6 py-2 rounded-lg text-sm font-medium transition-all" style={{background: "#00ff00"}} onMouseEnter={e => e.currentTarget.style.background = "#00dd00"} onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
                      Próximo: Itens →
                    </button>
                  </div>
                </div>
              )}

              {abaForm === "itens" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-gray-400 font-medium">Item {idx + 1}</span>
                          {form.items.length > 1 && (
                            <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 transition-all">
                              <MinusCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {!item.descricao ? (
                          <F label={form.tipo === 'NFSe' ? 'Selecionar Serviço' : 'Selecionar Produto'}>
                            <SearchableSelect
                              placeholder={form.tipo === 'NFSe' ? 'Digite o nome do serviço...' : 'Digite o nome ou código do produto...'}
                              options={form.tipo === 'NFSe'
                                ? servicos.map(s => ({ value: s.id, label: s.descricao, sublabel: s.valor ? `R$ ${Number(s.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '' }))
                                : estoque.map(p => ({ value: p.id, label: p.descricao, sublabel: p.valor_venda ? `R$ ${Number(p.valor_venda).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '' }))
                              }
                              onSelect={opt => {
                                if (form.tipo === 'NFSe') {
                                  const srv = servicos.find(s => s.id === opt.value);
                                  if (srv) atualizarItemCompleto(idx, { descricao: srv.descricao, codigo: srv.codigo || '', servico_id: srv.id, quantidade: 1, valor_unitario: srv.valor || 0, valor_total: srv.valor || 0 });
                                } else {
                                  const prod = estoque.find(p => p.id === opt.value);
                                  if (prod) atualizarItemCompleto(idx, { descricao: prod.descricao, codigo: prod.codigo || '', estoque_id: prod.id, quantidade: 1, valor_unitario: prod.valor_venda || 0, valor_total: prod.valor_venda || 0, ncm: prod.ncm || '', cfop: prod.cfop || '', cest: prod.cest || '', unidade: prod.unidade || 'UN' });
                                }
                              }}
                            />
                          </F>
                        ) : (
                          <div className={`grid gap-3 ${form.tipo === 'NFSe' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                            {form.tipo !== 'NFSe' && (
                              <F label="Código">
                                <div className="input-dark text-gray-400 text-sm">{item.codigo || '—'}</div>
                              </F>
                            )}
                            <F label={form.tipo === 'NFSe' ? 'Serviço' : 'Produto'} className={form.tipo === 'NFSe' ? 'col-span-1 md:col-span-2' : 'col-span-2 md:col-span-3'}>
                              <NoACInput value={item.descricao} onChange={e => atualizarItem(idx, 'descricao', e.target.value)} placeholder="Descrição" className={`input-dark ${errosForm.items?.[idx]?.descricao ? 'border-red-500' : ''}`} />
                              {errosForm.items?.[idx]?.descricao && <p className="text-red-400 text-xs mt-1">{errosForm.items[idx].descricao}</p>}
                            </F>
                            <F label="Quantidade">
                              <NoACInput value={item.quantidade} onChange={e => atualizarItem(idx, 'quantidade', e.target.value)} placeholder="1" />
                            </F>
                            <F label={form.tipo === 'NFSe' ? 'Valor' : 'Valor Unitário (R$)'}>
                              <NoACInput value={item.valor_unitario} onChange={e => atualizarItem(idx, 'valor_unitario', e.target.value)} placeholder="0" />
                            </F>
                            <F label={form.tipo === 'NFSe' ? 'Total' : 'Total (R$)'} className={form.tipo === 'NFSe' ? '' : 'col-span-2'}>
                              <NoACInput value={item.valor_total} onChange={e => atualizarItem(idx, 'valor_total', e.target.value)} placeholder="0" />
                            </F>
                            {form.tipo !== 'NFSe' && (
                              <>
                                <F label="NCM">
                                  <NoACInput value={item.ncm || ''} onChange={e => atualizarItem(idx, 'ncm', e.target.value)} placeholder="87089990" className={`input-dark ${errosForm.items?.[idx]?.ncm ? 'border-red-500' : ''}`} />
                                  {errosForm.items?.[idx]?.ncm && <p className="text-red-400 text-xs mt-1">{errosForm.items[idx].ncm}</p>}
                                </F>
                                <F label="CFOP">
                                  <NoACInput value={item.cfop || ''} onChange={e => atualizarItem(idx, 'cfop', e.target.value)} placeholder="5405" className={`input-dark ${errosForm.items?.[idx]?.cfop ? 'border-red-500' : ''}`} />
                                  {errosForm.items?.[idx]?.cfop && <p className="text-red-400 text-xs mt-1">{errosForm.items[idx].cfop}</p>}
                                </F>
                                <F label="CEST (opcional)">
                                  <NoACInput value={item.cest || ''} onChange={e => atualizarItem(idx, 'cest', e.target.value)} placeholder="" />
                                </F>
                                <F label="Unidade">
                                  <NoACInput value={item.unidade || ''} onChange={e => atualizarItem(idx, 'unidade', e.target.value)} placeholder="UN" />
                                </F>
                              </>
                            )}
                            <div className="col-span-2 md:col-span-4 flex justify-end">
                              <button onClick={() => { atualizarItemCompleto(idx, defaultItem()); }} className="text-xs text-gray-500 hover:text-red-400 transition-all">✕ Trocar produto</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={addItem} className="flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm transition-all">
                    <PlusCircle className="w-4 h-4" /> Adicionar item
                  </button>
                  <div className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
                    <span className="text-gray-400 font-medium">Total da Nota</span>
                    <span className="text-2xl font-bold" style={{color:"#00ff00"}}>
                      R$ {Number(form.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <button onClick={() => setAbaForm("cliente")} className="text-gray-400 hover:text-white text-sm px-4 py-2 border border-gray-700 rounded-lg transition-all">← Voltar</button>
                    <button onClick={() => {
                      // Só gera parcelas se ainda não existem (preserva as da venda original)
                      if (!form.parcelas_detalhes || form.parcelas_detalhes.length === 0) {
                        const qtd = form.parcelas || 1;
                        const vendaOriginal = form.ordem_venda_id ? vendas.find(v => v.id === form.ordem_venda_id) : null;
                        const dataBase = vendaOriginal?.data_entrada || form.data_emissao;
                        const parcelas = gerarParcelas(qtd, form.forma_pagamento, form.valor_total, dataBase);
                        setForm(f => ({ ...f, parcelas_detalhes: parcelas }));
                      }
                      setAbaForm("pagamento");
                    }} className="text-black px-6 py-2 rounded-lg text-sm font-medium transition-all" style={{background: "#00ff00"}} onMouseEnter={e => { e.currentTarget.style.background = "#00dd00"; }} onMouseLeave={e => { e.currentTarget.style.background = "#00ff00"; }}>Próximo: Pagamento →</button>
                  </div>
                </div>
              )}

              {abaForm === "pagamento" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <F label="Forma de Pagamento">
                      <select value={form.forma_pagamento} onChange={e => {
                        const fp = e.target.value;
                        const qtd = form.parcelas || 1;
                        // Se já há parcelas com vencimento definido, apenas atualiza a forma de pagamento
                        const temParcelasComData = form.parcelas_detalhes?.length > 0 && form.parcelas_detalhes.every(p => p.vencimento);
                        if (temParcelasComData) {
                          const atualizadas = form.parcelas_detalhes.map(p => ({ ...p, forma_pagamento: fp }));
                          setForm(f => ({ ...f, forma_pagamento: fp, parcelas_detalhes: atualizadas }));
                        } else {
                          const parcelas = gerarParcelas(qtd, fp, form.valor_total, form.data_emissao);
                          setForm(f => ({ ...f, forma_pagamento: fp, parcelas_detalhes: parcelas }));
                        }
                      }} className="input-dark">
                        {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                      </select>
                    </F>
                    <F label="Nº de Parcelas">
                      <select value={form.parcelas || 1} onChange={e => {
                        const qtd = Number(e.target.value);
                        const vendaOriginal = form.ordem_venda_id ? vendas.find(v => v.id === form.ordem_venda_id) : null;
                        const dataBase = vendaOriginal?.data_entrada || form.data_emissao;
                        const parcelas = gerarParcelas(qtd, form.forma_pagamento, form.valor_total, dataBase);
                        setForm(f => ({ ...f, parcelas: qtd, parcelas_detalhes: parcelas }));
                      }} className="input-dark">
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    </F>
                  </div>

                  {(form.parcelas_detalhes?.length > 0) && (
                    <div className="border border-gray-700 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-3 bg-gray-800 border-b border-gray-700">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vencimento</div>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor (R$)</div>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Forma Pgto</div>
                      </div>
                      {form.parcelas_detalhes.map((p, i) => (
                        <div key={i} className="grid grid-cols-3 border-b border-gray-700 last:border-b-0" style={{background: i % 2 === 0 ? '#111827' : '#0f172a'}}>
                          <div className="px-3 py-2">
                            <input type="date" value={p.vencimento || ''} onChange={e => {
                              const nova = [...form.parcelas_detalhes];
                              nova[i] = { ...nova[i], vencimento: e.target.value };
                              setForm(f => ({ ...f, parcelas_detalhes: nova }));
                            }} className="input-dark" />
                          </div>
                          <div className="px-3 py-2">
                            <input type="text" value={p.valor || ''} onChange={e => {
                              const nova = [...form.parcelas_detalhes];
                              nova[i] = { ...nova[i], valor: parseFloat(e.target.value.replace(',','.')) || 0 };
                              setForm(f => ({ ...f, parcelas_detalhes: nova }));
                            }} className="input-dark" />
                          </div>
                          <div className="px-3 py-2">
                            <select value={p.forma_pagamento || form.forma_pagamento} onChange={e => {
                              const nova = [...form.parcelas_detalhes];
                              nova[i] = { ...nova[i], forma_pagamento: e.target.value };
                              setForm(f => ({ ...f, parcelas_detalhes: nova }));
                            }} className="input-dark">
                              {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                      <div className="grid grid-cols-3 bg-gray-800 border-t border-gray-700">
                        <div className="px-4 py-2 text-xs text-gray-500 uppercase">Total parcelado</div>
                        <div className="px-4 py-2 text-sm font-bold" style={{color: Math.abs(form.parcelas_detalhes.reduce((s,p)=>s+Number(p.valor||0),0) - form.valor_total) < 0.02 ? "#00ff00" : "#f59e0b"}}>
                          R$ {form.parcelas_detalhes.reduce((s,p)=>s+Number(p.valor||0),0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </div>
                        <div></div>
                      </div>
                    </div>
                  )}

                  <F label="Dados Adicionais">
                    <textarea value={form.dados_adicionais || ''} onChange={e => setForm(f => ({ ...f, dados_adicionais: e.target.value }))}
                      className="input-dark" rows={3} placeholder="" autoComplete="off" />
                  </F>

                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                    <h3 className="text-white font-medium text-sm">Resumo da Nota</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-500">Tipo</div><div className="text-white font-medium">{form.tipo}</div>
                      <div className="text-gray-500">Cliente</div><div className="text-white font-medium">{form.cliente_nome || "—"}</div>
                      <div className="text-gray-500">CPF/CNPJ</div><div className="text-white">{form.cliente_cpf_cnpj || "—"}</div>
                      <div className="text-gray-500">Cidade</div><div className="text-white">{form.cliente_cidade ? `${form.cliente_cidade}/${form.cliente_estado}` : "—"}</div>
                      <div className="text-gray-500">Itens</div><div className="text-white">{form.items.length} item(ns)</div>
                      <div className="text-gray-500">Pagamento</div><div className="text-white">{form.forma_pagamento}</div>
                      <div className="text-gray-500 font-semibold">Total</div>
                      <div className="font-bold text-lg" style={{color:"#00ff00"}}>R$ {Number(form.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>

                  <BotoesPagamento
                    onVoltar={() => setAbaForm("itens")}
                    salvarRascunho={salvarRascunho}
                    emitindo={emitindo}
                    temSpedy={temSpedy}
                    onPreVisualizar={async () => {
                       if (!temSpedy) { salvarRascunho(); return; }
                       const erros = validarForm(form);
                       if (Object.keys(erros).length > 0) { setErrosForm(erros); if (erros.cliente_nome || erros.cliente_cpf_cnpj || erros.cliente_endereco) setAbaForm("cliente"); else setAbaForm("itens"); return; }
                       setErrosForm({});
                       setEmitindo(true);
                       const editId = currentEditIdRef.current || form._editId;
                       let notaId = editId;
                       const { _editId, ...dadosForm } = form;
                       // Garante que data_emissao é sempre a correta (não hoje)
                       dadosForm.data_emissao = dadosForm.data_emissao || new Date().toISOString().split('T')[0];
                       if (!editId) { const novo = await base44.entities.NotaFiscal.create({ ...dadosForm, status: 'Rascunho', xml_content: JSON.stringify(form.items || []) }); notaId = novo.id; currentEditIdRef.current = notaId; }
                       else { await base44.entities.NotaFiscal.update(editId, { ...dadosForm, status: 'Rascunho', xml_content: JSON.stringify(form.items || []) }); }
                       setEmitindo(false); setShowForm(false); currentEditIdRef.current = null; setForm(defaultForm());
                      await load();
                      const notaSalva = await base44.entities.NotaFiscal.filter({ id: notaId }).then(r => r[0]);
                      if (notaSalva) iniciarPreVisualizacao(notaSalva);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(aguardandoEmissao || pollingNotaId) && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-6">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-white text-xl font-bold">{pollingNotaId ? 'Aguardando SEFAZ...' : 'Transmitindo nota fiscal...'}</p>
            <p className="text-gray-400 text-sm mt-2">{pollingNotaId ? 'Consultando a cada 5s' : 'Aguardando autorização da SEFAZ'}</p>
          </div>
          {pollingNotaId && <button onClick={() => { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; setPollingNotaId(null); setAguardandoEmissao(false); load(); }} className="text-sm text-gray-400 hover:text-white border border-gray-700 px-4 py-2 rounded-lg transition-all">Fechar e consultar manualmente</button>}
        </div>
      )}

      {showSintegra && (
        <ModalSintegra
          notas={notas}
          estoque={estoque}
          configs={configsNF}
          onClose={() => setShowSintegra(false)}
        />
      )}

      {avisoExclusao && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Não é possível excluir</h2>
                <p className="text-gray-400 text-sm">NF {avisoExclusao.numero} — {avisoExclusao.cliente_nome || "—"}</p>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">
              Notas com status <span className="font-bold text-white">"{avisoExclusao.status}"</span> não podem ser excluídas.
              {avisoExclusao.status === 'Lançada' && (
                <p className="mt-2 text-gray-400">Para corrigir, use o botão <span className="text-orange-400 font-medium">Cancelar Lançamento</span> (ícone <Ban className="w-3 h-3 inline" />) para voltar ao status "Importada" e relançar.</p>
              )}
              {avisoExclusao.status === 'Importada' && (
                <p className="mt-2 text-gray-400">Para excluir, primeiro use <span className="text-orange-400 font-medium">Cancelar Lançamento</span> (ícone <Ban className="w-3 h-3 inline" />) para reverter o estoque. Depois a nota poderá ser excluída.</p>
              )}
              {avisoExclusao.status === 'Emitida' && (
                <p className="mt-2 text-gray-400">Para cancelar uma nota emitida, use o botão <span className="text-orange-400 font-medium">Cancelar Nota</span> na SEFAZ.</p>
              )}
            </div>
            <button onClick={() => setAvisoExclusao(null)} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-700 hover:bg-gray-600 transition-all">
              Entendido
            </button>
          </div>
        </div>
      )}

      {showEntrada && xmlParaEntrada && (
        <ModalEntradaNF
          xmlTexto={xmlParaEntrada}
          notaId={notaIdParaEntrada}
          onClose={() => { setShowEntrada(false); setXmlParaEntrada(""); setNotaIdParaEntrada(null); }}
          onSalvo={() => {
            setShowEntrada(false);
            setXmlParaEntrada("");
            setNotaIdParaEntrada(null);
            feedback("sucesso", "Nota importada! Estoque e financeiro atualizados.");
            load();
          }}
        />
      )}

      {xmlModal && (
        <ModalXML
          nota={xmlModal}
          onClose={() => setXmlModal(null)}
          onSalvo={(xmlSalvo) => {
            setNotas(prev => prev.map(n => n.id === xmlModal.id ? { ...n, xml_original: xmlSalvo } : n));
            setXmlModal(null);
          }}
        />
      )}

      {resultadoValidacao && (
        <ModalValidacaoXmlPdf resultado={resultadoValidacao} onClose={() => setResultadoValidacao(null)} />
      )}

      <style>{`.input-dark{width:100%;background:#1f2937;border:1px solid #374151;color:#fff;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input-dark:focus{border-color:#f97316}.input-dark::placeholder{color:#6b7280}`}</style>
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

function temXmlSalvo(nota) {
  // Versão simples: só verifica se tem algo salvo no BD
  // Verde se tem algo (url, original ou content)
  // Vermelho se não tem nada
  
  if (nota.xml_url && typeof nota.xml_url === 'string' && nota.xml_url.trim().length > 0) return true;
  if (nota.xml_original && typeof nota.xml_original === 'string' && nota.xml_original.trim().length > 0) return true;
  if (nota.xml_content && typeof nota.xml_content === 'string' && nota.xml_content.trim().length > 0) return true;
  
  return false;
}

function BotoesPagamento({ onVoltar, salvarRascunho, emitindo, temSpedy, onPreVisualizar }) {
  return (
    <div className="flex gap-3 justify-between">
      <button onClick={onVoltar} className="text-gray-400 hover:text-white text-sm px-4 py-2 border border-gray-700 rounded-lg transition-all">← Voltar</button>
      <div className="flex gap-3">
        <button onClick={salvarRascunho} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Salvar Rascunho</button>
        <button onClick={onPreVisualizar} disabled={emitindo} className="px-6 py-2 text-sm text-black rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2" style={{background:"#00ff00"}} onMouseEnter={e => !emitindo && (e.currentTarget.style.background="#00dd00")} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
          {emitindo && <RefreshCw className="w-4 h-4 animate-spin" />}
          {emitindo ? "Salvando..." : temSpedy ? "Pré-visualizar DANFE" : "Salvar Nota"}
        </button>
      </div>
    </div>
  );
}

function Loader() { return null; }