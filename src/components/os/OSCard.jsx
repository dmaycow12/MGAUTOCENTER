import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Edit, Trash2, MessageCircle, FileText, ChevronDown } from "lucide-react";

const STATUS_OPTIONS = ["Orçamento", "Aprovado", "Em Andamento", "Aguardando Peças", "Concluído", "Entregue", "Cancelado"];

const STATUS_COLOR = {
  "Orçamento":         "bg-gray-500/10 text-gray-400 border-gray-500/30",
  "Aprovado":          "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Em Andamento":      "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  "Aguardando Peças":  "bg-orange-500/10 text-orange-400 border-orange-500/30",
  "Concluído":         "bg-green-500/10 text-green-400 border-green-500/30",
  "Entregue":          "bg-teal-500/10 text-teal-400 border-teal-500/30",
  "Cancelado":         "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function OSCard({ os, onEdit, onDelete, onRefresh }) {
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const dropdownRef = useRef(null);
  const btnRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setStatusOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleStatusClick = (e) => {
    e.stopPropagation();
    if (!statusOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    }
    setStatusOpen(v => !v);
  };

  const alterarStatus = async (e, novoStatus) => {
    e.stopPropagation();
    setStatusOpen(false);
    await base44.entities.OrdemServico.update(os.id, { status: novoStatus });
    onRefresh?.();
  };

  const enviarOrcamento = (e) => {
    e.stopPropagation();
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const msg = encodeURIComponent(
      `Olá ${os.cliente_nome || ""}! Segue o orçamento da OS #${os.numero}:\n` +
      `Veículo: ${os.veiculo_placa || ""} ${os.veiculo_modelo || ""}\n` +
      `Serviços: R$ ${Number(os.valor_servicos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
      `Peças: R$ ${Number(os.valor_pecas || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
      `Total: R$ ${Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    );
    const fone = telefone.startsWith("55") ? telefone : `55${telefone}`;
    window.open(`https://wa.me/${fone}?text=${msg}`, "_blank");
  };

  const emitirNF = (e) => {
    e.stopPropagation();
    const params = new URLSearchParams({
      emitir: "1",
      tipo: "NFSe",
      os_id: os.id,
      os_numero: os.numero || "",
      cliente_id: os.cliente_id || "",
      cliente_nome: encodeURIComponent(os.cliente_nome || ""),
      valor: String(os.valor_total || 0),
    });
    navigate(`${createPageUrl("NotasFiscais")}?${params.toString()}`);
  };

  const colorClass = STATUS_COLOR[os.status] || "bg-gray-500/10 text-gray-400 border-gray-500/30";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* OS Number + Status */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
            <span className="text-orange-400 font-bold text-xs">#{os.numero || "—"}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">{os.cliente_nome || "—"}</p>
            <p className="text-gray-500 text-xs truncate">
              {[os.veiculo_placa, os.veiculo_modelo, os.veiculo_ano].filter(Boolean).join(" • ")}
            </p>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="relative flex-shrink-0">
          <button
            ref={btnRef}
            onClick={handleStatusClick}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium border cursor-pointer hover:opacity-80 transition-all ${colorClass}`}
          >
            {os.status || "—"}
            <ChevronDown className="w-3 h-3" />
          </button>
          {statusOpen && (
            <div
              ref={dropdownRef}
              style={{ position: "fixed", top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
              className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-44 py-1"
            >
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={(e) => alterarStatus(e, s)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all ${os.status === s ? "text-orange-400" : "text-gray-300"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Valor */}
        <div className="text-right flex-shrink-0">
          <p className="text-orange-400 font-bold text-sm">
            R$ {Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-gray-600 text-xs">{os.data_entrada || ""}</p>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            title="Editar OS"
            className="p-1.5 text-gray-500 hover:text-blue-400 transition-all"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={enviarOrcamento}
            title="Enviar orçamento via WhatsApp"
            className="p-1.5 text-gray-500 hover:text-green-400 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          <button
            onClick={emitirNF}
            title="Emitir Nota Fiscal"
            className="p-1.5 text-gray-500 hover:text-orange-400 transition-all"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            title="Excluir OS"
            className="p-1.5 text-gray-500 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detalhes extras */}
      {(os.defeito_relatado || os.observacoes) && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <p className="text-gray-500 text-xs line-clamp-1">{os.defeito_relatado || os.observacoes}</p>
        </div>
      )}
    </div>
  );
}