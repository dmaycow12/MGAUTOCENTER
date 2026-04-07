import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Loader } from "lucide-react";

export default function BackupCreator() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleBackup = async () => {
    setLoading(true);
    setStatus(null);
    
    try {
      console.log("Iniciando backup...");
      const response = await base44.functions.invoke("downloadBackupZip", {});
      console.log("Response:", response);
      
      if (response.status !== 200) {
        throw new Error(`Erro ${response.status}: ${response.data?.error || "Desconhecido"}`);
      }

      // Response.data é o blob do ZIP
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.zip`;
      
      console.log("Baixando arquivo...", a.download);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setStatus({ type: "success", msg: "Backup criado com sucesso!" });
    } catch (err) {
      console.error("Erro no backup:", err);
      setStatus({ type: "error", msg: `Erro: ${err.message}` });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  return (
    <div>
      <button
        onClick={handleBackup}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-black disabled:opacity-50"
        style={{ background: loading ? "#ccff00" : "#00ff00" }}
        onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "#00dd00")}
        onMouseLeave={(e) => e.currentTarget.style.background = "#00ff00"}
      >
        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {loading ? "Criando..." : "Criar Backup"}
      </button>
      
      {status && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 500,
            background: status.type === "success" ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)",
            color: status.type === "success" ? "#00ff00" : "#ff3333",
            border: `1px solid ${status.type === "success" ? "rgba(0,255,0,0.3)" : "rgba(255,0,0,0.3)"}`,
          }}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}