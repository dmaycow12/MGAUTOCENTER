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
      const response = await base44.functions.invoke("downloadBackupZip", {});
      // Download direto do ZIP gerado no servidor
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setResultado({ sucesso: true, msg: 'Backup baixado com sucesso!' });
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