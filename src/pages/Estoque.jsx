import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, X, TrendingUp } from "lucide-react";

const defaultForm = () => ({
  codigo: "", descricao: "", categoria: "", marca: "",
  quantidade: "", estoque_minimo: "", valor_custo: "", valor_venda: "",
  localizacao: "", fornecedor: "", ncm: "87089990", cfop: "5405", observacoes: ""
});

export default function Estoque() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [filtro, setFiltro] = useState("Todos");
  const [showReajuste, setShowReajuste] = useState(false);
  const [reajusteGrupo, setReajusteGrupo] = useState("Todos");
  const [reajusteTipo, setReajusteTipo] = useState("percentual");
  const [reajusteValor, setReajusteValor] = useState("");
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await base44.entities.Estoque.list("-created_date", 500);
    setItems(data);
    setLoading(false);
  };

  const salvar = async () => {
    if (!form.descricao) return alert("Informe a descrição.");
    if (editando) {
      await base44.entities.Estoque.update(editando.id, form);
    } else {
      await base44.entities.Estoque.create(form);
    }
    setShowForm(false);
    setEditando(null);
    setForm(defaultForm());
    load();
  };

  const excluir = async (id) => {
    if (!confirm("Excluir este item?")) return;
    await base44.entities.Estoque.delete(id);
    load();
  };

  const editar = (item) => {
    setForm({ ...defaultForm(), ...item });
    setEditando(item);
    setShowForm(true);
  };

  const filtrados = items.filter(i => {
    const matchSearch = !search ||
      i.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      i.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      i.categoria?.toLowerCase().includes(search.toLowerCase()) ||
      i.marca?.toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === "Todos" || (filtro === "Estoque Baixo" && i.quantidade <= i.estoque_minimo);
    return matchSearch && matchFiltro;
  });

  const estoqueBaixo = items.filter(i => i.quantidade <= i.estoque_minimo).length;
  const grupos = ["Todos", ...Array.from(new Set(items.map(i => i.categoria).filter(Boolean)))];

  const aplicarReajuste = async () => {
    if (!reajusteValor || Number(reajusteValor) <= 0) return alert("Informe um valor válido.");
    const alvo = reajusteGrupo === "Todos" ? items : items.filter(i => i.categoria === reajusteGrupo);
    if (!confirm(`Reajustar preço de venda de ${alvo.length} produto(s)?`)) return;
    setAplicando(true);
    for (const item of alvo) {
      const novoPreco = reajusteTipo === "percentual"
        ? Number(item.valor_venda || 0) * (1 + Number(reajusteValor) / 100)
        : Number(item.valor_venda || 0) + Number(reajusteValor);
      await base44.entities.Estoque.update(item.id, { valor_venda: Math.max(0, parseFloat(novoPreco.toFixed(2))) });
    }
    setAplicando(false);
    setShowReajuste(false);
    setReajusteValor("");
    load();
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs">Total de Itens</p>
          <p className="text-2xl font-bold text-white mt-1">{items.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs">Estoque Baixo</p>
          <p className={`text-2xl font-bold mt-1 ${estoqueBaixo > 0 ? "text-red-400" : "text-green-400"}`}>{estoqueBaixo}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs">Valor Total (Custo)</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">
            R$ {items.reduce((acc, i) => acc + (i.quantidade * i.valor_custo || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs">Valor Total (Venda)</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            R$ {items.reduce((acc, i) => acc + (i.quantidade * i.valor_venda || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar item..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={() => setFiltro(filtro === "Estoque Baixo" ? "Todos" : "Estoque Baixo")}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-all ${filtro === "Estoque Baixo" ? "bg-red-500 text-white" : "bg-gray-800 border border-gray-700 text-gray-400"}`}
          >
            <AlertTriangle className="w-4 h-4" /> Baixo
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReajuste(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <TrendingUp className="w-4 h-4" /> Reajustar Preços
          </button>
          <button
            onClick={() => { setShowForm(true); setEditando(null); setForm(defaultForm()); }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" /> Novo Item
          </button>
        </div>
      </div>

      {/* Modal Reajuste */}
      {showReajuste && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-400" /> Reajustar Preço de Venda</h2>
              <button onClick={() => setShowReajuste(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <F label="Grupo / Categoria">
                <select value={reajusteGrupo} onChange={e => setReajusteGrupo(e.target.value)} className="input-dark">
                  {grupos.map(g => <option key={g}>{g}</option>)}
                </select>
              </F>
              <F label="Tipo de reajuste">
                <div className="flex gap-2">
                  <button onClick={() => setReajusteTipo("percentual")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${reajusteTipo === "percentual" ? "bg-blue-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-400"}`}>
                    % Percentual
                  </button>
                  <button onClick={() => setReajusteTipo("fixo")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${reajusteTipo === "fixo" ? "bg-blue-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-400"}`}>
                    R$ Valor Fixo
                  </button>
                </div>
              </F>
              <F label={reajusteTipo === "percentual" ? "Percentual de aumento (%)" : "Valor a acrescentar (R$)"}>
                <input type="number" step="0.01" min="0" value={reajusteValor} onChange={e => setReajusteValor(e.target.value)} className="input-dark" placeholder={reajusteTipo === "percentual" ? "Ex: 10" : "Ex: 5.00"} />
              </F>
              <p className="text-xs text-gray-500">
                Serão reajustados: <span className="text-white font-medium">{reajusteGrupo === "Todos" ? items.length : items.filter(i => i.categoria === reajusteGrupo).length} produto(s)</span>
              </p>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowReajuste(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={aplicarReajuste} disabled={aplicando} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50">
                {aplicando ? "Aplicando..." : "Aplicar Reajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum item encontrado</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800 bg-gray-900/80">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 hidden md:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-center">Qtd</th>
                  <th className="px-4 py-3 text-center hidden sm:table-cell">Mín.</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Custo</th>
                  <th className="px-4 py-3 text-right">Venda</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(item => (
                  <tr key={item.id} className={`border-b border-gray-800 hover:bg-gray-800/50 transition-all ${item.quantidade <= item.estoque_minimo ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.codigo || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.quantidade <= item.estoque_minimo && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        <div>
                          <p className="text-white font-medium">{item.descricao}</p>
                          {item.marca && <p className="text-gray-500 text-xs">{item.marca}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{item.categoria || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${item.quantidade <= item.estoque_minimo ? "text-red-400" : "text-white"}`}>
                        {item.quantidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">{item.estoque_minimo}</td>
                    <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">R$ {Number(item.valor_custo || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-orange-400 font-medium">R$ {Number(item.valor_venda || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => editar(item)} className="p-1 text-gray-500 hover:text-blue-400 transition-all"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => excluir(item.id)} className="p-1 text-gray-500 hover:text-red-400 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">{editando ? "Editar Item" : "Novo Item de Estoque"}</h2>
              <button onClick={() => { setShowForm(false); setEditando(null); }}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Código"><input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className="input-dark" /></F>
                <F label="Quantidade"><input inputMode="decimal" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} className="input-dark no-arrows" placeholder="0" /></F>
                <F label="Descrição *" className="col-span-2">
                  <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="input-dark" />
                </F>
                <F label="Categoria"><input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="input-dark" /></F>
                <F label="Marca"><input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} className="input-dark" /></F>
                <F label="Estoque Mínimo">
                  <input inputMode="decimal" value={form.estoque_minimo} onChange={e => setForm({ ...form, estoque_minimo: e.target.value })} className="input-dark no-arrows" placeholder="0" />
                </F>
                <F label="Valor de Custo (R$)">
                  <input inputMode="decimal" value={form.valor_custo} onChange={e => setForm({ ...form, valor_custo: e.target.value })} className="input-dark no-arrows" placeholder="0,00" />
                </F>
                <F label="Valor de Venda (R$)">
                  <input inputMode="decimal" value={form.valor_venda} onChange={e => setForm({ ...form, valor_venda: e.target.value })} className="input-dark no-arrows" placeholder="0,00" />
                </F>
                <F label="Localização"><input value={form.localizacao} onChange={e => setForm({ ...form, localizacao: e.target.value })} className="input-dark" /></F>
                <F label="Fornecedor"><input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} className="input-dark" /></F>
              </div>

              {/* Dados Fiscais */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Dados Fiscais</p>
                <div className="grid grid-cols-2 gap-4">
                  <F label="NCM">
                    <input value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} className="input-dark" placeholder="87089990" maxLength={8} />
                  </F>
                  <F label="CFOP">
                    <input value={form.cfop} onChange={e => setForm({ ...form, cfop: e.target.value })} className="input-dark" placeholder="5405" maxLength={4} />
                  </F>
                </div>
              </div>

              <F label="Observações"><textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input-dark" rows={2} /></F>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={salvar} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all">
                {editando ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; } .no-arrows::-webkit-outer-spin-button, .no-arrows::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .no-arrows { -moz-appearance: textfield; }`}</style>
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