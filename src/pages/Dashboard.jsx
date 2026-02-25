import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  ClipboardList, Users, Package, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle
} from "lucide-react";
import FluxoMes from "../components/dashboard/FluxoMes";

export default function Dashboard() {
  const [stats, setStats] = useState({ os: [], clientes: [], estoque: [], financeiro: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [os, clientes, estoque, financeiro] = await Promise.all([
        base44.entities.OrdemServico.list("-created_date", 50),
        base44.entities.Cliente.list("-created_date", 100),
        base44.entities.Estoque.list("-created_date", 100),
        base44.entities.Financeiro.list("-created_date", 100),
      ]);
      setStats({ os, clientes, estoque, financeiro });
      setLoading(false);
    };
    load();
  }, []);

  const osAbertas = stats.os.filter(o => ["Orçamento", "Aprovado", "Em Andamento", "Aguardando Peças"].includes(o.status));
  const osConcluidas = stats.os.filter(o => o.status === "Concluído" || o.status === "Entregue");
  const estoqueBaixo = stats.estoque.filter(e => e.quantidade <= e.estoque_minimo);
  const receitasMes = stats.financeiro.filter(f => f.tipo === "Receita" && f.status === "Pago").reduce((acc, f) => acc + (f.valor || 0), 0);
  const despesasMes = stats.financeiro.filter(f => f.tipo === "Despesa" && f.status === "Pago").reduce((acc, f) => acc + (f.valor || 0), 0);
  const pendentes = stats.financeiro.filter(f => f.status === "Pendente" || f.status === "Atrasado");

  const chartData = ["Jan","Fev","Mar","Abr","Mai","Jun"].map((mes, i) => ({
    mes,
    receitas: Math.round(Math.random() * 8000 + 3000),
    despesas: Math.round(Math.random() * 4000 + 1000),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fluxo do Mês */}
      <FluxoMes financeiro={stats.financeiro} />



      {/* Finance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Receitas</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/10">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-400">R$ {receitasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Despesas</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10">
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-400">R$ {despesasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Saldo</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500/10">
              <DollarSign className="w-4 h-4 text-orange-400" />
            </div>
          </div>
          <p className={`text-2xl font-bold ${receitasMes - despesasMes >= 0 ? "text-orange-400" : "text-red-400"}`}>
            R$ {(receitasMes - despesasMes).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={ClipboardList} label="OS Abertas" value={osAbertas.length} color="orange" link="OrdemServico" />
        <StatCard icon={Users} label="Clientes" value={stats.clientes.length} color="blue" link="Clientes" />
        <StatCard icon={AlertTriangle} label="Estoque Baixo" value={estoqueBaixo.length} color="red" link="Estoque" />
      </div>

      {/* Fluxo de Caixa Anual */}
      <FluxoCaixa items={stats.financeiro} />

    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, link }) {
  const colors = {
    orange: "text-orange-400 bg-orange-500/10",
    green: "text-green-400 bg-green-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    red: "text-red-400 bg-red-500/10",
  };
  const iconColor = {
    orange: "text-orange-400",
    green: "text-green-400",
    blue: "text-blue-400",
    red: "text-red-400",
  };
  return (
    <Link to={createPageUrl(link)} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all block">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className={`w-4 h-4 ${iconColor[color]}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${iconColor[color]}`}>{value}</p>
    </Link>
  );
}

function FluxoCaixa({ items }) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const ano = new Date().getFullYear();

  const dados = meses.map((mes, i) => {
    const mesNum = String(i + 1).padStart(2, "0");
    const prefixo = `${ano}-${mesNum}`;
    const r = items.filter(x => x.tipo === "Receita" && x.status === "Pago" && x.data_pagamento?.startsWith(prefixo)).reduce((a, x) => a + Number(x.valor || 0), 0);
    const d = items.filter(x => x.tipo === "Despesa" && x.status === "Pago" && x.data_pagamento?.startsWith(prefixo)).reduce((a, x) => a + Number(x.valor || 0), 0);
    return { mes, receitas: r, despesas: d, saldo: r - d };
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold">Fluxo de Caixa — {ano}</h3>
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
            {dados.map((d, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-white">{d.mes}</td>
                <td className="px-4 py-3 text-right text-green-400">R$ {d.receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-red-400">R$ {d.despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className={`px-4 py-3 text-right font-bold ${d.saldo >= 0 ? "text-orange-400" : "text-red-400"}`}>
                  R$ {d.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    "Orçamento": "bg-gray-500/10 text-gray-400",
    "Aprovado": "bg-blue-500/10 text-blue-400",
    "Em Andamento": "bg-orange-500/10 text-orange-400",
    "Aguardando Peças": "bg-yellow-500/10 text-yellow-400",
    "Concluído": "bg-green-500/10 text-green-400",
    "Entregue": "bg-teal-500/10 text-teal-400",
    "Cancelado": "bg-red-500/10 text-red-400",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${map[status] || "bg-gray-500/10 text-gray-400"}`}>
      {status}
    </span>
  );
}