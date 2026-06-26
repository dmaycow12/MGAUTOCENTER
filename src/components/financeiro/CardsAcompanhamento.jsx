import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Scale } from "lucide-react";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CardsAcompanhamento({ items }) {
  const dados = useMemo(() => {
    const receitas = items.filter(i => i.tipo === "Receita");
    const despesas = items.filter(i => i.tipo !== "Receita");
    const aReceber = receitas.filter(i => i.status !== "Pago").reduce((s, i) => s + Number(i.valor || 0), 0);
    const aPagar = despesas.filter(i => i.status !== "Pago").reduce((s, i) => s + Number(i.valor || 0), 0);
    const recebido = receitas.filter(i => i.status === "Pago").reduce((s, i) => s + Number(i.valor || 0), 0);
    const pago = despesas.filter(i => i.status === "Pago").reduce((s, i) => s + Number(i.valor || 0), 0);
    const saldo = recebido - pago;
    return { aReceber, aPagar, recebido, pago, saldo };
  }, [items]);

  const cards = [
    { label: "A Receber", value: dados.aReceber, icon: TrendingUp, color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
    { label: "A Pagar", value: dados.aPagar, icon: TrendingDown, color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
    { label: "Recebido", value: dados.recebido, icon: Wallet, color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    { label: "Pago", value: dados.pago, icon: PiggyBank, color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    { label: "Saldo", value: dados.saldo, icon: Scale, color: dados.saldo >= 0 ? "#3b82f6" : "#f59e0b", bg: dados.saldo >= 0 ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.12)" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0.5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-xl p-3 flex flex-col gap-1" style={{ background: c.bg, border: `1px solid ${c.color}33` }}>
            <div className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
              <span className="text-[10px] sm:text-xs font-semibold uppercase" style={{ color: c.color }}>{c.label}</span>
            </div>
            <span className="text-sm sm:text-base font-bold whitespace-nowrap" style={{ color: "#fff" }}>
              R$ {fmt(c.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}