import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, MessageCircle, Printer, X, ChevronDown } from "lucide-react";
import OSForm from "@/components/os/OSForm";
import OSCard from "@/components/os/OSCard";

const PERIODOS_OS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes_atual", label: "Mês" },
  { key: "ano_atual", label: "Ano" },
  { key: "tudo", label: "Tudo" },
];

function getPeriodoRangeOS(key) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const dia = hoje.getDate();
  const todayStr = hoje.toISOString().split("T")[0];
  const pad = n => String(n).padStart(2, "0");
  if (key === "hoje") return { inicio: todayStr, fim: todayStr };
  if (key === "semana") {
    const primeiro = new Date(hoje);
    primeiro.setDate(dia - hoje.getDay());
    const ultimo = new Date(primeiro);
    ultimo.setDate(primeiro.getDate() + 6);
    return { inicio: primeiro.toISOString().split("T")[0], fim: ultimo.toISOString().split("T")[0] };
  }
  if (key === "mes_atual") return { inicio: `${ano}-${pad(mes + 1)}-01`, fim: `${ano}-${pad(mes + 1)}-31` };
  if (key === "ano_atual") return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  return null;
}

export default function OrdemServico() {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Tudo");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState(() => localStorage.getItem("os_periodo") || "mes_atual");
  const [outroPeriodoOpen, setOutroPeriodoOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const [customRange, setCustomRange] = useState(null);
  const outroPeriodoRef = useRef(null);

  const setPeriodo = (key) => {
    setFiltroPeriodo(key);
    setCustomRange(null);
    localStorage.setItem("os_periodo", key);
  };

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    setCustomRange({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
    setFiltroPeriodo("outro");
    setOutroPeriodoOpen(false);
  };

  const statusList = ["Aberta", "Concluída", "Cancelada", "Tudo"];

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

  const periodoRange = filtroPeriodo === "outro" ? customRange : getPeriodoRangeOS(filtroPeriodo);

  const filtradas = ordens
    .filter(o => {
      const matchSearch = !search ||
        o.numero?.toLowerCase().includes(search.toLowerCase()) ||
        o.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
        o.veiculo_placa?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus === "Tudo" || o.status === filtroStatus;
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
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" /> Nova OS
        </button>

        {/* Linha 2: filtro status */}
        <div className="flex gap-2">
          {statusList.map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroStatus === s ? "bg-orange-500 text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Linha 3: filtro período */}
        <div className="flex gap-2 flex-wrap">
          {PERIODOS_OS.map(p => (
            <button key={p.key} onClick={() => setPeriodo(p.key)}
              className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${filtroPeriodo === p.key ? "bg-orange-500 text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Linha 4: busca */}
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por OS, cliente, placa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-gray-400 mb-4">Nenhuma Ordem de Serviço encontrada</p>
          <button onClick={() => setShowForm(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
            Criar primeira OS
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map(os => (
            <OSCard
              key={os.id}
              os={os}
              clientes={clientes}
              veiculos={veiculos}
              onEdit={() => { setEditando(os); setShowForm(true); }}
              onDelete={() => excluir(os.id)}
              onRefresh={load}
            />
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