import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, MessageCircle, Printer, X, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, FileText } from "lucide-react";
import ModalEmissaoMassa from "@/components/notas/ModalEmissaoMassa";
import OSForm from "@/components/os/OSForm";
import OSCard from "@/components/os/OSCard";
import OSListRow from "@/components/os/OSListRow";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function OrdemServico() {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState(() => {
    const saved = localStorage.getItem("os_filtroStatus");
    return saved ? JSON.parse(saved) : [];
  });
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showEmissaoMassa, setShowEmissaoMassa] = useState(false);
  const [notas, setNotas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("os_viewmode") || "cards");

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
  useEffect(() => { localStorage.setItem("os_filtroMes", filtroMes); }, [filtroMes]);
  useEffect(() => { localStorage.setItem("os_filtroAno", filtroAno); }, [filtroAno]);
  useEffect(() => { localStorage.setItem("os_usandoOutroPeriodo", usandoOutroPeriodo); }, [usandoOutroPeriodo]);
  useEffect(() => { localStorage.setItem("os_outroPeriodoInicio", outroPeriodoInicio); }, [outroPeriodoInicio]);
  useEffect(() => { localStorage.setItem("os_outroPeriodoFim", outroPeriodoFim); }, [outroPeriodoFim]);
  useEffect(() => { localStorage.setItem("os_customRange", JSON.stringify(customRange)); }, [customRange]);

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
    } else if (tipo === 'semana') {
      const dow = hoje.getDay();
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow);
      const fim = new Date(hoje); fim.setDate(hoje.getDate() + (6 - dow));
      setCustomRange({ inicio: fmt(ini), fim: fmt(fim) });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'mes') {
      setUsandoOutroPeriodo(false);
      setCustomRange(null);
      setFiltroMes(hoje.getMonth() + 1);
      setFiltroAno(hoje.getFullYear());
    } else if (tipo === 'ano') {
      setCustomRange({ inicio: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` });
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
    setFiltroStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [o, c, v, n] = await Promise.all([
      base44.entities.OrdemServico.list("-created_date", 200),
      base44.entities.Cliente.list("-created_date", 200),
      base44.entities.Veiculo.list("-created_date", 500),
      base44.entities.NotaFiscal.list("-created_date", 500),
    ]);
    setOrdens(o);
    setClientes(c);
    setVeiculos(v);
    setNotas(n);
    setLoading(false);
  };

  const excluir = async (id) => {
    if (!confirm("Excluir esta Ordem de Serviço?")) return;
    await base44.entities.OrdemServico.delete(id);
    load();
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
        o.veiculo_placa?.toLowerCase().includes(s) ||
        o.veiculo_modelo?.toLowerCase().includes(s);
      const matchStatus = filtroStatus.length === 0 || filtroStatus.includes(o.status);
      // Se há busca por texto, ignora filtro de período para encontrar qualquer OS
      const matchPeriodo = search.trim() ? true : (!periodoRange || (o.data_entrada && o.data_entrada >= periodoRange.inicio && o.data_entrada <= periodoRange.fim));
      return matchSearch && matchStatus && matchPeriodo;
    })
    .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

  if (loading) return <Loader />;

  const ordensParaMassa = filtradas;

  return (
    <div className="space-y-4">
      {/* Controles — mesmo padrão do Financeiro */}
      <div className="flex flex-col gap-2">
        {/* Linha 1: Nova OS — ocupa linha toda */}
        <div className="flex gap-2">
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
        <div className="flex gap-2">
          {["Aberto", "Orçamento", "Concluído"].map(s => (
            <button key={s} onClick={() => toggleStatus(s)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroStatus.includes(s) ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Linha 3: filtro período */}
        <div className="flex gap-2 items-center">
          <div className={`flex-1 flex items-center h-11 rounded-xl text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>  
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="flex-1 text-center truncate">{MESES[filtroMes - 1]} - {filtroAno}</span>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="relative flex-1" ref={periodoDropRef}>
            <button
              onClick={() => setPeriodoDropOpen(v => !v)}
              className={`w-full flex items-center justify-center gap-2 px-4 h-11 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}
            >
              {usandoOutroPeriodo && customRange ? `${customRange.inicio.split("-").reverse().join("/")} — ${customRange.fim.split("-").reverse().join("/")}` : "Período"}
              <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${periodoDropOpen ? "rotate-180" : ""}`} />
            </button>
            {periodoDropOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 space-y-3">
                <p className="text-xs text-gray-400 font-medium">Atalhos</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['hoje','Hoje'],['semana','Semana'],['mes','Mês Atual'],['ano','Ano Inteiro']].map(([tipo, label]) => (
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
                      className="flex-1 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all">
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Linha 4: busca + toggle */}
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-green-400" />
          </div>
          <p className="text-gray-400">Nenhuma Ordem de Venda encontrada</p>
        </div>
      ) : viewMode === "cards" ? (
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         {filtradas.map(os => (
           <OSCard key={os.id} os={os} clientes={clientes} veiculos={veiculos} notas={notas} onEdit={() => { setEditando(os); setShowForm(true); }} onDelete={() => excluir(os.id)} onRefresh={load} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">OS</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Veículo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Placa</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">KM</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Data</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Pagamento</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Valor</th>
                  <th className="px-4 py-2.5 w-36"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(os => (
                  <OSListRow
                    key={os.id}
                    os={os}
                    notas={notas}
                    onEdit={() => { setEditando(os); setShowForm(true); }}
                    onDelete={() => excluir(os.id)}
                    onRefresh={load}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <OSForm
          os={editando}
          clientes={clientes}
          veiculos={veiculos}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSave={() => { setShowForm(false); setEditando(null); load(); }}
        />
      )}

      {showEmissaoMassa && (
        <ModalEmissaoMassa
          ordens={ordensParaMassa}
          onClose={() => setShowEmissaoMassa(false)}
          onConcluido={() => { setShowEmissaoMassa(false); load(); }}
        />
      )}
    </div>
  );
}

function Loader() { return null; }