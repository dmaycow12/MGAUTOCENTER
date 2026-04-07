import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Pencil, Trash2, X, LayoutGrid, List } from "lucide-react";

const defaultForm = () => ({ codigo: "", descricao: "", categoria: "", valor: 0, observacoes: "" });

export default function Servicos() {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("servicos_viewmode") || "list");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await base44.entities.Servico.list("-created_date", 500);
    setItens(data);
    setLoading(false);
  };

  const abrirNovo = () => { setForm(defaultForm()); setEditando(null); setShowForm(true); };
  const abrirEditar = (item) => { setForm({ ...item }); setEditando(item); setShowForm(true); };

  const salvar = async () => {
    if (!form.descricao) return alert("Informe a descrição do serviço.");
    setSaving(true);
    if (editando) {
      await base44.entities.Servico.update(editando.id, form);
    } else {
      await base44.entities.Servico.create(form);
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const excluir = async (id) => {
    if (!confirm("Excluir este serviço?")) return;
    await base44.entities.Servico.delete(id);
    load();
  };

  const filtrados = itens.filter(i =>
    !search ||
    i.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    i.descricao?.toLowerCase().includes(search.toLowerCase()) ||
    i.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return null;

  return (
    <div className="space-y-4">
      {/* Botão Novo */}
      <button
        onClick={abrirNovo}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
        style={{background: "#00ff00", color: "#fff"}}
        onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
        onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
      >
        <Plus className="w-4 h-4" /> Novo Serviço
      </button>

      {/* Busca + Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar serviço..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <button onClick={() => { setViewMode("list"); localStorage.setItem("servicos_viewmode","list"); }} className="px-3 py-2 transition-all" style={{background:viewMode==="list"?"#062C9B":"transparent",color:viewMode==="list"?"#fff":"#6b7280"}}><List className="w-5 h-5"/></button>
          <button onClick={() => { setViewMode("cards"); localStorage.setItem("servicos_viewmode","cards"); }} className="px-3 py-2 transition-all" style={{background:viewMode==="cards"?"#062C9B":"transparent",color:viewMode==="cards"?"#fff":"#6b7280"}}><LayoutGrid className="w-5 h-5"/></button>
        </div>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-gray-400 mb-4">Nenhum serviço encontrado</p>
          <button onClick={abrirNovo} className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
            Cadastrar primeiro serviço
          </button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map(item => (
            <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm">{item.descricao}</p>
                  {item.codigo && <p className="text-orange-400 font-mono text-xs">{item.codigo}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => abrirEditar(item)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5"/></button>
                  <button onClick={() => excluir(item.id)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>
              <p className="text-green-400 font-bold text-sm">{Number(item.valor||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>
              {item.observacoes && <p className="text-gray-500 text-xs truncate">{item.observacoes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[100px_1fr_120px_80px] gap-4 px-4 py-2 border-b border-gray-800 text-xs text-gray-500 font-medium">
            <span>Código</span><span>Descrição</span><span>Valor</span><span className="text-right">Ações</span>
          </div>
          {filtrados.map(item => (
            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_120px_80px] gap-2 sm:gap-4 px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-all items-center">
              <span className="text-orange-400 font-mono text-sm">{item.codigo || "—"}</span>
              <div>
                <p className="text-white text-sm font-medium">{item.descricao}</p>
                {item.observacoes && <p className="text-gray-500 text-xs mt-0.5 truncate">{item.observacoes}</p>}
              </div>
              <span className="text-green-400 text-sm font-medium">{Number(item.valor||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span>
              <div className="flex items-center gap-2 sm:justify-end">
                <button onClick={() => abrirEditar(item)} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-gray-700 rounded-lg transition-all"><Pencil className="w-4 h-4"/></button>
                <button onClick={() => excluir(item.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-all"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">{editando ? "Editar Serviço" : "Novo Serviço"}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <style>{`.inp { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .inp:focus { border-color:#f97316; } .inp::placeholder { color:#6b7280; }`}</style>
              <F label="Código"><input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} className="inp" placeholder="Ex: SRV001" /></F>
              <F label="Descrição *"><input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="inp" placeholder="Nome do serviço" /></F>
              <F label="Descrição"><input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="inp" placeholder="Ex: Mecânica, Elétrica..." /></F>
              <F label="Valor (R$)"><input type="text" inputMode="decimal" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} className="inp" placeholder="0,00" /></F>
              <F label="Observações"><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className="inp" rows={2} /></F>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-white rounded-lg transition-all font-medium" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>Cancelar</button>
              <button onClick={salvar} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all disabled:opacity-50" style={{background: "#062C9B"}} onMouseEnter={e => !saving && (e.currentTarget.style.background = "#041a4d")} onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}>
                {saving ? "Salvando..." : editando ? "Salvar Alterações" : "Cadastrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Loader() { return null; }