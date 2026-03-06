import React from "react";

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Card({ title, realizado, previsto, bgColor }) {
  const falta = Math.max(previsto - realizado, 0);

  return (
    <div className="flex-1 rounded-xl px-6 py-5" style={{ background: bgColor }}>
      <p className="text-white text-base font-bold mb-2">{title}</p>
      <p className="text-white text-sm font-bold">Realizado: {fmt(realizado)}</p>
      <p className="text-white text-sm font-bold">Falta: {fmt(falta)}</p>
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
      <Card title="Recebimentos do mês" realizado={recRealizado} previsto={recPrevisto} bgColor="#16a34a" />
      <Card title="Pagamentos do mês" realizado={pagRealizado} previsto={pagPrevisto} bgColor="#cc0000" />
    </div>
  );
}