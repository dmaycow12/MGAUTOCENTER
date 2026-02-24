import React from "react";

export default function PeriodFilter({ period, setPeriod }) {
  const now = new Date();
  const options = [
    { key: "today", label: "Hoje" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mês" },
    { key: "year", label: "Ano" },
    { key: "all", label: "Tudo" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => setPeriod(opt.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            period === opt.key
              ? "bg-orange-500 text-white"
              : "bg-gray-800 text-gray-300 hover:text-white border border-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}