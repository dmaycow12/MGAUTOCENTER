import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Loader } from "lucide-react";

export default function BackupCreator() {
  const [loading, setLoading] = useState(null);
  const [status, setStatus] = useState(null);

  const downloadFile = async (type) => {
    setLoading(type);
    setStatus(null);
    
    try {
      const funcName = type === "json" ? "downloadBackupJson" : "downloadBackupXlsx";
      const response = await base44.functions.invoke(funcName, {});
      
      if (response.status !== 200 || !response.data.file) {
        throw new Error(`Erro: ${response.data?.error || "Desconhecido"}`);
      }

      const binaryStr = atob(response.data.file);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { 
        type: type === "json" ? "application/json" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setStatus({ type: "success", msg: `Backup ${type.toUpperCase()} baixado com sucesso!` });
    } catch (err) {
      console.error("Erro:", err);
      setStatus({ type: "error", msg: `Erro: ${err.message}` });
    } finally {
      setLoading(null);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          onClick={() => downloadFile("json")}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-black disabled:opacity-50"
          style={{ background: loading === "json" ? "#ccff00" : "#00ff00" }}
          onMouseEnter={(e) => loading === null && (e.currentTarget.style.background = "#00dd00")}
          onMouseLeave={(e) => loading === null && (e.currentTarget.style.background = "#00ff00")}
        >
          {loading === "json" ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading === "json" ? "Baixando..." : "JSON"}
        </button>
        
        <button
          onClick={() => downloadFile("xlsx")}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-black disabled:opacity-50"
          style={{ background: loading === "xlsx" ? "#ccff00" : "#00ff00" }}
          onMouseEnter={(e) => loading === null && (e.currentTarget.style.background = "#00dd00")}
          onMouseLeave={(e) => loading === null && (e.currentTarget.style.background = "#00ff00")}
        >
          {loading === "xlsx" ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading === "xlsx" ? "Baixando..." : "XLSX"}
        </button>
      </div>
      
      {status && (
        <div
          style={{
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