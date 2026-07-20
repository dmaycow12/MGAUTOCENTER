import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import FiltroPerioodoAvancado from "@/components/notas/FiltroPerioodoAvancado";

const fmtV = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hoje = new Date();
const pad = n => String(n).padStart(2, "0");
function getPeriodoRange(mes, ano) {
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-31` };
}

export default function AbaComissoes() {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoRange, setPeriodoRange] = useState(() => getPeriodoRange(hoje.getMonth() + 1, hoje.getFullYear()));
  const [expandido, setExpandido] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await base44.entities.Vendas.list("-created_date", 9999);
      setVendas(data.filter(v => v.status !== "Orçamento"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const vendasPeriodo = vendas.filter(v => {
    const d = (v.data_entrada || v.created_date || "").substring(0, 10);
    return d >= periodoRange.inicio && d <= periodoRange.fim;
  });

  // Agrupar por técnico (campo técnico da venda) — comissão preenchida manualmente
  const comissoesPorTec = {};
  vendasPeriodo.forEach(v => {
    const tec = (v.tecnico || "").trim().toUpperCase();
    if (!tec) return;
    const baseServicos = Number(v.valor_servicos || 0);
    const comissao = Number(v.comissao || 0);
    if (!comissoesPorTec[tec]) comissoesPorTec[tec] = { base: 0, comissao: 0, vendas: [] };
    comissoesPorTec[tec].base += baseServicos;
    comissoesPorTec[tec].comissao += comissao;
    comissoesPorTec[tec].vendas.push({
      numero: v.numero,
      cliente: v.cliente_nome_fantasia || v.cliente_nome,
      veiculo: [v.veiculo_modelo, v.veiculo_placa].filter(Boolean).join(" · "),
      base: baseServicos,
      comissao,
    });
  });

  const resultados = Object.entries(comissoesPorTec).map(([tec, dados]) => ({
    tec, ...dados, qtdVendas: dados.vendas.length,
  })).sort((a, b) => b.comissao - a.comissao);

  const totalComissoes = resultados.reduce((acc, r) => acc + r.comissao, 0);

  if (loading) return <div className="py-12 text-center text-gray-500 text-sm">Carregando...</div>;

  return (
    <div className="space-y-2 mt-2">

      {/* ── FILTRO ── */}
      <FiltroPerioodoAvancado onFiltroChange={({ periodoRange: pr }) => setPeriodoRange(pr)} />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1 items-center justify-center text-center" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          <span className="text-gray-500 text-xs font-medium">TOTAL COMISSÕES</span>
          <span className="text-white font-bold text-sm">{fmtV(totalComissoes)}</span>
        </div>
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1 items-center justify-center text-center" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          <span className="text-gray-500 text-xs font-medium">TÉCNICOS</span>
          <span className="text-white font-bold text-sm">{resultados.length}</span>
        </div>
      </div>

      {/* ── RESULTADOS ── */}
      {resultados.length === 0 ? (
        <div className="rounded-xl py-10 text-center text-gray-600 text-xs" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          Nenhuma venda com técnico atribuído neste período
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          {/* Header tabela */}
          <div className="grid px-4 py-2" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", borderBottom: "1px solid #1e3a5f", background: "rgba(6,44,155,0.12)" }}>
            <span className="text-gray-500 text-xs font-bold tracking-widest">TÉCNICO</span>
            <span className="text-gray-500 text-xs font-bold text-center">Nº VENDA</span>
            <span className="text-gray-500 text-xs font-bold text-center">VEÍCULO</span>
            <span className="text-gray-500 text-xs font-bold text-right">BASE</span>
            <span className="text-gray-500 text-xs font-bold text-right">COMISSÃO</span>
          </div>

          {resultados.map((r) => (
            <div key={r.tec} style={{ borderBottom: "1px solid #0d1b2a" }}>
              {/* Linha principal */}
              <button
                onClick={() => setExpandido(expandido === r.tec ? null : r.tec)}
                className="w-full grid px-4 py-3 hover:bg-white/[0.04] transition-all items-center"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}
              >
                {/* Nome */}
                <div className="text-left">
                  <div className="text-white text-xs font-bold">{r.tec}</div>
                </div>

                {/* Números das vendas */}
                <div className="text-center text-white text-xs">
                  {[...new Set(r.vendas.map(d => d.numero).filter(Boolean))].map((num, i) => (
                    <span key={i} className="inline-block mr-1">#{num}</span>
                  ))}
                </div>

                {/* Veículo */}
                <div className="text-center text-white text-xs">
                  {[...new Set(r.vendas.map(d => d.veiculo).filter(Boolean))].map((v, i) => (
                    <span key={i} className="block">{v}</span>
                  ))}
                </div>

                {/* Base */}
                <div className="text-right text-white text-xs font-medium">{fmtV(r.base)}</div>

                {/* Comissão */}
                <div className="text-right">
                  <span className="text-white text-sm font-bold">{fmtV(r.comissao)}</span>
                </div>
              </button>

              {/* Detalhe expandido */}
              {expandido === r.tec && (
                <div className="overflow-x-auto" style={{ background: "rgba(0,0,0,0.3)", borderTop: "1px solid #1e3a5f" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "rgba(6,44,155,0.1)" }}>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold">Venda</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold">Cliente</th>
                        <th className="px-4 py-2 text-right text-gray-500 font-semibold">Base</th>
                        <th className="px-4 py-2 text-right text-gray-500 font-semibold">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.vendas.map((d, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-all" style={{ borderTop: "1px solid #111827" }}>
                          <td className="px-4 py-2 text-white font-bold">#{d.numero}</td>
                          <td className="px-4 py-2 text-gray-300 truncate max-w-[120px]">{d.cliente || "—"}</td>
                          <td className="px-4 py-2 text-right text-white font-semibold">{fmtV(d.base)}</td>
                          <td className="px-4 py-2 text-right text-white font-bold">{fmtV(d.comissao)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* Rodapé total */}
          <div className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", borderTop: "1px solid #1e3a5f", background: "rgba(6,44,155,0.08)" }}>
            <span className="text-gray-400 text-xs font-bold">TOTAL</span>
            <span />
            <span />
            <span className="text-right text-white text-xs font-semibold">{fmtV(resultados.reduce((a, r) => a + r.base, 0))}</span>
            <span className="text-right text-white text-sm font-bold">{fmtV(totalComissoes)}</span>
          </div>
        </div>
      )}
    </div>
  );
}