import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, Loader, CheckCircle2, AlertTriangle } from "lucide-react";

export default function BackupRestorer() {
  const [restaurando, setRestaurando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const restaurar = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="w-5 h-5 text-blue-400" />
        <h3 className="text-white font-semibold">Restaurar Backup</h3>
      </div>

      <p className="text-gray-400 text-sm">Carrega um arquivo de backup anteriormente salvo (ATENÇÃO: substitui todos os dados!)</p>

      <button
        onClick={restaurar}
        disabled={restaurando}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
        style={{ background: "#062C9B" }}
        onMouseEnter={e => !restaurando && (e.currentTarget.style.background = "#041a4d")}
        onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}
      >
        {restaurando ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {restaurando ? "Restaurando..." : "Selecionar Arquivo"}
      </button>

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