import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Edit, Trash2, Printer, ChevronDown, FileText, MessageCircle } from "lucide-react";

const statusColors = {
  "Em Aberto": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Concluída": "bg-green-500/10 text-green-400 border-green-500/20",
  "Cancelada": "bg-red-500/10 text-red-400 border-red-500/20",
  "Orçamento": "bg-gray-500/10 text-gray-400 border-gray-500/20",
  "Aprovado": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Em Andamento": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Concluído": "bg-green-500/10 text-green-400 border-green-500/20",
  "Entregue": "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "Cancelado": "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_OPTIONS = ["Em Aberto", "Concluída", "Cancelada"];
const primeiroNome = (nome) => (nome || "").split(" ")[0];

export default function OSCard({ os, onEdit, onDelete, onRefresh }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const menuRef = useRef(null);
  const statusRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const alterarStatus = async (novoStatus) => {
    const { base44 } = await import("@/api/base44Client");
    await base44.entities.OrdemServico.update(os.id, { ...os, status: novoStatus });
    setStatusOpen(false);
    onRefresh();
  };

  const whatsappOrcamento = () => {
    const tel = (os.cliente_telefone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `*Oficina Pro - Orçamento OS #${os.numero}*\n\n` +
      `Olá ${primeiroNome(os.cliente_nome)}! 👋\n\n` +
      `Segue o orçamento do seu veículo ${os.veiculo_modelo || ""} (${os.veiculo_placa || ""}):\n\n` +
      (os.servicos || []).map(s => `• ${s.descricao} — R$ ${Number(s.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n") + "\n\n" +
      `💰 *Total: R$ ${Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\nAguardamos sua aprovação. ✅`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
    setMenuOpen(false);
  };

  const whatsappChamar = () => {
    const tel = (os.cliente_telefone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `*Oficina Pro* - Olá ${primeiroNome(os.cliente_nome)}! 👋\n` +
      `Seu veículo ${os.veiculo_modelo || ""} (${os.veiculo_placa || ""}) está pronto!\n` +
      `OS #${os.numero} — R$ ${Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
    setMenuOpen(false);
  };

  const emitirNF = (tipo) => {
    alert(`Emitir ${tipo} para OS #${os.numero}`);
    setMenuOpen(false);
  };

  const imprimir = (e) => {
    e.stopPropagation();
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
      ${(os.servicos || []).length > 0 ? `<h2>Serviços</h2><table><tr><th>Descrição</th><th>Técnico</th><th>Valor</th></tr>${(os.servicos || []).map(s => `<tr><td>${s.descricao || ""}</td><td>${s.tecnico || ""}</td><td>R$ ${Number(s.valor || 0).toFixed(2)}</td></tr>`).join("")}</table>` : ""}
      ${(os.pecas || []).length > 0 ? `<h2>Peças</h2><table><tr><th>Descrição</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr>${(os.pecas || []).map(p => `<tr><td>${p.descricao || ""}</td><td>${p.quantidade || ""}</td><td>R$ ${Number(p.valor_unitario || 0).toFixed(2)}</td><td>R$ ${Number(p.valor_total || 0).toFixed(2)}</td></tr>`).join("")}</table>` : ""}
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

  const veiculo = [os.veiculo_modelo, os.veiculo_placa].filter(Boolean).join(" • ");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-all">
      {/* Layout Desktop: tudo numa linha | Mobile: info em cima, ações em baixo */}
      <div
        className="cursor-pointer select-none"
        onClick={() => setExpandido(!expandido)}
      >
        {/* Linha de informações */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1 md:pb-3">
          {/* Número OS */}
          <span className="text-white font-bold text-sm w-8 flex-shrink-0">{os.numero}</span>

          {/* Dados principais — tudo em uma linha tanto mobile quanto desktop */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
            <span className="text-white text-sm font-medium whitespace-nowrap">{primeiroNome(os.cliente_nome)}</span>
            {os.veiculo_modelo && <><span className="text-gray-600 text-xs">•</span><span className="text-gray-400 text-xs truncate max-w-[100px] md:max-w-none">{os.veiculo_modelo}</span></>}
            {os.veiculo_placa && <><span className="text-gray-600 text-xs">•</span><span className="text-gray-400 text-xs whitespace-nowrap">{os.veiculo_placa}</span></>}
            {os.data_entrada && <><span className="text-gray-600 text-xs">•</span><span className="text-gray-500 text-xs whitespace-nowrap">{os.data_entrada}</span></>}
          </div>

          {/* Ações — visíveis apenas no desktop */}
          <div className="hidden md:flex items-center flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Editar" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-800 transition-all">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={imprimir} title="Imprimir" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Excluir" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="relative" ref={statusRef}>
              <button onClick={(e) => { e.stopPropagation(); setStatusOpen(!statusOpen); }} className={`h-8 px-2 flex items-center gap-1 rounded-lg border text-xs font-medium transition-all hover:opacity-80 ${statusColors[os.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                <span className="whitespace-nowrap">{os.status}</span>
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </button>
              {statusOpen && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-30 w-36 py-1">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s} onClick={() => alterarStatus(s)} className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all ${os.status === s ? "text-orange-400" : "text-gray-300"}`}>{s}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all">
                <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-30 w-52 py-1">
                  <MenuItem icon={<MessageCircle className="w-4 h-4 text-green-400" />} label="Enviar Orçamento" onClick={whatsappOrcamento} />
                  <MenuItem icon={<MessageCircle className="w-4 h-4 text-green-400" />} label="Chamar no WhatsApp" onClick={whatsappChamar} />
                  <div className="border-t border-gray-700 my-1" />
                  <MenuItem icon={<FileText className="w-4 h-4 text-gray-400" />} label="Emitir NFe" onClick={() => emitirNF("NFe")} />
                  <MenuItem icon={<FileText className="w-4 h-4 text-gray-400" />} label="Emitir NFSe" onClick={() => emitirNF("NFSe")} />
                  <MenuItem icon={<FileText className="w-4 h-4 text-gray-400" />} label="Emitir NFCe" onClick={() => emitirNF("NFCe")} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Barra de ações — visível apenas no mobile */}
        <div className="flex md:hidden items-center justify-between px-3 pb-3 pt-1 border-t border-gray-800/50 mt-1" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Editar" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-800 transition-all">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={imprimir} title="Imprimir" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Excluir" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Status mobile */}
            <div className="relative" ref={statusRef}>
              <button onClick={(e) => { e.stopPropagation(); setStatusOpen(!statusOpen); }} className={`h-8 px-2 flex items-center gap-1 rounded-lg border text-xs font-medium transition-all hover:opacity-80 ${statusColors[os.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                <span className="whitespace-nowrap">{os.status}</span>
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </button>
              {statusOpen && (
                <div className="absolute right-0 bottom-full mb-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-30 w-36 py-1">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s} onClick={() => alterarStatus(s)} className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all ${os.status === s ? "text-orange-400" : "text-gray-300"}`}>{s}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Menu ações mobile */}
            <div className="relative" ref={menuRef}>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all">
                <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-full mb-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-30 w-52 py-1">
                  <MenuItem icon={<MessageCircle className="w-4 h-4 text-green-400" />} label="Enviar Orçamento" onClick={whatsappOrcamento} />
                  <MenuItem icon={<MessageCircle className="w-4 h-4 text-green-400" />} label="Chamar no WhatsApp" onClick={whatsappChamar} />
                  <div className="border-t border-gray-700 my-1" />
                  <MenuItem icon={<FileText className="w-4 h-4 text-gray-400" />} label="Emitir NFe" onClick={() => emitirNF("NFe")} />
                  <MenuItem icon={<FileText className="w-4 h-4 text-gray-400" />} label="Emitir NFSe" onClick={() => emitirNF("NFSe")} />
                  <MenuItem icon={<FileText className="w-4 h-4 text-gray-400" />} label="Emitir NFCe" onClick={() => emitirNF("NFCe")} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detalhe expandido — aparece ao clicar na OS */}
      {expandido && (
        <div className="border-t border-gray-800 p-4 space-y-4 bg-gray-900/50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><p className="text-gray-500 text-xs">KM</p><p className="text-white">{os.quilometragem || "—"}</p></div>
            <div><p className="text-gray-500 text-xs">Pagamento</p><p className="text-white">{os.forma_pagamento || "—"}</p></div>
            <div><p className="text-gray-500 text-xs">Total</p><p className="text-orange-400 font-bold">R$ {Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>
          </div>
          {os.defeito_relatado && <div><p className="text-xs text-gray-500 mb-1">Defeito Relatado</p><p className="text-gray-300 text-sm">{os.defeito_relatado}</p></div>}
          {os.diagnostico && <div><p className="text-xs text-gray-500 mb-1">Diagnóstico</p><p className="text-gray-300 text-sm">{os.diagnostico}</p></div>}
          {(os.servicos || []).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Serviços</p>
              <div className="space-y-1">
                {os.servicos.map((s, i) => (
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
                {os.pecas.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-gray-800/50 pb-1">
                    <span className="text-white">{p.descricao} <span className="text-gray-500">x{p.quantidade}</span></span>
                    <span className="text-gray-300 ml-2 flex-shrink-0">R$ {Number(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {os.observacoes && <div><p className="text-xs text-gray-500 mb-1">Observações</p><p className="text-gray-400 text-sm">{os.observacoes}</p></div>}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-all text-left">
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}