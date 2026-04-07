import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Loader, CheckCircle2, AlertTriangle } from "lucide-react";

export default function BackupCreator() {
  const [fazendo, setFazendo] = useState(false);
  const [resultado, setResultado] = useState(null);

  const fazer = async () => {
    setFazendo(true);
    setResultado(null);
    try {
      const response = await base44.functions.invoke("criarBackup", {});
      const backup = response.data;
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      const total = Object.keys(backup).reduce((acc, e) => acc + backup[e].length, 0);
      setResultado({ sucesso: true, msg: `Backup criado! ${total} registros salvos.` });
    } catch (err) {
      setResultado({ sucesso: false, msg: `Erro: ${err.message}` });
    }
    setFazendo(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Download className="w-5 h-5 text-green-400" />
        <h3 className="text-white font-semibold">Criar Backup</h3>
      </div>

      <p className="text-gray-400 text-sm">Baixa um arquivo com todos os dados atuais da aplicação</p>

      <button
        onClick={fazer}
        disabled={fazendo}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
        style={{ background: "#00ff00" }}
        onMouseEnter={e => !fazendo && (e.currentTarget.style.background = "#00dd00")}
        onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
      >
        {fazendo ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {fazendo ? "Criando..." : "Baixar Backup"}
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