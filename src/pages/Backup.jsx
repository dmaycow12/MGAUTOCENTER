import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Upload, AlertTriangle, CheckCircle2, Loader } from "lucide-react";

export default function Backup() {
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const entidades = ["Cliente", "Veiculo", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];

  const fazerBackup = async () => {
    setFazendoBackup(true);
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
      
      setResultado({ sucesso: true, msg: `Backup criado com sucesso! ${Object.keys(backup).reduce((acc, e) => acc + backup[e].length, 0)} registros salvos.` });
    } catch (err) {
      setResultado({ sucesso: false, msg: `Erro: ${err.message}` });
    }
    setFazendoBackup(false);
  };

  const restaurarBackup = async () => {
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
    <div className="space-y-4 max-w-2xl">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-white font-semibold">Sistema de Backup e Restauração</h2>
            <p className="text-gray-400 text-sm">Salve e restaure todos os dados da aplicação</p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4 space-y-3">
          <button
            onClick={fazerBackup}
            disabled={fazendoBackup}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
            style={{ background: "#00ff00" }}
            onMouseEnter={e => !fazendoBackup && (e.currentTarget.style.background = "#00dd00")}
            onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
          >
            {fazendoBackup ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {fazendoBackup ? "Criando backup..." : "Criar Backup"}
          </button>

          <button
            onClick={restaurarBackup}
            disabled={restaurando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
            style={{ background: "#062C9B" }}
            onMouseEnter={e => !restaurando && (e.currentTarget.style.background = "#041a4d")}
            onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}
          >
            {restaurando ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {restaurando ? "Restaurando..." : "Restaurar do Arquivo"}
          </button>
        </div>

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

        <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-xs text-gray-400">
          <p><span className="text-orange-400 font-semibold">Entidades cobertas:</span> {entidades.join(", ")}</p>
          <p><span className="text-orange-400 font-semibold">Nota:</span> Restauração substitui todos os dados atuais. Certifique-se de ter um backup antes!</p>
        </div>
      </div>
    </div>
  );
}