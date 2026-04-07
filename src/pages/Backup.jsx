import React from "react";
import BackupCreator from "../components/backup/BackupCreator";
import BackupRestorer from "../components/backup/BackupRestorer";
import BackupExcel from "../components/backup/BackupExcel";
import { AlertTriangle } from "lucide-react";

export default function Backup() {
  const entidades = ["Cliente", "Veiculo", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-400 font-semibold text-sm">Aviso Importante</p>
          <p className="text-red-300 text-xs mt-1">Faça backups regularmente antes de alterar dados importantes. A restauração substitui TODOS os dados atuais.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BackupCreator />
        <BackupRestorer />
        <BackupExcel />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
        <p className="text-xs text-gray-500 font-semibold">Entidades cobertas:</p>
        <div className="flex flex-wrap gap-2">
          {entidades.map(e => (
            <span key={e} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">{e}</span>
          ))}
        </div>
      </div>
    </div>
  );
}