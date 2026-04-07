import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Pencil, Printer, Trash2, FileText, MoreVertical, AlertTriangle } from "lucide-react";
import { gerarHTMLImpressao } from "./osImpressao";
import { reduzirEstoque, restaurarEstoque, excluirLancamentosOS } from "./estoqueUtils";

function WhatsAppIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const STATUS_OPTIONS = ["Aberto", "Orçamento", "Concluído"];

const STATUS_STYLE = {
  "Aberto":    { badge: "text-white", style: { background: "#cc0000", color: "#fff" } },
  "Orçamento": { badge: "text-white", style: { background: "#062C9B", color: "#fff" } },
  "Concluído": { badge: "text-white", style: { background: "#00C957", color: "#fff" } },
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

function InlineEdit({ value, onSave, placeholder = "" }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const inputRef = useRef(null);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  useEffect(() => { setVal(value || ""); }, [value]);
  const commit = () => { onSave(val); setEditing(false); };
  if (editing) return (
    <input ref={inputRef} type="text" value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(value || ""); setEditing(false); } }}
      className="bg-gray-800 border border-orange-500 text-white rounded px-1.5 py-0.5 text-sm focus:outline-none w-full"
    />
  );
  return (
    <p className="text-white text-sm font-medium cursor-text hover:opacity-80 truncate"
      onClick={() => setEditing(true)} title="Clique para editar">
      {val || placeholder || "—"}
    </p>
  );
}

export default function OrdemVendaCard({ os, notas = [], onEdit, onDelete, onRefresh }) {
  const notasOs = notas.filter(n => n.ordem_venda_id === os.id && n.status !== 'Rascunho');
  const temNfeProduto = notasOs.some(n => (n.tipo === 'NFe' || n.tipo === 'NFCe'));
  const temNfServico = notasOs.some(n => n.tipo === 'NFSe');
  const notaEmitida = notasOs.find(n => (n.tipo === 'NFe' || n.tipo === 'NFCe' || n.tipo === 'NFSe'));
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAvisoStatus, setShowAvisoStatus] = useState(false);
  const [statusPendenteCard, setStatusPendenteCard] = useState(null);
  const [showAvisoExcluir, setShowAvisoExcluir] = useState(false);

  const saveField = async (field, val) => {
    await base44.entities.Vendas.update(os.id, { [field]: val });
    onRefresh?.();
  };

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
    const gerarParcelasBase = (total, qtd, dataBase) => {
      const valorParcela = total / Math.max(1, qtd);
      const base = dataBase ? new Date(dataBase + "T00:00:00") : new Date();
      return Array.from({ length: qtd }, (_, i) => {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        return { numero: i + 1, valor: parseFloat(valorParcela.toFixed(2)), vencimento: d.toISOString().split("T")[0], forma_pagamento: "A Combinar" };
      });
    };
    const parcelas = osData.parcelas_detalhes && osData.parcelas_detalhes.length > 0
      ? osData.parcelas_detalhes
      : gerarParcelasBase(osData.valor_total, Number(osData.parcelas) || 1, osData.data_entrada);
    for (const p of parcelas) {
      const forma = p.forma_pagamento || "A Combinar";
      const pago = ["Dinheiro", "PIX"].includes(forma);
      await base44.entities.Financeiro.create({
        tipo: "Receita", categoria: "Ordem de Venda",
        descricao: "Venda #" + osData.numero + " — " + (osData.cliente_nome || "") + " — Parcela " + p.numero + "/" + parcelas.length,
        valor: p.valor,
        data_vencimento: p.vencimento,
        status: pago ? "Pago" : "Pendente",
        data_pagamento: pago ? new Date().toISOString().split("T")[0] : "",
        forma_pagamento: forma,
        ordem_venda_id: osData.id || "", cliente_id: osData.cliente_id || "",
      });
    }
  };

  const alterarStatus = async (novoStatus) => {
    setStatusOpen(false);
    const eraConcluido = os.status === "Concluído";
    const ficaConcluido = novoStatus === "Concluído";
    if (eraConcluido && !ficaConcluido) { setStatusPendenteCard(novoStatus); setShowAvisoStatus(true); return; }
    await base44.entities.Vendas.update(os.id, { status: novoStatus });
    if (!eraConcluido && ficaConcluido) {
      await gerarLancamentosFinanceiros(os);
      await reduzirEstoque(os.pecas);
    }
    onRefresh?.();
  };

  const confirmarMudancaStatus = async () => {
    try {
      const todasOS = await base44.entities.Vendas.list("-created_date", 1000);
      const osAtualizada = todasOS.find(o => o.id === os.id);
      const osData = osAtualizada || os;
      
      await excluirLancamentosOS(os.id);
      await restaurarEstoque(osData.pecas || []);
      await base44.entities.Vendas.update(os.id, { status: statusPendenteCard });
      setShowAvisoStatus(false);
      setStatusPendenteCard(null);
      onRefresh?.();
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const confirmarExcluir = async () => {
    if (os.status === "Concluído") {
      try {
        const todasOS = await base44.entities.Vendas.list("-created_date", 1000);
        const osAtualizada = todasOS.find(o => o.id === os.id);
        const osData = osAtualizada || os;
        
        await excluirLancamentosOS(os.id);
        await restaurarEstoque(osData.pecas || []);
      } catch (err) {
        console.error("Erro ao restaurar estoque na exclusão:", err);
      }
    }
    await base44.entities.Vendas.delete(os.id);
    setShowAvisoExcluir(false);
    onRefresh?.();
  };

  const handleExcluir = () => {
    if (os.status === "Concluído") { setShowAvisoExcluir(true); return; }
    onDelete?.();
  };

  const enviarOrcamento = () => {
    setMenuOpen(false);
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const linkOrcamento = `${window.location.origin}/OrcamentoPublico?id=${os.id}`;
    const servicosList = (os.servicos || []).map((s, i) => `  ${i+1}. ${s.descricao || "Serviço"} (x${s.quantidade || 1}) — ${fmtValor(Number(s.valor||0)*Number(s.quantidade||1))}`).join("\n");
    const pecasList = (os.pecas || []).map((p, i) => `  ${i+1}. ${p.descricao || "Peça"} (x${p.quantidade || 1}) — ${fmtValor(p.valor_total)}`).join("\n");
    let texto = `Olá ${os.cliente_nome || ""}! Segue o orçamento da Venda #${os.numero}:\nVeículo: ${os.veiculo_modelo || ""}\nPlaca: ${os.veiculo_placa || ""}\n`;
    if (pecasList) texto += `\n⚙️ *Peças:*\n${pecasList}\nSubtotal: ${fmtValor(os.valor_pecas)}\n`;
    if (servicosList) texto += `\n🔧 *Serviços:*\n${servicosList}\nSubtotal: ${fmtValor(os.valor_servicos)}\n`;
    if (os.desconto > 0) texto += `\nDesconto: -${fmtValor(os.desconto)}\n`;
    texto += `\n💰 *Total: ${fmtValor(os.valor_total)}*`;
    if (os.observacoes) texto += `\n\n📋 *Observações:*\n${os.observacoes}`;
    texto += `\n\n🔗 Acesse o orçamento completo com fotos:\n${linkOrcamento}`;
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

  const imprimir = () => {
    setMenuOpen(false);
    const win = window.open("", "_blank");
    win.document.write(gerarHTMLImpressao(os));
    win.document.close();
  };

  const style = STATUS_STYLE[os.status] || { badge: "bg-gray-600 text-white", style: { background: "#374151", color: "#fff" } };
  const veiculoNome = os.veiculo_modelo || "—";
  const veiculoPlaca = os.veiculo_placa?.toUpperCase() || "—";

  const menuItems = [
    { label: "Enviar orçamento", icon: WhatsAppIcon, action: enviarOrcamento },
    { label: "Chamar no WhatsApp", icon: WhatsAppIcon, action: chamarWhatsApp },
    { label: "Emitir NFe (Produtos)", icon: FileText, action: () => emitirNF("NFe") },
    { label: "Emitir NFSe (Serviços)", icon: FileText, action: () => emitirNF("NFSe") },
    { label: "Emitir NFCe (Consumidor)", icon: FileText, action: () => emitirNF("NFCe") },
  ];

  return (
    <>
      {showAvisoExcluir && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-7 h-7 flex-shrink-0" />
              <h3 className="text-lg font-bold">Excluir Venda Concluída</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Esta Venda está <strong className="text-green-400">Concluída</strong>. Ao excluir:<br />
              • <strong className="text-red-400">Lançamentos financeiros</strong> serão excluídos<br />
              • <strong className="text-yellow-400">Peças usadas</strong> serão devolvidas ao estoque
            </p>
            <p className="text-gray-400 text-sm">Deseja continuar?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAvisoExcluir(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={confirmarExcluir} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all">Sim, excluir</button>
            </div>
          </div>
        </div>
      )}
      {showAvisoStatus && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-7 h-7 flex-shrink-0" />
              <h3 className="text-lg font-bold">Atenção!</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Ao alterar o status desta Venda:<br />
              • <strong className="text-red-400">Lançamentos financeiros</strong> serão excluídos<br />
              • <strong className="text-yellow-400">Peças usadas</strong> serão devolvidas ao estoque
            </p>
            <p className="text-gray-400 text-sm">Deseja continuar?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAvisoStatus(false); setStatusPendenteCard(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={confirmarMudancaStatus} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all">Sim, confirmar</button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-white font-bold text-sm tracking-wide flex-shrink-0">#{os.numero || "—"}</span>
          <div className="flex items-center gap-2">
            {temNfeProduto && <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 flex items-center gap-1">✓ NFe/NFCe</span>}
            {temNfServico && <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">✓ NFSe</span>}
          </div>

          <div className="relative flex-1">
            <button ref={statusBtnRef} onClick={() => { setMenuOpen(false); setStatusOpen(v => !v); }}
              className="flex items-center justify-center gap-2 text-sm font-semibold hover:opacity-90 transition-all w-full"
              style={{...style.style, height: "34px", borderRadius: "8px"}}>
              {os.status || "—"}
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
            </button>
            {statusOpen && (
              <div ref={statusRef} className="absolute left-0 top-full mt-1 z-50 overflow-hidden rounded-lg shadow-2xl w-full">
                {STATUS_OPTIONS.filter(s => s !== os.status).map(s => (
                  <button key={s} onClick={() => alterarStatus(s)}
                    className="flex items-center justify-center text-sm font-semibold w-full"
                    style={{ background: STATUS_STYLE[s].style.background, color: "#fff", height: "34px" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => onEdit?.()} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={imprimir} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all" title="Imprimir"><Printer className="w-3.5 h-3.5" /></button>
          <button onClick={handleExcluir} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-all" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>

          <div className="relative">
            <button ref={menuBtnRef} onClick={() => { setStatusOpen(false); setMenuOpen(v => !v); }}
              className="p-1.5 text-gray-500 hover:text-white transition-all rounded-lg hover:bg-gray-800">
              <MoreVertical className="w-3.5 h-3.5" />
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

        <div className="grid grid-cols-2 border-t border-gray-800">
          <div className="col-span-2 px-3 py-2.5 border-b border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Cliente</p>
            <p className="text-white text-sm font-medium truncate">{os.cliente_nome || "—"}</p>
          </div>
          <div className="px-3 py-2.5 border-b border-r border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Veículo</p>
            <InlineEdit value={os.veiculo_modelo} onSave={v => saveField("veiculo_modelo", v)} placeholder="—" />
          </div>
          <div className="px-3 py-2.5 border-b border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Data</p>
            <p className="text-white text-sm font-medium">{fmtData(os.data_entrada)}</p>
          </div>
          <div className="px-3 py-2.5 border-b border-r border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Placa</p>
            <InlineEdit value={os.veiculo_placa?.toUpperCase()} onSave={v => saveField("veiculo_placa", v.toUpperCase())} placeholder="—" />
          </div>
          <div className="px-3 py-2.5 border-b border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">KM</p>
            <InlineEdit value={os.quilometragem ? String(os.quilometragem) : ""} onSave={v => saveField("quilometragem", v)} placeholder="—" />
          </div>
          <div className="px-3 py-2.5 border-r border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Pagamento</p>
            <p className="text-white text-sm font-medium">{(() => {
              const pd = os.parcelas_detalhes;
              if (!pd || pd.length === 0) return os.forma_pagamento || "—";
              const formas = [...new Set(pd.map(p => p.forma_pagamento).filter(Boolean))];
              if (formas.length === 0) return os.forma_pagamento || "—";
              if (formas.length === 1) return formas[0];
              return "Misto";
            })()}</p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Valor</p>
            <div className="flex items-center gap-2">
              <p className="text-green-400 text-sm font-bold">{fmtValor(os.valor_total)}</p>
              {notaEmitida && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">{notaEmitida.tipo}({notaEmitida.numero})</span>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}