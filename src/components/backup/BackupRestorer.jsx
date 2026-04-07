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
    <button
      onClick={restaurar}
      disabled={restaurando}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
      style={{ background: "#062C9B" }}
      onMouseEnter={e => !restaurando && (e.currentTarget.style.background = "#041a4d")}
      onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}
    >
      {restaurando ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
      {restaurando ? "Restaurando..." : "Restaurar Backup"}
    </button>
  );
}