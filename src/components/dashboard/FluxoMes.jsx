import React from "react";

function CircleProgress({ percent, color }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(percent, 0), 100) / 100 * circ;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#1f2937" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="36" y="41" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Card({ title, realizado, previsto, color }) {
  const falta = Math.max(previsto - realizado, 0);
  const percent = previsto > 0 ? (realizado / previsto) * 100 : 0;

  return (
    <div className="flex-1 bg-blue-900/30 border border-blue-800/40 rounded-xl p-4 flex items-center gap-4">
      <CircleProgress percent={percent} color={color} />
      <div className="space-y-0.5">
        <p className="text-white text-xs font-semibold mb-1">{title}</p>
        <p className="text-gray-300 text-xs">Realizado: <span className="text-white font-semibold">{fmt(realizado)}</span></p>
        <p className="text-gray-300 text-xs">Falta: <span className="text-white font-semibold">{fmt(falta)}</span></p>
        <p className="text-gray-300 text-xs">Previsto: <span className="text-white font-semibold">{fmt(previsto)}</span></p>
      </div>
    </div>
  );
}

export default function FluxoMes({ financeiro }) {
  const now = new Date();
  const mes = now.getMonth();
  const ano = now.getFullYear();

  const doMes = (financeiro || []).filter(f => {
    const ref = f.data_vencimento || f.data_pagamento || f.created_date;
    if (!ref) return false;
    const d = new Date(ref);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  // Recebimentos
  const recPrevisto = doMes.filter(f => f.tipo === "Receita").reduce((a, f) => a + (f.valor || 0), 0);
  const recRealizado = doMes.filter(f => f.tipo === "Receita" && f.status === "Pago").reduce((a, f) => a + (f.valor || 0), 0);

  // Pagamentos
  const pagPrevisto = doMes.filter(f => f.tipo === "Despesa").reduce((a, f) => a + (f.valor || 0), 0);
  const pagRealizado = doMes.filter(f => f.tipo === "Despesa" && f.status === "Pago").reduce((a, f) => a + (f.valor || 0), 0);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Card title="Recebimentos do mês" realizado={recRealizado} previsto={recPrevisto} color="#22c55e" />
      <Card title="Pagamentos do mês" realizado={pagRealizado} previsto={pagPrevisto} color="#f97316" />
    </div>
  );
}