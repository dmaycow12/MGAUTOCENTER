import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Edit, Trash2, Printer, ChevronDown, ChevronUp, MessageCircle, FileText } from "lucide-react";

const statusColors = {
  "Em Aberto": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Concluída": "bg-green-500/10 text-green-400 border-green-500/20",
  "Cancelada": "bg-red-500/10 text-red-400 border-red-500/20",
  // legados
  "Orçamento": "bg-gray-500/10 text-gray-400 border-gray-500/20",
  "Aprovado": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Em Andamento": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Concluído": "bg-green-500/10 text-green-400 border-green-500/20",
  "Entregue": "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "Cancelado": "bg-red-500/10 text-red-400 border-red-500/20",
};

const primeiroNome = (nome) => (nome || "").split(" ")[0];

export default function OSCard({ os, onEdit, onDelete, onRefresh }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const whatsappOrcamento = () => {
    const tel = (os.cliente_telefone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `*Oficina Pro - Orçamento OS #${os.numero}*\n\n` +
      `Olá ${primeiroNome(os.cliente_nome)}! 👋\n\n` +
      `Segue o orçamento do seu veículo ${os.veiculo_modelo || ""} (${os.veiculo_placa || ""}):\n\n` +
      (os.servicos || []).map(s => `• ${s.descricao} — R$ ${Number(s.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n") + "\n\n" +
      `💰 *Total: R$ ${Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\n` +
      `Aguardamos sua aprovação. ✅`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
    setMenuOpen(false);
  };

  const whatsappChamar = () => {
    const tel = (os.cliente_telefone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `*Oficina Pro* - Olá ${primeiroNome(os.cliente_nome)}! 👋\n` +
      `Seu veículo ${os.veiculo_modelo || ""} (${os.veiculo_placa || ""}) está pronto para retirada!\n` +
      `OS #${os.numero} — R$ ${Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
    setMenuOpen(false);
  };

  const emitirNF = (tipo) => {
    alert(`Emitir ${tipo} para OS #${os.numero}`);
    setMenuOpen(false);
  };

  const imprimir = () => {
    const conteudo = `
      <html><head><title>OS #${os.numero}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
        h1 { font-size: 18px; } h2 { font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        th { background: #f0f0f0; padding: 6px 8px; text-align: left; border: 1px solid #ddd; }
        td { padding: 6px 8px; border: 1px solid #ddd; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-top: 10px; }
        .total { text-align: right; margin-top: 10px; font-weight: bold; font-size: 15px; }
      </style></head><body>
      <h1>ORDEM DE SERVIÇO #${os.numero}</h1>
      <div class="info">
        <div><b>Cliente:</b> ${os.cliente_nome || ""}</div>
        <div><b>Data:</b> ${os.data_entrada || ""}</div>
        <div><b>Veículo:</b> ${os.veiculo_modelo || ""} ${os.veiculo_ano || ""}</div>
        <div><b>Placa:</b> ${os.veiculo_placa || ""}</div>
        <div><b>KM:</b> ${os.quilometragem || ""}</div>
        <div><b>Status:</b> ${os.status || ""}</div>
      </div>
      ${os.defeito_relatado ? `<h2>Defeito Relatado</h2><p>${os.defeito_relatado}</p>` : ""}
      ${os.diagnostico ? `<h2>Diagnóstico</h2><p>${os.diagnostico}</p>` : ""}
      ${(os.servicos || []).length > 0 ? `
        <h2>Serviços</h2>
        <table><tr><th>Descrição</th><th>Técnico</th><th>Valor</th></tr>
        ${(os.servicos || []).map(s => `<tr><td>${s.descricao || ""}</td><td>${s.tecnico || ""}</td><td>R$ ${Number(s.valor || 0).toFixed(2)}</td></tr>`).join("")}
        </table>` : ""}
      ${(os.pecas || []).length > 0 ? `
        <h2>Peças</h2>
        <table><tr><th>Descrição</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr>
        ${(os.pecas || []).map(p => `<tr><td>${p.descricao || ""}</td><td>${p.quantidade || ""}</td><td>R$ ${Number(p.valor_unitario || 0).toFixed(2)}</td><td>R$ ${Number(p.valor_total || 0).toFixed(2)}</td></tr>`).join("")}
        </table>` : ""}
      <div class="total">
        <div>Serviços: R$ ${Number(os.valor_servicos || 0).toFixed(2)}</div>
        <div>Peças: R$ ${Number(os.valor_pecas || 0).toFixed(2)}</div>
        ${os.desconto ? `<div>Desconto: R$ ${Number(os.desconto || 0).toFixed(2)}</div>` : ""}
        <div>TOTAL: R$ ${Number(os.valor_total || 0).toFixed(2)}</div>
      </div>
      ${os.observacoes ? `<h2>Observações</h2><p>${os.observacoes}</p>` : ""}
      </body></html>
    `;
    const win = window.open("", "_blank");
    win.document.write(conteudo);
    win.document.close();
    win.print();
  };

  const veiculo = [os.veiculo_placa, os.veiculo_modelo].filter(Boolean).join(" — ");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all">
      {/* Linha principal */}
      <div className="flex items-center gap-2 p-3 sm:p-4">
        {/* Dados */}
        <div className="flex-1 min-w-0 grid grid-cols-2 sm:flex sm:items-center sm:gap-4 gap-y-1">
          <span className="text-white font-bold text-sm sm:text-base whitespace-nowrap">
            OS #{os.numero}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium w-fit ${statusColors[os.status] || "bg-gray-500/10 text-gray-400"}`}>
            {os.status}
          </span>
          <span className="text-white text-sm font-medium col-span-2 sm:col-span-1 truncate">
            {primeiroNome(os.cliente_nome)}
          </span>
          {veiculo && (
            <span className="text-gray-400 text-xs truncate hidden sm:block">{veiculo}</span>
          )}
          {os.data_entrada && (
            <span className="text-gray-500 text-xs whitespace-nowrap">{os.data_entrada}</span>
          )}
        </div>

        {/* Mobile: veículo abaixo quando expandido */}

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            title="Editar"
            className="p-1.5 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-800 transition-all"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={imprimir}
            title="Imprimir"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            title="Excluir"
            className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Menu dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              title="Mais ações"
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-30 w-52 py-1 overflow-hidden">
                <MenuItem icon="💬" label="Enviar Orçamento WA" onClick={whatsappOrcamento} />
                <MenuItem icon="📲" label="Chamar no WhatsApp" onClick={whatsappChamar} />
                <div className="border-t border-gray-700 my-1" />
                <MenuItem icon={<FileText className="w-3.5 h-3.5" />} label="Emitir NFe" onClick={() => emitirNF("NFe")} />
                <MenuItem icon={<FileText className="w-3.5 h-3.5" />} label="Emitir NFSe" onClick={() => emitirNF("NFSe")} />
                <MenuItem icon={<FileText className="w-3.5 h-3.5" />} label="Emitir NFCe" onClick={() => emitirNF("NFCe")} />
              </div>
            )}
          </div>

          {/* Expandir detalhes */}
          <button
            onClick={() => setExpandido(!expandido)}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all"
          >
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile: veículo e data abaixo */}
      {veiculo && (
        <div className="px-3 pb-2 sm:hidden">
          <span className="text-gray-400 text-xs">{veiculo}</span>
        </div>
      )}

      {/* Detalhe expandido */}
      {expandido && (
        <div className="border-t border-gray-800 p-4 space-y-4 bg-gray-900/50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><p className="text-gray-500 text-xs">KM</p><p className="text-white">{os.quilometragem || "—"}</p></div>
            <div><p className="text-gray-500 text-xs">Pagamento</p><p className="text-white">{os.forma_pagamento || "—"}</p></div>
            <div><p className="text-gray-500 text-xs">Total</p><p className="text-orange-400 font-bold">R$ {Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>
          </div>

          {os.defeito_relatado && (
            <div><p className="text-xs text-gray-500 mb-1">Defeito Relatado</p><p className="text-gray-300 text-sm">{os.defeito_relatado}</p></div>
          )}
          {os.diagnostico && (
            <div><p className="text-xs text-gray-500 mb-1">Diagnóstico</p><p className="text-gray-300 text-sm">{os.diagnostico}</p></div>
          )}

          {(os.servicos || []).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Serviços</p>
              <div className="space-y-1">
                {(os.servicos || []).map((s, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-gray-800/50 pb-1">
                    <span className="text-white">{s.descricao}</span>
                    <span className="text-gray-300 ml-2 flex-shrink-0">R$ {Number(s.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(os.pecas || []).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Peças</p>
              <div className="space-y-1">
                {(os.pecas || []).map((p, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-gray-800/50 pb-1">
                    <span className="text-white">{p.descricao} <span className="text-gray-500">x{p.quantidade}</span></span>
                    <span className="text-gray-300 ml-2 flex-shrink-0">R$ {Number(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {os.observacoes && (
            <div><p className="text-xs text-gray-500 mb-1">Observações</p><p className="text-gray-400 text-sm">{os.observacoes}</p></div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-all text-left"
    >
      <span className="flex-shrink-0 text-base leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}