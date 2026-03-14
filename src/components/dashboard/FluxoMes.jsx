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

function Card({ title, pago, previsto, color, bg, bgColor, borderColor }) {
  const falta = Math.max(previsto - pago, 0);
  const percent = previsto > 0 ? (pago / previsto) * 100 : 0;
  const textColor = "#fff";
  const trackColor = "#1f2937";

  return (
    <div className={`flex-1 ${bg} rounded-xl px-6 py-5 flex items-center justify-center gap-5`} style={{ background: bgColor }}>
      <CircleProgress percent={percent} color={color} textColor={textColor} trackColor={trackColor} />
      <div className="space-y-1 text-center">
        <p className="text-base font-bold" style={{ color: textColor }}>{title}</p>
        <p className="text-sm font-bold" style={{ color: textColor }}>Pago: {fmt(pago)}</p>
        <p className="text-sm font-bold" style={{ color: textColor }}>Falta: {fmt(falta)}</p>
      </div>
    </div>
  );
}

export default function FluxoMes({ financeiro }) {
  const items = financeiro || [];

  const recPrevisto = items.filter(f => f.tipo === "Receita").reduce((a, f) => a + (f.valor || 0), 0);
  const recPago = items.filter(f => f.tipo === "Receita" && f.status === "Pago").reduce((a, f) => a + (f.valor || 0), 0);

  const pagPrevisto = items.filter(f => f.tipo === "Despesa").reduce((a, f) => a + (f.valor || 0), 0);
  const pagPago = items.filter(f => f.tipo === "Despesa" && f.status === "Pago").reduce((a, f) => a + (f.valor || 0), 0);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Card title="Receita" pago={recPago} previsto={recPrevisto} color="#4ade80" bg="" bgColor="#052e16" borderColor="#16a34a" />
      <Card title="Despesa" pago={pagPago} previsto={pagPrevisto} color="#f87171" bg="" bgColor="#2d0a0a" borderColor="#991b1b" />
    </div>
  );
}