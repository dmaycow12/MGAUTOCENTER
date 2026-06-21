import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Pencil, Printer, Trash2, AlertTriangle } from "lucide-react";
import { gerarHTMLImpressao } from "./vendaImpressao";
import { reduzirEstoque, restaurarEstoque, excluirLancamentosVenda, limparHistoricoVenda } from "./estoqueUtils";

function WhatsAppIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export const COLUNAS_PADRAO = {
  data: true, cliente: true, contato: false, veiculo: true, placa: true, km: true,
  status: true, custo: true, valor: true, lucro: true, nfe: true, nfse: true,
};

const formatTelefone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 11) return `${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  return digits;
};

const InlineEdit = forwardRef(function InlineEdit({ value, onSave, placeholder = "", mono = false, onNext, onPrev, isPhone = false }, ref) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const inputRef = useRef(null);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  useEffect(() => { setVal(value || ""); }, [value]);

  useImperativeHandle(ref, () => ({
    startEdit: () => setEditing(true),
  }));

  const commit = async () => {
    if (isPhone) {
      const digits = val.replace(/\D/g, '');
      if (digits.length > 0 && (digits.length < 10 || digits.length > 11)) {
        alert("O telefone deve ter entre 10 e 11 dígitos.");
        return;
      }
      const result = await onSave(digits.length > 0 ? formatTelefone(val) : "");
      if (result === false) return;
    } else {
      const result = await onSave(val);
      if (result === false) return;
    }
    setEditing(false);
  };

  if (editing) return (
    <input ref={inputRef} type="text" value={val}
      onChange={e => {
        const input = e.target.value;
        if (isPhone) {
          const digits = input.replace(/\D/g, '').slice(0, 11);
          setVal(formatTelefone(digits));
        } else {
          setVal(input);
        }
      }}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); commit(); onPrev?.(); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commit(); onNext?.(); return; }
        if (e.key === "Escape") { setVal(value || ""); setEditing(false); }
      }}
      className="bg-gray-800 border border-orange-500 text-white rounded px-1.5 py-0.5 text-sm focus:outline-none w-24"
      style={{MozAppearance:"textfield"}}
      inputMode={isPhone ? "numeric" : "text"}
    />
  );
  return (
    <span
      className={`text-gray-300 text-sm cursor-text hover:opacity-80 whitespace-nowrap ${mono ? 'font-mono' : ''}`}
      onClick={() => setEditing(true)}>
      {val || placeholder || "—"}
    </span>
  );
});

const FORMAS_PAGAMENTO = ["A Combinar", "Boleto", "Cartão", "Cheque", "Dinheiro", "PIX"];

// Feriados nacionais brasileiros fixos (MM-DD) + cálculo de variáveis
function getFeriadosBrasil(ano) {
  // Cálculo da Páscoa (algoritmo de Meeus/Jones/Butcher)
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  const pascoa = new Date(ano, mes - 1, dia);
  const fmt = d => `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addDias = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  return new Set([
    "01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25",
    fmt(addDias(pascoa, -48)), // Segunda de Carnaval
    fmt(addDias(pascoa, -47)), // Terça de Carnaval
    fmt(addDias(pascoa, -2)),  // Sexta-feira Santa
    fmt(pascoa),               // Páscoa
    fmt(addDias(pascoa, 60)),  // Corpus Christi
  ]);
}

function proximoDiaUtil(dataBase) {
  const d = dataBase ? new Date(dataBase + "T12:00:00") : new Date();
  d.setDate(d.getDate() + 1);
  const feriados = getFeriadosBrasil(d.getFullYear());
  const fmtKey = dt => `${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  for (let i = 0; i < 10; i++) {
    const dow = d.getDay();
    const key = fmtKey(d);
    if (dow !== 0 && dow !== 6 && !feriados.has(key)) break;
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split("T")[0];
}

function calcularVencimento(formaPagamento, dataEntrada) {
  if (!formaPagamento || formaPagamento === "A Combinar") {
    // 30 dias após a abertura
    const base = dataEntrada ? new Date(dataEntrada + "T12:00:00") : new Date();
    base.setDate(base.getDate() + 30);
    return base.toISOString().split("T")[0];
  }
  // Para demais formas: próximo dia útil
  return proximoDiaUtil(dataEntrada || new Date().toISOString().split("T")[0]);
}

const STATUS_OPTIONS = ["Aberto", "Concluído"];
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

function fmtValorInteiro(v) {
  const num = Math.round(Number(v || 0));
  return num.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function PagamentoSelect({ os, onRefresh }) {
  const pd = os.parcelas_detalhes;
  const formaAtual = (() => {
    if (!pd || pd.length === 0) return os.forma_pagamento || "A Combinar";
    const formas = [...new Set(pd.map(p => p.forma_pagamento).filter(Boolean))];
    if (formas.length === 0) return os.forma_pagamento || "A Combinar";
    if (formas.length === 1) return formas[0];
    return "Misto";
  })();

  if (formaAtual === "Misto") return <span className="text-gray-300 text-sm">Misto</span>;

  const handleChange = async (novaForma) => {
    const novoVenc = calcularVencimento(novaForma, new Date().toISOString().split("T")[0]);
    // Atualiza a OS
    const updates = { forma_pagamento: novaForma };
    if (pd && pd.length > 0) {
      updates.parcelas_detalhes = pd.map(p => ({ ...p, forma_pagamento: novaForma, vencimento: novoVenc }));
    }
    await base44.entities.Vendas.update(os.id, updates);
    // Atualiza lançamentos financeiros vinculados
    try {
      const fins = await base44.entities.Financeiro.filter({ ordem_venda_id: os.id });
      for (const f of fins) {
        await base44.entities.Financeiro.update(f.id, {
          forma_pagamento: novaForma,
          data_vencimento: novoVenc,
        });
      }
    } catch (_) {}
    onRefresh?.();
  };

  return (
    <select
      value={formaAtual}
      onChange={e => handleChange(e.target.value)}
      className="text-gray-300 text-sm border-0 outline-none cursor-pointer hover:text-white transition-colors"
      style={{ background: "transparent", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" }}
      onClick={e => e.stopPropagation()}
    >
      {FORMAS_PAGAMENTO.map(f => (
        <option key={f} value={f} style={{ background: "#1f2937", color: "#fff" }}>{f}</option>
      ))}
    </select>
  );
}

function VendaRowInner({ os, notas = [], clientes = [], onEdit, onDelete, onRefresh, onUpdate, colunas = COLUNAS_PADRAO, ocultarVeiculo = false, rowIndex, getRowRef, registerRef }, ref) {
  const clienteCadastro = clientes.find(c => c.id === os.cliente_id);
  const isConsumidor = os.cliente_nome?.toUpperCase() === "CONSUMIDOR";
  // Mostra apenas nome social: para CONSUMIDOR usa o da venda (ou "CONSUMIDOR" como padrão); para outros usa nome_fantasia do cadastro ou da venda
  const nomeSocialExibido = isConsumidor
    ? (os.cliente_nome_fantasia || "CONSUMIDOR")
    : (clienteCadastro?.nome_fantasia || os.cliente_nome_fantasia || os.cliente_nome || "—");
  const notasOs = notas.filter(n => n.ordem_venda_id === os.id && n.status !== 'Rascunho');
  const navigate = useNavigate();
  const [showAviso, setShowAviso] = useState(false);
  const [statusPendente, setStatusPendente] = useState(null);
  const [showAvisoExcluir, setShowAvisoExcluir] = useState(false);
  const [showBloqueio, setShowBloqueio] = useState(false);
  const [bloqueioQtd, setBloqueioQtd] = useState(0);
  const [manualNFModal, setManualNFModal] = useState(null);
  const normalizarNF = (v) => v ? v.replace(/\(#?(\d+)\)/, '$1') : v;
  const numeroRef = useRef(null);
   const nomeSocialRef = useRef(null);
   const contatoRef = useRef(null);
   const veiculoRef = useRef(null);
   const placaRef = useRef(null);
   const kmRef = useRef(null);

  const startFirstEdit = () => {
     numeroRef.current?.startEdit();
   };

  useImperativeHandle(ref, () => ({ startFirstEdit }));

  // Registra ref nesta linha para uso externo
  useEffect(() => {
    registerRef?.(rowIndex, { startFirstEdit });
    return () => registerRef?.(rowIndex, null);
  }, [rowIndex, registerRef, isConsumidor, colunas, ocultarVeiculo]);

  const goNextRow = () => {
    const next = getRowRef?.(rowIndex + 1);
    next?.startFirstEdit();
  };

  const saveField = async (field, val) => {
    if (field === "numero" && val && val !== os.numero) {
      const existentes = await base44.entities.Vendas.filter({ numero: val }, "-created_date", 5);
      const duplicado = existentes.find(v => v.id !== os.id);
      if (duplicado) {
        alert(`O número ${val} já está em uso pela venda do cliente "${duplicado.cliente_nome || "—"}". Escolha outro número.`);
        return false;
      }
    }
    await base44.entities.Vendas.update(os.id, { [field]: val });
    onUpdate?.({ [field]: val }); // atualiza local sem recarregar tudo

    // Atualiza descrição dos lançamentos financeiros quando campos relevantes mudam
    if (["cliente_nome_fantasia", "veiculo_modelo", "veiculo_placa"].includes(field)) {
      try {
        const vendaAtualizada = { ...os, [field]: val };
        const nomeCliente = vendaAtualizada.cliente_nome_fantasia || vendaAtualizada.cliente_nome || "";
        const veiculo = vendaAtualizada.veiculo_modelo ? ` — ${vendaAtualizada.veiculo_modelo}` : "";
        const placa = vendaAtualizada.veiculo_placa ? ` — ${vendaAtualizada.veiculo_placa}` : "";
        const fins = await base44.entities.Financeiro.filter({ ordem_venda_id: os.id }, "-created_date", 100);
        for (const f of fins) {
          const parcelaMatch = (f.descricao || "").match(/(\d+\/\d+)/);
          const parcelaStr = parcelaMatch ? parcelaMatch[1] : "1/1";
          const novaDesc = `#${os.numero} — ${nomeCliente}${veiculo}${placa} — ${parcelaStr}`;
          if (novaDesc !== f.descricao) {
            await base44.entities.Financeiro.update(f.id, { descricao: novaDesc });
          }
        }
      } catch (_) {}
    }
  };


  const gerarLancamentosFinanceiros = async (osData) => {
    // Verifica se já existem lançamentos para esta venda
    const finPorVenda = await base44.entities.Financeiro.filter({ ordem_venda_id: osData.id }, "-created_date", 100);
    if (finPorVenda.length > 0) return; // já existem, não duplica

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
    const parcelasAtualizadas = [...parcelas];
    for (let i = 0; i < parcelasAtualizadas.length; i++) {
      const p = parcelasAtualizadas[i];
      const forma = p.forma_pagamento || "A Combinar";
      const pago = ["Dinheiro", "PIX"].includes(forma);
      const fin = await base44.entities.Financeiro.create({
        tipo: "Receita", categoria: "Ordem de Venda",
        descricao: "Venda #" + osData.numero + " — " + (osData.cliente_nome || "") + " — Parcela " + (i+1) + "/" + parcelasAtualizadas.length,
        valor: p.valor,
        data_vencimento: p.vencimento,
        status: pago ? "Pago" : "Pendente",
        data_pagamento: pago ? new Date().toISOString().split("T")[0] : "",
        forma_pagamento: forma,
        ordem_venda_id: osData.id || "",
        cliente_id: osData.cliente_id || "",
      });
      parcelasAtualizadas[i] = { ...p, financeiro_id: fin.id, financeiro_status: pago ? "Pago" : "Pendente" };
    }
    // Salva financeiro_id nas parcelas da venda
    await base44.entities.Vendas.update(osData.id, { parcelas_detalhes: parcelasAtualizadas });
  };

  const alterarStatus = async (novoStatus) => {
    const eraConcluido = os.status === "Concluído";
    const ficaConcluido = novoStatus === "Concluído";
    const eraOrcamento = os.status === "Orçamento";
    const ficaOrcamento = novoStatus === "Orçamento";
    if (ficaConcluido && !eraConcluido) {
      const pd = os.parcelas_detalhes || [];
      if (pd.length > 0) {
        const fins = await base44.entities.Financeiro.filter({ ordem_venda_id: os.id }, "-created_date", 100);
        const receitas = fins.filter(f => f.tipo === "Receita");
        let pendentes = 0;
        if (receitas.length > 0) {
          pendentes = receitas.filter(f => f.status !== "Pago").length;
        } else {
          pendentes = pd.filter(p => p.financeiro_status !== "Pago").length;
        }
        if (pendentes > 0) {
          setBloqueioQtd(pendentes);
          setShowBloqueio(true);
          return;
        }
      }
    }
    onUpdate?.({ status: novoStatus });
    const updateData = { status: novoStatus };
    if (os.quilometragem !== undefined && os.quilometragem !== null) {
      updateData.quilometragem = String(os.quilometragem);
    }
    await base44.entities.Vendas.update(os.id, updateData);
    if (!eraConcluido && ficaConcluido) {
      await gerarLancamentosFinanceiros(os);
      await reduzirEstoque(os.pecas, os);
    }
    // Saindo de Orçamento para Aberto: subtrai estoque
    if (eraOrcamento && !ficaOrcamento && !ficaConcluido) {
      await reduzirEstoque(os.pecas, os);
    }
    // Entrando em Orçamento vindo de Aberto: devolve estoque
    if (!eraOrcamento && ficaOrcamento && !eraConcluido) {
      await restaurarEstoque(os.pecas || [], os.id);
    }
    onRefresh?.();
  };

  const confirmarMudancaStatus = async () => {
    try {
      await excluirLancamentosVenda(os.id);
      await restaurarEstoque(os.pecas, os.id);
      onUpdate?.({ status: statusPendente });
      const updateData = { status: statusPendente };
      if (os.quilometragem !== undefined && os.quilometragem !== null) {
        updateData.quilometragem = String(os.quilometragem);
      }
      await base44.entities.Vendas.update(os.id, updateData);
      setShowAviso(false);
      setStatusPendente(null);
      onRefresh?.();
    } catch (err) {
      alert("Erro ao alterar status: " + (err?.message || "Erro desconhecido"));
    }
  };

  const confirmarExcluir = async () => {
    try {
      await excluirLancamentosVenda(os.id);
      await limparHistoricoVenda(os.id);
      await base44.entities.Vendas.delete(os.id);
    } catch (err) {
      console.error("Erro ao excluir venda:", err);
    }
    setShowAvisoExcluir(false);
    onRefresh?.();
  };

  const handleExcluir = () => {
    setShowAvisoExcluir(true);
  };

  const imprimir = () => {
    const win = window.open("", "_blank");
    win.document.write(gerarHTMLImpressao(os));
    win.document.close();
  };

  const enviarWhatsApp = () => {
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const fone = telefone.startsWith("55") ? telefone : "55" + telefone;
    const concluido = os.status === "Concluído";

    let texto = "";
    if (concluido) {
      texto = `Olá ${os.cliente_nome || ""}! Seu veículo ${os.veiculo_modelo || ""} (${os.veiculo_placa || ""}) está pronto para retirada! 🎉\n\n`;
    } else {
      texto = `Olá ${os.cliente_nome || ""}! Segue o orçamento da Venda #${os.numero}:\n`;
      if (os.veiculo_modelo || os.veiculo_placa) texto += `Veículo: ${os.veiculo_modelo || ""} ${os.veiculo_placa ? `(${os.veiculo_placa})` : ""}\n`;
      texto += "\n";
    }

    const servicos = os.servicos || [];
    const pecas = os.pecas || [];

    if (servicos.length > 0) {
      texto += "*Serviços:*\n";
      servicos.forEach(s => {
        texto += `• ${s.descricao || "Serviço"} — ${fmtValor(s.valor * (s.quantidade || 1))}\n`;
      });
      texto += "\n";
    }

    if (pecas.length > 0) {
      texto += "*Peças:*\n";
      pecas.forEach(p => {
        texto += `• ${p.descricao || "Peça"} (${p.quantidade || 1}x) — ${fmtValor(p.valor_total || p.valor_unitario * (p.quantidade || 1))}\n`;
      });
      texto += "\n";
    }

    texto += `💰 *Total: ${fmtValor(os.valor_total)}*`;

    if (os.observacoes) texto += `\n\n📝 Obs: ${os.observacoes}`;

    window.open("https://wa.me/" + fone + "?text=" + encodeURIComponent(texto), "_blank");
  };

  const emitirNF = (tipo) => {
    // Bloquear se já existe NFe/NFCe (para tipos NFe e NFCe) ou NFSe (para tipo NFSe)
    const jaTemNfNfce = notasOs.some(n => n.tipo === 'NFe' || n.tipo === 'NFCe');
    const jaTemNfse = notasOs.some(n => n.tipo === 'NFSe');
    if ((tipo === 'NFe' || tipo === 'NFCe') && jaTemNfNfce) return;
    if (tipo === 'NFSe' && jaTemNfse) return;

    const params = new URLSearchParams({ emitir: "1", tipo, os_id: os.id, os_numero: os.numero || "", cliente_id: os.cliente_id || "", cliente_nome: os.cliente_nome || "", valor: String(os.valor_total || 0) });
    window.open(createPageUrl("NotasFiscais") + "?" + params.toString(), "_blank");
  };



  const style = STATUS_STYLE[os.status] || { style: { background: "#374151", color: "#fff" } };

  return (
    <>
      {showBloqueio && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/40 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{background:"rgba(220,38,38,0.15)", border:"1px solid rgba(220,38,38,0.4)"}}>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Pagamento Pendente</h3>
                <p className="text-gray-400 text-xs">Não é possível concluir</p>
              </div>
            </div>
            <div className="rounded-xl p-4" style={{background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)"}}>
              <p className="text-gray-200 text-sm leading-relaxed">
                Esta venda possui <strong className="text-red-400">{bloqueioQtd} parcela{bloqueioQtd > 1 ? 's' : ''}</strong> ainda não {bloqueioQtd > 1 ? 'quitadas' : 'quitada'}.
              </p>
              <p className="text-gray-400 text-xs mt-2">Quite todas as parcelas antes de concluir a venda.</p>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowBloqueio(false)}
                className="px-5 py-2 text-sm font-semibold rounded-xl text-white transition-all"
                style={{background:"#062C9B"}}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {showAvisoExcluir && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-7 h-7 flex-shrink-0" />
              <h3 className="text-lg font-bold">Excluir Venda</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Ao excluir esta venda:<br />
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
         <td className="px-4 py-3 text-white font-bold text-sm whitespace-nowrap font-mono">
           {os.numero || "—"}
         </td>
        {colunas.data && <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">{fmtData(os.data_entrada)}</td>}
        {colunas.cliente && <td className="px-4 py-3">
          {isConsumidor ? (
            <InlineEdit ref={nomeSocialRef} value={os.cliente_nome_fantasia || "CONSUMIDOR"} onSave={v => saveField("cliente_nome_fantasia", v)} placeholder="CONSUMIDOR"
              onNext={() => colunas.contato ? contatoRef.current?.startEdit() : veiculoRef.current?.startEdit()} />
          ) : (
            <p className="text-white text-sm font-medium">{nomeSocialExibido}</p>
          )}
        </td>}
        {colunas.contato && <td className="px-4 py-3"><InlineEdit ref={contatoRef} value={os.cliente_telefone} onSave={v => saveField("cliente_telefone", v)} placeholder="—"
          onNext={() => veiculoRef.current?.startEdit()}
          onPrev={() => isConsumidor ? nomeSocialRef.current?.startEdit() : null}
          isPhone={true} /></td>}
        {colunas.veiculo && !ocultarVeiculo && <td className="px-4 py-3"><InlineEdit ref={veiculoRef} value={os.veiculo_modelo} onSave={v => saveField("veiculo_modelo", v)} placeholder="—"
          onNext={() => placaRef.current?.startEdit()}
          onPrev={() => colunas.contato ? contatoRef.current?.startEdit() : isConsumidor ? nomeSocialRef.current?.startEdit() : null} /></td>}
        {colunas.placa && !ocultarVeiculo && <td className="px-4 py-3"><InlineEdit ref={placaRef} value={os.veiculo_placa?.toUpperCase()} onSave={v => saveField("veiculo_placa", v.toUpperCase())} placeholder="—" mono
          onNext={() => kmRef.current?.startEdit()}
          onPrev={() => veiculoRef.current?.startEdit()} /></td>}
        {colunas.km && !ocultarVeiculo && <td className="px-4 py-3"><InlineEdit ref={kmRef} value={os.quilometragem ? String(os.quilometragem) : ""} onSave={v => saveField("quilometragem", v || null)} placeholder="—"
          onNext={goNextRow}
          onPrev={() => placaRef.current?.startEdit()} /></td>}
        {colunas.status && <td className="px-4 py-3">
          <div className="flex gap-1">
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => alterarStatus(s)}
                className="flex items-center justify-center text-xs h-8 px-3 rounded-md font-semibold transition-all whitespace-nowrap"
                style={{
                  background: os.status === s ? STATUS_STYLE[s].style.background : "#1f2937",
                  color: "#fff",
                  opacity: os.status === s ? 1 : 0.5,
                  minWidth: "72px",
                }}>
                {s}
              </button>
            ))}
          </div>
        </td>}
        {colunas.valor && <td className="px-4 py-3 text-right text-gray-300 text-sm whitespace-nowrap">{fmtValorInteiro(os.valor_total)}</td>}
        {colunas.custo && <td className="px-4 py-3 text-right text-gray-300 text-sm whitespace-nowrap">
          {fmtValorInteiro((os.pecas || []).reduce((acc, p) => acc + Number(p.valor_custo || 0) * Number(p.quantidade || 1), 0) + (os.servicos || []).reduce((acc, s) => acc + Number(s.valor_custo || 0) * Number(s.quantidade ?? 1), 0))}
        </td>}
        {colunas.lucro && <td className="px-4 py-3 text-right text-gray-300 text-sm whitespace-nowrap">
          {(() => {
            const custo = (os.pecas || []).reduce((acc, p) => acc + Number(p.valor_custo || 0) * Number(p.quantidade || 1), 0) + (os.servicos || []).reduce((acc, s) => acc + Number(s.valor_custo || 0) * Number(s.quantidade ?? 1), 0);
            const lucro = os.valor_total - custo;
            return fmtValorInteiro(lucro);
          })()}
        </td>}

        {colunas?.nfe && <td className="px-4 py-3">{(() => {
          const nfe = notasOs.find(n => (n.tipo === 'NFe' || n.tipo === 'NFCe'));
          const manual = os.nfe_manual;
          if (nfe) return <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400">{nfe.tipo}{nfe.numero}</span>;
          if (manual) { const n = normalizarNF(manual); return <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/20 text-green-400">{n}</span>; }
          if (!(os.pecas?.length > 0)) return <span className="text-gray-700 text-xs">—</span>;
          return <button onClick={() => emitirNF('NFe')} className="text-gray-700 hover:text-green-400 text-xs transition-all">+ NF</button>;
        })()}</td>}
        {colunas.nfse && <td className="px-4 py-3">{(() => {
          const nfse = notasOs.find(n => n.tipo === 'NFSe');
          const manual = os.nfse_manual;
          if (nfse) return <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400">NFSe{nfse.numero}</span>;
          if (manual) { const n = normalizarNF(manual); return <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-400">{n}</span>; }
          if (!(os.servicos?.length > 0)) return <span className="text-gray-700 text-xs">—</span>;
          return <button onClick={() => emitirNF('NFSe')} className="text-gray-700 hover:text-blue-400 text-xs transition-all">+ NFSe</button>;
        })()}</td>}
        <td className="px-4 py-3">
          <div className="flex gap-1 justify-end" style={{whiteSpace:'nowrap'}}>
            <button onClick={() => onEdit?.()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all text-gray-500 hover:text-blue-400" title="Editar">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={imprimir} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white rounded-lg hover:bg-gray-700 transition-all" title="Imprimir">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={handleExcluir} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-all" title="Excluir">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={enviarWhatsApp} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-green-400 rounded-lg hover:bg-gray-700 transition-all" title={os.status === "Concluído" ? "Avisar que está pronto" : "Enviar orçamento"}>
              <WhatsAppIcon className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}

const VendaRow = forwardRef(VendaRowInner);
export default VendaRow;