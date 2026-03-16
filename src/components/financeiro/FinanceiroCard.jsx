import React, { useState, useRef, useEffect } from "react";
import { Edit, Trash2, ChevronDown } from "lucide-react";

const STATUS_OPTIONS = ["Pendente", "Pago", "Atrasado"];
const PAGAMENTO_OPTIONS = ["", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Boleto", "Transferência", "A Prazo", "A Combinar"];

const STATUS_BG = {
  "Pendente": "#f59e0b",
  "Pago":     "#16a34a",
  "Atrasado": "#dc2626",
};

function fmtData(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return parts[2] + "/" + parts[1] + "/" + String(parts[0]).slice(2);
}

function fmtValor(v) {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export default function FinanceiroCard({ item, onEdit, onDelete, onAlterarStatus, onAlterarPagamento }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const statusRef = useRef(null);
  const statusBtnRef = useRef(null);
  const pagamentoRef = useRef(null);
  const pagamentoBtnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target) && statusBtnRef.current && !statusBtnRef.current.contains(e.target)) setStatusOpen(false);
      if (pagamentoRef.current && !pagamentoRef.current.contains(e.target) && pagamentoBtnRef.current && !pagamentoBtnRef.current.contains(e.target)) setPagamentoOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const style = STATUS_STYLE[item.status] || { badge: "bg-gray-600 text-white" };
  const isReceita = item.tipo === "Receita";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all">
      {/* Linha 1: tipo badge + status + ações */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${isReceita ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
          {item.tipo}
        </span>

        {/* Status dropdown */}
        <div className="relative">
          <button
            ref={statusBtnRef}
            onClick={() => setStatusOpen(v => !v)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold hover:opacity-90 transition-all ${style.badge}`}
          >
            {item.status || "—"}
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          </button>
          {statusOpen && (
            <div ref={statusRef} className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-36 py-1 z-50">
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => { onAlterarStatus(item, s); setStatusOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all ${item.status === s ? "text-orange-400" : "text-gray-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button onClick={() => onEdit?.(item)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-all" title="Editar">
          <Edit className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete?.(item.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-all" title="Excluir">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grade de infos */}
      <div className="grid grid-cols-2 border-t border-gray-800">
        {/* Descrição — ocupa 2 colunas */}
        <div className="col-span-2 px-3 py-2.5 border-b border-gray-800">
          <p className="text-white text-xs font-medium uppercase tracking-wider mb-1">Descrição</p>
          <p className="text-white text-xs font-medium truncate">{item.descricao || "—"}</p>
        </div>

        {/* Categoria */}
        <div className="px-3 py-2.5 border-r border-gray-800">
          <p className="text-white text-xs font-medium uppercase tracking-wider mb-1">Categoria</p>
          <p className="text-white text-xs font-medium truncate">{item.categoria || "—"}</p>
        </div>

        {/* Forma Pagamento */}
        <div className="px-3 py-2.5 relative">
          <p className="text-white text-xs font-medium uppercase tracking-wider mb-1">Pagamento</p>
          <button
            ref={pagamentoBtnRef}
            onClick={() => setPagamentoOpen(v => !v)}
            className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 font-medium transition-all"
          >
            {item.forma_pagamento || "A Combinar"}
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          </button>
          {pagamentoOpen && (
            <div ref={pagamentoRef} className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-44 py-1 z-50">
              {PAGAMENTO_OPTIONS.filter(p => p !== "").map(p => (
                <button key={p} onClick={() => { onAlterarPagamento?.(item, p); setPagamentoOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all ${item.forma_pagamento === p ? "text-orange-400" : "text-gray-300"}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vencimento */}
        <div className="px-3 py-2.5 border-t border-r border-gray-800">
          <p className="text-white text-xs font-medium uppercase tracking-wider mb-1">Vencimento</p>
          <p className="text-white text-xs font-medium">{fmtData(item.data_vencimento)}</p>
        </div>

        {/* Valor */}
        <div className="px-3 py-2.5 border-t border-gray-800">
          <p className="text-white text-xs font-medium uppercase tracking-wider mb-1">Valor</p>
          <p className="text-white text-xs font-medium">
            {fmtValor(item.valor)}
          </p>
        </div>
      </div>
    </div>
  );
}