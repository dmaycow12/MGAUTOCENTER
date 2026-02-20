import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  ClipboardList, Users, Package, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle, Clock,
  CheckCircle, Plus, ArrowRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="OS Abertas" value={osAbertas.length} color="orange" link="OrdemServico" />
        <StatCard icon={CheckCircle} label="OS Concluídas" value={osConcluidas.length} color="green" link="OrdemServico" />
        <StatCard icon={Users} label="Clientes" value={stats.clientes.length} color="blue" link="Clientes" />
        <StatCard icon={AlertTriangle} label="Estoque Baixo" value={estoqueBaixo.length} color="red" link="Estoque" />
      </div>

      {/* Finance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Receitas</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-400">R$ {receitasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Despesas</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">R$ {despesasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Saldo</span>
            <DollarSign className="w-4 h-4 text-orange-400" />
          </div>
          <p className={`text-2xl font-bold ${receitasMes - despesasMes >= 0 ? "text-orange-400" : "text-red-400"}`}>
            R$ {(receitasMes - despesasMes).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas OS */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Últimas Ordens de Serviço</h2>
            <Link to={createPageUrl("OrdemServico")} className="text-orange-400 text-sm flex items-center gap-1 hover:text-orange-300">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats.os.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Nenhuma OS registrada</p>
          ) : (
            <div className="space-y-2">
              {stats.os.slice(0, 5).map(os => (
                <div key={os.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{os.numero} — {os.cliente_nome || "—"}</p>
                    <p className="text-xs text-gray-500">{os.veiculo_placa} {os.veiculo_modelo && `• ${os.veiculo_modelo}`}</p>
                  </div>
                  <StatusBadge status={os.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contas Pendentes */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Contas Pendentes</h2>
            <Link to={createPageUrl("Financeiro")} className="text-orange-400 text-sm flex items-center gap-1 hover:text-orange-300">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {pendentes.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Nenhuma conta pendente</p>
          ) : (
            <div className="space-y-2">
              {pendentes.slice(0, 5).map(f => (
                <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{f.descricao}</p>
                    <p className="text-xs text-gray-500">{f.tipo} • Venc: {f.data_vencimento || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${f.tipo === "Receita" ? "text-green-400" : "text-red-400"}`}>
                      R$ {(f.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === "Atrasado" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                      {f.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to={createPageUrl("OrdemServico")} className="bg-orange-500 hover:bg-orange-600 rounded-xl p-4 flex items-center gap-3 transition-all">
          <Plus className="w-5 h-5 text-white" />
          <span className="text-white font-medium text-sm">Nova OS</span>
        </Link>
        <Link to={createPageUrl("Clientes")} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-4 flex items-center gap-3 transition-all">
          <Users className="w-5 h-5 text-orange-400" />
          <span className="text-white font-medium text-sm">Novo Cliente</span>
        </Link>
        <Link to={createPageUrl("Estoque")} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-4 flex items-center gap-3 transition-all">
          <Package className="w-5 h-5 text-orange-400" />
          <span className="text-white font-medium text-sm">Estoque</span>
        </Link>
        <Link to={createPageUrl("Financeiro")} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-4 flex items-center gap-3 transition-all">
          <DollarSign className="w-5 h-5 text-orange-400" />
          <span className="text-white font-medium text-sm">Financeiro</span>
        </Link>
      </div>
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
  return (
    <Link to={createPageUrl(link)} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all block">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-gray-500 text-sm mt-1">{label}</p>
    </Link>
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