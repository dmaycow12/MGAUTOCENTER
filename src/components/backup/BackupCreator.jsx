import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Loader, CheckCircle2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

export default function BackupCreator() {
  const [fazendo, setFazendo] = useState(false);
  const [resultado, setResultado] = useState(null);

  const fazer = async () => {
    setFazendo(true);
    setResultado(null);
    try {
      const response = await base44.functions.invoke("criarBackup", {});
      const backup = response.data;
      const dataStr = new Date().toISOString().split("T")[0];
      
      // Baixar JSON
      const jsonBlob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonA = document.createElement("a");
      jsonA.href = jsonUrl;
      jsonA.download = `backup-${dataStr}.json`;
      document.body.appendChild(jsonA);
      jsonA.click();
      document.body.removeChild(jsonA);
      URL.revokeObjectURL(jsonUrl);
      
      // Delay para evitar bloqueio do navegador
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Baixar XLSX
      const wb = XLSX.utils.book_new();
      for (const [entidade, dados] of Object.entries(backup)) {
        if (dados && dados.length > 0) {
          const ws = XLSX.utils.json_to_sheet(dados);
          XLSX.utils.book_append_sheet(wb, ws, entidade);
        }
      }
      XLSX.writeFile(wb, `backup-${dataStr}.xlsx`);
      
      const total = Object.values(backup).reduce((acc, e) => acc + (Array.isArray(e) ? e.length : 0), 0);
      setResultado({ sucesso: true, msg: `Backup criado! ${total} registros em 2 arquivos (JSON + XLSX).` });
    } catch (err) {
      setResultado({ sucesso: false, msg: `Erro: ${err.message}` });
    }
    setFazendo(false);
  };

  return (
    <button
      onClick={fazer}
      disabled={fazendo}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
      style={{ background: "#00ff00" }}
      onMouseEnter={e => !fazendo && (e.currentTarget.style.background = "#00dd00")}
      onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
    >
      {fazendo ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {fazendo ? "Criando..." : "Criar Backup"}
    </button>
  );
}