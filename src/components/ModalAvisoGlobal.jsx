import React, { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { getEstado, subscribe, fecharAviso } from "@/lib/modalAviso";

export default function ModalAvisoGlobal() {
  const [state, setState] = useState(getEstado());

  useEffect(() => subscribe(setState), []);

  if (!state.isOpen) return null;

  const isConfirm = state.tipo === "confirm";
  const corIcone = isConfirm ? "#f87171" : "#fbbf24";

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={fecharAviso}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4" style={{ color: corIcone }} />
            {state.titulo || (isConfirm ? "Confirmar Ação" : "Aviso")}
          </h2>
          <button onClick={fecharAviso}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>
        <div className="p-5">
          <p className="text-gray-300 text-sm leading-relaxed">{state.mensagem}</p>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button
            onClick={fecharAviso}
            className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all"
          >
            {isConfirm ? "Cancelar" : "Fechar"}
          </button>
          <button
            onClick={state.onConfirm}
            className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all"
            style={{ background: isConfirm ? "#cc0000" : "#f97316" }}
            onMouseEnter={e => e.currentTarget.style.background = isConfirm ? "#aa0000" : "#ea580c"}
            onMouseLeave={e => e.currentTarget.style.background = isConfirm ? "#cc0000" : "#f97316"}
          >
            {isConfirm ? "Confirmar" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}