import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, Loader, CheckCircle2, AlertTriangle, AlertCircle, X } from "lucide-react";

export default function BackupRestorer() {
  const [restaurando, setRestaurando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);

  const restaurar = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setConfirmarRestaurar(false);
      setRestaurando(true);
      setResultado(null);
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        const response = await base44.functions.invoke("restaurarBackup", { backup });
        setResultado({ sucesso: true, msg: response.data.msg });
      } catch (err) {
        setResultado({ sucesso: false, msg: `Erro: ${err.message}` });
      }
      setRestaurando(false);
    };
    input.click();
  };

  const abrirSeletorArquivo = () => {
    setConfirmarRestaurar(true);
  };

  const executarRestaurar = () => {
    restaurar();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="w-5 h-5 text-blue-400" />
        <h3 className="text-white font-semibold">Restaurar Backup</h3>
      </div>

      <p className="text-gray-400 text-sm">Carrega um arquivo de backup anteriormente salvo (ATENÇÃO: substitui todos os dados!)</p>

      <button
        onClick={abrirSeletorArquivo}
        disabled={restaurando}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
        style={{ background: "#062C9B" }}
        onMouseEnter={e => !restaurando && (e.currentTarget.style.background = "#041a4d")}
        onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}
      >
        {restaurando ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {restaurando ? "Restaurando..." : "Selecionar Arquivo"}
      </button>

      {confirmarRestaurar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header com ícone */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-500/30 px-6 py-5 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-white font-bold text-lg">Restaurar Backup</h2>
                <p className="text-gray-300 text-xs mt-1">Confirmar operação irreversível</p>
              </div>
              <button
                onClick={() => setConfirmarRestaurar(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="px-6 py-5">
              <p className="text-gray-200 text-sm font-semibold mb-3">Atenção!</p>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">
                O backup será importado <strong>sem duplicar registros já existentes</strong>. Todos os dados serão <strong>substituídos permanentemente</strong>. Esta operação não pode ser desfeita.
              </p>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
                <p className="text-red-300 text-xs">
                  💾 Certifique-se de ter um backup atual antes de prosseguir.
                </p>
              </div>
            </div>

            {/* Botões */}
            <div className="bg-gray-900 px-6 py-4 flex gap-3">
              <button
                onClick={() => setConfirmarRestaurar(false)}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 transition text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={executarRestaurar}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white bg-yellow-600 hover:bg-yellow-700 transition text-sm flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {resultado && (
        <div className={`flex items-start gap-3 p-4 rounded-lg ${resultado.sucesso ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
          {resultado.sucesso ? (
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${resultado.sucesso ? "text-green-400" : "text-red-400"}`}>{resultado.msg}</p>
        </div>
      )}
    </div>
  );
}