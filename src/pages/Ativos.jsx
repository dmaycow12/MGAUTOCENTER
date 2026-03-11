import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Pencil, Trash2, Camera, X, Image, ChevronDown, Check, LayoutGrid, List } from "lucide-react";

const DEFAULT_CATEGORIAS = ["Equipamento", "Ferramenta", "Veículo", "Imóvel", "Mobiliário", "Eletrônico", "Outro"];

function getCategorias() {
  try {
    const s = localStorage.getItem("ativos_categorias");
    return s ? JSON.parse(s) : DEFAULT_CATEGORIAS;
  } catch { return DEFAULT_CATEGORIAS; }
}

function saveCategorias(cats) {
  localStorage.setItem("ativos_categorias", JSON.stringify(cats));
}

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Ativos() {
  const [ativos, setAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalhando, setDetalhando] = useState(null);
  const [categorias, setCategorias] = useState(getCategorias());
  const [novaCategoria, setNovaCategoria] = useState("");
  const [editandoCategoria, setEditandoCategoria] = useState(null);
  const [editNomeCategoria, setEditNomeCategoria] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "list"
  const dropdownRef = useRef(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const load = async () => {
    const data = await base44.entities.Ativo.list("-created_date", 500);
    setAtivos(data);
    setLoading(false);
  };

  const excluir = async (id) => {
    if (!confirm("Excluir este ativo?")) return;
    await base44.entities.Ativo.delete(id);
    load();
  };

  const atualizarCategorias = (cats) => {
    setCategorias(cats);
    saveCategorias(cats);
  };

  const adicionarCategoria = () => {
    const nova = novaCategoria.trim();
    if (!nova || categorias.includes(nova)) return;
    atualizarCategorias([...categorias, nova]);
    setNovaCategoria("");
  };

  const renomearCategoria = (catAntiga, novoNome) => {
    const novo = novoNome.trim();
    if (!novo || categorias.includes(novo)) return;
    atualizarCategorias(categorias.map(c => c === catAntiga ? novo : c));
    if (filtroCategoria === catAntiga) setFiltroCategoria(novo);
    setEditandoCategoria(null);
  };

  const filtrados = ativos.filter(a => {
    const matchSearch = !search || a.nome?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filtroCategoria === "Todas" || a.categoria === filtroCategoria;
    return matchSearch && matchCat;
  });

  const totalValorAtual = filtrados.reduce((acc, a) => acc + Number(a.valor_atual || 0), 0);
  const totalValorCompra = filtrados.reduce((acc, a) => acc + Number(a.valor_aquisicao || 0) * Number(a.quantidade || 1), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#cc0000", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Botão novo */}
      <button
        onClick={() => { setEditando(null); setShowForm(true); }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
        style={{ background: "#00ff00", color: "#fff" }}
        onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
        onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
      >
        <Plus className="w-4 h-4" /> Novo Ativo
      </button>

      {/* Filtro Categoria - botão grande dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-xl text-base font-semibold transition-all border"
          style={{
            background: filtroCategoria !== "Todas" ? "#062C9B" : "#1f2937",
            color: "#fff",
            borderColor: filtroCategoria !== "Todas" ? "#062C9B" : "#374151"
          }}
        >
          <span>{filtroCategoria === "Todas" ? "Todas as Categorias" : filtroCategoria}</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl z-20 shadow-xl overflow-hidden">
            {/* Opção "Todas" */}
            <button
              onClick={() => { setFiltroCategoria("Todas"); setDropdownOpen(false); }}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-800 transition-all text-left"
              style={{ color: filtroCategoria === "Todas" ? "#00ff00" : "#d1d5db" }}
            >
              <span>Todas as Categorias</span>
              {filtroCategoria === "Todas" && <Check className="w-4 h-4" />}
            </button>

            {/* Categorias com edição inline */}
            {categorias.map(cat => (
              <div key={cat} className="flex items-center hover:bg-gray-800 transition-all">
                {editandoCategoria === cat ? (
                  <div className="flex-1 flex items-center gap-2 px-4 py-2">
                    <input
                      autoFocus
                      value={editNomeCategoria}
                      onChange={e => setEditNomeCategoria(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") renomearCategoria(cat, editNomeCategoria);
                        if (e.key === "Escape") setEditandoCategoria(null);
                      }}
                      className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      onClick={e => { e.stopPropagation(); renomearCategoria(cat, editNomeCategoria); }}
                      className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: "#00ff00", color: "#fff" }}
                    >OK</button>
                    <button onClick={e => { e.stopPropagation(); setEditandoCategoria(null); }} className="text-gray-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="flex-1 flex items-center justify-between px-4 py-3 text-sm text-left"
                      style={{ color: filtroCategoria === cat ? "#00ff00" : "#d1d5db" }}
                      onClick={() => { setFiltroCategoria(cat); setDropdownOpen(false); }}
                    >
                      <span>{cat}</span>
                      {filtroCategoria === cat && <Check className="w-4 h-4" />}
                    </button>
                    <button
                      className="pr-4 text-gray-600 hover:text-gray-300 transition-all"
                      onClick={e => { e.stopPropagation(); setEditandoCategoria(cat); setEditNomeCategoria(cat); }}
                      title="Renomear"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}

            {/* Acrescentar nova categoria */}
            <div className="border-t border-gray-700 px-4 py-3 flex gap-2">
              <input
                value={novaCategoria}
                onChange={e => setNovaCategoria(e.target.value)}
                onKeyDown={e => e.key === "Enter" && adicionarCategoria()}
                placeholder="Nova categoria..."
                className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500"
                onClick={e => e.stopPropagation()}
              />
              <button
                onClick={e => { e.stopPropagation(); adicionarCategoria(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "#00ff00", color: "#fff" }}
              >+ Adicionar</button>
            </div>
          </div>
        )}
      </div>

      {/* Busca + Toggle de visualização */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar ativo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        {/* Toggle cards/lista */}
        <div className="flex bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className="px-3 py-2 transition-all"
            style={{ background: viewMode === "list" ? "#062C9B" : "transparent", color: viewMode === "list" ? "#fff" : "#6b7280" }}
            title="Lista"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className="px-3 py-2 transition-all"
            style={{ background: viewMode === "cards" ? "#062C9B" : "transparent", color: viewMode === "cards" ? "#fff" : "#6b7280" }}
            title="Cards"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs">Ativos</p>
          <p className="text-green-400 font-bold text-lg">{filtrados.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs">Valor de Compra</p>
          <p className="text-red-400 font-bold text-sm">{fmt(totalValorCompra)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs">Valor Atual</p>
          <p className="text-orange-400 font-bold text-sm">{fmt(totalValorAtual)}</p>
        </div>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">Nenhum ativo cadastrado</p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(ativo => (
            <AtivoCard
              key={ativo.id}
              ativo={ativo}
              onEdit={() => { setEditando(ativo); setShowForm(true); }}
              onDelete={() => excluir(ativo.id)}
              onDetalhe={() => setDetalhando(ativo)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(ativo => (
            <AtivoRow
              key={ativo.id}
              ativo={ativo}
              onEdit={() => { setEditando(ativo); setShowForm(true); }}
              onDelete={() => excluir(ativo.id)}
              onDetalhe={() => setDetalhando(ativo)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AtivoForm
          ativo={editando}
          categorias={categorias}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSave={() => { setShowForm(false); setEditando(null); load(); }}
        />
      )}

      {detalhando && (
        <AtivoDetalhe ativo={detalhando} onClose={() => setDetalhando(null)} onEdit={() => { setEditando(detalhando); setDetalhando(null); setShowForm(true); }} />
      )}
    </div>
  );
}

function AtivoCard({ ativo, onEdit, onDelete, onDetalhe }) {
  const foto = ativo.fotos?.[0];
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all cursor-pointer" onClick={onDetalhe}>
      <div className="h-36 bg-gray-800 flex items-center justify-center overflow-hidden">
        {foto ? (
          <img src={foto} alt={ativo.nome} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <Image className="w-10 h-10" />
            <span className="text-xs">Sem foto</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{ativo.nome || "—"}</p>
          <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded">{ativo.categoria || "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs">Valor de Compra</p>
            <span className="text-red-400 font-black text-base">{fmt(ativo.valor_aquisicao)}</span>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs">Valor Atual</p>
            <span className="text-green-400 font-black text-base">{fmt(ativo.valor_atual)}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="flex-1 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg flex items-center justify-center gap-1 transition-all hover:bg-gray-800">
            <Pencil className="w-3 h-3" /> Editar
          </button>
          <button onClick={onDelete} className="py-1.5 px-3 text-xs text-red-400 hover:text-red-300 border border-gray-700 rounded-lg transition-all hover:bg-gray-800">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AtivoRow({ ativo, onEdit, onDelete, onDetalhe }) {
  const foto = ativo.fotos?.[0];
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-3 px-4 py-3 hover:border-gray-700 transition-all cursor-pointer" onClick={onDetalhe}>
      <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <Image className="w-5 h-5 text-gray-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{ativo.nome || "—"}</p>
        <p className="text-gray-500 text-xs">{ativo.categoria || "—"} {ativo.data_aquisicao ? `• ${fmtData(ativo.data_aquisicao)}` : ""}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-red-400 font-black text-sm">{fmt(ativo.valor_aquisicao)}</p>
        <p className="text-green-400 font-black text-sm">{fmt(ativo.valor_atual)}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-800 transition-all">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-all">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AtivoDetalhe({ ativo, onClose, onEdit }) {
  const [fotoIdx, setFotoIdx] = useState(0);
  const fotos = ativo.fotos || [];
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{ativo.nome}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>
        {fotos.length > 0 && (
          <div className="relative">
            <img src={fotos[fotoIdx]} alt="" className="w-full h-56 object-cover" />
            {fotos.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {fotos.map((_, i) => (
                  <button key={i} onClick={() => setFotoIdx(i)} className="w-2 h-2 rounded-full transition-all"
                    style={{ background: i === fotoIdx ? "#f97316" : "#6b7280" }} />
                ))}
              </div>
            )}
          </div>
        )}
        <div className="p-5 space-y-3">
          <span className="text-gray-500 text-xs">{ativo.categoria}</span>
          <div className="grid grid-cols-2 gap-3">
            {ativo.data_aquisicao && <Info label="Aquisição" value={fmtData(ativo.data_aquisicao)} />}
            {ativo.valor_aquisicao > 0 && <Info label="Valor de Compra" value={fmt(ativo.valor_aquisicao)} />}
            {ativo.valor_atual > 0 && <Info label="Valor Atual" value={fmt(ativo.valor_atual)} />}
          </div>
          {ativo.observacoes && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Observações</p>
              <p className="text-gray-300 text-sm">{ativo.observacoes}</p>
            </div>
          )}
          <button onClick={onEdit} className="w-full py-2.5 text-sm text-white rounded-xl font-medium transition-all" style={{ background: "#cc0000" }}
            onMouseEnter={e => e.currentTarget.style.background = "#aa0000"}
            onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
            Editar Ativo
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-white text-sm font-medium">{value}</p>
    </div>
  );
}

function AtivoForm({ ativo, categorias, onClose, onSave }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [form, setForm] = useState(ativo ? { ...ativo } : {
    nome: "",
    categoria: categorias[0] || "Equipamento",
    data_aquisicao: "",
    valor_aquisicao: 0,
    valor_atual: 0,
    fotos: [],
    observacoes: "",
  });

  const handleFotoUpload = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, fotos: [...(f.fotos || []), file_url] }));
    setUploadingFoto(false);
  };

  const removerFoto = (idx) => {
    setForm(f => ({ ...f, fotos: f.fotos.filter((_, i) => i !== idx) }));
  };

  const salvar = async () => {
    if (!form.nome) return alert("Informe o nome do ativo.");
    setSaving(true);
    if (ativo) {
      await base44.entities.Ativo.update(ativo.id, form);
    } else {
      await base44.entities.Ativo.create(form);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{ativo ? "Editar Ativo" : "Novo Ativo"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Fotos */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Fotos</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(form.fotos || []).map((foto, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group">
                  <img src={foto} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removerFoto(i)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              ))}
              {uploadingFoto && (
                <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                <Camera className="w-4 h-4" /> Câmera
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                <Image className="w-4 h-4" /> Galeria
              </button>
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleFotoUpload(e.target.files[0])} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleFotoUpload(e.target.files[0])} />
          </div>

          <F label="Nome do Ativo *">
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="input-dark" placeholder="Ex: Moto Bros 160" />
          </F>

          <F label="Categoria">
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="input-dark">
              {categorias.map(c => <option key={c}>{c}</option>)}
            </select>
          </F>

          <div className="grid grid-cols-2 gap-3">
            <F label="Data de Aquisição">
              <input type="date" value={form.data_aquisicao} onChange={e => setForm(f => ({ ...f, data_aquisicao: e.target.value }))} className="input-dark" />
            </F>
            <div />
            <F label="Valor de Compra (R$)">
              <input type="number" value={form.valor_aquisicao} onChange={e => setForm(f => ({ ...f, valor_aquisicao: Number(e.target.value) }))} className="input-dark" />
            </F>
            <F label="Valor Atual (R$)">
              <input type="number" value={form.valor_atual} onChange={e => setForm(f => ({ ...f, valor_atual: Number(e.target.value) }))} className="input-dark" />
            </F>
          </div>

          <F label="Observações">
            <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className="input-dark" rows={3} />
          </F>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-all">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all disabled:opacity-50"
            style={{ background: "#cc0000" }}
            onMouseEnter={e => e.currentTarget.style.background = "#aa0000"}
            onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
            {saving ? "Salvando..." : ativo ? "Salvar" : "Cadastrar Ativo"}
          </button>
        </div>
      </div>
      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; }`}</style>
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