import React from "react";

function CircleProgress({ percent, color, textColor = "white", trackColor = "#1f2937" }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(percent, 0), 100) / 100 * circ;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke={trackColor} strokeWidth="7" />
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
      <text x="36" y="41" textAnchor="middle" fontSize="11" fontWeight="bold" fill={textColor}>
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Card({ title, realizado, previsto, color, bg, bgColor }) {
  const falta = Math.max(previsto - realizado, 0);
  const percent = previsto > 0 ? (realizado / previsto) * 100 : 0;

  return (
    <div className={`flex-1 ${bg} rounded-xl px-6 py-5 flex items-center gap-5`} style={bgColor ? { background: bgColor } : {}}>
      <CircleProgress percent={percent} color={color} />
      <div className="space-y-1">
        <p className="text-base font-bold" style={{ color: bgColor === "#00ff00" ? "#000" : "#fff" }}>{title}</p>
        <p className="text-sm font-bold" style={{ color: bgColor === "#00ff00" ? "#000" : "#fff" }}>Realizado: {fmt(realizado)}</p>
        <p className="text-sm font-bold" style={{ color: bgColor === "#00ff00" ? "#000" : "#fff" }}>Falta: {fmt(falta)}</p>
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
      <Card title="Recebimentos do mês" realizado={recRealizado} previsto={recPrevisto} color="#000000" bg="border border-green-400/40" bgColor="#00ff00" />
      <Card title="Pagamentos do mês" realizado={pagRealizado} previsto={pagPrevisto} color="#ffffff" bg="border border-red-600/40" bgColor="#cc0000" />
    </div>
  );
}