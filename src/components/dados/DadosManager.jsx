import React, { useState } from "react";
import { Database, BarChart3, Wrench, ArrowUpDown } from "lucide-react";
import AbaEstatisticas from "./AbaEstatisticas";
import AbaManutencao from "./AbaManutencao";
import AbaImportarExportar from "./AbaImportarExportar";

const ABAS = [
  { id: "estatisticas", label: "Estatísticas", icon: BarChart3 },
  { id: "manutencao", label: "Manutenção", icon: Wrench },
  { id: "importar", label: "Importar / Exportar", icon: ArrowUpDown },
];

export default function DadosManager() {
  const [aba, setAba] = useState("estatisticas");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-center gap-2">
        <Database className="w-5 h-5 text-green-400" />
        <h2 className="text-white font-bold text-lg text-center">Dados</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: aba === id ? "#062C9B" : "#1f2937",
              color: "#fff",
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {aba === "estatisticas" && <AbaEstatisticas />}
      {aba === "manutencao" && <AbaManutencao />}
      {aba === "importar" && <AbaImportarExportar />}
    </div>
  );
}