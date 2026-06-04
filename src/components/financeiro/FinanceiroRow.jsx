import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Edit, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const PAGAMENTO_OPTIONS = ["A Combinar", "Boleto", "Cartão", "Dinheiro", "PIX"];
const STATUS_OPTIONS = ["Pendente", "Pago"];
const STATUS_BG = { "Pendente": "#cc0000", "Pago": "#16a34a", "Atrasado": "#dc2626" };

export default function FinanceiroRow({ item, onEdit, onDelete, onAlterarStatus, onAlterarPagamento }) {
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const pagamentoRef = useRef(null);
  const pagamentoBtnRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const calcPos = () => {
    if (!pagamentoBtnRef.current) return;
    const rect = pagamentoBtnRef.current.getBoundingClientRect();
    const itemHeight = PAGAMENTO_OPTIONS.length * 36;
    const openUp = window.innerHeight - rect.bottom < itemHeight + 8;
    setDropPos({
      top: openUp ? rect.top - itemHeight - 4 : rect.bottom + 4,
      left: rect.right - 144,
      width: 144,
    });
  };

  useEffect(() => {
    const handler = (e) => {
      if (pagamentoRef.current && !pagamentoRef.current.contains(e.target) &&
          pagamentoBtnRef.current && !pagamentoBtnRef.current.contains(e.target)) {
        setPagamentoOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!pagamentoOpen) return;
    const onScroll = () => calcPos();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [pagamentoOpen]);

  const abrirDropdown = () => {
    if (item.status === "Pago") return;
    calcPos();
    setPagamentoOpen(v => !v);
  };

  const fmt = v => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3 hover:border-gray-600 transition-all">
      {/* Linha 1: Tipo | Descrição */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`text-xs px-2 py-1 rounded-full font-bold flex-shrink-0 w-fit ${item.tipo === "Receita" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {item.tipo}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{item.descricao}</p>
            {item.categoria && item.categoria !== "Ordem de Venda" && (
              <p className="text-gray-500 text-xs">{item.categoria}</p>
            )}
          </div>
        </div>
        <span className={`font-bold text-sm flex-shrink-0 ${item.tipo === "Receita" ? "text-green-400" : "text-red-400"}`}>
          R$ {fmt(item.valor)}
        </span>
      </div>

      {/* Linha 2: Data | Status | Forma Pagamento */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Data */}
        <div className="flex items-center gap-1.5 bg-gray-700/30 px-2 py-1 rounded-lg">
          <span className="text-gray-400">📅</span>
          <span className="text-gray-300">{item.data_vencimento ? item.data_vencimento.split("-").reverse().join("/") : "—"}</span>
        </div>

        {/* Status */}
        <div className="flex gap-1">
          {STATUS_OPTIONS.map(s => {
            const bloqueado = s === "Pago" && (!item.forma_pagamento || item.forma_pagamento === "A Combinar");
            const isActive = item.status === s || (s === "Pendente" && item.status === "Atrasado");
            return (
              <button
                key={s}
                onClick={() => {
                  if (bloqueado) {
                    toast.error("Defina a forma de pagamento primeiro.");
                    return;
                  }
                  onAlterarStatus(item, s);
                }}
                className="px-2 py-1 rounded-lg font-bold transition-all"
                style={{
                  background: isActive ? STATUS_BG[s] : "#374151",
                  color: "#fff",
                  opacity: isActive ? 1 : bloqueado ? 0.25 : 0.45,
                  cursor: bloqueado ? "not-allowed" : "pointer",
                }}
                title={bloqueado ? "Selecione forma de pagamento" : undefined}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Forma Pagamento */}
        <div className="relative flex-shrink-0 ml-auto">
          <button
            ref={pagamentoBtnRef}
            onClick={abrirDropdown}
            className="px-2 py-1 rounded-lg font-medium transition-all flex items-center gap-1"
            style={{
              background: "#374151",
              color: item.status === "Pago" ? "#9ca3af" : "#fff",
              cursor: item.status === "Pago" ? "not-allowed" : "pointer",
              opacity: item.status === "Pago" ? 0.6 : 1,
            }}
            title={item.status === "Pago" ? "Não pode alterar após pagamento" : "Clique para alterar"}
          >
            <span>{item.forma_pagamento || "—"}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {pagamentoOpen && createPortal(
            <div
              ref={pagamentoRef}
              style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 999999 }}
              className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
            >
              {PAGAMENTO_OPTIONS.map(op => (
                <button
                  key={op}
                  onClick={() => {
                    if (item.status === "Pago") return;
                    onAlterarPagamento(item, op);
                    setPagamentoOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-all"
                  style={{ background: item.forma_pagamento === op ? "#062C9B" : "transparent", color: item.forma_pagamento === op ? "#fff" : undefined }}
                >
                  {op}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Linha 3: Ações */}
      <div className="flex justify-end gap-2 border-t border-gray-700 pt-3">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-700 transition-all"
        >
          <Edit className="w-3.5 h-3.5" /> Editar
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" /> Excluir
        </button>
      </div>
    </div>
  );
}