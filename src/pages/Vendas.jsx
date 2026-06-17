import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, MessageCircle, Printer, X, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, FileText, Settings, RefreshCw, AlertTriangle } from "lucide-react";
import ModalEmissaoMassa from "@/components/notas/ModalEmissaoMassa";
import VendaForm from "@/components/vendas/VendaForm";
import VendaCard from "@/components/vendas/VendaCard";
import VendaRow, { COLUNAS_PADRAO } from "@/components/vendas/VendaRow";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function Vendas() {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState(() => {
    const saved = localStorage.getItem("os_filtroStatus");
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed : ["Aberto"];
  });
  const [filtroTipo, setFiltroTipo] = useState(() => {
   const saved = localStorage.getItem("os_filtroTipo2");
   if (saved) {
     const parsed = JSON.parse(saved);
     // migrar formato antigo (string) para array
     if (typeof parsed === "string") return [parsed];
     return parsed;
   }
   return ["patio"];
  });
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showEmissaoMassa, setShowEmissaoMassa] = useState(false);
  const [notas, setNotas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("os_viewmode") || "cards");
  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const saved = localStorage.getItem("os_colunasVisiveis");
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...COLUNAS_PADRAO, ...parsed };
  });
  const [showColunasFilter, setShowColunasFilter] = useState(false);
  const filtroRef = useRef(null);
  const rowRefs = useRef({});

  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState(() => {
     const saved = localStorage.getItem("os_filtroMes");
     return saved ? parseInt(saved) : hoje.getMonth() + 1;
   });
   const [filtroAno, setFiltroAno] = useState(() => {
     const saved = localStorage.getItem("os_filtroAno");
     return saved ? parseInt(saved) : hoje.getFullYear();
   });
   const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(() => localStorage.getItem("os_usandoOutroPeriodo") === "true");
   const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
   const [outroPeriodoInicio, setOutroPeriodoInicio] = useState(() => localStorage.getItem("os_outroPeriodoInicio") || "");
   const [outroPeriodoFim, setOutroPeriodoFim] = useState(() => localStorage.getItem("os_outroPeriodoFim") || "");
   const [customRange, setCustomRange] = useState(() => {
     const saved = localStorage.getItem("os_customRange");
     return saved ? JSON.parse(saved) : null;
   });
   const [orderData, setOrderData] = useState(() => localStorage.getItem("os_orderData") || "asc");
    const [orderNumero, setOrderNumero] = useState(() => localStorage.getItem("os_orderNumero") || "asc");
    const periodoDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) setPeriodoDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Persistir filtros no localStorage
  useEffect(() => { localStorage.setItem("os_search", search); }, [search]);
  useEffect(() => { localStorage.setItem("os_filtroStatus", JSON.stringify(filtroStatus)); }, [filtroStatus]);
  useEffect(() => { localStorage.setItem("os_filtroTipo2", JSON.stringify(filtroTipo)); }, [filtroTipo]);
  useEffect(() => { localStorage.setItem("os_filtroMes", filtroMes); }, [filtroMes]);
  useEffect(() => { localStorage.setItem("os_filtroAno", filtroAno); }, [filtroAno]);
  useEffect(() => { localStorage.setItem("os_usandoOutroPeriodo", usandoOutroPeriodo); }, [usandoOutroPeriodo]);
  useEffect(() => { localStorage.setItem("os_outroPeriodoInicio", outroPeriodoInicio); }, [outroPeriodoInicio]);
   useEffect(() => { localStorage.setItem("os_outroPeriodoFim", outroPeriodoFim); }, [outroPeriodoFim]);
   useEffect(() => { localStorage.setItem("os_customRange", JSON.stringify(customRange)); }, [customRange]);
   useEffect(() => { localStorage.setItem("os_colunasVisiveis", JSON.stringify(colunasVisiveis)); }, [colunasVisiveis]);
    useEffect(() => { localStorage.setItem("os_orderData", orderData); }, [orderData]);
    useEffect(() => { localStorage.setItem("os_orderNumero", orderNumero); }, [orderNumero]);

  useEffect(() => {
    const handler = (e) => {
      if (filtroRef.current && !filtroRef.current.contains(e.target)) setShowColunasFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navegarMes = (dir) => {
    setUsandoOutroPeriodo(false);
    setCustomRange(null);
    let m = filtroMes + dir, a = filtroAno;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    setFiltroMes(m);
    setFiltroAno(a);
  };

  const aplicarAtalho = (tipo) => {
    const hoje = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    if (tipo === 'hoje') {
      const d = fmt(hoje);
      setCustomRange({ inicio: d, fim: d });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'ontem') {
      const d = new Date(hoje); d.setDate(hoje.getDate() - 1);
      const s = fmt(d);
      setCustomRange({ inicio: s, fim: s });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'semana') {
      const dow = hoje.getDay();
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow);
      const fim = new Date(hoje); fim.setDate(hoje.getDate() + (6 - dow));
      setCustomRange({ inicio: fmt(ini), fim: fmt(fim) });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'semana_passada') {
      const dow = hoje.getDay();
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow - 7);
      const fim = new Date(hoje); fim.setDate(hoje.getDate() - dow - 1);
      setCustomRange({ inicio: fmt(ini), fim: fmt(fim) });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'mes') {
      setUsandoOutroPeriodo(false);
      setCustomRange(null);
      setFiltroMes(hoje.getMonth() + 1);
      setFiltroAno(hoje.getFullYear());
    } else if (tipo === 'mes_passado') {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      setUsandoOutroPeriodo(false);
      setCustomRange(null);
      setFiltroMes(d.getMonth() + 1);
      setFiltroAno(d.getFullYear());
    } else if (tipo === 'ano') {
      setCustomRange({ inicio: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'ano_passado') {
      const a = hoje.getFullYear() - 1;
      setCustomRange({ inicio: `${a}-01-01`, fim: `${a}-12-31` });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'tudo') {
      setCustomRange({ inicio: '2000-01-01', fim: '2099-12-31' });
      setUsandoOutroPeriodo(true);
    }
    setPeriodoDropOpen(false);
  };

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    setCustomRange({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
    setUsandoOutroPeriodo(true);
    setPeriodoDropOpen(false);
  };

  const toggleStatus = (s) => {
    setFiltroStatus(prev => {
      if (prev.includes(s) && prev.length === 1) return prev; // mínimo 1
      return prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s];
    });
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      console.log("Iniciando carregamento de Vendas...");
      const [o, c, n, e] = await Promise.all([
        base44.entities.Vendas.list("-created_date", 2000),
        base44.entities.Cadastro.list("-created_date", 2000),
        base44.entities.NotaFiscal.list("-created_date", 1000),
        base44.entities.Estoque.list("-created_date", 500),
      ]);
      console.log("Vendas carregadas:", o?.length || 0);
      setOrdens(o);
      setClientes(c);
      setNotas(n);
      setEstoque(e);
    } catch (err) {
      console.error("Erro ao carregar Vendas:", err);
      console.error("Stack:", err.stack);
      alert("Erro ao carregar vendas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (id) => {
    if (!confirm("Excluir esta Ordem de Serviço?")) return;
    await base44.entities.Vendas.delete(id);
    load();
  };

  const atualizarOrdem = (id, dados) => {
    setOrdens(prev => prev.map(o => o.id === id ? { ...o, ...dados } : o));
  };

  const pad = n => String(n).padStart(2, "0");
  const periodoRange = usandoOutroPeriodo && customRange
    ? customRange
    : { inicio: `${filtroAno}-${pad(filtroMes)}-01`, fim: `${filtroAno}-${pad(filtroMes)}-31` };

  const filtradas = ordens
     .filter(o => {
       const s = search.toLowerCase();
       const matchSearch = !search ||
         o.numero?.toLowerCase().includes(s) ||
         o.cliente_nome?.toLowerCase().includes(s) ||
         o.cliente_nome_fantasia?.toLowerCase().includes(s) ||
         o.veiculo_placa?.toLowerCase().includes(s) ||
         o.veiculo_modelo?.toLowerCase().includes(s);
       const matchStatus = filtroStatus.length > 0 && filtroStatus.includes(o.status);
       const matchPeriodo = !periodoRange || (o.data_entrada && o.data_entrada >= periodoRange.inicio && o.data_entrada <= periodoRange.fim);
       const temVeiculo = !!(o.veiculo_id || o.veiculo_placa || o.veiculo_modelo);
       const matchTipo = filtroTipo.length > 0 && ((filtroTipo.includes("patio") && temVeiculo) || (filtroTipo.includes("balcao") && !temVeiculo));
       return matchSearch && matchStatus && matchPeriodo && matchTipo;
       })
     .sort((a, b) => {
       // Prioriza ordenação por número se definida, senão por data
       const numA = parseInt(a.numero || 0);
       const numB = parseInt(b.numero || 0);
       const dataA = a.data_entrada || "";
       const dataB = b.data_entrada || "";

       if (orderNumero !== "asc") {
         if (numA !== numB) return orderNumero === "asc" ? numA - numB : numB - numA;
       } else {
         if (dataA !== dataB) {
           if (orderData === "asc") return dataA.localeCompare(dataB);
           return dataB.localeCompare(dataA);
         }
       }
       return orderNumero === "asc" ? numA - numB : numB - numA;
     });

  const ordensParaMassa = filtradas;

  const fmtValorSimples = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Totais por tipo — baseados nas ordens já filtradas (exceto o filtro de tipo)
  const ordensComFiltrosBase = ordens.filter(o => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      o.numero?.toLowerCase().includes(s) ||
      o.cliente_nome?.toLowerCase().includes(s) ||
      o.cliente_nome_fantasia?.toLowerCase().includes(s) ||
      o.veiculo_placa?.toLowerCase().includes(s) ||
      o.veiculo_modelo?.toLowerCase().includes(s);
    const matchStatus = filtroStatus.length > 0 && filtroStatus.includes(o.status);
    const matchPeriodo = !periodoRange || (o.data_entrada && o.data_entrada >= periodoRange.inicio && o.data_entrada <= periodoRange.fim);
    return matchSearch && matchStatus && matchPeriodo;
  });
  const totalPatio = ordensComFiltrosBase.filter(o => !!(o.veiculo_id || o.veiculo_placa || o.veiculo_modelo)).reduce((acc, o) => acc + (o.valor_total || 0), 0);
  const totalBalcao = ordensComFiltrosBase.filter(o => !(o.veiculo_id || o.veiculo_placa || o.veiculo_modelo)).reduce((acc, o) => acc + (o.valor_total || 0), 0);
  const getCustoPeca = (p) => {
    // Usa APENAS o custo salvo na venda — nunca busca do estoque atual
    return Number(p.valor_custo || 0);
  };
  const totalCusto = ordensComFiltrosBase.reduce((acc, o) => {
    const custoPecas = (o.pecas || []).reduce((s, p) => s + getCustoPeca(p) * Number(p.quantidade || 1), 0);
    const custoServicos = (o.servicos || []).reduce((s, sv) => s + Number(sv.valor_custo || 0) * Number(sv.quantidade ?? 1), 0);
    return acc + custoPecas + custoServicos;
  }, 0);
  const totalLucroServicos = ordensComFiltrosBase.reduce((acc, o) => {
    const custoServicos = (o.servicos || []).reduce((s, sv) => s + Number(sv.valor_custo || 0) * Number(sv.quantidade ?? 1), 0);
    return acc + (o.valor_servicos || 0) - custoServicos;
  }, 0);
  const totalLucroBruto = ordensComFiltrosBase.reduce((acc, o) => {
    const custoPecas = (o.pecas || []).reduce((s, p) => s + getCustoPeca(p) * Number(p.quantidade || 1), 0);
    const custoServicos = (o.servicos || []).reduce((s, sv) => s + Number(sv.valor_custo || 0) * Number(sv.quantidade ?? 1), 0);
    return acc + (o.valor_servicos || 0) - custoServicos + (o.valor_pecas || 0) - custoPecas;
  }, 0);
  const totalValorPecas = ordensComFiltrosBase.reduce((acc, o) => acc + (o.valor_pecas || 0), 0);
  const totalLucroPecas = ordensComFiltrosBase.reduce((acc, o) => {
    const custoPecas = (o.pecas || []).reduce((s, p) => s + getCustoPeca(p) * Number(p.quantidade || 1), 0);
    return acc + (o.valor_pecas || 0) - custoPecas;
  }, 0);
  const fmtTotal = v => Math.round(Number(v || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Cálculo de comissão baseado nas configurações do AbaComissoes
  const totalComissao = (() => {
    const configsSalvas = localStorage.getItem("comissoes_config");
    const configs = configsSalvas ? JSON.parse(configsSalvas) : [];
    if (!configs.length) return null;
    let total = 0;
    ordensComFiltrosBase.forEach(o => {
      (o.servicos || []).forEach(sv => {
        const tecnico = (sv.tecnico || "").trim().toLowerCase();
        const config = configs.find(c => (c.tecnico || "").trim().toLowerCase() === tecnico);
        if (config && config.percentual > 0) {
          const valorServico = Number(sv.valor || 0) * Number(sv.quantidade ?? 1);
          total += valorServico * (Number(config.percentual) / 100);
        }
      });
    });
    return total;
  })();

  // Vendas com peças sem custo (valor_custo === 0 ou undefined)
  const vendasSemCusto = ordens.filter(o =>
    o.status !== "Orçamento" &&
    (o.pecas || []).some(p => !p.valor_custo || Number(p.valor_custo) === 0)
  ).sort((a, b) => parseInt(b.numero || 0) - parseInt(a.numero || 0));

  const [showAlertaSemCusto, setShowAlertaSemCusto] = useState(false);

  return (
    <div className="space-y-0.5">

       {/* Controles — mesmo padrão do Financeiro */}
       <div className="flex flex-col gap-0.5">
         {/* Linha 1: Nova OS — ocupa linha toda */}
         <div className="flex gap-0.5">
          <button
            onClick={() => { setShowForm(true); setEditando(null); }}
            className="flex-1 flex items-center justify-center gap-2 text-white py-3 rounded-xl text-sm font-semibold transition-all"
            style={{background: "#00ff00", color: "#000"}}
            onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
            onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
          >
            <Plus className="w-4 h-4" /> Nova Ordem de Venda
          </button>
          <button
            onClick={() => setShowEmissaoMassa(true)}
            disabled={ordensParaMassa.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{background: "#062C9B", color: "#fff"}}
            title="Emitir NF em massa para as ordens filtradas"
          >
            <FileText className="w-4 h-4" /> NF Massa ({ordensParaMassa.length})
          </button>
        </div>

        {/* Linha 2: filtro status — multi-select */}
        <div className="flex gap-0.5">
          {["Aberto", "Orçamento", "Concluído"].map(s => (
            <button key={s} onClick={() => toggleStatus(s)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroStatus.includes(s) ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Linha 3: filtro Pátio / Balcão — multi-select */}
        <div className="flex gap-0.5">
          {[
            { key: "patio", label: "Pátio" },
            { key: "balcao", label: "Balcão" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFiltroTipo(prev => {
              if (prev.includes(key) && prev.length === 1) return prev; // mínimo 1
              return prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key];
            })}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroTipo.includes(key) ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Cards de totais - linha 1 */}
        <div className="grid grid-cols-4 gap-0.5">
          <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
            <span className="text-xs font-semibold text-gray-400 tracking-wide">VENDAS</span>
            <span className="text-sm font-bold text-white">{ordensComFiltrosBase.length}</span>
          </div>
          {[
            { label: "PÁTIO", value: totalPatio },
            { label: "BALCÃO", value: totalBalcao },
            { label: "TOTAL", value: totalPatio + totalBalcao },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
              <span className="text-xs font-semibold text-gray-400 tracking-wide">{label}</span>
              <span className="text-sm font-bold text-white">{fmtTotal(value)}</span>
            </div>
          ))}
        </div>
        {/* Cards de totais - linha 2 */}
        <div className="grid grid-cols-5 gap-0.5">
          <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
            <span className="text-xs font-semibold text-gray-400 tracking-wide">CUSTO</span>
            <span className="text-sm font-bold text-white">{fmtTotal(totalCusto)}</span>
          </div>
          <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
            <span className="text-xs font-semibold text-gray-400 tracking-wide">PEÇAS</span>
            <span className="text-sm font-bold text-white">{fmtTotal(totalValorPecas)}</span>
          </div>
          <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
            <span className="text-xs font-semibold text-gray-400 tracking-wide">SERVIÇOS</span>
            <span className={`text-sm font-bold ${totalLucroServicos >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtTotal(totalLucroServicos)}</span>
          </div>
          <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
            <span className="text-xs font-semibold text-gray-400 tracking-wide">COMISSÃO</span>
            <span className="text-sm font-bold text-white">{totalComissao !== null ? fmtTotal(totalComissao) : "—"}</span>
          </div>
          <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
            <span className="text-xs font-semibold text-gray-400 tracking-wide">LUCRO</span>
            <span className={`text-sm font-bold ${(totalValorPecas + totalLucroServicos - totalCusto) >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtTotal(totalValorPecas + totalLucroServicos - totalCusto)}</span>
          </div>
        </div>

        {/* Linha 3: filtro período */}
        <div className="flex gap-0.5 items-stretch">
          <div className={`flex-1 flex items-center rounded-xl text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button onClick={() => { setUsandoOutroPeriodo(false); setCustomRange(null); }} className="flex-1 text-center py-3 hover:bg-white/10 transition-all cursor-pointer px-1 leading-tight" style={{fontSize:"clamp(11px,1.5vw,15px)"}}>{MESES[filtroMes - 1]} - {filtroAno}</button>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="relative flex-1" ref={periodoDropRef}>
            <button
              onClick={() => setPeriodoDropOpen(v => !v)}
              className={`w-full h-full min-h-[48px] flex items-center justify-center gap-1 px-2 rounded-xl font-semibold transition-all ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}
              style={{fontSize:"clamp(11px,1.5vw,13px)"}}
            >
              <span className="text-center leading-tight flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span>
                  {usandoOutroPeriodo && customRange
                    ? customRange.inicio.split("-").reverse().join("/")
                    : `${String(1).padStart(2,"0")}/${String(filtroMes).padStart(2,"0")}/${filtroAno}`}
                </span>
                <span className="hidden sm:inline">—</span>
                <span>
                  {usandoOutroPeriodo && customRange
                    ? customRange.fim.split("-").reverse().join("/")
                    : `${String(new Date(filtroAno,filtroMes,0).getDate()).padStart(2,"0")}/${String(filtroMes).padStart(2,"0")}/${filtroAno}`}
                </span>
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${periodoDropOpen ? "rotate-180" : ""}`} />
            </button>
            {periodoDropOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 space-y-3">
                <p className="text-xs text-gray-400 font-medium">Atalhos</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['hoje','Hoje'],['ontem','Ontem'],['semana','Semana'],['semana_passada','Sem. Passada'],['mes','Mês'],['mes_passado','Mês Passado'],['ano','Ano'],['ano_passado','Ano Passado'],['tudo','Tudo']].map(([tipo, label]) => (
                    <button key={tipo} onClick={() => aplicarAtalho(tipo)}
                      className="py-2 text-xs text-white bg-gray-800 hover:bg-[#062C9B] border border-gray-700 rounded-lg font-medium transition-all">
                      {label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-700 pt-3 space-y-3">
                  <p className="text-xs text-gray-400 font-medium">Período personalizado</p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">De</label>
                    <input type="date" value={outroPeriodoInicio} onChange={e => setOutroPeriodoInicio(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Até</label>
                    <input type="date" value={outroPeriodoFim} onChange={e => setOutroPeriodoFim(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPeriodoDropOpen(false)}
                      className="flex-1 py-2 text-xs text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">
                      Cancelar
                    </button>
                    <button onClick={aplicarOutroPeriodo}
                      className="flex-1 py-2 text-xs text-white rounded-lg font-medium transition-all" style={{background: "#062C9B"}} onMouseEnter={e => e.currentTarget.style.background = "#041a4d"} onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}>
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Linha 4: busca + toggle + filtro colunas */}
         <div className="flex gap-0.5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder=""
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
           <button onClick={() => { setViewMode("list"); localStorage.setItem("os_viewmode","list"); }} className="px-3 py-2 transition-all" style={{background: viewMode==="list"?"#062C9B":"transparent",color:viewMode==="list"?"#fff":"#6b7280"}}><List className="w-5 h-5"/></button>
           <button onClick={() => { setViewMode("cards"); localStorage.setItem("os_viewmode","cards"); }} className="px-3 py-2 transition-all" style={{background: viewMode==="cards"?"#062C9B":"transparent",color:viewMode==="cards"?"#fff":"#6b7280"}}><LayoutGrid className="w-5 h-5"/></button>
          </div>
          <div className="relative" ref={filtroRef}>
            <button
              onClick={() => setShowColunasFilter(!showColunasFilter)}
              className="flex items-center justify-center gap-2 px-4 h-11 rounded-xl text-sm font-semibold transition-all bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"
            >
              <Settings className="w-4 h-4" /> Filtro
            </button>
            {showColunasFilter && (
              <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 z-50">
                <p className="text-xs text-gray-400 font-semibold mb-3 uppercase">Colunas da Lista</p>
                <div className="space-y-2">
                  {[
                    { key: 'cliente', label: 'Cliente' },
                    { key: 'contato', label: 'Contato' },
                    { key: 'veiculo', label: 'Veículo' },
                    { key: 'placa', label: 'Placa' },
                    { key: 'km', label: 'KM' },
                    { key: 'custo', label: 'Custo' },
                    { key: 'valor', label: 'Valor' },
                    { key: 'lucro', label: 'Lucro B.' },
                    { key: 'nfe', label: 'NFe/NFCe' },
                    { key: 'nfse', label: 'NFSe' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={colunasVisiveis[key]}
                        onChange={(e) => setColunasVisiveis(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-600 accent-blue-600"
                      />
                      <span className="text-sm text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
         </div>
         </div>

         {/* Alerta: Vendas com peças sem custo */}
         {vendasSemCusto.length > 0 && (
         <div className="rounded-xl overflow-hidden" style={{border: "1px solid #854d0e", background: "#1c1003"}}>
           <button
             onClick={() => setShowAlertaSemCusto(v => !v)}
             className="w-full flex items-center justify-between px-4 py-3 hover:bg-yellow-900/20 transition-all"
           >
             <div className="flex items-center gap-2">
               <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
               <span className="text-sm font-semibold text-yellow-400">
                 {vendasSemCusto.length} VENDA{vendasSemCusto.length > 1 ? "S" : ""} COM PEÇAS SEM CUSTO
               </span>
             </div>
             <ChevronDown className={`w-4 h-4 text-yellow-500 transition-transform ${showAlertaSemCusto ? "rotate-180" : ""}`} />
           </button>
           {showAlertaSemCusto && (
             <div style={{overflowX: "auto"}}>
               <table className="w-full min-w-[500px]" style={{borderTop: "1px solid #854d0e"}}>
                 <thead>
                   <tr style={{background: "#2a1800"}}>
                     <th className="text-left px-4 py-2 text-xs font-semibold text-yellow-600 uppercase">Nº</th>
                     <th className="text-left px-4 py-2 text-xs font-semibold text-yellow-600 uppercase">Data</th>
                     <th className="text-left px-4 py-2 text-xs font-semibold text-yellow-600 uppercase">Cliente</th>
                     <th className="text-left px-4 py-2 text-xs font-semibold text-yellow-600 uppercase">Peças Sem Custo</th>
                     <th className="text-left px-4 py-2 text-xs font-semibold text-yellow-600 uppercase">Ação</th>
                   </tr>
                 </thead>
                 <tbody>
                   {vendasSemCusto.map(o => {
                     const pecasSemCusto = (o.pecas || []).filter(p => !p.valor_custo || Number(p.valor_custo) === 0);
                     return (
                       <tr key={o.id} className="border-t" style={{borderColor: "#3d2000"}}>
                         <td className="px-4 py-2 text-sm font-bold text-yellow-300">#{o.numero}</td>
                         <td className="px-4 py-2 text-sm text-gray-300">{o.data_entrada ? o.data_entrada.split("-").reverse().join("/") : "—"}</td>
                         <td className="px-4 py-2 text-sm text-gray-200">{o.cliente_nome || "—"}</td>
                         <td className="px-4 py-2">
                           <div className="flex flex-wrap gap-1">
                             {pecasSemCusto.map((p, i) => (
                               <span key={i} className="px-2 py-0.5 rounded text-xs" style={{background: "#3d2000", color: "#fbbf24", border: "1px solid #854d0e"}}>
                                 {p.descricao || p.codigo || "Sem nome"}
                               </span>
                             ))}
                           </div>
                         </td>
                         <td className="px-4 py-2">
                           <button
                             onClick={() => { setEditando(o); setShowForm(true); }}
                             className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                             style={{background: "#062C9B", color: "#fff"}}
                           >
                             Editar
                           </button>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
           )}
         </div>
         )}

         {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-green-400" />
          </div>
          <p className="text-gray-400">Nenhuma Ordem de Venda encontrada</p>
        </div>
      ) : viewMode === "cards" ? (
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
          {filtradas.map(os => (
            <VendaCard key={os.id} os={os} clientes={clientes} notas={notas} onEdit={() => { setEditando(os); setShowForm(true); }} onDelete={() => excluir(os.id)} onRefresh={load} onUpdate={(dados) => atualizarOrdem(os.id, dados)} camposVisiveis={colunasVisiveis} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div style={{overflowX:'auto', overflowY:'visible'}}>
            <table className="w-full min-w-[700px]">
              <thead>
               <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-12 cursor-pointer hover:text-white transition-colors whitespace-nowrap" onClick={() => setOrderNumero(orderNumero === "asc" ? "desc" : "asc")}>Nº <span style={{fontSize:"14px",fontWeight:"900",color:"#60a5fa"}}>{orderNumero === "asc" ? "▲" : "▼"}</span></th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20 cursor-pointer hover:text-white transition-colors whitespace-nowrap" onClick={() => setOrderData(orderData === "asc" ? "desc" : "asc")}>Data <span style={{fontSize:"14px",fontWeight:"900",color:"#60a5fa"}}>{orderData === "asc" ? "▲" : "▼"}</span></th>
                  {colunasVisiveis.cliente && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider flex-1">Cliente</th>}
                  {colunasVisiveis.contato && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Contato</th>}
                  {colunasVisiveis.veiculo && filtroTipo.includes("patio") && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Veículo</th>}
                  {colunasVisiveis.placa && filtroTipo.includes("patio") && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">Placa</th>}
                  {colunasVisiveis.km && filtroTipo.includes("patio") && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">KM</th>}
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Status</th>
                  {colunasVisiveis.valor && <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Valor</th>}
                  {colunasVisiveis.custo && <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Custo</th>}
                  {colunasVisiveis.lucro && <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Lucro B.</th>}
                  {colunasVisiveis.nfe && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">NFe/NFCe</th>}
                  {colunasVisiveis.nfse && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">NFSe</th>}
                  <th className="px-4 py-2.5 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((os, idx) => (
                  <VendaRow
                    key={os.id}
                    os={os}
                    notas={notas}
                    clientes={clientes}
                    colunas={colunasVisiveis}
                    ocultarVeiculo={filtroTipo.includes("balcao") && !filtroTipo.includes("patio")}
                    onEdit={() => { setEditando(os); setShowForm(true); }}
                    onDelete={() => excluir(os.id)}
                    onRefresh={load}
                    onUpdate={(dados) => atualizarOrdem(os.id, dados)}
                    rowIndex={idx}
                    totalRows={filtradas.length}
                    getRowRef={(i) => rowRefs.current[i]}
                    registerRef={(i, ref) => { rowRefs.current[i] = ref; }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
       <VendaForm
           os={editando}
            clientes={clientes}
            onClose={() => { setShowForm(false); setEditando(null); }}
            onSave={(vendaSalva) => {
              setShowForm(false);
              setEditando(null);
              if (vendaSalva?.id) {
                setOrdens(prev => {
                  const exists = prev.find(o => o.id === vendaSalva.id);
                  if (exists) return prev.map(o => o.id === vendaSalva.id ? { ...o, ...vendaSalva } : o);
                  return [vendaSalva, ...prev];
                });
              } else {
                load();
              }
            }}
          />
      )}

      {showEmissaoMassa && (
        <ModalEmissaoMassa
          ordens={ordensParaMassa}
          notas={notas}
          clientes={clientes}
          onClose={() => setShowEmissaoMassa(false)}
          onConcluido={(notasFrescas) => { setShowEmissaoMassa(false); if (notasFrescas) setNotas(notasFrescas); else load(); }}
        />
      )}
    </div>
  );
}