import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, MessageCircle, Printer, X, ChevronDown } from "lucide-react";
import OSForm from "@/components/os/OSForm";
import OSCard from "@/components/os/OSCard";

export default function OrdemServico() {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);

  const statusList = ["Todos", "Em Aberto", "Concluída", "Cancelada"];

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

  const filtradas = ordens.filter(o => {
    const matchSearch = !search ||
      o.numero?.toLowerCase().includes(search.toLowerCase()) ||
      o.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      o.veiculo_placa?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "Todos" || o.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por OS, cliente, placa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        <button
          onClick={() => { setShowForm(true); setEditando(null); }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" /> Nova OS
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {statusList.map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filtroStatus === s
                ? "bg-orange-500 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
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
        <div className="space-y-3">
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