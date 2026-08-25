import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, FileText, Check, X, AlertCircle } from "lucide-react";
import { mostrarAlerta } from "@/lib/modalAviso";

export default function AbaNcmCfop({ items, onReload }) {
  const [search, setSearch] = useState("");
  const [editando, setEditando] = useState(null); // { id, field }
  const [salvando, setSalvando] = useState(false);

  const filtrados = useMemo(() => {
    const s = search.toLowerCase().trim();
    return items
      .filter(i => i.cest === undefined || i.cest === null || i.cest === "" || true) // mantém todos
      .filter(i => !s ||
        (i.descricao || "").toLowerCase().includes(s) ||
        (i.codigo || "").toLowerCase().includes(s) ||
        (i.ncm || "").toLowerCase().includes(s) ||
        (i.cfop || "").toLowerCase().includes(s))
      .sort((a, b) => (a.descricao || "").localeCompare(b.descricao || "", "pt-BR"));
  }, [items, search]);

  const iniciarEdicao = (item, field) => setEditando({ id: item.id, field, valor: String(item[field] ?? "") });
  const cancelarEdicao = () => setEditando(null);

  const salvarEdicao = async (item, field, valor) => {
    setEditando(null);
    const limpo = valor.replace(/\D/g, "");
    if (limpo === String(item[field] ?? "")) return;
    setSalvando(true);
    try {
      await base44.entities.Estoque.update(item.id, { [field]: limpo });
      // atualização otimista local
      const evt = new CustomEvent("estoque-ncmcfop-atualizado", { detail: { id: item.id, field, valor: limpo } });
      window.dispatchEvent(evt);
      onReload?.();
    } catch (err) {
      mostrarAlerta("Erro ao salvar: " + (err?.message || "desconhecido"), "Erro");
    } finally {
      setSalvando(false);
    }
  };

  const semNcm = filtrados.filter(i => !i.ncm).length;
  const semCfop = filtrados.filter(i => !i.cfop).length;

  const CellEdit = ({ item, field, maxLength }) => {
    const isEdit = editando?.id === item.id && editando?.field === field;
    const [local, setLocal] = useState("");
    React.useEffect(() => { if (isEdit) setLocal(editando.valor); }, [isEdit]);
    if (isEdit) {
      return (
        <input
          autoFocus
          value={local}
          maxLength={maxLength}
          onChange={e => setLocal(e.target.value.replace(/\D/g, ""))}
          onBlur={() => salvarEdicao(item, field, local)}
          onKeyDown={e => {
            if (e.key === "Escape") cancelarEdicao();
            if (e.key === "Enter") salvarEdicao(item, field, local);
          }}
          className="bg-gray-700 border border-green-500 rounded text-white text-sm px-2 py-1 w-28 outline-none"
          style={{ textTransform: "none" }}
        />
      );
    }
    const val = item[field];
    const vazio = !val;
    return (
      <span
        onClick={() => iniciarEdicao(item, field)}
        className={`cursor-pointer hover:underline rounded px-2 py-0.5 transition-all ${vazio ? "text-red-400 italic" : "text-white"}`}
        title="Clique para editar"
      >
        {vazio ? "—" : val}
      </span>
    );
  };

  return (
    <div className="space-y-0.5">
      {/* Busca + resumo */}
      <div className="flex flex-col md:flex-row gap-0.5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            placeholder="Buscar por descrição, código, NCM ou CFOP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
            style={{ textTransform: "none" }}
          />
        </div>
        <div className="flex gap-0.5">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Total:</span>
            <span className="text-white text-sm font-bold">{filtrados.length}</span>
          </div>
          <div className="bg-gray-900 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400">Sem NCM:</span>
            <span className="text-red-400 text-sm font-bold">{semNcm}</span>
          </div>
          <div className="bg-gray-900 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400">Sem CFOP:</span>
            <span className="text-red-400 text-sm font-bold">{semCfop}</span>
          </div>
        </div>
      </div>

      {salvando && (
        <div className="text-xs text-orange-400 px-2 py-1">Salvando...</div>
      )}

      {/* Tabela */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800 bg-gray-900/80">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3 text-center">NCM</th>
                  <th className="px-4 py-3 text-center">CFOP</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(item => (
                  <tr key={item.id} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-800/40 transition-all">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.codigo || "—"}</td>
                    <td className="px-4 py-3 text-white font-medium">{item.descricao || "—"}</td>
                    <td className="px-4 py-3 text-gray-400">{item.marca || "—"}</td>
                    <td className="px-4 py-3 text-center"><CellEdit item={item} field="ncm" maxLength={8} /></td>
                    <td className="px-4 py-3 text-center"><CellEdit item={item} field="cfop" maxLength={4} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}