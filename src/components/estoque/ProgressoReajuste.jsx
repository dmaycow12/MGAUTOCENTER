import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

export default function ProgressoReajuste({ isOpen, onClose, total, progresso, status, erro, sucessos }) {
  const percentual = Math.round((progresso / total) * 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">Reajustando Preços</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Barra de Progresso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Progresso</span>
              <span className="text-sm font-bold text-white">{progresso}/{total}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-700">
              <div
                className="bg-gradient-to-r from-green-500 to-green-400 h-full transition-all duration-300"
                style={{ width: `${percentual}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-2">{percentual}%</div>
          </div>

          {/* Status */}
          <div className={`p-4 rounded-lg border ${
            status === 'processando' 
              ? 'bg-blue-500/10 border-blue-500/30'
              : status === 'sucesso'
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-3">
              {status === 'processando' && (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              {status === 'sucesso' && (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
              {status === 'erro' && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={`text-sm font-medium ${
                status === 'processando' ? 'text-blue-400' :
                status === 'sucesso' ? 'text-green-400' :
                'text-red-400'
              }`}>
                {status === 'processando' ? 'Processando...' :
                 status === 'sucesso' ? 'Concluído!' :
                 'Erro no processamento'}
              </span>
            </div>
          </div>

          {/* Resultado */}
          {status !== 'processando' && (
            <div className="bg-gray-800/50 rounded-lg p-4 text-sm space-y-2 text-gray-300">
              <p>✅ <span className="text-green-400 font-bold">{sucessos}</span> produtos atualizados</p>
              {total - sucessos > 0 && (
                <p>⚠️ <span className="text-yellow-400 font-bold">{total - sucessos}</span> produtos falharam</p>
              )}
              {erro && (
                <p className="text-red-400 text-xs mt-3">Erro: {erro}</p>
              )}
            </div>
          )}
        </div>

        {status !== 'processando' && (
          <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all"
              style={{ background: "#00ff00", color: "#000" }}
              onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
              onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}