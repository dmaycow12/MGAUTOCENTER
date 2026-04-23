import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Pencil, Printer, Trash2, AlertTriangle } from "lucide-react";
import { gerarHTMLImpressao } from "./vendaImpressao";
import { reduzirEstoque, restaurarEstoque, excluirLancamentosOS } from "./estoqueUtils";

function WhatsAppIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export const COLUNAS_PADRAO = {
  data: true, cliente: true, veiculo: true, placa: true, km: true,
  status: true, valor: true, pagamento: true, nfe: true, nfse: true,
};

function InlineEdit({ value, onSave, placeholder = "", mono = false, onEnter }) {
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
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          commit();
          onEnter?.();
        }
        if (e.key === "Escape") { setVal(value || ""); setEditing(false); }
      }}
      className="bg-gray-800 border border-orange-500 text-white rounded px-1.5 py-0.5 text-sm focus:outline-none w-24"
      style={{MozAppearance:"textfield"}}
    />
  );
  return (
    <span
      className={`text-gray-300 text-sm cursor-text hover:opacity-80 whitespace-nowrap ${mono ? 'font-mono' : ''}`}
      onClick={() => setEditing(true)}>
      {val || placeholder || "—"}
    </span>
  );
}

const STATUS_OPTIONS = ["Aberto", "Orçamento", "Concluído"];
const STATUS_STYLE = {
  "Aberto":    { style: { background: "#cc0000", color: "#fff" } },
  "Orçamento": { style: { background: "#062C9B", color: "#fff" } },
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

export default function VendaRow({ os, notas = [], onEdit, onDelete, onRefresh, colunas = COLUNAS_PADRAO }) {
  const notasOs = notas.filter(n => n.ordem_venda_id === os.id && n.status !== 'Rascunho');
  const temNFEmitida = notasOs.some(n => (n.tipo === 'NFe' || n.tipo === 'NFCe' || n.tipo === 'NFSe'));
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const [showAviso, setShowAviso] = useState(false);
  const [statusPendente, setStatusPendente] = useState(null);
  const [showAvisoExcluir, setShowAvisoExcluir] = useState(false);
  const [manualNFModal, setManualNFModal] = useState(null);
  const normalizarNF = (v) => v ? v.replace(/\(#?(\d+)\)/, '$1') : v;

  const saveField = async (field, val) => {
    await base44.entities.Vendas.update(os.id, { [field]: val });
    onRefresh?.();
  };

  const statusRef = useRef(null);
  const statusBtnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target) && statusBtnRef.current && !statusBtnRef.current.contains(e.target)) setStatusOpen(false);
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
        ordem_servico_id: osData.id || "", cliente_id: osData.cliente_id || "",
      });
    }
  };

  const alterarStatus = async (novoStatus) => {
    setStatusOpen(false);
    const eraConcluido = os.status === "Concluído";
    const ficaConcluido = novoStatus === "Concluído";
    if (eraConcluido && !ficaConcluido) { setStatusPendente(novoStatus); setShowAviso(true); return; }
    await base44.entities.Vendas.update(os.id, { status: novoStatus });
    if (!eraConcluido && ficaConcluido) {
      await gerarLancamentosFinanceiros(os);
      await reduzirEstoque(os.pecas);
    }
    onRefresh?.();
  };

  const confirmarMudancaStatus = async () => {
    await excluirLancamentosOS(os.id);
    await restaurarEstoque(os.pecas);
    await base44.entities.Vendas.update(os.id, { status: statusPendente });
    setShowAviso(false);
    setStatusPendente(null);
    onRefresh?.();
  };

  const confirmarExcluir = async () => {
    if (os.status === "Concluído") {
      await excluirLancamentosOS(os.id);
      await restaurarEstoque(os.pecas);
    }
    await base44.entities.Vendas.delete(os.id);
    setShowAvisoExcluir(false);
    onRefresh?.();
  };

  const handleExcluir = () => {
    if (os.status === "Concluído") { setShowAvisoExcluir(true); return; }
    onDelete?.();
  };

  const imprimir = () => {
    const win = window.open("", "_blank");
    win.document.write(gerarHTMLImpressao(os));
    win.document.close();
  };

  const enviarWhatsApp = () => {
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const isConcluido = os.status === "Concluído";
    const servicosList = (os.servicos || []).map(s => `  • ${s.descricao || "Serviço"} (x${s.quantidade || 1}) — ${fmtValor(Number(s.valor||0)*Number(s.quantidade||1))}`).join("\n");
    const pecasList = (os.pecas || []).map(p => `  • ${p.descricao || "Peça"} (x${p.quantidade || 1}) — ${fmtValor(p.valor_total)}`).join("\n");
    let texto = "";
    if (isConcluido) {
      texto = `Olá ${os.cliente_nome || ""}! Seu veículo ${os.veiculo_modelo || ""} está pronto para retirada! 🎉\n`;
      texto += `Placa: ${os.veiculo_placa || ""}\n`;
    } else {
      texto = `Olá ${os.cliente_nome || ""}! Segue o orçamento da Venda #${os.numero}:\n`;
      texto += `Veículo: ${os.veiculo_modelo || ""}\nPlaca: ${os.veiculo_placa || ""}\n`;
    }
    if (pecasList) texto += `\n⚙️ *Peças:*\n${pecasList}\n`;
    if (servicosList) texto += `\n🔧 *Serviços:*\n${servicosList}\n`;
    if (os.desconto > 0) texto += `\nDesconto: -${fmtValor(os.desconto)}\n`;
    texto += `\n💰 *Total: ${fmtValor(os.valor_total)}*`;
    if (os.observacoes) texto += `\n\n📋 *Observações:*\n${os.observacoes}`;
    const fone = telefone.startsWith("55") ? telefone : "55" + telefone;
    window.open("https://wa.me/" + fone + "?text=" + encodeURIComponent(texto), "_blank");
  };

  const emitirNF = (tipo) => {
    const params = new URLSearchParams({ emitir: "1", tipo, os_id: os.id, os_numero: os.numero || "", cliente_id: os.cliente_id || "", cliente_nome: encodeURIComponent(os.cliente_nome || ""), valor: String(os.valor_total || 0) });
    navigate(createPageUrl("NotasFiscais") + "?" + params.toString());
  };

  const style = STATUS_STYLE[os.status] || { style: { background: "#374151", color: "#fff" } };

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
      {showAviso && (
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
              <button onClick={() => { setShowAviso(false); setStatusPendente(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={confirmarMudancaStatus} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all">Sim, confirmar</button>
            </div>
          </div>
        </div>
      )}

      {manualNFModal && (
        <tr><td colSpan={99}>
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4">
              <h3 className="text-white font-semibold">Histórico Manual de NF</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select value={manualNFModal.tipo} onChange={e => setManualNFModal(m => ({...m, tipo: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm">
                    {manualNFModal.campo === 'nfe_manual' ? <><option value="NFCe">NFCe</option><option value="NFe">NFe</option></> : <option value="NFSe">NFSe</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Número</label>
                  <input value={manualNFModal.numero} onChange={e => setManualNFModal(m => ({...m, numero: e.target.value}))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm" placeholder="170" autoFocus autoComplete="off" />
                </div>
              </div>
              <p className="text-gray-500 text-xs">Prévia: <span className="text-green-400 font-mono">{manualNFModal.tipo}{manualNFModal.numero || '170'}</span></p>
              <div className="flex gap-2 justify-end">
                {(manualNFModal.campo === 'nfe_manual' ? os.nfe_manual : os.nfse_manual) && (
                  <button onClick={async () => { await saveField(manualNFModal.campo, ''); setManualNFModal(null); }} className="px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg">Remover</button>
                )}
                <button onClick={() => setManualNFModal(null)} className="px-3 py-1.5 text-xs text-gray-400 border border-gray-700 rounded-lg">Cancelar</button>
                <button onClick={async () => { await saveField(manualNFModal.campo, `${manualNFModal.tipo}${manualNFModal.numero}`); setManualNFModal(null); }} className="px-4 py-1.5 text-xs font-semibold rounded-lg" style={{background:'#00ff00',color:'#000'}}>Salvar</button>
              </div>
            </div>
          </div>
        </td></tr>
      )}
      <tr className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-all">
        <td className="px-4 py-3 text-white font-bold text-sm whitespace-nowrap">#{os.numero || "—"}</td>
        {colunas.data && <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">{fmtData(os.data_entrada)}</td>}
        {colunas.cliente && <td className="px-4 py-3"><p className="text-white text-sm font-medium">{os.cliente_nome || "—"}</p></td>}
        {colunas.veiculo && <td className="px-4 py-3"><InlineEdit value={os.veiculo_modelo} onSave={v => saveField("veiculo_modelo", v)} placeholder="—" onEnter={() => emitirNF("NFSe")} /></td>}
        {colunas.placa && <td className="px-4 py-3"><InlineEdit value={os.veiculo_placa?.toUpperCase()} onSave={v => saveField("veiculo_placa", v.toUpperCase())} placeholder="—" mono onEnter={() => emitirNF("NFSe")} /></td>}
        {colunas.km && <td className="px-4 py-3"><InlineEdit value={os.quilometragem ? String(os.quilometragem) : ""} onSave={v => saveField("quilometragem", v)} placeholder="—" onEnter={() => emitirNF("NFSe")} /></td>}
        {colunas.status && <td className="px-4 py-3">
          <div className="relative inline-block">
            <button ref={statusBtnRef}
              onClick={() => { setStatusOpen(v => !v); }}
              className="flex items-center justify-center gap-1 text-xs h-6 px-3 rounded-md font-semibold hover:opacity-90 transition-all whitespace-nowrap w-40"
              style={style.style}>
              {os.status || "—"}
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>
            {statusOpen && (
              <div ref={statusRef} className="absolute left-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-[9999] space-y-1 p-1" style={{width: '140px'}}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => alterarStatus(s)}
                    className="w-full flex items-center justify-center h-6 text-xs font-semibold rounded-md transition-all hover:opacity-90 whitespace-nowrap"
                    style={{ background: STATUS_STYLE[s].style.background, color: "#fff" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </td>}
        {colunas.valor && <td className="px-4 py-3 text-right font-bold whitespace-nowrap" style={{color:'#00ff00'}}>{fmtValor(os.valor_total)}</td>}
        {colunas.pagamento && <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">{(() => {
          const pd = os.parcelas_detalhes;
          if (!pd || pd.length === 0) return os.forma_pagamento || "—";
          const formas = [...new Set(pd.map(p => p.forma_pagamento).filter(Boolean))];
          if (formas.length === 0) return os.forma_pagamento || "—";
          if (formas.length === 1) return formas[0];
          return "Misto";
        })()}</td>}
        {colunas?.nfe && <td className="px-4 py-3">{(() => {
          const nfe = notasOs.find(n => (n.tipo === 'NFe' || n.tipo === 'NFCe'));
          const manual = os.nfe_manual;
          if (nfe) return <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 cursor-pointer" onClick={() => setManualNFModal({ campo: 'nfe_manual', tipo: nfe.tipo, numero: nfe.numero || '' })}>{nfe.tipo}{nfe.numero}</span>;
          if (manual) { const n = normalizarNF(manual); return <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400 cursor-pointer" onClick={() => setManualNFModal({ campo: 'nfe_manual', tipo: n.replace(/\d+$/, '') || 'NFCe', numero: (n.match(/(\d+)$/) || [])[1] || '' })}>{n}</span>; }
          return <button onClick={() => setManualNFModal({ campo: 'nfe_manual', tipo: 'NFCe', numero: '' })} className="text-gray-700 hover:text-green-400 text-xs transition-all">+ NF</button>;
        })()}</td>}
        {colunas.nfse && <td className="px-4 py-3">{(() => {
          const nfse = notasOs.find(n => n.tipo === 'NFSe');
          const manual = os.nfse_manual;
          if (nfse) return <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400 cursor-pointer" onClick={() => setManualNFModal({ campo: 'nfse_manual', tipo: 'NFSe', numero: nfse.numero || '' })}>NFSe{nfse.numero}</span>;
          if (manual) { const n = normalizarNF(manual); return <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400 cursor-pointer" onClick={() => setManualNFModal({ campo: 'nfse_manual', tipo: 'NFSe', numero: (n.match(/(\d+)$/) || [])[1] || '' })}>{n}</span>; }
          return <button onClick={() => setManualNFModal({ campo: 'nfse_manual', tipo: 'NFSe', numero: '' })} className="text-gray-700 hover:text-blue-400 text-xs transition-all">+ NFSe</button>;
        })()}</td>}
        <td className="px-4 py-3">
          <div className="flex gap-1 justify-end" style={{whiteSpace:'nowrap'}}>
            <button onClick={enviarWhatsApp} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-500/20 transition-all text-green-500 hover:text-green-400" title="WhatsApp">
              <WhatsAppIcon className="w-4 h-4" />
            </button>
            <button onClick={() => onEdit?.()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all text-gray-500 hover:text-blue-400" title="Editar">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={imprimir} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white rounded-lg hover:bg-gray-700 transition-all" title="Imprimir">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={handleExcluir} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-all" title="Excluir">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}