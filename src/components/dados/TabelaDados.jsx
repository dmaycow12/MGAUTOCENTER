import React from "react";
import { Loader2, AlertCircle } from "lucide-react";

const fmtMoney = (v) =>
  v !== undefined && v !== null && v !== ""
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0)
    : "—";

const fmtDate = (v) => {
  if (!v) return "—";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
};

export const FORMATOS = {
  money: (v) => fmtMoney(v),
  date: (v) => fmtDate(v),
  text: (v) => (v === undefined || v === null || v === "" ? "—" : String(v)),
};

export default function TabelaDados({ colunas, registros, carregando, erro, completo, onCarregarMais }) {
  if (carregando && (!registros || registros.length === 0)) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando dados...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-red-400 text-sm">
        <AlertCircle className="w-5 h-5" /> {erro}
      </div>
    );
  }

  if (!registros || registros.length === 0) {
    return <div className="text-center py-10 text-gray-500 text-sm">Nenhum registro encontrado.</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/60 text-gray-300">
              {colunas.map((c) => (
                <th key={c.k} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{c.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registros.map((r, i) => (
              <tr key={r.id || i} className="border-t border-gray-800/60 hover:bg-gray-800/30">
                {colunas.map((c) => (
                  <td key={c.k} className={`px-3 py-1.5 whitespace-nowrap text-gray-200 ${c.f === "money" ? "text-right" : ""}`}>
                    {FORMATOS[c.f || "text"](r[c.k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-500">{registros.length} registros carregados</span>
        {!completo && (
          <button
            onClick={onCarregarMais}
            disabled={carregando}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: "#1f2937", color: "#fff" }}
          >
            {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Carregar mais
          </button>
        )}
      </div>
    </div>
  );
}