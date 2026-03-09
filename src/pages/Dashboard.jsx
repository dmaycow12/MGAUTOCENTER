import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  ClipboardList, DollarSign, Users, Package,
  TrendingUp, TrendingDown, Clock, CheckCircle,
  AlertCircle
} from "lucide-react";

const RED = "#cc0000";
const ORANGE = "#f97316";
const GREEN = "#00C957";
const BLUE = "#062C9B";
const YELLOW = "#FFCC00";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

  useEffect(() => {
    Promise.all([
      base44.entities.OrdemServico.list("-created_date", 500),
      base44.entities.Financeiro.list("-created_date", 500),
      base44.entities.Cliente.list("-created_date", 500),
      base44.entities.Estoque.list("-created_date", 500),
    ]).then(([o, f, c, e]) => {
      setOrdens(o);
      setFinanceiro(f);
      setClientes(c);
      setEstoque(e);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: RED, borderTopColor: "transparent" }} />
    </div>
  );

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();

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

  // Gráfico OS por mês (últimos 6 meses)
  const osPorMes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(anoAtual, mesAtual - 5 + i, 1);
    const m = d.getMonth();
    const a = d.getFullYear();
    const key = `${a}-${String(m + 1).padStart(2, "0")}`;
    const total = ordens.filter(o => o.data_entrada?.startsWith(key)).length;
    const concluidas = ordens.filter(o => o.data_entrada?.startsWith(key) && o.status === "Concluído").length;
    return { mes: MESES[m], total, concluidas };
  });

  // Gráfico Receita x Despesa por mês (últimos 6 meses)
  const fluxoPorMes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(anoAtual, mesAtual - 5 + i, 1);
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

  // Pizza status OS (sem Orçamento)
  const statusData = [
    { name: "Aberto", value: osAbertas, color: BLUE },
    { name: "Concluído", value: osConcluidas, color: GREEN },
  ].filter(d => d.value > 0);

  // OS Pagas: status Concluído E todas as parcelas do financeiro pagas
  const osPagasPorMes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(anoAtual, mesAtual - 5 + i, 1);
    const m = d.getMonth();
    const a = d.getFullYear();
    const key = `${a}-${String(m + 1).padStart(2, "0")}`;
    const count = ordens.filter(o => {
      if (o.status !== "Concluído") return false;
      if (!o.data_conclusao?.startsWith(key) && !o.data_entrada?.startsWith(key)) return false;
      const parcelas = financeiro.filter(f => f.ordem_servico_id === o.id);
      if (parcelas.length === 0) return false;
      return parcelas.every(p => p.status === "Pago");
    }).length;
    return { mes: MESES[m], pagas: count };
  });



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
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardList} label="OS do Mês" value={osMes} sub={`${osAbertas} abertas`} color={RED} />
        <KpiCard icon={DollarSign} label="Receita do Mês" value={fmt(receitaMes)} sub={`Recebido: ${fmt(receitaPaga)}`} color={GREEN} />
        <KpiCard icon={Users} label="Clientes" value={clientes.length} sub="cadastrados" color={BLUE} />
        <KpiCard icon={Package} label="Estoque Crítico" value={estoqueCritico} sub="itens abaixo do mínimo" color={estoqueCritico > 0 ? RED : GREEN} />
      </div>

      {/* KPIs financeiros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Despesa do Mês" value={fmt(despesaMes)} color={ORANGE} />
        <KpiCard icon={CheckCircle} label="OS Concluídas" value={osConcluidas} sub="no total" color={GREEN} />
        <KpiCard icon={Clock} label="Pendentes" value={pendentes} sub="lançamentos" color={YELLOW} />
        <KpiCard icon={AlertCircle} label="Atrasados" value={atrasados} sub="lançamentos" color={atrasados > 0 ? RED : GREEN} />
      </div>

      {/* Gráficos linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* OS por mês */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <SectionTitle>Ordens de Serviço — Últimos 6 Meses</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={osPorMes} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
              <Bar dataKey="total" name="Total" fill={ORANGE} radius={[4, 4, 0, 0]} />
              <Bar dataKey="concluidas" name="Concluídas" fill={GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Receita x Despesa */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <SectionTitle>Receita x Despesa — Últimos 6 Meses</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fluxoPorMes} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
              <Bar dataKey="receita" name="Receita" fill={GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill={RED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lucro líquido linha */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <SectionTitle>Lucro Líquido — Últimos 6 Meses</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={fluxoPorMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="lucro" name="Lucro" stroke={ORANGE} strokeWidth={2} dot={{ fill: ORANGE, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pizza linha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status OS */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <SectionTitle>Status das OS</SectionTitle>
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

        {/* OS Pagas por mês */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <SectionTitle>OS Pagas (todas parcelas pagas)</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={osPagasPorMes} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pagas" name="OS Pagas" fill={GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumo financeiro mês */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <SectionTitle>Resumo Financeiro do Mês</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1">Receita Prevista</p>
            <p className="text-green-400 font-bold text-lg">{fmt(receitaMes)}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1">Receita Recebida</p>
            <p className="text-green-300 font-bold text-lg">{fmt(receitaPaga)}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1">Despesas</p>
            <p className="text-red-400 font-bold text-lg">{fmt(despesaMes)}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1">Saldo Previsto</p>
            <p className={`font-bold text-lg ${receitaMes - despesaMes >= 0 ? "text-orange-400" : "text-red-400"}`}>{fmt(receitaMes - despesaMes)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}