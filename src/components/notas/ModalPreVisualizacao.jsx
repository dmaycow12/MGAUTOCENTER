import React from "react";
import { X, CheckCircle, Eye } from "lucide-react";

export default function ModalPreVisualizacao({ pdfUrl, tipo, nota, onAutorizar, onFechar }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Pré-visualização da DANFE</h2>
              <p className="text-yellow-400 text-xs mt-0.5">Este PDF é de homologação e contém a marca "SEM VALOR FISCAL"</p>
            </div>
          </div>
          <button onClick={onFechar}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-hidden p-4 min-h-0">
          <iframe
            src={pdfUrl}
            className="w-full h-full rounded-xl border border-gray-700"
            style={{ minHeight: "500px" }}
            title="DANFE Pré-visualização"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <span>Cliente: <span className="text-white font-medium">{nota?.cliente_nome || "—"}</span></span>
            <span className="text-gray-600">•</span>
            <span>Tipo: <span className="text-orange-400 font-medium">{tipo}</span></span>
            <span className="text-gray-600">•</span>
            <span>Valor: <span className="font-bold" style={{ color: "#00ff00" }}>R$ {Number(nota?.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onFechar}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all"
            >
              Cancelar / Corrigir
            </button>
            <button
              onClick={() => onAutorizar(nota?.id)}
              className="flex items-center gap-2 px-6 py-2 text-sm text-black rounded-lg font-bold transition-all"
              style={{ background: "#00ff00" }}
              onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
              onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
            >
              <CheckCircle className="w-4 h-4" />
              Autorizar e Emitir para Produção
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}