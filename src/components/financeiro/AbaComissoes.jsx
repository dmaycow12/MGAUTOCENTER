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

  // Lista de vendas com comissão — cada venda com comissão > 0 é um registro
  const vendasComissao = vendasPeriodo
    .filter(v => Number(v.comissao || 0) > 0)
    .map(v => ({
      data: (v.data_entrada || v.created_date || "").substring(0, 10),
      numero: v.numero,
      veiculo: v.veiculo_modelo || "",
      placa: v.veiculo_placa || "",
      comissao: Number(v.comissao || 0),
      tecnico: (v.tecnico || "").trim().toUpperCase(),
    }))
    .sort((a, b) => b.data.localeCompare(a.data));

  const totalComissoes = vendasComissao.reduce((acc, v) => acc + v.comissao, 0);
  const qtdTecnicos = new Set(vendasComissao.map(v => v.tecnico).filter(Boolean)).size;

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
          <span className="text-white font-bold text-sm">{qtdTecnicos}</span>
        </div>
      </div>

      {/* ── RESULTADOS ── */}
      {vendasComissao.length === 0 ? (
        <div className="rounded-xl py-10 text-center text-gray-600 text-xs" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          Nenhuma venda com comissão neste período
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          {/* Header tabela */}
          <div className="grid px-4 py-2" style={{ gridTemplateColumns: "1fr 1fr 2fr 1fr 1fr 1fr", borderBottom: "1px solid #1e3a5f", background: "rgba(6,44,155,0.12)" }}>
            <span className="text-gray-500 text-xs font-bold tracking-widest">DATA</span>
            <span className="text-gray-500 text-xs font-bold text-center">Nº VENDA</span>
            <span className="text-gray-500 text-xs font-bold text-center">VEÍCULO</span>
            <span className="text-gray-500 text-xs font-bold text-center">PLACA</span>
            <span className="text-gray-500 text-xs font-bold text-center">TÉCNICO</span>
            <span className="text-gray-500 text-xs font-bold text-right">COMISSÃO</span>
          </div>

          {vendasComissao.map((v, i) => (
            <div key={i} className="grid px-4 py-3 hover:bg-white/[0.04] transition-all items-center" style={{ gridTemplateColumns: "1fr 1fr 2fr 1fr 1fr 1fr", borderBottom: "1px solid #232b38" }}>
              {/* Data */}
              <div className="text-left text-white text-xs">{v.data ? new Date(v.data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>

              {/* Nº Venda */}
              <div className="text-center text-white text-xs font-bold">{v.numero ? `#${v.numero}` : "—"}</div>

              {/* Veículo */}
              <div className="text-center text-white text-xs truncate">{v.veiculo || "—"}</div>

              {/* Placa */}
              <div className="text-center text-white text-xs">{v.placa || "—"}</div>

              {/* Técnico */}
              <div className="text-center text-white text-xs">{v.tecnico || "—"}</div>

              {/* Comissão */}
              <div className="text-right">
                <span className="text-white text-sm font-bold">{fmtV(v.comissao)}</span>
              </div>
            </div>
          ))}

          {/* Rodapé total */}
          <div className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: "1fr 1fr 2fr 1fr 1fr 1fr", borderTop: "1px solid #1e3a5f", background: "rgba(6,44,155,0.08)" }}>
            <span className="text-gray-400 text-xs font-bold">TOTAL</span>
            <span />
            <span />
            <span />
            <span />
            <span className="text-right text-white text-sm font-bold">{fmtV(totalComissoes)}</span>
          </div>
        </div>
      )}
    </div>
  );
}