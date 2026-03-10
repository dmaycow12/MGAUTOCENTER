import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, MessageCircle, Printer, X, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import OSForm from "@/components/os/OSForm";
import OSCard from "@/components/os/OSCard";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function OrdemServico() {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState([]); // multi-select
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("os_viewmode") || "cards");

  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState(hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(false);
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const [customRange, setCustomRange] = useState(null);
  const periodoDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) setPeriodoDropOpen(false);
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
    const [o, c, v] = await Promise.all([
      base44.entities.OrdemServico.list("-created_date", 200),
      base44.entities.Cliente.list("-created_date", 200),
      base44.entities.Veiculo.list("-created_date", 500),
    ]);
    setOrdens(o);
    setClientes(c);
    setVeiculos(v);
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
      const matchSearch = !search ||
        o.numero?.toLowerCase().includes(search.toLowerCase()) ||
        o.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
        o.veiculo_placa?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus.length === 0 || filtroStatus.includes(o.status);
      const matchPeriodo = !periodoRange || (o.data_entrada && o.data_entrada >= periodoRange.inicio && o.data_entrada <= periodoRange.fim);
      return matchSearch && matchStatus && matchPeriodo;
    })
    .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Controles — mesmo padrão do Financeiro */}
      <div className="flex flex-col gap-2">
        {/* Linha 1: Nova OS — ocupa linha toda */}
        <button
          onClick={() => { setShowForm(true); setEditando(null); }}
          className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl text-sm font-semibold transition-all"
          style={{background: "#00ff00", color: "#000"}}
          onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
          onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
        >
          <Plus className="w-4 h-4" /> Nova OS
        </button>

        {/* Linha 2: filtro status — multi-select */}
        <div className="flex gap-2">
          {["Aberto", "Orçamento", "Concluído"].map(s => (
            <button key={s} onClick={() => toggleStatus(s)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroStatus.includes(s) ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Linha 3: filtro período — mesmo padrão do Financeiro */}
        <div className="flex gap-2 items-center">
          <div className={`flex-1 flex items-center h-11 rounded-xl text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-4 transition-all flex-shrink-0 hover:bg-white/20" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="flex-1 text-center truncate">{MESES[filtroMes - 1]} - {filtroAno}</span>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-4 transition-all flex-shrink-0 hover:bg-white/20" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronRight className="w-5 h-5" />
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
                <p className="text-xs text-gray-400 font-medium">Selecione o período</p>
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
            )}
          </div>
        </div>

        {/* Linha 4: busca + toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por OS, cliente, placa..."
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
          <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-gray-400 mb-4">Nenhuma Ordem de Serviço encontrada</p>
          <button onClick={() => setShowForm(true)} className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
            Criar primeira OS
          </button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map(os => (
            <OSCard key={os.id} os={os} clientes={clientes} veiculos={veiculos} onEdit={() => { setEditando(os); setShowForm(true); }} onDelete={() => excluir(os.id)} onRefresh={load} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {filtradas.map(os => (
            <div key={os.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">OS #{os.numero} — {os.cliente_nome || "—"}</p>
                <p className="text-gray-500 text-xs">{os.veiculo_placa || "—"} {os.veiculo_modelo ? `• ${os.veiculo_modelo}` : ""} {os.data_entrada ? `• ${os.data_entrada}` : ""}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${os.status==="Concluído"?"bg-green-500/10 text-green-400":os.status==="Orçamento"?"bg-yellow-500/10 text-yellow-400":"bg-blue-500/10 text-blue-400"}`}>{os.status}</span>
              <span className="text-orange-400 font-bold text-sm">R$ {Number(os.valor_total||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
              <div className="flex gap-1">
                <button onClick={() => { setEditando(os); setShowForm(true); }} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-700 transition-all"><Edit className="w-4 h-4"/></button>
                <button onClick={() => excluir(os.id)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-all"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))}
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
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
}