import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function getPeriodoRange(mes, ano) {
  const pad = n => String(n).padStart(2, "0");
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-31` };
}

const fmtV = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AbaFaturamento() {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

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

  const navMes = (dir) => {
    let novoMes = mes + dir;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
  };

  const { inicio, fim } = getPeriodoRange(mes, ano);

  const vendasPeriodo = vendas.filter(v => {
    const ref = v.data_entrada || v.data_conclusao || v.created_date || "";
    const d = ref.substring(0, 10);
    return d >= inicio && d <= fim;
  });

  // Faturamento por mês (últimos 12 meses)
  const faturamentoPorMes = Array.from({ length: 12 }, (_, i) => {
    let m = hoje.getMonth() + 1 - 11 + i;
    let a = hoje.getFullYear();
    while (m <= 0) { m += 12; a--; }
    while (m > 12) { m -= 12; a++; }
    const pad = n => String(n).padStart(2, "0");
    const prefixo = `${a}-${pad(m)}`;
    const vendasMes = vendas.filter(v => {
      const d = (v.data_entrada || v.created_date || "").substring(0, 7);
      return d === prefixo;
    });
    const total = vendasMes.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
    const concluidas = vendasMes.filter(v => v.status === "Concluído").length;
    return { label: `${MESES[m-1].substring(0,3)}/${String(a).substring(2)}`, total, qtd: vendasMes.length, concluidas };
  });

  const maxBar = Math.max(...faturamentoPorMes.map(d => d.total), 1);

  // Métricas do período
  const totalPeriodo = vendasPeriodo.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
  const concluidas = vendasPeriodo.filter(v => v.status === "Concluído");
  const abertas = vendasPeriodo.filter(v => v.status === "Aberto");
  const ticketMedio = vendasPeriodo.length > 0 ? totalPeriodo / vendasPeriodo.length : 0;

  // Faturamento por técnico (campo tecnico nos serviços)
  const porTecnico = {};
  vendasPeriodo.forEach(v => {
    (v.servicos || []).forEach(s => {
      const tec = s.tecnico || "Sem técnico";
      if (!porTecnico[tec]) porTecnico[tec] = 0;
      porTecnico[tec] += Number(s.valor || 0) * Number(s.quantidade ?? 1);
    });
  });
  const rankTecnicos = Object.entries(porTecnico).sort((a, b) => b[1] - a[1]);

  if (loading) return <div className="py-12 text-center text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-3 mt-2">
      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#062C9B] rounded-xl overflow-hidden h-10">
          <button onClick={() => navMes(-1)} className="flex items-center justify-center px-2 h-full hover:bg-white/20 transition-all">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-white text-sm font-semibold px-3">{MESES[mes-1]} {ano}</span>
          <button onClick={() => navMes(1)} className="flex items-center justify-center px-2 h-full hover:bg-white/20 transition-all">
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
        <span className="text-gray-400 text-xs">{vendasPeriodo.length} vendas no período</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Faturamento Total", value: fmtV(totalPeriodo), color: "#16a34a" },
          { label: "Ticket Médio", value: fmtV(ticketMedio), color: "#3b82f6" },
          { label: "Concluídas", value: concluidas.length, color: "#f59e0b", isCt: true },
          { label: "Em Aberto", value: abertas.length, color: "#ef4444", isCt: true },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-3 flex flex-col gap-1" style={{ background: "#0d1b2a", border: "1px solid #1e3a5f" }}>
            <span className="text-xs text-gray-400">{kpi.label}</span>
            <span className="text-base font-bold" style={{ color: kpi.color }}>
              {kpi.isCt ? kpi.value : kpi.value}
            </span>
          </div>
        ))}
      </div>

      {/* Gráfico de barras — 12 meses */}
      <div className="rounded-xl p-4" style={{ background: "#0d1b2a", border: "1px solid #1e3a5f" }}>
        <h3 className="text-white text-sm font-semibold mb-3">Faturamento — Últimos 12 Meses</h3>
        <div className="flex items-end gap-1 h-32">
          {faturamentoPorMes.map((d, i) => {
            const h = maxBar > 0 ? Math.max((d.total / maxBar) * 100, 2) : 2;
            const isAtual = i === 11;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-t transition-all"
                  style={{ height: `${h}%`, background: isAtual ? "#062C9B" : "#1e3a5f", minHeight: 4 }}
                />
                <span className="text-gray-500 text-[8px] truncate w-full text-center">{d.label}</span>
                {/* tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10">
                  {d.label}: {fmtV(d.total)}<br/>{d.qtd} venda(s)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ranking por técnico */}
      {rankTecnicos.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#0d1b2a", border: "1px solid #1e3a5f" }}>
          <h3 className="text-white text-sm font-semibold mb-3">Faturamento por Técnico — {MESES[mes-1]} {ano}</h3>
          <div className="space-y-2">
            {rankTecnicos.map(([tec, val], i) => {
              const pct = rankTecnicos[0][1] > 0 ? (val / rankTecnicos[0][1]) * 100 : 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">{tec}</span>
                    <span className="text-green-400 font-semibold">{fmtV(val)}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: "#062C9B" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela de vendas do período */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#0d1b2a", border: "1px solid #1e3a5f" }}>
        <div className="p-3 border-b border-gray-800">
          <h3 className="text-white text-sm font-semibold">Vendas do Período</h3>
        </div>
        {vendasPeriodo.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">Nenhuma venda neste período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="px-3 py-2 text-left">Nº</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendasPeriodo.sort((a, b) => Number(b.numero) - Number(a.numero)).map(v => (
                  <tr key={v.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-white font-semibold">#{v.numero}</td>
                    <td className="px-3 py-2 text-gray-300">{v.cliente_nome_fantasia || v.cliente_nome || "—"}</td>
                    <td className="px-3 py-2 text-gray-400">{(v.data_entrada || "").split("-").reverse().join("/") || "—"}</td>
                    <td className="px-3 py-2 text-right text-green-400 font-semibold">{fmtV(v.valor_total)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{
                        background: v.status === "Concluído" ? "#16a34a22" : v.status === "Aberto" ? "#062C9B22" : "#37415122",
                        color: v.status === "Concluído" ? "#16a34a" : v.status === "Aberto" ? "#60a5fa" : "#9ca3af"
                      }}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}