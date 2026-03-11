import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  ClipboardList, DollarSign, Users, Package,
  TrendingUp, TrendingDown, Clock, CheckCircle,
  AlertCircle, ChevronLeft, ChevronRight, ChevronDown
} from "lucide-react";
import FluxoMes from "@/components/dashboard/FluxoMes";

const RED = "#cc0000";
const ORANGE = "#f97316";
const GREEN = "#00C957";
const BLUE = "#062C9B";
const YELLOW = "#FFCC00";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function KpiCard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "22" }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-1 ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-white font-bold text-xl mt-0.5">{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-white font-semibold text-base mb-3">{children}</h2>;
}

export default function Dashboard() {
  const [ordens, setOrdens] = useState([]);
  const [financeiro, setFinanceiro] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState(6);

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const [filtroMes, setFiltroMes] = useState(hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(false);
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const [customRange, setCustomRange] = useState(null);
  const periodoDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) setPeriodoDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navegarMes = (dir) => {
    setUsandoOutroPeriodo(false); setCustomRange(null);
    let m = filtroMes + dir, a = filtroAno;
    if (m > 12) { m = 1; a++; } if (m < 1) { m = 12; a--; }
    setFiltroMes(m); setFiltroAno(a);
  };

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    setCustomRange({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
    setUsandoOutroPeriodo(true); setPeriodoDropOpen(false);
  };

  const pad = n => String(n).padStart(2, "0");
  const periodoRange = usandoOutroPeriodo && customRange
    ? customRange
    : { inicio: `${filtroAno}-${pad(filtroMes)}-01`, fim: `${filtroAno}-${pad(filtroMes)}-31` };

  const financeiroPeriodo = financeiro.filter(i => {
    const ref = i.data_vencimento || i.data_pagamento || "";
    return ref >= periodoRange.inicio && ref <= periodoRange.fim;
  });

  const [ativos, setAtivos] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.OrdemServico.list("-created_date", 2000),
      base44.entities.Financeiro.list("-created_date", 2000),
      base44.entities.Cliente.list("-created_date", 2000),
      base44.entities.Estoque.list("-created_date", 2000),
      base44.entities.Ativo.list("-created_date", 2000),
    ]).then(([o, f, c, e, a]) => {
      setOrdens(o);
      setFinanceiro(f);
      setClientes(c);
      setEstoque(e);
      setAtivos(a);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: RED, borderTopColor: "transparent" }} />
    </div>
  );

  // KPIs OS
  const osAbertas = ordens.filter(o => o.status === "Aberto").length;
  const osOrcamento = ordens.filter(o => o.status === "Orçamento").length;
  const osConcluidas = ordens.filter(o => o.status === "Concluído").length;
  const osMes = ordens.filter(o => o.data_entrada?.startsWith(`${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}`)).length;

  // KPIs Financeiro
  const receitaMes = financeiro
    .filter(f => f.tipo === "Receita" && f.data_vencimento?.startsWith(`${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}`))
    .reduce((acc, f) => acc + Number(f.valor || 0), 0);

  const despesaMes = financeiro
    .filter(f => f.tipo === "Despesa" && f.data_vencimento?.startsWith(`${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}`))
    .reduce((acc, f) => acc + Number(f.valor || 0), 0);

  const receitaPaga = financeiro
    .filter(f => f.tipo === "Receita" && f.status === "Pago" && f.data_vencimento?.startsWith(`${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}`))
    .reduce((acc, f) => acc + Number(f.valor || 0), 0);

  const pendentes = financeiro.filter(f => f.status === "Pendente").length;
  const atrasados = financeiro.filter(f => f.status === "Atrasado").length;

  // Estoque critico
  const estoqueCritico = estoque.filter(e => Number(e.quantidade || 0) <= Number(e.estoque_minimo || 0)).length;

  // Gráfico Receita x Despesa x Lucro por mês (período selecionável)
  const fluxoPorMes = Array.from({ length: periodoMeses }, (_, i) => {
    const d = new Date(anoAtual, mesAtual - (periodoMeses - 1) + i, 1);
    const m = d.getMonth();
    const a = d.getFullYear();
    const key = `${a}-${String(m + 1).padStart(2, "0")}`;
    const receita = financeiro
      .filter(f => f.tipo === "Receita" && f.data_vencimento?.startsWith(key))
      .reduce((acc, f) => acc + Number(f.valor || 0), 0);
    const despesa = financeiro
      .filter(f => f.tipo === "Despesa" && f.data_vencimento?.startsWith(key))
      .reduce((acc, f) => acc + Number(f.valor || 0), 0);
    return { mes: MESES[m], receita, despesa, lucro: receita - despesa };
  });

  // Ordens filtradas pelo período do topo
  const ordensPeriodo = ordens.filter(o => {
    const ref = o.data_entrada || "";
    return ref >= periodoRange.inicio && ref <= periodoRange.fim;
  });

  // Pizza status OS (filtrada pelo período)
  const osAbertasPeriodo = ordensPeriodo.filter(o => o.status === "Aberto").length;
  const osOrcamentoPeriodo = ordensPeriodo.filter(o => o.status === "Orçamento").length;
  const osConcluidasPeriodo = ordensPeriodo.filter(o => o.status === "Concluído").length;

  const statusData = [
    { name: "Aberto", value: osAbertasPeriodo, color: BLUE },
    { name: "Orçamento", value: osOrcamentoPeriodo, color: YELLOW },
    { name: "Concluído", value: osConcluidasPeriodo, color: GREEN },
  ].filter(d => d.value > 0);

  // Pizza OS Pagas pelo Financeiro (filtrada pelo período)
  const osPagasData = (() => {
    const osSemOrcamento = ordensPeriodo.filter(o => o.status !== "Orçamento");
    let pagas = 0, pendentes = 0, atrasadas = 0, semLancamento = 0;
    osSemOrcamento.forEach(o => {
      const parcelas = financeiro.filter(f => f.ordem_servico_id === o.id);
      if (parcelas.length === 0) { semLancamento++; return; }
      if (parcelas.every(p => p.status === "Pago")) { pagas++; }
      else if (parcelas.some(p => p.status === "Atrasado")) { atrasadas++; }
      else { pendentes++; }
    });
    return [
      { name: "Pagas", value: pagas, color: GREEN },
      { name: "Pendentes", value: pendentes, color: YELLOW },
      { name: "Atrasadas", value: atrasadas, color: RED },
      { name: "Sem lançamento", value: semLancamento, color: "#6b7280" },
    ].filter(d => d.value > 0);
  })();



  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs">
          <p className="text-gray-300 mb-1 font-medium">{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" && p.value > 100 ? fmt(p.value) : p.value}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Filtro de mês + gráficos FluxoMes */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <div className={`flex-1 flex items-center h-11 rounded-xl text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 hover:bg-white/20 transition-all" style={{borderRight:"1px solid rgba(255,255,255,0.15)"}}>
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="flex-1 text-center">{MESES[filtroMes - 1]} - {filtroAno}</span>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 hover:bg-white/20 transition-all" style={{borderLeft:"1px solid rgba(255,255,255,0.15)"}}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="relative flex-1" ref={periodoDropRef}>
            <button onClick={() => setPeriodoDropOpen(v => !v)}
              className={`w-full flex items-center justify-center gap-2 px-4 h-11 rounded-xl text-sm font-semibold transition-all ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}>
              {usandoOutroPeriodo && customRange ? `${customRange.inicio.split("-").reverse().join("/")} — ${customRange.fim.split("-").reverse().join("/")}` : "Período"}
              <ChevronDown className={`w-4 h-4 transition-transform ${periodoDropOpen ? "rotate-180" : ""}`} />
            </button>
            {periodoDropOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 space-y-3">
                <p className="text-xs text-gray-400 font-medium">Selecione o período</p>
                <div><label className="block text-xs text-gray-500 mb-1">De</label>
                  <input type="date" value={outroPeriodoInicio} onChange={e => setOutroPeriodoInicio(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Até</label>
                  <input type="date" value={outroPeriodoFim} onChange={e => setOutroPeriodoFim(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
                <div className="flex gap-2">
                  <button onClick={() => setPeriodoDropOpen(false)} className="flex-1 py-2 text-xs text-gray-400 border border-gray-700 rounded-lg hover:text-white">Cancelar</button>
                  <button onClick={aplicarOutroPeriodo} className="flex-1 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">Aplicar</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <FluxoMes financeiro={financeiroPeriodo} />
      </div>


      {/* Pizza linha - Centralizadas */}
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
        {/* Status OS */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <SectionTitle>Vendas Status</SectionTitle>
          {statusData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {statusData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      <span className="text-gray-400 text-sm">{d.name}</span>
                    </div>
                    <span className="text-white font-semibold text-sm">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">Sem dados</p>
          )}
        </div>

        {/* OS Pagas pelo Financeiro */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <SectionTitle>Vendas Financeiro</SectionTitle>
          {osPagasData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={osPagasData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value">
                    {osPagasData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {osPagasData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      <span className="text-gray-400 text-sm">{d.name}</span>
                    </div>
                    <span className="text-white font-semibold text-sm">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">Sem dados</p>
          )}
        </div>
        </div>
      </div>

      {/* Cards Produtos e Ativos */}
      {(() => {
        const totalItens = estoque.length;
        const estoqueBaixo = estoque.filter(e => Number(e.quantidade || 0) <= Number(e.estoque_minimo || 0)).length;
        const valorCusto = estoque.reduce((acc, e) => acc + Number(e.valor_custo || 0) * Number(e.quantidade || 0), 0);
        const valorVenda = estoque.reduce((acc, e) => acc + Number(e.valor_venda || 0) * Number(e.quantidade || 0), 0);
        const totalAtivos = ativos.length;
        const valorCompraAtivos = ativos.reduce((acc, a) => acc + Number(a.valor_aquisicao || 0) * Number(a.quantidade || 1), 0);
        const valorAtualAtivos = ativos.reduce((acc, a) => acc + Number(a.valor_atual || 0), 0);
        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs">Total de Itens</p>
                <p className="text-white font-bold text-lg">{totalItens}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs">Estoque Baixo</p>
                <p className="text-white font-bold text-lg">{estoqueBaixo}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs">Valor Total (Custo)</p>
                <p className="text-white font-bold text-sm">{fmt(valorCusto)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs">Valor Total (Venda)</p>
                <p className="text-green-400 font-bold text-sm">{fmt(valorVenda)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs">Ativos</p>
                <p className="text-green-400 font-bold text-lg">{totalAtivos}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs">Valor de Compra</p>
                <p className="text-red-400 font-bold text-sm">{fmt(valorCompraAtivos)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs">Valor Atual</p>
                <p className="text-green-400 font-bold text-sm">{fmt(valorAtualAtivos)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs">Custo Produtos + Ativos</p>
                <p className="text-yellow-400 font-bold text-sm">{fmt(valorCusto + valorAtualAtivos)}</p>
              </div>
            </div>
          </>
        );
      })()}

      {/* Gráfico Receita x Despesa x Lucro */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-base">Receita x Despesa x Lucro</h2>
          <div className="flex gap-1">
            {[3, 6, 12].map(m => (
              <button
                key={m}
                onClick={() => setPeriodoMeses(m)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={periodoMeses === m ? { background: "#062C9B", color: "#fff" } : { background: "#1f2937", color: "#6b7280", border: "1px solid #374151" }}
              >
                {m === 12 ? "1 ano" : `${m}m`}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={fluxoPorMes} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
              formatter={(value) => {
                const colors = { Receita: GREEN, Despesa: RED, Lucro: BLUE };
                return <span style={{ color: colors[value] || "#9ca3af" }}>{value}</span>;
              }}
            />
            <Bar dataKey="receita" name="Receita" fill={GREEN} radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesa" name="Despesa" fill={RED} radius={[4, 4, 0, 0]} />
            <Bar dataKey="lucro" name="Lucro" fill={BLUE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}