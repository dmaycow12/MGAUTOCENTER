import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  FileText, Plus, Upload, Search, Trash2, Eye, X,
  CheckCircle, AlertCircle, Printer, Download, PlusCircle, MinusCircle, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Archive, BarChart2
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
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroModeloNF, setFiltroModeloNF] = useState("Todos");
  const [gerandoZip, setGerandoZip] = useState(false);
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
    const filtradas = notasList.filter(n => n.tipo === tipo);
    const nums = filtradas
      .map(n => parseInt(n.numero, 10))
      .filter(n => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  };

  const proximaSerie = (notasList, tipo) => {
    const filtradas = notasList.filter(n => n.tipo === tipo && n.serie);
    const series = filtradas.map(n => parseInt(n.serie, 10)).filter(n => !isNaN(n));
    return series.length > 0 ? String(Math.max(...series)) : "1";
  };

  const load = async () => {
    const [n, c, configs, os] = await Promise.all([
      base44.entities.NotaFiscal.list("-created_date", 200),
      base44.entities.Cliente.list("-created_date", 200),
      base44.entities.Configuracao.list("-created_date", 100),
      base44.entities.OrdemServico.list("-created_date", 500),
    ]);
    setNotas(n);
    setClientes(c);
    setOrdensVenda(os);
    const apiKey = configs.find(cfg => cfg.chave === "spedy_api_key")?.valor;
    setTemSpedy(!!(apiKey && apiKey.trim()));
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

    await base44.entities.NotaFiscal.delete(id);
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
      items: [{ descricao: rascunhoNota.observacoes || "Serviços", quantidade: 1, valor_unitario: rascunhoNota.valor_total, valor_total: rascunhoNota.valor_total }],
    } : form;

    if (!f.cliente_nome) return alert("Informe o nome do cliente.");
    if (!f.valor_total || f.valor_total <= 0) return alert("Informe o valor total.");

    const isConsumidor = f.cliente_nome?.toUpperCase() === "CONSUMIDOR";
    if (f.tipo === "NFSe") {
      if (isConsumidor) return alert("NFSe não aceita o cliente CONSUMIDOR. Selecione um cliente com CPF ou CNPJ cadastrado.");
      if (!f.cliente_cpf_cnpj?.trim()) return alert("NFSe exige cliente com CPF ou CNPJ cadastrado.");
    }

    if (rascunhoNota) setTransmitindo(rascunhoNota.id);
    else setEmitindo(true);

    try {
      const payload = { ...f, nota_id: rascunhoNota?.id || null, numero_manual: f.numero || null, serie_manual: f.serie || "1" };
      const response = await base44.functions.invoke("emitirNotaFiscal", payload);

      if (response.data?.sucesso) {
        feedback("sucesso", `Nota ${f.tipo} transmitida com sucesso! ${response.data.mensagem || ""}`);
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

  const salvarRascunho = async () => {
    await base44.entities.NotaFiscal.create({ ...form, status: "Rascunho" });
    setShowForm(false);
    setForm(defaultForm());
    feedback("sucesso", "Salvo como rascunho.");
    load();
  };

  const imprimirNota = (nota) => {
    let dadosXML = null;
    if (nota.status === "Importada" && nota.xml_content) {
      try {
        const xml = nota.xml_content.replace(/<(\/?)[a-zA-Z0-9_]+:([a-zA-Z0-9_]+)/g, "<$1$2");
        const get = (tag) => { const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`)); return m ? m[1].trim() : ""; };
        const getAll = (tag) => { const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g"); const r = []; let m; while((m=re.exec(xml))!==null) r.push(m[1]); return r; };
        const xNomes = [...xml.matchAll(/<xNome>([^<]*)<\/xNome>/g)];
        const cnpjs = [...xml.matchAll(/<CNPJ>([^<]*)<\/CNPJ>/g)];
        const IEs = [...xml.matchAll(/<IE>([^<]*)<\/IE>/g)];
        const detNodes = getAll("det");
        const itens = detNodes.map((det,i) => ({
          num: i+1,
          descricao: det.match(/<xProd>([^<]*)<\/xProd>/)?.[1] || "",
          ncm: det.match(/<NCM>([^<]*)<\/NCM>/)?.[1] || "",
          cfop: det.match(/<CFOP>([^<]*)<\/CFOP>/)?.[1] || "",
          unidade: det.match(/<uCom>([^<]*)<\/uCom>/)?.[1] || "",
          quantidade: det.match(/<qCom>([^<]*)<\/qCom>/)?.[1] || "",
          vUnit: det.match(/<vUnCom>([^<]*)<\/vUnCom>/)?.[1] || "",
          vTotal: det.match(/<vProd>([^<]*)<\/vProd>/)?.[1] || "",
        }));
        const dupNodes = getAll("dup");
        const dups = dupNodes.map(dup => ({
          nDup: dup.match(/<nDup>([^<]*)<\/nDup>/)?.[1] || "",
          dVenc: dup.match(/<dVenc>([^<]*)<\/dVenc>/)?.[1] || "",
          vDup: dup.match(/<vDup>([^<]*)<\/vDup>/)?.[1] || "",
        }));
        dadosXML = {
          emit_nome: xNomes[0]?.[1] || nota.cliente_nome,
          emit_cnpj: cnpjs[0]?.[1] || "",
          emit_ie: IEs[0]?.[1] || "",
          emit_end: `${get("xLgr")}, ${get("nro")} — ${get("xBairro")} — ${get("xMun")}/${get("UF")} CEP: ${get("CEP")}`,
          dest_nome: xNomes[1]?.[1] || "",
          dest_cnpj: cnpjs[1]?.[1] || "",
          dest_ie: IEs[1]?.[1] || "",
          natOp: get("natOp"),
          dataEmissao: (get("dhEmi") || get("dEmi"))?.substring(0,10) || nota.data_emissao,
          vBC: get("vBC"), vICMS: get("vICMS"), vIPI: get("vIPI"), vPIS: get("vPIS"), vCOFINS: get("vCOFINS"),
          vProd: get("vProd"), vDesc: get("vDesc"), vFrete: get("vFrete"), vNF: get("vNF"),
          infCpl: get("infCpl"),
          itens,
          dups,
        };
      } catch {}
    }

    const fmt = (v) => Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2});
    const chaveFormatada = (nota.chave_acesso||"").replace(/(\d{4})/g,"$1 ").trim();

    const htmlDanfe = dadosXML ? `
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
      <title>DANFE NF-e ${nota.numero}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:8pt;color:#000;background:#fff;padding:6mm}
        .border{border:1px solid #000}
        .box{border:1px solid #000;padding:2px 4px;margin-bottom:2px}
        .box .lbl{font-size:6pt;color:#333;text-transform:uppercase;font-weight:bold}
        .box .val{font-size:8.5pt;font-weight:bold}
        .header{display:grid;grid-template-columns:1fr 140px 1fr;border:1px solid #000;margin-bottom:3px}
        .h-emit{padding:4px;border-right:1px solid #000}
        .h-danfe{padding:4px;text-align:center;border-right:1px solid #000;display:flex;flex-direction:column;justify-content:center}
        .h-info{padding:4px;font-size:7pt}
        .section-title{background:#eee;font-size:7pt;font-weight:bold;text-transform:uppercase;padding:1px 4px;border:1px solid #000;margin-bottom:2px;margin-top:4px}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-bottom:2px}
        table{width:100%;border-collapse:collapse;font-size:7pt;margin-bottom:2px}
        th{background:#eee;border:1px solid #000;padding:2px 3px;text-align:center;font-size:6.5pt;font-weight:bold}
        td{border:1px solid #000;padding:2px 3px}
        .chave{font-size:7pt;font-family:monospace;letter-spacing:1px;word-break:break-all;border:1px solid #000;padding:3px;background:#f9f9f9;margin-bottom:3px;text-align:center}
        .totais{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:2px}
        .dup-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:2px;margin-bottom:2px}
        @media print{@page{size:A4;margin:8mm}body{padding:0}}
      </style></head><body>
      <div class="header">
        <div class="h-emit">
          <div class="lbl" style="font-size:9pt;font-weight:bold">${dadosXML.emit_nome}</div>
          <div style="font-size:7pt;margin-top:2px">${dadosXML.emit_end}</div>
          <div style="font-size:7pt;margin-top:2px">CNPJ: ${dadosXML.emit_cnpj} — IE: ${dadosXML.emit_ie}</div>
        </div>
        <div class="h-danfe">
          <div style="font-size:10pt;font-weight:bold;letter-spacing:2px">DANFE</div>
          <div style="font-size:7pt;margin-top:2px">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</div>
          <div style="margin-top:4px;font-size:8pt;font-weight:bold">Nº ${nota.numero} Série ${nota.serie || "1"}</div>
          <div style="font-size:7pt;margin-top:2px">Emissão: ${dadosXML.dataEmissao}</div>
        </div>
        <div class="h-info">
          <div class="lbl">Natureza da Operação</div>
          <div class="val" style="font-size:8pt">${dadosXML.natOp}</div>
          <div style="margin-top:4px" class="lbl">Protocolo de Autorização</div>
          <div class="val" style="font-size:7pt">${nota.chave_acesso ? "Nota Autorizada" : "Uso Denegado / Sem Protocolo"}</div>
        </div>
      </div>
      ${nota.chave_acesso ? `<div class="chave">Chave de Acesso: ${chaveFormatada}</div>` : ""}
      <div class="section-title">Destinatário / Remetente</div>
      <div class="grid2">
        <div class="box"><div class="lbl">Nome / Razão Social</div><div class="val">${dadosXML.dest_nome || "—"}</div></div>
        <div class="box"><div class="lbl">CNPJ / CPF</div><div class="val">${dadosXML.dest_cnpj || "—"}</div></div>
      </div>
      <div class="section-title">Dados dos Produtos / Serviços</div>
      <table>
        <thead><tr><th>#</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>UN</th><th>Qtd</th><th>V. Unit.</th><th>V. Total</th></tr></thead>
        <tbody>
          ${dadosXML.itens.map(it => `<tr><td style="text-align:center">${it.num}</td><td>${it.descricao}</td><td style="text-align:center">${it.ncm}</td><td style="text-align:center">${it.cfop}</td><td style="text-align:center">${it.unidade}</td><td style="text-align:right">${it.quantidade}</td><td style="text-align:right">${fmt(it.vUnit)}</td><td style="text-align:right"><b>${fmt(it.vTotal)}</b></td></tr>`).join("")}
        </tbody>
      </table>
      <div class="section-title">Cálculo do Imposto / Totais</div>
      <div class="totais">
        <div class="box"><div class="lbl">Base Cálc. ICMS</div><div class="val">R$ ${fmt(dadosXML.vBC)}</div></div>
        <div class="box"><div class="lbl">Valor ICMS</div><div class="val">R$ ${fmt(dadosXML.vICMS)}</div></div>
        <div class="box"><div class="lbl">Valor IPI</div><div class="val">R$ ${fmt(dadosXML.vIPI)}</div></div>
        <div class="box"><div class="lbl">Valor PIS</div><div class="val">R$ ${fmt(dadosXML.vPIS)}</div></div>
        <div class="box"><div class="lbl">Valor COFINS</div><div class="val">R$ ${fmt(dadosXML.vCOFINS)}</div></div>
        <div class="box"><div class="lbl">Desconto</div><div class="val">R$ ${fmt(dadosXML.vDesc)}</div></div>
        <div class="box"><div class="lbl">Frete</div><div class="val">R$ ${fmt(dadosXML.vFrete)}</div></div>
        <div class="box" style="border:2px solid #000"><div class="lbl">VALOR TOTAL NF</div><div class="val" style="font-size:11pt">R$ ${fmt(dadosXML.vNF)}</div></div>
      </div>
      ${dadosXML.dups.length > 0 ? `<div class="section-title">Duplicatas</div><div class="dup-grid">${dadosXML.dups.map(d => { const [ano, mes, dia] = (d.dVenc || "").split("-"); const df = ano && mes && dia ? `${dia}/${mes}/${ano.slice(-2)}` : d.dVenc; return `<div class="box"><div class="lbl">Bol. ${d.nDup}</div><div class="val" style="font-size:7pt">Venc: ${df}</div><div class="val">R$ ${fmt(d.vDup)}</div></div>`; }).join("")}</div>` : ""}
      ${dadosXML.infCpl ? `<div class="section-title">Informações Complementares</div><div class="box" style="font-size:7pt">${dadosXML.infCpl}</div>` : ""}
      <script>window.onload=function(){window.print()}</script>
      </body></html>
    ` : `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
      <title>NF ${nota.tipo} ${nota.numero || nota.id}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20mm;color:#111;max-width:210mm;margin:0 auto}
        h1{font-size:18pt;margin-bottom:4px}.sub{color:#888;font-size:10pt;margin-bottom:12px}
        .box{border:1px solid #ccc;padding:6px 10px;margin-bottom:6px;border-radius:4px}
        .lbl{font-size:7pt;color:#888;text-transform:uppercase;letter-spacing:.5px}
        .val{font-size:11pt;font-weight:bold}
        .total-val{font-size:18pt;font-weight:bold;color:#f97316}
        @media print{@page{size:A4;margin:15mm}body{padding:0}}
      </style></head><body>
      <h1>${nota.tipo} — Nota Fiscal</h1>
      <p class="sub">Emitida por Oficina Pro • ${nota.data_emissao || ""} • Status: ${nota.status}</p>
      <div class="box"><div class="lbl">Número / Série</div><div class="val">${nota.numero || "—"}${nota.serie ? ` / ${nota.serie}` : ""}</div></div>
      <div class="box"><div class="lbl">Cliente</div><div class="val">${nota.cliente_nome || "—"}</div></div>
      <div class="box"><div class="lbl">Valor Total</div><div class="total-val">R$ ${fmt(nota.valor_total)}</div></div>
      ${nota.observacoes ? `<div class="box"><div class="lbl">Observações</div><div class="val" style="font-size:10pt">${nota.observacoes}</div></div>` : ""}
      ${nota.chave_acesso ? `<div class="box" style="font-size:7pt;word-break:break-all"><b>Chave de Acesso:</b> ${nota.chave_acesso}</div>` : ""}
      ${nota.pdf_url ? `<div style="margin-top:12px"><a href="${nota.pdf_url}" target="_blank" style="color:#f97316;font-weight:bold">📄 Baixar PDF Oficial</a></div>` : ""}
      <script>window.onload=function(){window.print()}</script>
      </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(htmlDanfe);
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
          <button onClick={() => { const df = defaultForm(); setForm({...df, numero: proximoNumero(notas, df.tipo), serie: proximaSerie(notas, df.tipo)}); setAbaForm("cliente"); setShowForm(true); }}
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
                    <td className="px-4 py-3 text-white font-mono text-xs">{nota.serie || "1"}/{nota.numero || "—"}</td>
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
                {!temSpedy && <p className="text-yellow-400 text-xs mt-0.5">⚠️ Spedy não configurada — será salvo como rascunho</p>}
                {temSpedy && <p className="text-green-400 text-xs mt-0.5">✓ Spedy configurada — será transmitida automaticamente</p>}
              </div>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>

            <div className="px-5 pt-4 flex-shrink-0 grid grid-cols-4 gap-4">
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
              <F label="Série">
                <NoACInput value={form.serie} onChange={e => setForm(f => ({ ...f, serie: e.target.value }))} placeholder="1" />
              </F>
              <F label="Número">
                <NoACInput value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="1" />
              </F>
              <F label="Data de Emissão">
                <input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} className="input-dark" />
              </F>
            </div>

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
                      <NoACInput value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} placeholder="Nome completo ou razão social" />
                    </F>
                    <F label="CPF / CNPJ">
                      <NoACInput value={form.cliente_cpf_cnpj} onChange={e => setForm(f => ({ ...f, cliente_cpf_cnpj: e.target.value }))} placeholder="000.000.000-00" />
                    </F>
                    <F label="E-mail">
                      <NoACInput value={form.cliente_email} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} placeholder="email@cliente.com" />
                    </F>
                    <F label="Telefone">
                      <NoACInput value={form.cliente_telefone} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                    </F>
                    <F label="CEP">
                      <NoACInput value={form.cliente_cep} onChange={e => setForm(f => ({ ...f, cliente_cep: e.target.value }))} placeholder="00000-000" />
                    </F>
                    <F label="Endereço" className="col-span-2">
                      <NoACInput value={form.cliente_endereco} onChange={e => setForm(f => ({ ...f, cliente_endereco: e.target.value }))} placeholder="Rua, Avenida..." />
                    </F>
                    <F label="Número">
                      <NoACInput value={form.cliente_numero} onChange={e => setForm(f => ({ ...f, cliente_numero: e.target.value }))} placeholder="123" />
                    </F>
                    <F label="Bairro">
                      <NoACInput value={form.cliente_bairro} onChange={e => setForm(f => ({ ...f, cliente_bairro: e.target.value }))} placeholder="" />
                    </F>
                    <F label="Cidade">
                      <NoACInput value={form.cliente_cidade} onChange={e => setForm(f => ({ ...f, cliente_cidade: e.target.value }))} placeholder="Nome da cidade" />
                    </F>
                    <F label="Estado (UF)">
                      <NoACInput value={form.cliente_estado} onChange={e => setForm(f => ({ ...f, cliente_estado: e.target.value.toUpperCase() }))} placeholder="MG" maxLength={2} />
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
                  {(form.tipo === "NFCe" || form.tipo === "NFe") && (
                    <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      ℹ️ {form.tipo} lança apenas <strong>produtos</strong> — não inclua serviços
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
                          <F label="Descrição" className="col-span-2 md:col-span-4">
                            <NoACInput value={item.descricao} onChange={e => atualizarItem(idx, "descricao", e.target.value)} placeholder={form.tipo === "NFSe" ? "Ex: Troca de óleo, Alinhamento..." : "Ex: Filtro de óleo, Pastilha de freio..."} />
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