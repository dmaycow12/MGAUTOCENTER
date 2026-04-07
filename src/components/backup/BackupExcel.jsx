import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Loader, CheckCircle2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

const ENTIDADES = ["Cliente", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];

export default function BackupExcel() {
  const [fazendo, setFazendo] = useState(false);
  const [resultado, setResultado] = useState(null);

  const fazer = async () => {
    setFazendo(true);
    setResultado(null);
    try {
      const wb = XLSX.utils.book_new();
      let totalRegistros = 0;

      for (const entidade of ENTIDADES) {
        const dados = await base44.entities[entidade].list(undefined, 1000);
        if (dados && dados.length > 0) {
          const ws = XLSX.utils.json_to_sheet(dados);
          XLSX.utils.book_append_sheet(wb, ws, entidade);
          totalRegistros += dados.length;
        }
      }

      XLSX.writeFile(wb, `backup-${new Date().toISOString().split("T")[0]}.xlsx`);
      setResultado({ sucesso: true, msg: `Backup Excel criado! ${totalRegistros} registros em ${ENTIDADES.length} abas.` });
    } catch (err) {
      setResultado({ sucesso: false, msg: `Erro: ${err.message}` });
    }
    setFazendo(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Download className="w-5 h-5 text-orange-400" />
        <h3 className="text-white font-semibold">Backup em Excel</h3>
      </div>

      <p className="text-gray-400 text-sm">Cria arquivo Excel com uma aba para cada entidade</p>

      <button
        onClick={fazer}
        disabled={fazendo}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50"
        style={{ background: "#f97316" }}
        onMouseEnter={e => !fazendo && (e.currentTarget.style.background = "#ea580c")}
        onMouseLeave={e => e.currentTarget.style.background = "#f97316"}
      >
        {fazendo ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {fazendo ? "Criando..." : "Baixar Excel"}
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