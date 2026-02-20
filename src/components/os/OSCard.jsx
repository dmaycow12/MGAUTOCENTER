import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Edit, Trash2, MessageCircle, Printer, ChevronDown, ChevronUp, Clock, Wrench } from "lucide-react";

const statusColors = {
  "Orçamento": "bg-gray-500/10 text-gray-400 border-gray-500/20",
  "Aprovado": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Em Andamento": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Aguardando Peças": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Concluído": "bg-green-500/10 text-green-400 border-green-500/20",
  "Entregue": "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "Cancelado": "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function OSCard({ os, onEdit, onDelete, onRefresh }) {
  const [expandido, setExpandido] = useState(false);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  const statusList = ["Orçamento", "Aprovado", "Em Andamento", "Aguardando Peças", "Concluído", "Entregue", "Cancelado"];

  const atualizarStatus = async (novoStatus) => {
    setAtualizandoStatus(true);
    await base44.entities.OrdemServico.update(os.id, { status: novoStatus });
    setAtualizandoStatus(false);
    onRefresh();
  };

  const whatsappOrcamento = () => {
    const tel = (os.cliente_telefone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `*Oficina Pro - Orçamento OS #${os.numero}*\n\n` +
      `Olá ${os.cliente_nome || ""}! 👋\n\n` +
      `Segue o orçamento do seu veículo ${os.veiculo_modelo || ""} (${os.veiculo_placa || ""}):\n\n` +
      (os.servicos || []).map(s => `• ${s.descricao} — R$ ${Number(s.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n") + "\n\n" +
      `💰 *Total: R$ ${Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\n` +
      `Aguardamos sua aprovação. ✅`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
  };

  const whatsappConclusao = () => {
    const tel = (os.cliente_telefone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `*Oficina Pro - Veículo Pronto! 🎉*\n\n` +
      `Olá ${os.cliente_nome || ""}! 👋\n\n` +
      `Seu veículo ${os.veiculo_modelo || ""} (${os.veiculo_placa || ""}) está pronto para retirada!\n\n` +
      `*OS #${os.numero}*\n` +
      `💰 Valor: R$ ${Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n` +
      `Aguardamos você! 🔧`
    );
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
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
        .info div { padding: 4px 0; }
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
        ${os.forma_pagamento ? `<div style="font-weight:normal;font-size:12px;color:#666">Pagamento: ${os.forma_pagamento}${os.parcelas ? ` em ${os.parcelas}x` : ""}</div>` : ""}
      </div>
      ${os.observacoes ? `<h2>Observações</h2><p>${os.observacoes}</p>` : ""}
      </body></html>
    `;
    const win = window.open("", "_blank");
    win.document.write(conteudo);
    win.document.close();
    win.print();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all">
      <div className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm">OS #{os.numero}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[os.status] || "bg-gray-500/10 text-gray-400"}`}>
                {os.status}
              </span>
            </div>
            <p className="text-gray-400 text-sm truncate">{os.cliente_nome} • {os.veiculo_placa} {os.veiculo_modelo && `• ${os.veiculo_modelo}`}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-white font-bold text-sm hidden sm:block mr-2">
            R$ {Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <button onClick={imprimir} title="Imprimir" className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-all">
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={whatsappOrcamento} title="WhatsApp Orçamento" className="p-1.5 text-gray-500 hover:text-green-400 rounded-lg hover:bg-gray-800 transition-all">
            <MessageCircle className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-800 transition-all">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpandido(!expandido)} className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-all">
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-gray-800 p-4 space-y-4 bg-gray-900/50">
          {/* Info row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-gray-500 text-xs">KM</p><p className="text-white">{os.quilometragem || "—"}</p></div>
            <div><p className="text-gray-500 text-xs">Entrada</p><p className="text-white">{os.data_entrada || "—"}</p></div>
            <div><p className="text-gray-500 text-xs">Previsão</p><p className="text-white">{os.data_previsao || "—"}</p></div>
            <div><p className="text-gray-500 text-xs">Pagamento</p><p className="text-white">{os.forma_pagamento || "—"}</p></div>
          </div>

          {/* Atualizar Status */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Atualizar Status:</p>
            <div className="flex flex-wrap gap-2">
              {statusList.map(s => (
                <button
                  key={s}
                  onClick={() => atualizarStatus(s)}
                  disabled={atualizandoStatus || os.status === s}
                  className={`text-xs px-2 py-1 rounded-full border transition-all ${
                    os.status === s
                      ? "bg-orange-500 text-white border-orange-500"
                      : "text-gray-400 border-gray-700 hover:border-orange-500 hover:text-orange-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Serviços */}
          {(os.servicos || []).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Serviços</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-1">Descrição</th>
                    <th className="pb-1">Técnico</th>
                    <th className="pb-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(os.servicos || []).map((s, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-1.5 text-white">{s.descricao}</td>
                      <td className="py-1.5 text-gray-400">{s.tecnico}</td>
                      <td className="py-1.5 text-right text-white">R$ {Number(s.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Peças */}
          {(os.pecas || []).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Peças</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-1">Descrição</th>
                    <th className="pb-1 text-center">Qtd</th>
                    <th className="pb-1 text-right">Unit.</th>
                    <th className="pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(os.pecas || []).map((p, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-1.5 text-white">{p.descricao}</td>
                      <td className="py-1.5 text-gray-400 text-center">{p.quantidade}</td>
                      <td className="py-1.5 text-right text-gray-400">R$ {Number(p.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-1.5 text-right text-white">R$ {Number(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-end gap-6 text-sm border-t border-gray-800 pt-3">
            <div className="text-right">
              <p className="text-gray-500">Serviços: R$ {Number(os.valor_servicos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-gray-500">Peças: R$ {Number(os.valor_pecas || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              {os.desconto > 0 && <p className="text-red-400">Desconto: -R$ {Number(os.desconto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>}
              <p className="text-white font-bold text-base">Total: R$ {Number(os.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* WhatsApp buttons */}
          <div className="flex gap-2 flex-wrap pt-1">
            <button onClick={whatsappOrcamento} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-all">
              <MessageCircle className="w-3 h-3" /> Enviar Orçamento via WhatsApp
            </button>
            {(os.status === "Concluído" || os.status === "Entregue") && (
              <button onClick={whatsappConclusao} className="flex items-center gap-2 px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs rounded-lg transition-all">
                <MessageCircle className="w-3 h-3" /> Aviso de Conclusão via WhatsApp
              </button>
            )}
            <button onClick={imprimir} className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-all">
              <Printer className="w-3 h-3" /> Imprimir OS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}