import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  FileText, Plus, Upload, Search, Trash2, X,
  CheckCircle, AlertCircle, Printer, Download, PlusCircle, MinusCircle, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Archive, BarChart2, Pencil, ClipboardList, Ban, LogIn
} from "lucide-react";
import ModalEntradaNF from "@/components/notas/ModalEntradaNF";
import ModalSintegra from "@/components/notas/ModalSintegra";
import SearchableSelect from "@/components/notas/SearchableSelect";

import JSZip from "jszip";

const STATUS_COLOR = {
  Rascunho: "bg-gray-500/10 text-gray-400",
  Emitida: "bg-green-500/10 text-green-400",
  Cancelada: "bg-red-500/10 text-red-400",
  Importada: "bg-blue-500/10 text-blue-400",
};

const FORMAS_PAGAMENTO = ["A Combinar", "Boleto", "Cartão", "Cheque", "Dinheiro", "PIX"];

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
    observacoes: "",
    cliente_id: "",
    cliente_nome: "",
    cliente_cpf_cnpj: "",
    cliente_email: "",
    cliente_telefone: "",
    cliente_endereco: "",
    cliente_numero: "",
    cliente_bairro: "",
    cliente_cep: "",
    cliente_cidade: "",
    cliente_estado: "",
    ordem_servico_id: "",
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
  const [ordensVenda, setOrdensVenda] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroModeloNF, setFiltroModeloNF] = useState("Todos");
  const [gerandoZip, setGerandoZip] = useState(false);
  const [showSintegra, setShowSintegra] = useState(false);
  const [buscandoSefaz, setBuscandoSefaz] = useState(false);
  const [gerandoSintegra, setGerandoSintegra] = useState(false);

  const [notaIdParaEntrada, setNotaIdParaEntrada] = useState(null);

  const hoje = new Date();
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const [filtroMes, setFiltroMes] = useState(hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(false);
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const [customRange, setCustomRange] = useState(null);
  const periodoDropRef = useRef(null);

  const pad = n => String(n).padStart(2, "0");
  const periodoRange = usandoOutroPeriodo && customRange
    ? customRange
    : { inicio: `${filtroAno}-${pad(filtroMes)}-01`, fim: `${filtroAno}-${pad(filtroMes)}-31` };

  const navegarMes = (direcao) => {
    setUsandoOutroPeriodo(false);
    setCustomRange(null);
    let novoMes = filtroMes + direcao;
    let novoAno = filtroAno;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setFiltroMes(novoMes);
    setFiltroAno(novoAno);
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
  const [aguardandoEmissao, setAguardandoEmissao] = useState(false);
  const currentEditIdRef = useRef(null);
  const [msgFeedback, setMsgFeedback] = useState(null);
  const [temSpedy, setTemSpedy] = useState(false);
  const [abaForm, setAbaForm] = useState("cliente");
  const [errosForm, setErrosForm] = useState({});
  const [configsNF, setConfigsNF] = useState([]);

  useEffect(() => {
    load().then(async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("emitir") === "1") {
        const tipo = params.get("tipo") || "NFSe";
        const os_id = params.get("os_id") || "";
        const cliente_id = params.get("cliente_id") || "";
        const cliente_nome = decodeURIComponent(params.get("cliente_nome") || "");
        window.history.replaceState({}, "", window.location.pathname);

        let items = [defaultItem()];
        let valor_total = 0;
        let clienteExtra = {};
        if (os_id) {
          try {
            const osData = await base44.entities.OrdemServico.filter({ id: os_id }, "-created_date", 1);
            const os = osData[0];
            if (os) {
              clienteExtra = {
                cliente_cpf_cnpj: os.cliente_cpf_cnpj || "",
                cliente_email: os.cliente_email || "",
                cliente_telefone: os.cliente_telefone || "",
                cliente_endereco: os.cliente_endereco || "",
                cliente_bairro: os.cliente_bairro || "",
                cliente_cidade: os.cliente_cidade || "",
                cliente_estado: os.cliente_estado || "",
                forma_pagamento: os.forma_pagamento || os.parcelas_detalhes?.[0]?.forma_pagamento || "A Combinar",
              };
              if (tipo === "NFSe") {
                const servicos = os.servicos || [];
                if (servicos.length > 0) {
                  items = servicos.map(s => ({
                    descricao: s.descricao || "",
                    quantidade: Number(s.quantidade ?? 1),
                    valor_unitario: Number(s.valor || 0),
                    valor_total: Number(s.valor || 0) * Number(s.quantidade ?? 1),
                  }));
                }
                valor_total = items.reduce((sum, it) => sum + it.valor_total, 0);
              } else {
                const pecas = os.pecas || [];
                if (pecas.length > 0) {
                  items = pecas.map(p => ({
                    descricao: p.descricao || "",
                    quantidade: Number(p.quantidade || 1),
                    valor_unitario: Number(p.valor_unitario || 0),
                    valor_total: Number(p.valor_total || 0),
                  }));
                }
                valor_total = items.reduce((sum, it) => sum + it.valor_total, 0);
              }
            }
          } catch {}
        }

        setForm({
          ...defaultForm(),
          tipo,
          ordem_servico_id: os_id,
          cliente_id,
          cliente_nome,
          ...clienteExtra,
          valor_total,
          items,
        });
        setAbaForm("cliente");
        setShowForm(true);
      }
    });
  }, []);

  const proximoNumero = (notasList, tipo) => {
    if (tipo === 'NFCe') {
      const cfgUltimo = configsNF.find(c => c.chave === 'nfce_ultimo_numero');
      const ultimoSalvo = parseInt(cfgUltimo?.valor || '0', 10);
      const nums = notasList.filter(n => n.tipo === 'NFCe').map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
      const ultimoNota = nums.length > 0 ? Math.max(...nums) : 0;
      return String(Math.max(ultimoSalvo, ultimoNota) + 1);
    }
    const chaveConfig = tipo === 'NFe' ? 'nfe_ultimo_numero' : tipo === 'NFSe' ? 'nfse_ultimo_rps' : null;
    const cfgUltimo = chaveConfig ? configsNF.find(c => c.chave === chaveConfig) : null;
    // Para NFSe, se não houver config, assume 29 (último RPS registrado no painel Focus NFe)
    const defaultBase = tipo === 'NFSe' ? 29 : 0;
    const ultimoSalvo = parseInt(cfgUltimo?.valor || String(defaultBase), 10);
    const filtradas = notasList.filter(n => n.tipo === tipo);
    const nums = filtradas.map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
    const ultimoNota = nums.length > 0 ? Math.max(...nums) : 0;
    return String(Math.max(ultimoSalvo, ultimoNota) + 1);
  };

  const proximaSerie = (notasList, tipo) => {
    if (tipo === 'NFSe') return '900'; // Série padrão para NFSe Nacional
    const filtradas = notasList.filter(n => n.tipo === tipo && n.serie);
    const series = filtradas.map(n => parseInt(n.serie, 10)).filter(n => !isNaN(n));
    return series.length > 0 ? String(Math.max(...series)) : "1";
  };

  const load = async () => {
    const [n, c, configs, os, est, srv] = await Promise.all([
      base44.entities.NotaFiscal.list("-created_date", 200),
      base44.entities.Cliente.list("-created_date", 200),
      base44.entities.Configuracao.list("-created_date", 100),
      base44.entities.OrdemServico.list("-created_date", 500),
      base44.entities.Estoque.list("-created_date", 500),
      base44.entities.Servico.list("-created_date", 500),
    ]);
    setNotas(n);
    setClientes(c);
    setOrdensVenda(os);
    setEstoque(est);
    setServicos(srv);
    setConfigsNF(configs);
    setTemSpedy(true);
    setLoading(false);
  };

  const filtradas = notas.filter(n => {
    const isEntrada = n.status === "Importada";
    if (filtroTipo === "Entrada" && !isEntrada) return false;
    if (filtroTipo === "Saída" && isEntrada) return false;
    if (filtroModeloNF !== "Todos" && n.tipo !== filtroModeloNF) return false;
    const data = n.data_emissao || "";
    if (data < periodoRange.inicio || data > periodoRange.fim) return false;
    if (search) {
      const s = search.toLowerCase();
      return (n.cliente_nome || "").toLowerCase().includes(s) || (n.numero || "").includes(s) || (n.chave_acesso || "").includes(s);
    }
    return true;
  });

  const clientesFiltrados = clientes.filter(c => {
    const isConsumidor = c.nome?.toUpperCase() === "CONSUMIDOR";
    const temDocumento = !!(c.cpf_cnpj && c.cpf_cnpj.trim());
    if (form.tipo === "NFSe") return !isConsumidor && temDocumento;
    return true;
  });

  const selecionarCliente = (clienteId) => {
    const c = clientes.find(cl => cl.id === clienteId);
    if (!c) { setForm(f => ({ ...f, cliente_id: "", cliente_nome: "" })); return; }
    setForm(f => ({
      ...f,
      cliente_id: c.id,
      cliente_nome: c.nome || "",
      cliente_cpf_cnpj: c.cpf_cnpj || "",
      cliente_email: c.email || "",
      cliente_telefone: c.telefone || "",
      cliente_endereco: c.endereco || "",
      cliente_numero: c.numero || "",
      cliente_bairro: c.bairro || "",
      cliente_cep: c.cep || "",
      cliente_cidade: c.cidade || "",
      cliente_estado: c.estado || "",
    }));
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

  const excluir = async (id) => {
    if (!confirm("Excluir esta nota fiscal?")) return;
    const nota = notas.find(n => n.id === id);
    if (nota?.numero) {
      const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
      const vinculados = financeiros.filter(f => f.descricao?.includes(`NF ${nota.numero}`));
      for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
    }
    // Devolver estoque se nota emitida com produtos
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

  const parsearItensXML = (xmlContent) => {
    try {
      const parsed = JSON.parse(xmlContent);
      if (Array.isArray(parsed)) return parsed.filter(i => i.descricao);
    } catch {}
    return [];
  };

  const importarXML = async () => {
    if (!xmlTexto.trim()) return alert("Cole o conteúdo do XML.");
    setImportando(true);
    setXmlParaEntrada(xmlTexto);
    setXmlTexto("");
    setShowImport(false);
    setImportando(false);
    setShowEntrada(true);
  };

  const feedback = (tipo, msg) => {
    setMsgFeedback({ tipo, msg });
    setTimeout(() => setMsgFeedback(null), 6000);
  };

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
      f = {
        ...defaultForm(),
        tipo: rascunhoNota.tipo,
        cliente_id: rascunhoNota.cliente_id,
        cliente_nome: rascunhoNota.cliente_nome || clienteVinculado?.nome || '',
        cliente_cpf_cnpj: rascunhoNota.cliente_cpf_cnpj || clienteVinculado?.cpf_cnpj || '',
        cliente_email: clienteVinculado?.email || '',
        cliente_telefone: clienteVinculado?.telefone || '',
        cliente_endereco: clienteVinculado?.endereco || '',
        cliente_numero: clienteVinculado?.numero || '',
        cliente_bairro: clienteVinculado?.bairro || '',
        cliente_cep: clienteVinculado?.cep || '',
        cliente_cidade: clienteVinculado?.cidade || '',
        cliente_estado: clienteVinculado?.estado || '',
        ordem_servico_id: rascunhoNota.ordem_servico_id,
        valor_total: rascunhoNota.valor_total,
        observacoes: rascunhoNota.observacoes,
        data_emissao: rascunhoNota.data_emissao,
        items: [{ descricao: rascunhoNota.observacoes || 'Serviços', quantidade: 1, valor_unitario: rascunhoNota.valor_total, valor_total: rascunhoNota.valor_total }],
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
      };
      const response = await base44.functions.invoke("emitirNotaFiscal", payload);

      if (response.data?.sucesso) {
        feedback('sucesso', `Nota ${f.tipo} transmitida com sucesso! ${response.data.mensagem || ''}`);
        currentEditIdRef.current = null;
        setForm(defaultForm());
      } else {
        feedback("erro", response.data?.erro || "Erro ao emitir.");
      }
      load();
    } catch (e) {
      feedback("erro", "Erro: " + e.message);
    }
    setEmitindo(false);
    setAguardandoEmissao(false);
    setTransmitindo(null);
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
    setForm({
      ...defaultForm(),
      tipo: nota.tipo || 'NFSe',
      numero: nota.numero || '',
      serie: nota.serie || '1',
      data_emissao: nota.data_emissao || new Date().toISOString().split('T')[0],
      cliente_id: nota.cliente_id || '',
      cliente_nome: nota.cliente_nome || '',
      cliente_cpf_cnpj: nota.cliente_cpf_cnpj || '',
      cliente_email: nota.cliente_email || '',
      cliente_telefone: nota.cliente_telefone || '',
      cliente_endereco: nota.cliente_endereco || '',
      cliente_numero: nota.cliente_numero || '',
      cliente_bairro: nota.cliente_bairro || '',
      cliente_cep: nota.cliente_cep || '',
      cliente_cidade: nota.cliente_cidade || '',
      cliente_estado: nota.cliente_estado || '',
      ordem_servico_id: nota.ordem_servico_id || '',
      valor_total: nota.valor_total || 0,
      observacoes: nota.observacoes || '',
      forma_pagamento: nota.forma_pagamento || 'A Combinar',
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

  const imprimirNota = async (nota) => {
    // NFCe: a URL do DANFCE é HTML, abrir direto
    if (nota.tipo === 'NFCe' && nota.pdf_url) {
      window.open(nota.pdf_url, '_blank');
      return;
    }
    feedback('sucesso', 'Carregando PDF...');
    try {
      const res = await base44.functions.invoke('proxyPdfNota', { nota_id: nota.id });
      const data = res.data;
      if (data?.sucesso && data?.pdf_base64) {
        setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, status: 'Emitida' } : n));
        setMsgFeedback(null);
        const byteChars = atob(data.pdf_base64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else if (data?.processando) {
        feedback('erro', data.mensagem || 'A SEFAZ ainda está processando a nota.');
      } else {
        feedback('erro', data?.erro || 'PDF não disponível para esta nota.');
      }
    } catch (e) {
      feedback('erro', 'Erro ao consultar PDF: ' + e.message);
    }
  };

  const gerarPdfConferencia = async (nota) => {
    if (nota.status !== 'Importada') { feedback('erro', 'Apenas notas importadas podem gerar relatório de conferência.'); return; }
    try {
      feedback('sucesso', 'Gerando PDF de conferência...');
      const res = await base44.functions.invoke('gerarPdfConferenciaCompra', { nota_id: nota.id });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conferencia_${nota.numero || 'nota'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMsgFeedback(null);
    } catch (e) {
      feedback('erro', 'Erro ao gerar PDF: ' + e.message);
    }
  };

  const exportarRelatorio = () => {
    if (filtradas.length === 0) return alert("Nenhuma nota no filtro atual.");
    setGerandoZip(true);
    const header = ["Tipo", "Número", "Série", "Status", "Cliente", "Data Emissão", "Valor Total", "Chave Acesso", "Observações"];
    const rows = filtradas.map(n => [
      n.tipo || "", n.numero || "", n.serie || "", n.status || "", n.cliente_nome || "",
      n.data_emissao || "", Number(n.valor_total || 0).toFixed(2).replace(".", ","),
      n.chave_acesso || "", (n.observacoes || "").replace(/[\r\n;]/g, " "),
    ]);
    const sep = ";";
    const bom = "\uFEFF";
    const csvContent = bom + [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(sep)).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas_fiscais_${periodoRange.inicio}_${periodoRange.fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setGerandoZip(false);
  };

  const gerarSintegra = () => {
    setGerandoSintegra(true);
    const nfes = filtradas.filter(n => n.tipo === "NFe");
    const mes = String(filtroMes).padStart(2, "0");
    const ano = String(filtroAno);
    const dtIni = `${ano}${mes}01`;
    const dtFin = `${ano}${mes}31`;
    let linhas = [];
    linhas.push(`10MG AUTOCENTER LTDA              54043647000120Patos de Minas       MG${dtIni}${dtFin}1`.padEnd(125, " ").substring(0, 125) + "\r\n");
    linhas.push(`11Rua Rui Barbosa                1355Santa Terezinha    38700000                         34998791260          1`.padEnd(85, " ").substring(0, 85) + "\r\n");
    let totalNotasEntrada = 0, totalValorEntrada = 0;
    let totalNotasSaida = 0, totalValorSaida = 0;
    for (const nota of nfes) {
      const isEntrada = nota.status === "Importada";
      const codSit = nota.status === "Cancelada" ? "2" : "N";
      const tipo = isEntrada ? "E" : "S";
      const cfop = "5405";
      const data = (nota.data_emissao || "").replace(/-/g, "").substring(2);
      const valor = String(Math.round(Number(nota.valor_total || 0) * 100)).padStart(13, "0");
      const cnpj = (nota.cliente_cpf_cnpj || "").replace(/\D/g, "").padStart(14, "0");
      const ie = "ISENTO         ";
      const uf = "MG";
      const num = (nota.numero || "0").padStart(6, "0");
      const serie = (nota.serie || "1").padStart(3, " ");
      const modelo = "55";
      linhas.push(`50${cnpj}${ie}${uf}${data}${num}${serie}${modelo}${cfop}${valor}${valor}00000000000000000000000000000000000000000000000000000000${tipo}${codSit}\r\n`);
      if (isEntrada) { totalNotasEntrada++; totalValorEntrada += Number(nota.valor_total || 0); }
      else { totalNotasSaida++; totalValorSaida += Number(nota.valor_total || 0); }
    }
    linhas.push(`9010         ${String(totalNotasEntrada).padStart(5,"0")}${String(Math.round(totalValorEntrada*100)).padStart(13,"0")}50E\r\n`);
    linhas.push(`9010         ${String(totalNotasSaida).padStart(5,"0")}${String(Math.round(totalValorSaida*100)).padStart(13,"0")}50S\r\n`);
    linhas.push(`99${String(linhas.length + 1).padStart(12, "0")}\r\n`);
    const conteudo = linhas.join("");
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SINTEGRA_${ano}${mes}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setGerandoSintegra(false);
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {msgFeedback && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${msgFeedback.tipo === "sucesso" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {msgFeedback.tipo === "sucesso" ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span>{msgFeedback.msg}</span>
        </div>
      )}

      {/* Botões - 3 Colunas Compactas */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setShowImport(true)} className="flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all" style={{background: "#00cc44", color: "#000"}} onMouseEnter={e => e.currentTarget.style.background = "#00aa33"} onMouseLeave={e => e.currentTarget.style.background = "#00cc44"}>
          <Upload className="w-3 h-3" /> Importar XML
        </button>
        <button
          onClick={async () => {
            setBuscandoSefaz(true);
            try {
              const res = await base44.functions.invoke('consultarNotasRecebidas', {});
              const data = res.data;
              if (data?.sucesso) {
                feedback('sucesso', data.mensagem || 'Consulta concluída.');
                load();
              } else {
                feedback('erro', data?.erro || 'Erro ao buscar notas recebidas.');
              }
            } catch (e) {
              feedback('erro', 'Erro: ' + e.message);
            }
            setBuscandoSefaz(false);
          }}
          disabled={buscandoSefaz}
          className="flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50"
          style={{background: "#00cc44", color: "#000"}}
          onMouseEnter={e => { if (!buscandoSefaz) e.currentTarget.style.background = "#00aa33"; }}
          onMouseLeave={e => e.currentTarget.style.background = "#00cc44"}
        >
          {buscandoSefaz ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          {buscandoSefaz ? 'Buscando...' : 'Buscar da SEFAZ'}
        </button>
        <button onClick={() => { setForm(f => ({ ...f, numero: proximoNumero(notas, f.tipo), serie: proximaSerie(notas, f.tipo) })); setShowForm(true); }} className="flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all" style={{background: "#00cc44", color: "#000"}} onMouseEnter={e => e.currentTarget.style.background = "#00aa33"} onMouseLeave={e => e.currentTarget.style.background = "#00cc44"}>
          <Plus className="w-3 h-3" /> Emitir Nota
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2">
        {/* Entrada/Saída + NFe/NFSe/NFCe */}
        <div className="flex gap-2">
          <button onClick={() => setFiltroTipo("Todos")} className={`flex-1 h-8 rounded-lg text-[11px] font-medium transition-all ${filtroTipo === "Todos" ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>Saída</button>
          <button onClick={() => setFiltroTipo("Entrada")} className={`flex-1 h-8 rounded-lg text-[11px] font-medium transition-all ${filtroTipo === "Entrada" ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>Entrada</button>
          {["Todos", "NFe", "NFSe", "NFCe"].map(m => (
            <button key={m} onClick={() => setFiltroModeloNF(m)}
              className={`flex-1 h-8 rounded-lg text-[11px] font-medium transition-all ${filtroModeloNF === m ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {m === "Todos" ? "Tudo" : m}
            </button>
          ))}
        </div>

        {/* Botões Export + Período */}
        <div className="flex gap-2">
          <button onClick={() => exportarRelatorio()} disabled={gerandoZip} className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
            {gerandoZip ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />} Exportar
          </button>
          <button onClick={() => setShowSintegra(true)} className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
            <BarChart2 className="w-3 h-3" /> Sintegra
          </button>
          <div className={`flex-1 flex items-center h-8 rounded-lg text-[11px] font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>< ChevronLeft className="w-3 h-3" /></button>
            <span className="flex-1 text-center truncate">{MESES[filtroMes - 1]} - {filtroAno}</span>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>< ChevronRight className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Busca + View */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Buscar nota..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div className="flex bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <button onClick={() => { setViewMode("table"); localStorage.setItem("notas_viewmode","table"); }} className="px-3 py-2 transition-all" style={{background:viewMode==="table"?"#062C9B":"transparent",color:viewMode==="table"?"#fff":"#6b7280"}} title="Lista"><List className="w-5 h-5"/></button>
            <button onClick={() => { setViewMode("cards"); localStorage.setItem("notas_viewmode","cards"); }} className="px-3 py-2 transition-all" style={{background:viewMode==="cards"?"#062C9B":"transparent",color:viewMode==="cards"?"#fff":"#6b7280"}} title="Cards"><LayoutGrid className="w-5 h-5"/></button>
          </div>
        </div>
      </div>

      {/* Tabela/Cards */}
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
                  {nota.status !== 'Emitida' && nota.status !== 'Processando' && nota.status !== 'Aguardando Sefin Nacional' && (
                    <button onClick={() => editarNota(nota)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-yellow-400 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5"/></button>
                  )}
                  <button onClick={() => imprimirNota(nota)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg transition-all"><Printer className="w-3.5 h-3.5"/></button>
                  {(nota.status === 'Emitida' || nota.status === 'Processando' || nota.status === 'Aguardando Sefin Nacional') && (
                    <button title="Cancelar" onClick={() => cancelarNota(nota)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-orange-400 rounded-lg transition-all"><Ban className="w-3.5 h-3.5"/></button>
                  )}
                  <button onClick={() => excluir(nota.id)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
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
                          <button title="Transmitir" onClick={() => { if (transmitindo) return; emitirNota(nota); }} disabled={transmitindo !== null}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-lg transition-all disabled:opacity-50">
                            {transmitindo === nota.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            {transmitindo === nota.id ? "..." : "Transmitir"}
                          </button>
                        )}
                        {(nota.status === "Importada") && (
                          <button title="Lançar Entrada" onClick={async () => {
                            const xmlDisponivel = nota.xml_content && nota.xml_content.includes('<det');
                            if (xmlDisponivel) {
                              setNotaIdParaEntrada(nota.id);
                              setXmlParaEntrada(nota.xml_content);
                              setShowEntrada(true);
                            } else if (nota.chave_acesso) {
                              feedback('sucesso', 'Buscando XML completo na SEFAZ...');
                              try {
                                const res = await base44.functions.invoke('buscarXmlNota', { chave_acesso: nota.chave_acesso, nota_id: nota.id });
                                if (res.data?.sucesso && res.data?.xml) {
                                  setMsgFeedback(null);
                                  setNotaIdParaEntrada(nota.id);
                                  setXmlParaEntrada(res.data.xml);
                                  setShowEntrada(true);
                                } else {
                                  feedback('erro', res.data?.erro || 'XML não disponível. Importe o arquivo XML manualmente.');
                                }
                              } catch (e) {
                                feedback('erro', 'Erro ao buscar XML: ' + e.message);
                              }
                            } else {
                              feedback('erro', 'Nota sem chave de acesso. Importe o arquivo XML manualmente.');
                            }
                          }} className="p-1 text-blue-400 hover:text-blue-300 transition-all" title="Lançar Entrada">
                            <LogIn className="w-4 h-4" />
                          </button>
                        )}
                        {nota.status !== 'Emitida' && nota.status !== 'Processando' && nota.status !== 'Aguardando Sefin Nacional' && nota.status !== 'Importada' && nota.status !== 'Lançada' && (
                          <button title="Editar" onClick={() => editarNota(nota)} className="p-1 text-gray-500 hover:text-yellow-400 transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {nota.status !== 'Importada' && nota.status !== 'Lançada' && (
                          <button title="Imprimir" onClick={() => imprimirNota(nota)} className="p-1 text-gray-500 hover:text-blue-400 transition-all">
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {(nota.status === 'Emitida' || nota.status === 'Processando' || nota.status === 'Aguardando Sefin Nacional') && (
                          <button title="Cancelar Nota" onClick={() => cancelarNota(nota)} className="p-1 text-gray-500 hover:text-orange-400 transition-all">
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

      {/* Modal Importar XML */}
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
              <button onClick={() => { setShowImport(false); setXmlTexto(""); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white">Cancelar</button>
              <button onClick={importarXML} disabled={importando || !xmlTexto.trim()} className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50" style={{background: "#cc0000"}} onMouseEnter={e => !importando && (e.currentTarget.style.background = "#aa0000")} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
                {importando ? "Importando..." : "Importar XML"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Emitir NF */}
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

            <div className="px-5 pt-4 flex-shrink-0 grid grid-cols-3 gap-4">
              <F label="Tipo de Nota Fiscal">
                <select value={form.tipo} onChange={e => {
                    const novoTipo = e.target.value;
                    let numero = proximoNumero(notas, novoTipo);
                    let serie = proximaSerie(notas, novoTipo);
                    setForm(f => ({ ...f, tipo: novoTipo, items: [defaultItem()], numero, serie }));
                }} className="input-dark">
                  <option value="NFSe">NFSe — Serviço</option>
                  <option value="NFe">NFe — Produto</option>
                  <option value="NFCe">NFCe — Consumidor</option>
                </select>
              </F>
              <F label="Data de Emissão">
                <input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} className="input-dark" />
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
              {/* ABA CLIENTE */}
              {abaForm === "cliente" && (
                <div className="space-y-4">

                  <F label="Buscar Cliente">
                    <SearchableSelect
                      placeholder="Digite o nome ou CPF/CNPJ..."
                      options={clientesFiltrados.map(c => ({ value: c.id, label: c.nome, sublabel: c.cpf_cnpj || '' }))}
                      onSelect={opt => selecionarCliente(opt.value)}
                    />
                  </F>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="Nome / Razão Social *" className="col-span-2">
                      <NoACInput value={form.cliente_nome} onChange={e => { setForm(f => ({ ...f, cliente_nome: e.target.value })); setErrosForm(e2 => ({...e2, cliente_nome: undefined})); }} placeholder="Nome completo ou razão social" className={`input-dark ${errosForm.cliente_nome ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_nome && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_nome}</p>}
                    </F>
                    <F label="CPF / CNPJ">
                      <NoACInput value={form.cliente_cpf_cnpj} onChange={e => { setForm(f => ({ ...f, cliente_cpf_cnpj: e.target.value })); setErrosForm(e2 => ({...e2, cliente_cpf_cnpj: undefined})); }} placeholder="000.000.000-00" className={`input-dark ${errosForm.cliente_cpf_cnpj ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_cpf_cnpj && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_cpf_cnpj}</p>}
                    </F>
                    <F label="E-mail">
                      <NoACInput value={form.cliente_email} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} placeholder="email@cliente.com" />
                    </F>
                    <F label="Telefone">
                      <NoACInput value={form.cliente_telefone} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                    </F>
                    <F label="CEP">
                      <NoACInput value={form.cliente_cep} onChange={e => { setForm(f => ({ ...f, cliente_cep: e.target.value })); setErrosForm(e2 => ({...e2, cliente_cep: undefined})); }} placeholder="00000-000" className={`input-dark ${errosForm.cliente_cep ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_cep && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_cep}</p>}
                    </F>
                    <F label="Endereço" className="col-span-2">
                      <NoACInput value={form.cliente_endereco} onChange={e => { setForm(f => ({ ...f, cliente_endereco: e.target.value })); setErrosForm(e2 => ({...e2, cliente_endereco: undefined})); }} placeholder="Rua, Avenida..." className={`input-dark ${errosForm.cliente_endereco ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_endereco && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_endereco}</p>}
                    </F>
                    <F label="Número">
                      <NoACInput value={form.cliente_numero} onChange={e => setForm(f => ({ ...f, cliente_numero: e.target.value }))} placeholder="123" />
                    </F>
                    <F label="Bairro">
                      <NoACInput value={form.cliente_bairro} onChange={e => setForm(f => ({ ...f, cliente_bairro: e.target.value }))} placeholder="" />
                    </F>
                    <F label="Cidade">
                      <NoACInput value={form.cliente_cidade} onChange={e => { setForm(f => ({ ...f, cliente_cidade: e.target.value })); setErrosForm(e2 => ({...e2, cliente_cidade: undefined})); }} placeholder="Nome da cidade" className={`input-dark ${errosForm.cliente_cidade ? 'border-red-500' : ''}`} />
                      {errosForm.cliente_cidade && <p className="text-red-400 text-xs mt-1">{errosForm.cliente_cidade}</p>}
                    </F>
                    <F label="Estado (UF)">
                      <NoACInput value={form.cliente_estado} onChange={e => { setForm(f => ({ ...f, cliente_estado: e.target.value.toUpperCase() })); setErrosForm(e2 => ({...e2, cliente_estado: undefined})); }} placeholder="MG" maxLength={2} className={`input-dark ${errosForm.cliente_estado ? 'border-red-500' : ''}`} />
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

              {/* ABA ITENS */}
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
                                : estoque.map(p => ({ value: p.id, label: p.descricao, sublabel: [p.codigo, p.valor_venda ? `R$ ${Number(p.valor_venda).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : ''].filter(Boolean).join(' — ') }))
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
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <F label="Código">
                              <div className="input-dark text-gray-400 text-sm">{item.codigo || '—'}</div>
                            </F>
                            <F label={form.tipo === 'NFSe' ? 'Serviço' : 'Produto'} className="col-span-2 md:col-span-3">
                              <NoACInput value={item.descricao} onChange={e => atualizarItem(idx, 'descricao', e.target.value)} placeholder="Descrição" className={`input-dark ${errosForm.items?.[idx]?.descricao ? 'border-red-500' : ''}`} />
                              {errosForm.items?.[idx]?.descricao && <p className="text-red-400 text-xs mt-1">{errosForm.items[idx].descricao}</p>}
                            </F>
                            <F label="Quantidade">
                              <NoACInput value={item.quantidade} onChange={e => atualizarItem(idx, 'quantidade', e.target.value)} placeholder="1" />
                            </F>
                            <F label="Valor Unitário (R$)">
                              <NoACInput value={item.valor_unitario} onChange={e => atualizarItem(idx, 'valor_unitario', e.target.value)} placeholder="0" />
                            </F>
                            <F label="Total (R$)" className="col-span-2">
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
                  <F label="Discriminação / Observações">
                    <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                      className="input-dark" rows={3} placeholder="Informações adicionais..." autoComplete="off" />
                  </F>
                  <div className="flex justify-between">
                    <button onClick={() => setAbaForm("cliente")} className="text-gray-400 hover:text-white text-sm px-4 py-2 border border-gray-700 rounded-lg transition-all">← Voltar</button>
                    <button onClick={() => setAbaForm("pagamento")} className="text-black px-6 py-2 rounded-lg text-sm font-medium transition-all" style={{background: "#00ff00"}} onMouseEnter={e => e.currentTarget.style.background = "#00dd00"} onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>Próximo: Pagamento →</button>
                  </div>
                </div>
              )}

              {/* ABA PAGAMENTO */}
              {abaForm === "pagamento" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="Forma de Pagamento">
                      <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))} className="input-dark">
                        {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                      </select>
                    </F>
                  </div>

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

                  <div className="flex gap-3 justify-between">
                    <button onClick={() => setAbaForm("itens")} className="text-gray-400 hover:text-white text-sm px-4 py-2 border border-gray-700 rounded-lg transition-all">← Voltar</button>
                    <div className="flex gap-3">
                      <button onClick={salvarRascunho} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Salvar Rascunho</button>
                      <button
                        onClick={() => temSpedy ? emitirNota() : salvarRascunho()}
                        disabled={emitindo}
                        className="px-6 py-2 text-sm text-black rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                        style={{background: "#00ff00"}}
                        onMouseEnter={e => !emitindo && (e.currentTarget.style.background = "#00dd00")}
                        onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
                      >
                        {emitindo && <RefreshCw className="w-4 h-4 animate-spin" />}
                        {emitindo ? "Emitindo..." : temSpedy ? "Transmitir Nota" : "Salvar Nota"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Overlay aguardando emissão */}
      {aguardandoEmissao && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-6">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-white text-xl font-bold">Transmitindo nota fiscal...</p>
            <p className="text-gray-400 text-sm mt-2">Aguardando autorização da SEFAZ</p>
          </div>
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

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
}