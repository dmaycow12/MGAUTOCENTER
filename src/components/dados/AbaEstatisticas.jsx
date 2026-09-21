import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

const ROTULOS = {
  Vendas: "Vendas",
  Cadastro: "Clientes / Fornecedores",
  Estoque: "Estoque",
  Servico: "Serviços",
  Ativo: "Ativos",
  Financeiro: "Financeiro",
  NotaFiscal: "Notas Fiscais",
};

const fmtData = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

export default function AbaEstatisticas() {
  const [carregando, setCarregando] = useState(false);
  const [stats, setStats] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await base44.functions.invoke("estatisticasDados", {});
      setStats(res.data);
    } catch (e) {
      setErro(e?.response?.data?.error || e?.message || String(e));
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const entradas = stats ? Object.entries(stats).filter(([k]) => ROTULOS[k]) : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <button
          onClick={carregar}
          disabled={carregando}
          className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50 transition-all"
          style={{ background: "#00ff00", color: "#000" }}
          onMouseEnter={(e) => { if (!carregando) e.currentTarget.style.background = "#00dd00"; }}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#00ff00")}
        >
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {carregando ? "Contando registros..." : "Atualizar Estatísticas"}
        </button>
      </div>

      {erro && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {carregando && !stats && (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando estatísticas dos módulos...
        </div>
      )}

      {entradas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {entradas.map(([entidade, info]) => (
            <div key={entidade} className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center space-y-1">
              <p className="text-xs text-gray-400 truncate">{ROTULOS[entidade]}</p>
              <p className="text-2xl font-bold text-white">{info.total ?? 0}</p>
              <p className="text-[10px] text-gray-500">Último registro: {fmtData(info.ultimo)}</p>
              {info.por_tipo && (
                <p className="text-[10px] text-gray-400">
                  {Object.entries(info.por_tipo).map(([t, q]) => `${t}: ${q}`).join(" | ")}
                </p>
              )}
            </div>
          ))}
          <div className="col-span-2 md:col-span-4 flex items-center justify-center gap-2 text-[11px] text-gray-500 pt-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            Total de registros: {entradas.reduce((s, [, i]) => s + (i.total || 0), 0)}
          </div>
        </div>
      )}
    </div>
  );
}