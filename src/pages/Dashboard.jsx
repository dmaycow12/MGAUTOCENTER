import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  ClipboardList, Users, Package, TrendingUp, TrendingDown,
  DollarSign, AlertTriangle, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CircleProgress({ percent, color }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(percent, 0), 100) / 100 * circ;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76">
      <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 38 38)" style={{ transition: "stroke-dasharray 0.6s ease" }} />
      <text x="38" y="43" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

function FluxoCard({ title, realizado, previsto, bgClass, accentColor }) {
  const falta = Math.max(previsto - realizado, 0);
  const percent = previsto > 0 ? (realizado / previsto) * 100 : 0;
  return (
    <div className={`flex-1 rounded-2xl p-5 flex items-center gap-5 ${bgClass}`}>
      <CircleProgress percent={percent} color={accentColor} />
      <div>
        <p className="text-white/70 text-xs font-medium mb-2 uppercase tracking-wider">{title}</p>
        <p className="text-white text-sm">Realizado: <span className="font-bold">{fmt(realizado)}</span></p>
        <p className="text-white/70 text-sm mt-0.5">Falta: <span className="text-white font-semibold">{fmt(falta)}</span></p>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, link, prefix = "", suffix = "" }) {
  const palettes = {
    green:  { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
    red:    { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
    orange: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    blue:   { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    yellow: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  };
  const p = palettes[color] || palettes.orange;
  const inner = (
    <div className={`bg-gray-900 border ${p.border} rounded-2xl p-5 hover:border-opacity-60 transition-all h-full`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${p.bg}`}>
          <Icon className={`w-4 h-4 ${p.text}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${p.text}`}>{prefix}{value}{suffix}</p>
    </div>
  );
  return link ? <Link to={createPageUrl(link)} className="block">{inner}</Link> : <div>{inner}</div>;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs space-y-1 shadow-xl">
        <p className="text-gray-400 font-medium mb-2">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [stats, setStats] = useState({ os: [], clientes: [], estoque: [], financeiro: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.OrdemServico.list("-created_date", 50),
      base44.entities.Cliente.list("-created_date", 200),
      base44.entities.Estoque.list("-created_date", 200),
      base44.entities.Financeiro.list("-created_date", 200),
    ]).then(([os, clientes, estoque, financeiro]) => {
      setStats({ os, clientes, estoque, financeiro });
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const now = new Date();
  const mes = now.getMonth();
  const ano = now.getFullYear();

  // Fluxo do mês atual
  const doMes = stats.financeiro.filter(f => {
    const ref = f.data_vencimento || f.data_pagamento || f.created_date;
    if (!ref) return false;
    const d = new Date(ref);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const recPrevisto = doMes.filter(f => f.tipo === "Receita").reduce((a, f) => a + (f.valor || 0), 0);
  const recRealizado = doMes.filter(f => f.tipo === "Receita" && f.status === "Pago").reduce((a, f) => a + (f.valor || 0), 0);
  const pagPrevisto = doMes.filter(f => f.tipo === "Despesa").reduce((a, f) => a + (f.valor || 0), 0);
  const pagRealizado = doMes.filter(f => f.tipo === "Despesa" && f.status === "Pago").reduce((a, f) => a + (f.valor || 0), 0);

  const osAbertas = stats.os.filter(o => ["Orçamento", "Aprovado", "Em Andamento", "Aguardando Peças", "Aberta"].includes(o.status));
  const estoqueBaixo = stats.estoque.filter(e => e.quantidade <= (e.estoque_minimo || 0));
  const saldo = recRealizado - pagRealizado;

  // Fluxo de caixa anual
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const fluxoAnual = meses.map((m, i) => {
    const prefix = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const r = stats.financeiro.filter(x => x.tipo === "Receita" && x.status === "Pago" && x.data_pagamento?.startsWith(prefix)).reduce((a, x) => a + (x.valor || 0), 0);
    const d = stats.financeiro.filter(x => x.tipo === "Despesa" && x.status === "Pago" && x.data_pagamento?.startsWith(prefix)).reduce((a, x) => a + (x.valor || 0), 0);
    return { mes: m, Receitas: r, Despesas: d };
  });

  return (
    <div className="space-y-5">

      {/* Fluxo do Mês */}
      <div className="flex flex-col sm:flex-row gap-4">
        <FluxoCard
          title="Recebimentos do mês"
          realizado={recRealizado}
          previsto={recPrevisto}
          bgClass="bg-gradient-to-r from-green-700 to-green-600 border border-green-500/30"
          accentColor="#ffffff"
        />
        <FluxoCard
          title="Pagamentos do mês"
          realizado={pagRealizado}
          previsto={pagPrevisto}
          bgClass="bg-gradient-to-r from-red-700 to-red-600 border border-red-500/30"
          accentColor="#ffffff"
        />
      </div>

      {/* KPIs Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={TrendingUp} label="Receitas pagas" value={fmt(recRealizado)} color="green" />
        <KpiCard icon={TrendingDown} label="Despesas pagas" value={fmt(pagRealizado)} color="red" />
        <KpiCard icon={DollarSign} label="Saldo do mês" value={fmt(saldo)} color={saldo >= 0 ? "orange" : "red"} />
      </div>

      {/* KPIs Operacionais */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={ClipboardList} label="OS Abertas" value={osAbertas.length} color="orange" link="OrdemServico" />
        <KpiCard icon={Users} label="Clientes" value={stats.clientes.length} color="blue" link="Clientes" />
        <KpiCard icon={AlertTriangle} label="Est. Baixo" value={estoqueBaixo.length} color="yellow" link="Estoque" />
      </div>

      {/* Gráfico Fluxo de Caixa Anual */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Fluxo de Caixa — {ano}</h3>
          <span className="text-gray-500 text-xs">Receitas vs Despesas</span>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fluxoAnual} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v === 0 ? "0" : `${(v / 1000).toFixed(0)}k`} width={36} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Receitas</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Despesas</span>
          </div>
        </div>
      </div>

      {/* Tabela resumo mensal */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm">Resumo Mensal — {ano}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="px-4 py-3 text-left">Mês</th>
                <th className="px-4 py-3 text-right text-green-400">Receitas</th>
                <th className="px-4 py-3 text-right text-red-400">Despesas</th>
                <th className="px-4 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {fluxoAnual.map((d, i) => {
                const s = d.Receitas - d.Despesas;
                return (
                  <tr key={i} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-all">
                    <td className="px-4 py-2.5 text-gray-300 font-medium">{d.mes}</td>
                    <td className="px-4 py-2.5 text-right text-green-400">{fmt(d.Receitas)}</td>
                    <td className="px-4 py-2.5 text-right text-red-400">{fmt(d.Despesas)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${s >= 0 ? "text-orange-400" : "text-red-400"}`}>{fmt(s)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}