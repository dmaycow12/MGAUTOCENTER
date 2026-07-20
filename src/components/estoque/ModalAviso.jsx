import React from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ModalAviso({ isOpen, tipo = "alerta", titulo, mensagem, onConfirm, onCancel, confirmText, cancelText }) {
  if (!isOpen) return null;

  const isConfirm = tipo === "confirm";
  const isAlerta = tipo === "alerta";
  const corIcone = isAlerta ? "#fbbf24" : "#f87171";

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4" style={{ color: corIcone }} />
            {titulo || (isConfirm ? "Confirmar Ação" : "Aviso")}
          </h2>
          <button onClick={onCancel}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>
        <div className="p-5">
          <p className="text-gray-300 text-sm leading-relaxed">{mensagem}</p>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all"
          >
            {cancelText || "Cancelar"}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all"
            style={{ background: isAlerta ? "#f97316" : "#cc0000" }}
            onMouseEnter={e => e.currentTarget.style.background = isAlerta ? "#ea580c" : "#aa0000"}
            onMouseLeave={e => e.currentTarget.style.background = isAlerta ? "#f97316" : "#cc0000"}
          >
            {confirmText || (isConfirm ? "Confirmar" : "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}