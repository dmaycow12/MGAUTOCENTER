import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Trash2, Edit, X, Check } from "lucide-react";

const TIPO_CORES = {
  entrada: { bg: "#00ff0022", color: "#00ff00", border: "#00ff0044", label: "ENTRADA" },
  saida: { bg: "#ef444422", color: "#ef4444", border: "#ef444444", label: "SAÍDA" },
  ajuste: { bg: "#f9731622", color: "#f97316", border: "#f9731644", label: "AJUSTE" },
};

// Normaliza o tipo removendo acentos e lowercase (para compatibilidade com dados antigos como "saída")
function normalizarTipo(tipo) {
  return String(tipo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function fmtData(str) {
  if (!str) return "—";
  const d = str.substring(0, 10).split("-");
  if (d.length !== 3) return str;
  return `${d[2]}/${d[1]}/${d[0]}`;
}

function fmtVal(v) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function MovimentacoesEstoque({ items, onReload }) {
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [selecionados, setSelecionados] = useState([]);
  const [deletando, setDeletando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Flatten all movements (excluir produto XX coringa)
  const todasMovimentacoes = useMemo(() => {
    const lista = [];
    for (const item of items) {
      if (item.codigo?.toUpperCase() === "XX") continue;
      const hist = Array.isArray(item.historico) ? item.historico : [];
      hist.forEach((mov, idx) => {
        lista.push({ itemId: item.id, produtoDescricao: item.descricao, produtoCodigo: item.codigo, movIdx: idx, mov });
      });
    }
    lista.sort((a, b) => {
      const da = a.mov.data || "";
      const db = b.mov.data || "";
      return db.localeCompare(da);
    });
    return lista;
  }, [items]);

  const filtradas = useMemo(() => {
    return todasMovimentacoes.filter(m => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        m.produtoDescricao?.toLowerCase().includes(q) ||
        m.produtoCodigo?.toLowerCase().includes(q) ||
        m.mov.fornecedor?.toLowerCase().includes(q) ||
        m.mov.observacao?.toLowerCase().includes(q) ||
        m.mov.ordem_venda_numero?.toLowerCase().includes(q);
      const tipoNorm = normalizarTipo(m.mov.tipo);
      const obsNorm = String(m.mov.observacao || "").toLowerCase();
      const isSaldoOuAjuste = tipoNorm === "ajuste" || obsNorm.includes("saldo inicial") || obsNorm.includes("ajuste");
      const matchTipo = filtroTipo === "Todos" ||
        (filtroTipo === "Ajuste" ? isSaldoOuAjuste : (tipoNorm === filtroTipo.toLowerCase() && !isSaldoOuAjuste));
      return matchSearch && matchTipo;
    });
  }, [todasMovimentacoes, search, filtroTipo]);

  const chaveUnica = (m) => `${m.itemId}_${m.movIdx}`;

  const toggleSel = (m) => {
    const k = chaveUnica(m);
    setSelecionados(prev => prev.includes(k) ? prev.filter(s => s !== k) : [...prev, k]);
  };

  const toggleTodos = () => {
    if (selecionados.length === filtradas.length) {
      setSelecionados([]);
    } else {
      setSelecionados(filtradas.map(chaveUnica));
    }
  };

  const selecionadosSet = new Set(selecionados);

  const excluirSelecionados = async () => {
    if (!selecionados.length) return;
    if (!confirm(`Excluir ${selecionados.length} ajuste(s)? O saldo de cada produto será corrigido automaticamente.`)) return;
    setDeletando(true);

    const porItem = {};
    for (const k of selecionados) {
      const [itemId, movIdxStr] = k.split("_");
      const movIdx = parseInt(movIdxStr);
      if (!porItem[itemId]) porItem[itemId] = new Set();
      porItem[itemId].add(movIdx);
    }

    for (const [itemId, idxSet] of Object.entries(porItem)) {
      const item = items.find(i => i.id === itemId);
      if (!item) continue;

      // Calcula quanto de quantidade será removida pelos ajustes excluídos
      let qtdRemovida = 0;
      (item.historico || []).forEach((mov, idx) => {
        if (idxSet.has(idx)) {
          qtdRemovida += Number(mov.quantidade || 0);
        }
      });

      const novoHistorico = (item.historico || []).filter((_, idx) => !idxSet.has(idx));
      const novaQtd = Number(item.quantidade || 0) - qtdRemovida;

      await base44.entities.Estoque.update(itemId, {
        historico: novoHistorico,
        quantidade: novaQtd,
      });
    }

    setSelecionados([]);
    setDeletando(false);
    onReload();
  };

  const abrirEdicao = (m) => {
    setEditando({ itemId: m.itemId, movIdx: m.movIdx });
    setEditForm({ ...m.mov });
  };

  const salvarEdicao = async () => {
    const item = items.find(i => i.id === editando.itemId);
    if (!item) return;
    const novoHistorico = [...(item.historico || [])];
    novoHistorico[editando.movIdx] = { ...editForm };
    await base44.entities.Estoque.update(editando.itemId, { historico: novoHistorico });
    setEditando(null);
    onReload();
  };

  const tipoOpcoes = ["Todos", "Entrada", "Saida", "Ajuste"];
  const tipoLabels = { "Todos": "TODOS", "Entrada": "ENTRADAS", "Saida": "SAÍDAS", "Ajuste": "AJUSTES" };

  const totalEntradas = todasMovimentacoes.filter(m => normalizarTipo(m.mov.tipo) === "entrada").length;
  const totalSaidas = todasMovimentacoes.filter(m => normalizarTipo(m.mov.tipo) === "saida").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-500 text-xs mb-1">Total</p>
          <p className="text-white font-bold">{todasMovimentacoes.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-500 text-xs mb-1">Entradas</p>
          <p className="font-bold" style={{ color: "#00ff00" }}>{totalEntradas}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-500 text-xs mb-1">Saídas</p>
          <p className="text-red-400 font-bold">{totalSaidas}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar produto, fornecedor, O.V...."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          {tipoOpcoes.map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className="px-3 py-2 text-xs font-semibold transition-all"
              style={{ background: filtroTipo === t ? "#062C9B" : "transparent", color: filtroTipo === t ? "#fff" : "#6b7280" }}
            >
              {tipoLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Ações selecionados */}
      {selecionados.length > 0 && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
          <span className="text-red-400 text-sm font-medium flex-1">{selecionados.length} ajuste(s) selecionado(s)</span>
          <button onClick={() => setSelecionados([])} className="text-gray-400 text-xs px-3 py-1.5 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
          <button onClick={excluirSelecionados} disabled={deletando}
            className="flex items-center gap-2 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50"
            style={{ background: "#ef4444" }}>
            <Trash2 className="w-3.5 h-3.5" /> {deletando ? "Excluindo..." : "Excluir em Massa"}
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800 bg-gray-900/80">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox"
                    checked={filtradas.length > 0 && selecionados.length === filtradas.length}
                    onChange={toggleTodos}
                    className="accent-blue-500 cursor-pointer w-4 h-4" />
                </th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Valor Unit.</th>
                <th className="px-4 py-3">Fornecedor / O.V.</th>
                <th className="px-4 py-3">Observação</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">Nenhuma movimentação encontrada</td></tr>
              ) : filtradas.map((m) => {
                const k = chaveUnica(m);
                const tipoNorm = normalizarTipo(m.mov.tipo);
                const obsNorm2 = String(m.mov.observacao || "").toLowerCase();
                const isAjusteVisual = tipoNorm === "ajuste" || obsNorm2.includes("saldo inicial") || obsNorm2.includes("ajuste");
                const cor = isAjusteVisual ? TIPO_CORES["ajuste"] : (TIPO_CORES[tipoNorm] || TIPO_CORES["ajuste"]);
                return (
                  <tr key={k} className={`border-b border-gray-800 transition-all hover:bg-gray-800/40 ${selecionadosSet.has(k) ? "bg-blue-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      {isAjusteVisual ? (
                        <input type="checkbox" checked={selecionadosSet.has(k)} onChange={() => toggleSel(m)}
                          className="accent-blue-500 cursor-pointer w-4 h-4" />
                      ) : <span className="w-4 h-4 block" />}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium text-xs">{m.produtoDescricao}</p>
                      {m.produtoCodigo && <p className="text-gray-600 font-mono text-[10px]">{m.produtoCodigo}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: cor.bg, color: cor.color, border: `1px solid ${cor.border}` }}>
                        {cor.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtData(m.mov.data)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: isAjusteVisual ? "#f97316" : (tipoNorm === "saida" ? "#ef4444" : "#00ff00") }}>
                      {tipoNorm === "saida" ? "-" : "+"}{m.mov.quantidade || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 text-xs">{m.mov.valor_unitario ? fmtVal(m.mov.valor_unitario) : "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate">
                      {m.mov.fornecedor ? m.mov.fornecedor : m.mov.ordem_venda_numero ? `O.V. ${m.mov.ordem_venda_numero}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{m.mov.observacao || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => abrirEdicao(m)} className="p-1 text-gray-500 hover:text-blue-400 transition-all">
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Individual */}
      {editando && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold text-sm">Editar Movimentação</h2>
              <button onClick={() => setEditando(null)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Tipo">
                <select value={editForm.tipo || ""} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value }))} className="input-mov">
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </Field>
              <Field label="Data">
                <input type="date" value={(editForm.data || "").substring(0, 10)} onChange={e => setEditForm(f => ({ ...f, data: e.target.value + "T00:00:00.000Z" }))} className="input-mov" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantidade">
                  <input type="text" value={editForm.quantidade || ""} onChange={e => setEditForm(f => ({ ...f, quantidade: Number(e.target.value.replace(/[^0-9.]/g, "")) }))} className="input-mov" />
                </Field>
                <Field label="Valor Unitário">
                  <input type="text" value={editForm.valor_unitario || ""} onChange={e => setEditForm(f => ({ ...f, valor_unitario: Number(e.target.value.replace(/[^0-9.]/g, "")) }))} className="input-mov" />
                </Field>
              </div>
              <Field label="Fornecedor">
                <input type="text" value={editForm.fornecedor || ""} onChange={e => setEditForm(f => ({ ...f, fornecedor: e.target.value }))} className="input-mov" />
              </Field>
              <Field label="N° O.V.">
                <input type="text" value={editForm.ordem_venda_numero || ""} onChange={e => setEditForm(f => ({ ...f, ordem_venda_numero: e.target.value }))} className="input-mov" />
              </Field>
              <Field label="Observação">
                <input type="text" value={editForm.observacao || ""} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} className="input-mov" />
              </Field>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setEditando(null)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={salvarEdicao} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all" style={{ background: "#00ff00", color: "#000" }}>
                <Check className="w-4 h-4" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-mov{width:100%;background:#1f2937;border:1px solid #374151;color:#fff;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;}.input-mov:focus{border-color:#3b82f6;}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}