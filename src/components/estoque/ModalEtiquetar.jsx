import React, { useState, useMemo } from "react";
import { X, Tag, Save } from "lucide-react";

export default function ModalEtiquetar({ items, onClose, onSalvar }) {
  const [etiqueta, setEtiqueta] = useState("");
  const [salvando, setSalvando] = useState(false);

  const etiquetasExistentes = useMemo(() => {
    const set = new Set();
    items.forEach(i => { if (i.etiqueta) set.add(i.etiqueta); });
    return [...set].sort();
  }, [items]);

  const handleSalvar = async () => {
    if (!etiqueta.trim()) return alert("Digite ou selecione uma etiqueta.");
    setSalvando(true);
    try {
      await onSalvar(etiqueta.trim());
      onClose();
    } catch (e) {
      alert("Erro ao salvar etiqueta: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Tag className="w-4 h-4 text-green-400" /> Etiquetar Produtos
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-gray-400">
            {items.length} produto(s) selecionado(s). Escolha uma etiqueta existente ou digite uma nova para aplicar a todos.
          </p>

          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-semibold">ETIQUETA</label>
            <input
              type="text"
              value={etiqueta}
              onChange={e => setEtiqueta(e.target.value)}
              placeholder="Digite o nome da etiqueta..."
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500"
            />
            {etiquetasExistentes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {etiquetasExistentes.map(et => (
                  <button
                    key={et}
                    onClick={() => setEtiqueta(et)}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                    style={{
                      background: etiqueta === et ? "#00ff00" : "transparent",
                      color: etiqueta === et ? "#000" : "#9ca3af",
                      borderColor: etiqueta === et ? "#00ff00" : "#374151"
                    }}
                  >
                    {et}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 px-3">Código</th>
                  <th className="text-left py-2 px-3">Descrição</th>
                  <th className="text-left py-2 px-3">Etiqueta Atual</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-800">
                    <td className="py-2 px-3 text-gray-400 font-mono">{item.codigo || "—"}</td>
                    <td className="py-2 px-3 text-white font-medium">{item.descricao}</td>
                    <td className="py-2 px-3 text-gray-500">{item.etiqueta || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
            style={{ background: "#00ff00", color: "#000" }}
          >
            <Save className="w-4 h-4" /> {salvando ? "Salvando..." : `Salvar Etiqueta em ${items.length} Produto(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}