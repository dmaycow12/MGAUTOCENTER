import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Pencil, Printer, Trash2, FileText, MoreVertical, AlertTriangle } from "lucide-react";

function WhatsAppIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const STATUS_OPTIONS = ["Aberto", "Orçamento", "Concluído"];
const STATUS_STYLE = {
  "Aberto":    { style: { background: "#062C9B", color: "#fff" } },
  "Orçamento": { style: { background: "#FFCC00", color: "#fff" } },
  "Concluído": { style: { background: "#00C957", color: "#fff" } },
};

function fmtData(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return parts[2] + "/" + parts[1] + "/" + String(parts[0]).slice(2);
}

function fmtValor(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OSListRow({ os, onEdit, onDelete, onRefresh }) {
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAviso, setShowAviso] = useState(false);
  const [statusPendente, setStatusPendente] = useState(null);

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

  const gerarLancamentosFinanceiros = async (osData) => {
    const gerarParcelas = (total, qtd, formaPagamento, dataBase) => {
      const valorParcela = total / Math.max(1, qtd);
      const base = dataBase ? new Date(dataBase + "T00:00:00") : new Date();
      return Array.from({ length: qtd }, (_, i) => {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        return { numero: i + 1, valor: parseFloat(valorParcela.toFixed(2)), vencimento: d.toISOString().split("T")[0], forma_pagamento: formaPagamento || "Dinheiro" };
      });
    };
    const parcelas = osData.parcelas_detalhes && osData.parcelas_detalhes.length > 0
      ? osData.parcelas_detalhes
      : gerarParcelas(osData.valor_total, Number(osData.parcelas) || 1, osData.forma_pagamento, osData.data_entrada);
    for (const p of parcelas) {
      await base44.entities.Financeiro.create({
        tipo: "Receita", categoria: "Ordem de Serviço",
        descricao: "OS #" + osData.numero + " — " + (osData.cliente_nome || "") + " — Parcela " + p.numero + "/" + parcelas.length,
        valor: p.valor, data_vencimento: p.vencimento, status: "Pendente",
        forma_pagamento: p.forma_pagamento || osData.forma_pagamento || "Dinheiro",
        ordem_servico_id: osData.id || "", cliente_id: osData.cliente_id || "",
      });
    }
  };

  const excluirLancamentos = async () => {
    const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
    const vinculados = financeiros.filter(f => f.ordem_servico_id === os.id);
    for (const f of vinculados) await base44.entities.Financeiro.delete(f.id);
  };

  const alterarStatus = async (novoStatus) => {
    setStatusOpen(false);
    const eraConcluido = os.status === "Concluído";
    const ficaConcluido = novoStatus === "Concluído";
    if (eraConcluido && !ficaConcluido) { setStatusPendente(novoStatus); setShowAviso(true); return; }
    await base44.entities.OrdemServico.update(os.id, { status: novoStatus });
    if (!eraConcluido && ficaConcluido) await gerarLancamentosFinanceiros(os);
    onRefresh?.();
  };

  const confirmarMudancaStatus = async () => {
    await excluirLancamentos();
    await base44.entities.OrdemServico.update(os.id, { status: statusPendente });
    setShowAviso(false);
    setStatusPendente(null);
    onRefresh?.();
  };

  const imprimir = () => {
    // Import and use the same gerarHTMLImpressao from OSCard
    setMenuOpen(false);
    // Build a minimal print window with OS data
    const win = window.open("", "_blank");
    win.document.write("<html><body><script>window.onload=function(){window.print()}<\/script><pre>" + JSON.stringify(os, null, 2) + "</pre></body></html>");
    win.document.close();
  };

  const enviarOrcamento = () => {
    setMenuOpen(false);
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const linkOrcamento = `${window.location.origin}/OrcamentoPublico?id=${os.id}`;
    let texto = `Olá ${os.cliente_nome || ""}! Segue o orçamento da OS #${os.numero}:\n`;
    texto += `Veículo: ${os.veiculo_modelo || ""}\nPlaca: ${os.veiculo_placa || ""}\n`;
    texto += `\n💰 *Total: ${fmtValor(os.valor_total)}*`;
    texto += `\n\n🔗 Acesse o orçamento completo:\n${linkOrcamento}`;
    const fone = telefone.startsWith("55") ? telefone : "55" + telefone;
    window.open("https://wa.me/" + fone + "?text=" + encodeURIComponent(texto), "_blank");
  };

  const chamarWhatsApp = () => {
    setMenuOpen(false);
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const fone = telefone.startsWith("55") ? telefone : "55" + telefone;
    window.open("https://wa.me/" + fone, "_blank");
  };

  const emitirNF = (tipo) => {
    setMenuOpen(false);
    const params = new URLSearchParams({ emitir: "1", tipo, os_id: os.id, os_numero: os.numero || "", cliente_id: os.cliente_id || "", cliente_nome: encodeURIComponent(os.cliente_nome || ""), valor: String(os.valor_total || 0) });
    navigate(createPageUrl("NotasFiscais") + "?" + params.toString());
  };

  const menuItems = [
    { label: "Enviar orçamento", icon: WhatsAppIcon, action: enviarOrcamento },
    { label: "Chamar no WhatsApp", icon: WhatsAppIcon, action: chamarWhatsApp },
    { label: "Emitir NFe", icon: FileText, action: () => emitirNF("NFe") },
    { label: "Emitir NFSe", icon: FileText, action: () => emitirNF("NFSe") },
    { label: "Emitir NFCe", icon: FileText, action: () => emitirNF("NFCe") },
  ];

  const style = STATUS_STYLE[os.status] || { style: { background: "#374151", color: "#fff" } };

  return (
    <>
      {showAviso && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-7 h-7 flex-shrink-0" />
              <h3 className="text-lg font-bold">Atenção!</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Ao alterar o status desta OS, <strong className="text-red-400">todos os lançamentos financeiros</strong> gerados serão <strong className="text-red-400">excluídos automaticamente</strong>.
            </p>
            <p className="text-gray-400 text-sm">Deseja continuar?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAviso(false); setStatusPendente(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={confirmarMudancaStatus} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all">Sim, confirmar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-all">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">OS #{os.numero} — {os.cliente_nome || "—"}</p>
          <p className="text-gray-500 text-xs">{os.veiculo_placa || "—"} {os.veiculo_modelo ? `• ${os.veiculo_modelo}` : ""} {os.data_entrada ? `• ${fmtData(os.data_entrada)}` : ""}</p>
        </div>

        {/* Status dropdown */}
        <div className="relative flex-shrink-0">
          <button
            ref={statusBtnRef}
            onClick={() => { setMenuOpen(false); setStatusOpen(v => !v); }}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold hover:opacity-90 transition-all"
            style={style.style}
          >
            {os.status || "—"}
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          </button>
          {statusOpen && (
            <div ref={statusRef} className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-36 py-1 z-50">
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => alterarStatus(s)}
                  className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all"
                  style={{ color: STATUS_STYLE[s].style.background }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Valor */}
        <span className="text-green-400 font-bold text-sm flex-shrink-0">{fmtValor(os.valor_total)}</span>

        {/* Ações */}
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onEdit?.()} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-700 transition-all" title="Editar">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={imprimir} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white rounded-lg hover:bg-gray-700 transition-all" title="Imprimir">
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete?.()} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-all" title="Excluir">
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Menu ações */}
          <div className="relative">
            <button ref={menuBtnRef} onClick={() => { setStatusOpen(false); setMenuOpen(v => !v); }}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white rounded-lg hover:bg-gray-700 transition-all">
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div ref={menuRef} className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-52 py-1 z-50">
                {menuItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button key={i} onClick={item.action}
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-all">
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
    </>
  );
}