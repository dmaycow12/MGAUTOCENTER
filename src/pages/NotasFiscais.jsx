import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  FileText, Plus, Upload, Search, Trash2, Eye, X,
  CheckCircle, AlertCircle, Printer, Download, PlusCircle, MinusCircle, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Archive, BarChart2, Pencil
} from "lucide-react";
import ModalEntradaNF from "@/components/notas/ModalEntradaNF";
import JSZip from "jszip";

const STATUS_COLOR = {
  Rascunho: "bg-gray-500/10 text-gray-400",
  Emitida: "bg-green-500/10 text-green-400",
  Cancelada: "bg-red-500/10 text-red-400",
  Importada: "bg-blue-500/10 text-blue-400",
};

const FORMAS_PAGAMENTO = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Boleto", "Transferência", "A Prazo"];

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
    forma_pagamento: "PIX",
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

// Input sem autocomplete do navegador
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
  const [buscandoSefaz, setBuscandoSefaz] = useState(false);
  const [gerandoSintegra, setGerandoSintegra] = useState(false);

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
  const [msgFeedback, setMsgFeedback] = useState(null);
  const [temSpedy, setTemSpedy] = useState(false);
  const [abaForm, setAbaForm] = useState("cliente");
  const [errosForm, setErrosForm] = useState({});

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
    const filtradas = notasList.filter(n => n.tipo === tipo);
    const nums = filtradas.map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  };

  const proximaSerie = (notasList, tipo) => {
    const filtradas = notasList.filter(n => n.tipo === tipo && n.serie);
    const series = filtradas.map(n => parseInt(n.serie, 10)).filter(n => !isNaN(n));
    return series.length > 0 ? String(Math.max(...series)) : "1";
  };

  const [configsNF, setConfigsNF] = useState([]);

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

  const excluir = async (id) => {
    if (!confirm("Excluir esta nota fiscal? Isso também removerá os itens do estoque e os lançamentos financeiros vinculados.")) return;
    const nota = notas.find(n => n.id === id);

    if (nota?.status === "Importada" && nota?.xml_content) {
      const xmlItens = parsearItensXML(nota.xml_content);
      if (xmlItens.length > 0) {
        const estoque = await base44.entities.Estoque.list("-created_date", 500);
        for (const item of xmlItens) {
          if (!item.descricao) continue;
          const existente = estoque.find(e => {
            if (item.codigo && item.codigo !== "SEM GTIN" && item.codigo !== "" && e.codigo) {
              return e.codigo === item.codigo;
            }
            return e.descricao?.trim().toLowerCase() === item.descricao.trim().toLowerCase();
          });
          if (existente) {
            const novaQtd = (Number(existente.quantidade) || 0) - (Number(item.quantidade) || 0);
            await base44.entities.Estoque.update(existente.id, { quantidade: Math.max(0, novaQtd) });
          }
        }
      }
    }

    if (nota?.numero) {
      const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
      const vinculados = financeiros.filter(f => f.descricao?.includes(`NF ${nota.numero}`));
      for (const f of vinculados) {
        await base44.entities.Financeiro.delete(f.id);
      }
    }

    try {
      await base44.entities.NotaFiscal.delete(id);
    } catch (_) {
      // Nota já não existe no banco, apenas atualiza a lista
    }
    load();
  };

  const parsearItensXML = (xmlContent) => {
    try {
      const parsed = JSON.parse(xmlContent);
      if (Array.isArray(parsed)) return parsed.filter(i => i.descricao);
    } catch {}
    const xml = (xmlContent || "").replace(/<(\/?)[a-zA-Z0-9_]+:([a-zA-Z0-9_]+)/g, "<$1$2");
    const getAll = (tag) => { const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g"); const r = []; let m; while((m=re.exec(xml))!==null) r.push(m[1]); return r; };
    return getAll("det").map(det => ({
      descricao: det.match(/<xProd>([^<]*)<\/xProd>/)?.[1]?.trim() || "",
      quantidade: parseFloat(det.match(/<qCom>([^<]*)<\/qCom>/)?.[1] || "0"),
      codigo: det.match(/<cEAN>([^<]*)<\/cEAN>/)?.[1]?.trim() || "",
    })).filter(i => i.descricao);
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

    const itemErros = f.items.map((it, idx) => {
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
    const f = rascunhoNota ? {
      ...defaultForm(),
      tipo: rascunhoNota.tipo,
      cliente_id: rascunhoNota.cliente_id,
      cliente_nome: rascunhoNota.cliente_nome,
      ordem_servico_id: rascunhoNota.ordem_servico_id,
      valor_total: rascunhoNota.valor_total,
      observacoes: rascunhoNota.observacoes,
      data_emissao: rascunhoNota.data_emissao,
      items: [{ descricao: rascunhoNota.observacoes || 'Serviços', quantidade: 1, valor_unitario: rascunhoNota.valor_total, valor_total: rascunhoNota.valor_total }],
    } : form;

    if (!rascunhoNota) {
      const erros = validarForm(f);
      if (Object.keys(erros).length > 0) {
        setErrosForm(erros);
        // Navega para a aba com o primeiro erro
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
      if (isConsumidor) return alert("NFSe não aceita o cliente CONSUMIDOR. Selecione um cliente com CPF ou CNPJ cadastrado.");
      if (!f.cliente_cpf_cnpj?.trim()) return alert("NFSe exige cliente com CPF ou CNPJ cadastrado.");
    }
    if (f.tipo === "NFe") {
      if (isConsumidor) return alert("NFe não aceita CONSUMIDOR. Use NFCe para venda ao consumidor final, ou selecione um cliente com CPF/CNPJ.");
      if (!f.cliente_cpf_cnpj?.trim()) return alert("NFe exige cliente com CPF ou CNPJ cadastrado.");
    }

    if (rascunhoNota) setTransmitindo(rascunhoNota.id);
    else setEmitindo(true);

    try {
      const payload = {
        ...f,
        data_emissao: f.data_emissao || new Date().toISOString().split('T')[0],
        nota_id: rascunhoNota?.id || form._editId || null,
        serie_manual: f.serie || '1',
        // garante que items sempre tem valor_unitario correto
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
        feedback("sucesso", `Nota ${f.tipo} transmitida com sucesso! ${response.data.mensagem || ""}`);
        // Atualiza o registro no banco com os dados retornados
        const idParaAtualizar = rascunhoNota?.id || form._editId;
        if (idParaAtualizar) {
          const atualizacao = {};
          if (response.data.numero) atualizacao.numero = response.data.numero;
          if (response.data.serie) atualizacao.serie = response.data.serie;
          if (response.data.status) atualizacao.status_sefaz = response.data.status;
          if (Object.keys(atualizacao).length > 0) {
            await base44.entities.NotaFiscal.update(idParaAtualizar, atualizacao);
          }
        }
        setShowForm(false);
        setForm(defaultForm());
      } else {
        feedback("erro", response.data?.erro || "Erro ao emitir na Spedy.");
        if (!rascunhoNota) {
          await base44.entities.NotaFiscal.create({ ...f, status: "Rascunho" });
        }
      }
      load();
    } catch (e) {
      feedback("erro", "Erro: " + e.message);
      if (!rascunhoNota) {
        await base44.entities.NotaFiscal.create({ ...form, status: "Rascunho" });
        setShowForm(false);
        setForm(defaultForm());
        load();
      }
    }
    setEmitindo(false);
    setTransmitindo(null);
  };

  const editarNota = (nota) => {
    setForm({
      ...defaultForm(),
      tipo: nota.tipo || 'NFSe',
      numero: nota.numero || '',
      serie: nota.serie || '1',
      data_emissao: nota.data_emissao || new Date().toISOString().split('T')[0],
      cliente_id: nota.cliente_id || '',
      cliente_nome: nota.cliente_nome || '',
      ordem_servico_id: nota.ordem_servico_id || '',
      valor_total: nota.valor_total || 0,
      observacoes: nota.observacoes || '',
      forma_pagamento: 'PIX',
      items: nota.xml_content ? (() => { try { const p = JSON.parse(nota.xml_content); if (Array.isArray(p) && p.length > 0) return p.map(i => ({ descricao: i.descricao || '', quantidade: i.quantidade || 1, valor_unitario: i.valor_unitario || 0, valor_total: i.valor_total || 0, ncm: i.ncm || '', cfop: i.cfop || '', cest: i.cest || '', unidade: i.unidade || 'UN', codigo: i.codigo || '' })); } catch {} return [defaultItem()]; })() : [defaultItem()],
      _editId: nota.id,
    });
    setAbaForm('cliente');
    setShowForm(true);
  };

  const salvarRascunho = async () => {
    await base44.entities.NotaFiscal.create({ ...form, status: "Rascunho" });
    setShowForm(false);
    setForm(defaultForm());
    feedback("sucesso", "Salvo como rascunho.");
    load();
  };

  const imprimirNota = async (nota) => {
    // Busca configurações para cupom
    const configs = await base44.entities.Configuracao.list('-created_date', 100);
    const getNomeOficina = () => configs.find(c => c.chave === 'nome_oficina')?.valor || 'MG AUTOCENTER';
    const getEndereco = () => configs.find(c => c.chave === 'endereco')?.valor || '';
    const getCidade = () => configs.find(c => c.chave === 'cidade')?.valor || '';
    const getEstado = () => configs.find(c => c.chave === 'estado')?.valor || '';
    const getCep = () => configs.find(c => c.chave === 'cep')?.valor || '';
    const getTelefone = () => configs.find(c => c.chave === 'telefone')?.valor || '';
    const getCnpj = () => configs.find(c => c.chave === 'cnpj')?.valor || '';

    const nomeOficina = getNomeOficina();
    const endereco = getEndereco();
    const cidade = getCidade();
    const estado = getEstado();
    const cep = getCep();
    const telefone = getTelefone();
    const cnpj = getCnpj();

    // Parse itens se houver
    let itens = [];
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        itens = Array.isArray(parsed) ? parsed : [];
      } catch {}
    }

    const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const chaveFormatada = (nota.chave_acesso || '').replace(/(\d{4})/g, '$1 ').trim();
    const dataFormatada = nota.data_emissao ? nota.data_emissao.split('-').reverse().join('/') : '';

    const htmlCupom = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cupom NFCe ${nota.numero}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Courier New', monospace; font-size: 11pt; color: #000; background: #fff; padding: 6mm; line-height: 1.3; }
          .cupom { width: 80mm; margin: 0 auto; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding: 4mm 0; margin-bottom: 2mm; }
          .header h1 { font-size: 12pt; font-weight: bold; margin-bottom: 2mm; }
          .header p { font-size: 9pt; margin: 1mm 0; }
          .secao { margin: 3mm 0; padding: 2mm 0; border-bottom: 1px dashed #000; }
          .secao-titulo { font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #333; margin-bottom: 2mm; }
          .linha { display: flex; justify-content: space-between; font-size: 9pt; margin: 1.5mm 0; }
          .label { font-weight: bold; }
          .valor { text-align: right; }
          .item { font-size: 8.5pt; margin: 2mm 0; padding: 1mm 0; border-bottom: 1px dotted #ccc; }
          .item-desc { font-weight: bold; }
          .item-info { display: flex; justify-content: space-between; font-size: 8pt; margin-top: 0.5mm; }
          .total { font-size: 12pt; font-weight: bold; text-align: right; margin: 2mm 0; }
          .qrcode { text-align: center; margin: 3mm 0; font-size: 7pt; }
          .rodape { text-align: center; font-size: 7pt; color: #666; margin-top: 2mm; }
          @media print {
            @page { size: 80mm auto; margin: 2mm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="cupom">
          <!-- HEADER -->
          <div class="header">
            <h1>${nomeOficina}</h1>
            <p>${cnpj ? 'CNPJ: ' + cnpj : ''}</p>
            <p>${endereco}${endereco && cidade ? ', ' : ''}${cidade}${cidade && estado ? '/' : ''}${estado}</p>
            ${cep ? '<p>CEP: ' + cep + '</p>' : ''}
            ${telefone ? '<p>Tel: ' + telefone + '</p>' : ''}
          </div>

          <!-- INFO NOTA -->
          <div class="secao">
            <div class="linha">
              <span class="label">NFCe Nº:</span>
              <span class="valor">${nota.numero || '—'}</span>
            </div>
            <div class="linha">
              <span class="label">Série:</span>
              <span class="valor">${nota.serie || '1'}</span>
            </div>
            <div class="linha">
              <span class="label">Data/Hora:</span>
              <span class="valor">${dataFormatada} 12:00</span>
            </div>
            <div class="linha">
              <span class="label">Status:</span>
              <span class="valor">${nota.status || 'Emitida'}</span>
            </div>
          </div>

          <!-- CLIENTE -->
          <div class="secao">
            <div class="secao-titulo">Cliente</div>
            <div style="font-size: 9pt;">
              <strong>${nota.cliente_nome || 'Consumidor Final'}</strong>
            </div>
          </div>

          <!-- ITENS -->
          ${itens.length > 0 ? `
            <div class="secao">
              <div class="secao-titulo">Itens</div>
              ${itens.map((it, idx) => `
                <div class="item">
                  <div class="item-desc">${(idx + 1).toString().padStart(2, '0')}. ${(it.descricao || 'Produto').toUpperCase()}</div>
                  <div class="item-info">
                    <span>${Number(it.quantidade || 1)} x R$ ${fmt(it.valor_unitario || 0)}</span>
                    <span style="font-weight: bold;">R$ ${fmt(it.valor_total || 0)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- TOTALIZADORES -->
          <div class="secao">
            <div class="linha">
              <span class="label">Subtotal:</span>
              <span class="valor">R$ ${fmt(nota.valor_total || 0)}</span>
            </div>
            <div class="total">
              <div style="font-size: 9pt; color: #666; margin-bottom: 1mm;">TOTAL</div>
              R$ ${fmt(nota.valor_total || 0)}
            </div>
          </div>

          <!-- PAGAMENTO -->
          <div class="secao">
            <div class="secao-titulo">Forma de Pagamento</div>
            <div style="font-size: 9pt; font-weight: bold;">
              ${itens.length > 0 ? (itens[0].forma_pagamento || 'PIX') : 'PIX'}
            </div>
          </div>

          <!-- CHAVE -->
          ${nota.chave_acesso ? `
            <div class="secao">
              <div class="secao-titulo">Chave de Acesso</div>
              <div class="qrcode">
                <strong>${chaveFormatada}</strong>
              </div>
            </div>
          ` : ''}

          <!-- RODAPÉ -->
          <div class="rodape">
            <p>Obrigado pela compra!</p>
            <p style="margin-top: 2mm; font-size: 6.5pt;">Este é um documento fiscal eletrônico.</p>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(htmlCupom);
    win.document.close();
  };

  const filtradas = notas.filter(n => {
    const matchSearch = !search || n.numero?.includes(search) ||
      n.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      n.chave_acesso?.includes(search);
    const matchTipo = filtroTipo === "Todos" ||
      (filtroTipo === "Entrada" && n.tipo === "NFe" && n.status === "Importada") ||
      (filtroTipo === "Saída" && n.status !== "Importada");
    const matchModelo = filtroModeloNF === "Todos" || n.tipo === filtroModeloNF;
    const matchInicio = !periodoRange || (n.data_emissao && n.data_emissao >= periodoRange.inicio);
    const matchFim = !periodoRange || (n.data_emissao && n.data_emissao <= periodoRange.fim);
    return matchSearch && matchTipo && matchModelo && matchInicio && matchFim;
  });

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

      {/* Header / Filtros */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all" style={{background: "#00ff00", color: "#000"}} onMouseEnter={e => e.currentTarget.style.background = "#00dd00"} onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
            <Upload className="w-3 h-3" /> Importar XML
          </button>
          <button
            onClick={async () => {
              setBuscandoSefaz(true);
              try {
                const res = await base44.functions.invoke('importarSefaz', {});
                const data = res.data;
                if (data?.sucesso) {
                  feedback('sucesso', `Busca concluída! ${JSON.stringify(data.notas_encontradas).substring(0, 200)}`);
                } else {
                  feedback('erro', data?.erro || 'Erro ao buscar na SEFAZ.');
                }
              } catch (e) {
                feedback('erro', 'Erro: ' + e.message);
              }
              setBuscandoSefaz(false);
            }}
            disabled={buscandoSefaz}
            className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50"
            style={{background: "#00cc44", color: "#000"}}
            onMouseEnter={e => { if (!buscandoSefaz) e.currentTarget.style.background = "#00aa33"; }}
            onMouseLeave={e => e.currentTarget.style.background = "#00cc44"}
          >
            {buscandoSefaz ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {buscandoSefaz ? 'Buscando...' : 'Buscar da SEFAZ'}
          </button>
          <button onClick={() => { const df = defaultForm(); setForm({...df, numero: proximoNumero(notas, df.tipo), serie: proximaSerie(notas, df.tipo)}); setAbaForm("cliente"); setShowForm(true); }} className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all" style={{background: "#00ff00", color: "#000"}} onMouseEnter={e => e.currentTarget.style.background = "#00dd00"} onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
            <Plus className="w-3 h-3" /> Emitir Nota
          </button>
          </div>

          <div className="flex gap-2">
          {["Tudo", "Entrada", "Saída"].map(t => (
            <button key={t} onClick={() => setFiltroTipo(t === "Tudo" ? "Todos" : t)}
              className={`flex-1 h-8 rounded-lg text-[11px] font-medium transition-all ${(t === "Tudo" ? filtroTipo === "Todos" : filtroTipo === t) ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {["Todos", "NFe", "NFSe", "NFCe"].map(m => (
            <button key={m} onClick={() => setFiltroModeloNF(m)}
              className={`flex-1 h-8 rounded-lg text-[11px] font-medium transition-all ${filtroModeloNF === m ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {m === "Todos" ? "Tudo" : m}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={exportarRelatorio} disabled={gerandoZip} className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
            {gerandoZip ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />} Exportar
          </button>
          <button onClick={gerarSintegra} disabled={gerandoSintegra} className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
            {gerandoSintegra ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BarChart2 className="w-3 h-3" />} Sintegra
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <div className={`flex-1 flex items-center h-8 rounded-lg text-[11px] font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="flex-1 text-center truncate">{MESES[filtroMes - 1]} - {filtroAno}</span>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="relative flex-1" ref={periodoDropRef}>
            <button onClick={() => setPeriodoDropOpen(v => !v)}
              className={`w-full flex items-center justify-center gap-2 px-4 h-8 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}>
              {usandoOutroPeriodo && customRange ? `${customRange.inicio.split("-").reverse().join("/")} — ${customRange.fim.split("-").reverse().join("/")}` : "Período"}
              <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${periodoDropOpen ? "rotate-180" : ""}`} />
            </button>
            {periodoDropOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 space-y-3">
                <p className="text-xs text-gray-400 font-medium">Selecione o período</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">De</label>
                  <input type="date" value={outroPeriodoInicio} onChange={e => setOutroPeriodoInicio(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Até</label>
                  <input type="date" value={outroPeriodoFim} onChange={e => setOutroPeriodoFim(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPeriodoDropOpen(false)} className="flex-1 py-2 text-xs text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
                  <button onClick={aplicarOutroPeriodo} className="flex-1 py-2 text-xs text-white rounded-lg font-medium transition-all bg-blue-600 hover:bg-blue-700">Aplicar</button>
                </div>
              </div>
            )}
          </div>
        </div>

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
                  <button onClick={() => editarNota(nota)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-yellow-400 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5"/></button>
                  <button onClick={() => imprimirNota(nota)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg transition-all"><Printer className="w-3.5 h-3.5"/></button>
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
                          <button title="Transmitir para Spedy" onClick={() => emitirNota(nota)} disabled={transmitindo === nota.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-lg transition-all disabled:opacity-50">
                            {transmitindo === nota.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            {transmitindo === nota.id ? "..." : "Transmitir"}
                          </button>
                        )}
                        {nota.pdf_url && (
                          <a href={nota.pdf_url} target="_blank" rel="noreferrer" title="Baixar PDF" className="p-1 text-gray-500 hover:text-green-400 transition-all">
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button title="Editar" onClick={() => editarNota(nota)} className="p-1 text-gray-500 hover:text-yellow-400 transition-all">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button title="Imprimir" onClick={() => imprimirNota(nota)} className="p-1 text-gray-500 hover:text-blue-400 transition-all">
                          <Printer className="w-4 h-4" />
                        </button>
                        {nota.chave_acesso && (
                          <a href={`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XbSeqxE8pl8=&nfe=${nota.chave_acesso}`}
                            target="_blank" rel="noreferrer" title="Consultar DANFE na SEFAZ" className="p-1 text-gray-500 hover:text-green-400 transition-all">
                            <Eye className="w-4 h-4" />
                          </a>
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
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>

            <div className="px-5 pt-4 flex-shrink-0 grid grid-cols-3 gap-4">
              <F label="Tipo de Nota Fiscal">
                <select value={form.tipo} onChange={e => {
                  const novoTipo = e.target.value;
                  setForm(f => ({ ...f, tipo: novoTipo, items: [defaultItem()], numero: proximoNumero(notas, novoTipo), serie: proximaSerie(notas, novoTipo) }));
                }} className="input-dark">
                  <option value="NFSe">NFSe — Serviço</option>
                  <option value="NFe">NFe — Produto</option>
                  <option value="NFCe">NFCe — Consumidor</option>
                </select>
              </F>
              <F label="Número">
                <NoACInput value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="1" />
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
                  {form.tipo === "NFSe" && (
                    <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-2">
                      ⚠️ NFSe aceita apenas clientes com CPF/CNPJ cadastrado — CONSUMIDOR não é permitido
                    </p>
                  )}
                  {form.tipo === "NFCe" && (
                    <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-2">
                      ℹ️ NFCe aceita CONSUMIDOR e clientes com CPF/CNPJ — lança apenas produtos
                    </p>
                  )}
                  <F label="Selecionar Cliente Cadastrado">
                    <select value={form.cliente_id} onChange={e => selecionarCliente(e.target.value)} className="input-dark">
                      <option value="">— Selecione ou preencha abaixo —</option>
                      {clientesFiltrados.map(c => <option key={c.id} value={c.id}>{c.nome} {c.cpf_cnpj ? `(${c.cpf_cnpj})` : ""}</option>)}
                    </select>
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
                  {form.tipo === "NFSe" && (
                    <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                      ⚠️ NFSe lança apenas <strong>serviços</strong> — não inclua produtos
                    </p>
                  )}
                  {form.tipo === "NFe" && (
                    <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      ℹ️ NFe lança apenas <strong>produtos</strong> e exige cliente com CPF/CNPJ — não aceita CONSUMIDOR
                    </p>
                  )}
                  {form.tipo === "NFCe" && (
                    <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      ℹ️ NFCe é para venda ao <strong>consumidor final</strong> — CPF/CNPJ opcional — não inclua serviços
                    </p>
                  )}
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <F label={form.tipo === 'NFSe' ? 'Selecionar Serviço Cadastrado' : 'Selecionar Produto do Estoque'} className="col-span-2 md:col-span-4">
                            <select
                              className="input-dark"
                              value=""
                              onChange={e => {
                                const id = e.target.value;
                                if (!id) return;
                                if (form.tipo === 'NFSe') {
                                  const srv = servicos.find(s => s.id === id);
                                  if (srv) atualizarItemCompleto(idx, { descricao: srv.descricao, quantidade: 1, valor_unitario: srv.valor || 0, valor_total: srv.valor || 0 });
                                } else {
                                  const prod = estoque.find(p => p.id === id);
                                   if (prod) atualizarItemCompleto(idx, { descricao: prod.descricao, quantidade: 1, valor_unitario: prod.valor_venda || 0, valor_total: prod.valor_venda || 0, ncm: prod.ncm || '', cfop: prod.cfop || '', cest: prod.cest || '', unidade: prod.unidade || 'UN', codigo: prod.codigo || '' });
                                }
                              }}
                            >
                              <option value="">— Selecione para preencher automaticamente —</option>
                              {form.tipo === 'NFSe'
                                ? servicos.map(s => <option key={s.id} value={s.id}>{s.descricao}{s.valor ? ` — R$ ${Number(s.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}` : ''}</option>)
                                : estoque.filter(p => p.quantidade > 0 || true).map(p => <option key={p.id} value={p.id}>{p.descricao}{p.codigo ? ` (${p.codigo})` : ''}{p.valor_venda ? ` — R$ ${Number(p.valor_venda).toLocaleString('pt-BR', {minimumFractionDigits:2})}` : ''}</option>)
                              }
                            </select>
                          </F>
                          <F label="Descrição" className="col-span-2 md:col-span-4">
                              <NoACInput value={item.descricao} onChange={e => atualizarItem(idx, "descricao", e.target.value)} placeholder={form.tipo === "NFSe" ? "Ex: Troca de óleo, Alinhamento..." : "Ex: Filtro de óleo, Pastilha de freio..."} className={`input-dark ${errosForm.items?.[idx]?.descricao ? 'border-red-500' : ''}`} />
                              {errosForm.items?.[idx]?.descricao && <p className="text-red-400 text-xs mt-1">{errosForm.items[idx].descricao}</p>}
                            </F>
                           <F label="Quantidade">
                             <NoACInput value={item.quantidade} onChange={e => atualizarItem(idx, "quantidade", e.target.value)} placeholder="1" />
                           </F>
                           <F label="Valor Unitário (R$)">
                             <NoACInput value={item.valor_unitario} onChange={e => atualizarItem(idx, "valor_unitario", e.target.value)} placeholder="0" />
                           </F>
                           <F label="Total (R$)" className="col-span-2">
                             <NoACInput value={item.valor_total} onChange={e => atualizarItem(idx, "valor_total", e.target.value)} placeholder="0" />
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
                        </div>
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
                    <F label="Ordem de Venda Vinculada (opcional)">
                      <select value={form.ordem_servico_id} onChange={e => setForm(f => ({ ...f, ordem_servico_id: e.target.value }))} className="input-dark">
                        <option value="">— Nenhuma —</option>
                        {ordensVenda.map(ov => <option key={ov.id} value={ov.id}>{ov.numero ? `Nº ${ov.numero}` : `OS ${ov.id.slice(-6)}`} — {ov.cliente_nome || "sem cliente"}</option>)}
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

      {showEntrada && xmlParaEntrada && (
        <ModalEntradaNF
          xmlTexto={xmlParaEntrada}
          onClose={() => { setShowEntrada(false); setXmlParaEntrada(""); }}
          onSalvo={() => {
            setShowEntrada(false);
            setXmlParaEntrada("");
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