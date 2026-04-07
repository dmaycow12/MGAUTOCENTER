import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Loader, CheckCircle2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";

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
      
      // Criar arquivo XLSX
      const wb = XLSX.utils.book_new();
      for (const [entidade, dados] of Object.entries(backup)) {
        if (dados && dados.length > 0) {
          const ws = XLSX.utils.json_to_sheet(dados);
          XLSX.utils.book_append_sheet(wb, ws, entidade);
        }
      }
      const xlsxBlob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Criar ZIP com JSON + XLSX
      const zip = new JSZip();
      zip.file(`backup-${dataStr}.json`, JSON.stringify(backup, null, 2));
      zip.file(`backup-${dataStr}.xlsx`, xlsxBlob);
      
      zip.generateAsync({ type: 'blob' }).then(zipBlob => {
        const zipUrl = URL.createObjectURL(zipBlob);
        const zipA = document.createElement('a');
        zipA.href = zipUrl;
        zipA.download = `backup-${dataStr}.zip`;
        document.body.appendChild(zipA);
        zipA.click();
        document.body.removeChild(zipA);
        URL.revokeObjectURL(zipUrl);
      });
      
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