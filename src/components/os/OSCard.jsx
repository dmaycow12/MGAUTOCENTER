import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Pencil, Printer, Trash2, FileText } from "lucide-react";

function WhatsAppIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const STATUS_OPTIONS = ["Em Aberto", "Concluído", "Cancelado"];

const STATUS_COLOR = {
  "Em Aberto":  "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  "Concluído":  "bg-green-500/10 text-green-400 border-green-500/30",
  "Cancelado":  "bg-red-500/10 text-red-400 border-red-500/30",
};

function fmtData(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${String(parts[0]).slice(2)}`;
}

function fmtValor(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OSCard({ os, onEdit, onDelete, onRefresh }) {
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const statusRef = useRef(null);
  const statusBtnRef = useRef(null);
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target) && statusBtnRef.current && !statusBtnRef.current.contains(e.target)) setStatusOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target) && menuBtnRef.current && !menuBtnRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const alterarStatus = async (novoStatus) => {
    setStatusOpen(false);
    await base44.entities.OrdemServico.update(os.id, { status: novoStatus });
    onRefresh?.();
  };

  const enviarOrcamento = () => {
    setMenuOpen(false);
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const msg = encodeURIComponent(
      `Olá ${os.cliente_nome || ""}! Segue o orçamento da OS #${os.numero}:\n` +
      `Veículo: ${os.veiculo_placa || ""} ${os.veiculo_modelo || ""}\n` +
      `Serviços: ${fmtValor(os.valor_servicos)}\n` +
      `Peças: ${fmtValor(os.valor_pecas)}\n` +
      `Total: ${fmtValor(os.valor_total)}`
    );
    const fone = telefone.startsWith("55") ? telefone : `55${telefone}`;
    window.open(`https://wa.me/${fone}?text=${msg}`, "_blank");
  };

  const chamarWhatsApp = () => {
    setMenuOpen(false);
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const fone = telefone.startsWith("55") ? telefone : `55${telefone}`;
    window.open(`https://wa.me/${fone}`, "_blank");
  };

  const emitirNF = (tipo) => {
    setMenuOpen(false);
    const params = new URLSearchParams({
      emitir: "1",
      tipo,
      os_id: os.id,
      os_numero: os.numero || "",
      cliente_id: os.cliente_id || "",
      cliente_nome: encodeURIComponent(os.cliente_nome || ""),
      valor: String(os.valor_total || 0),
    });
    navigate(`${createPageUrl("NotasFiscais")}?${params.toString()}`);
  };

  const imprimir = () => {
    setMenuOpen(false);
    const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const servicos = (os.servicos || []).map(s => `<tr><td>${s.descricao || ""}</td><td>${s.tecnico || "—"}</td><td style="text-align:right">R$ ${fmt(s.valor)}</td></tr>`).join("");
    const pecas = (os.pecas || []).map(p => `<tr><td>${p.descricao || ""}</td><td style="text-align:center">${p.quantidade || 1}</td><td style="text-align:right">R$ ${fmt(p.valor_unitario)}</td><td style="text-align:right">R$ ${fmt(p.valor_total)}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>OS #${os.numero}</title>
    <style>body{font-family:Arial,sans-serif;padding:20mm;color:#111;max-width:210mm;margin:0 auto}h1{font-size:16pt}table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#f3f4f6;border:1px solid #ddd;padding:4px 8px;text-align:left;font-size:9pt}td{border:1px solid #ddd;padding:4px 8px;font-size:9pt}.total{font-size:14pt;font-weight:bold;color:#f97316}@media print{@page{size:A4;margin:15mm}body{padding:0}}</style>
    </head><body>
    <h1>Ordem de Serviço #${os.numero}</h1>
    <p><b>Cliente:</b> ${os.cliente_nome || "—"} &nbsp;&nbsp; <b>Placa:</b> ${os.veiculo_placa || "—"} &nbsp;&nbsp; <b>Veículo:</b> ${os.veiculo_modelo || "—"} ${os.veiculo_ano || ""}</p>
    <p><b>Data:</b> ${fmtData(os.data_entrada)} &nbsp;&nbsp; <b>KM:</b> ${os.quilometragem || "—"} &nbsp;&nbsp; <b>Status:</b> ${os.status || "—"}</p>
    ${os.defeito_relatado ? `<p><b>Defeito relatado:</b> ${os.defeito_relatado}</p>` : ""}
    ${os.diagnostico ? `<p><b>Diagnóstico:</b> ${os.diagnostico}</p>` : ""}
    ${servicos ? `<h3>Serviços</h3><table><thead><tr><th>Descrição</th><th>Técnico</th><th>Valor</th></tr></thead><tbody>${servicos}</tbody></table>` : ""}
    ${pecas ? `<h3>Peças</h3><table><thead><tr><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${pecas}</tbody></table>` : ""}
    <p style="margin-top:16px"><b>Serviços:</b> R$ ${fmt(os.valor_servicos)} &nbsp;&nbsp; <b>Peças:</b> R$ ${fmt(os.valor_pecas)} &nbsp;&nbsp; <b>Desconto:</b> R$ ${fmt(os.desconto)}</p>
    <p class="total">Total: R$ ${fmt(os.valor_total)}</p>
    ${os.forma_pagamento ? `<p><b>Pagamento:</b> ${os.forma_pagamento}${os.parcelas > 1 ? ` (${os.parcelas}x)` : ""}</p>` : ""}
    ${os.observacoes ? `<p><b>Obs:</b> ${os.observacoes}</p>` : ""}
    <script>window.onload=function(){window.print()}</script></body></html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  const colorClass = STATUS_COLOR[os.status] || "bg-gray-500/10 text-gray-400 border-gray-500/30";

  const veiculo = [os.veiculo_placa, os.veiculo_modelo].filter(Boolean).join(" • ");

  const menuItems = [
    { label: "Editar", icon: Pencil, action: () => { setMenuOpen(false); onEdit?.(); } },
    { label: "Imprimir", icon: Printer, action: imprimir },
    { label: "Excluir", icon: Trash2, action: () => { setMenuOpen(false); onDelete?.(); }, danger: true },
    { label: "Enviar orçamento", icon: WhatsAppIcon, action: enviarOrcamento, whatsapp: true },
    { label: "Chamar no WhatsApp", icon: WhatsAppIcon, action: chamarWhatsApp, whatsapp: true },
    { label: "Emitir NFe", icon: FileText, action: () => emitirNF("NFe") },
    { label: "Emitir NFSe", icon: FileText, action: () => emitirNF("NFSe") },
    { label: "Emitir NFCe", icon: FileText, action: () => emitirNF("NFCe") },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 transition-all">
      <div className="flex items-center gap-3 w-full min-w-0">

        {/* Número OS */}
        <span className="text-white font-bold text-sm flex-shrink-0 w-8 text-center">{os.numero || "—"}</span>

        {/* Cliente + Veículo + Placa */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate leading-tight">{os.cliente_nome || "—"}</p>
          <p className="text-gray-500 text-xs truncate leading-tight">
            {[os.veiculo_placa, veiculo].filter(Boolean).join(" • ")}
          </p>
        </div>

        {/* Data */}
        <span className="text-gray-500 text-xs flex-shrink-0 hidden sm:block">{fmtData(os.data_entrada)}</span>

        {/* Valor */}
        <span className="text-orange-400 font-bold text-sm flex-shrink-0 whitespace-nowrap">{fmtValor(os.valor_total)}</span>

        {/* Status dropdown */}
        <div className="relative flex-shrink-0">
          <button
            ref={statusBtnRef}
            onClick={() => setStatusOpen(v => !v)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium border whitespace-nowrap hover:opacity-80 transition-all ${colorClass}`}
          >
            {os.status || "—"}
            <ChevronDown className="w-3 h-3" />
          </button>
          {statusOpen && (
            <div
              ref={statusRef}
              className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-36 py-1 z-50"
            >
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => alterarStatus(s)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all ${os.status === s ? "text-orange-400" : "text-gray-300"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Menu de ações */}
        <div className="relative flex-shrink-0">
          <button
            ref={menuBtnRef}
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 text-gray-500 hover:text-white transition-all rounded-lg hover:bg-gray-800"
            title="Ações"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-52 py-1 z-50"
            >
              {menuItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    onClick={item.action}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all ${item.danger ? "text-red-400 hover:text-red-300" : "text-gray-300 hover:text-white"}`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}