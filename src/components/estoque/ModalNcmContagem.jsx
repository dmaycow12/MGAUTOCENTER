import React from "react";
import { X, FileText } from "lucide-react";

export default function ModalNcmContagem({ aberto, contagem, total, onClose }) {
  if (!aberto) return null;

  const ordenados = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-bold text-base">Contagem por NCM</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-800 text-xs text-gray-400">
          {ordenados.length} NCM(s) diferente(s) em {total} produto(s)
        </div>

        <div className="overflow-y-auto flex-1">
          {ordenados.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhum NCM cadastrado
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800 sticky top-0 bg-gray-900">
                  <th className="px-5 py-2">NCM</th>
                  <th className="px-5 py-2 text-right">Produtos</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map(([ncm, qtd]) => (
                  <tr key={ncm} className="border-b border-gray-800/60 last:border-0">
                    <td className="px-5 py-2.5 text-white font-mono">{ncm}</td>
                    <td className="px-5 py-2.5 text-right text-blue-400 font-bold">{qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}