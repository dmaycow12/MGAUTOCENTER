import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Plus, Search, TrendingUp, TrendingDown, DollarSign, X, Filter, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Edit, Trash2 } from "lucide-react";

const STATUS_OPTIONS = ["Pendente", "Pago"];

function SortHeader({ label, col, sortCol, sortDir, onClick, className = "" }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white transition-all ${className}`}>
      {label}
      <span className="flex flex-col" style={{lineHeight:1, gap:1}}>
        <span style={{opacity: sortCol===col && sortDir==="asc" ? 1 : 0.3, fontSize:8}}>▲</span>
        <span style={{opacity: sortCol===col && sortDir==="desc" ? 1 : 0.3, fontSize:8}}>▼</span>
      </span>
    </button>
  );
}
const PAGAMENTO_OPTIONS = ["A Combinar", "Boleto", "Cartão", "Dinheiro", "PIX"];
const STATUS_BG_LIST = { "Pendente": "#cc0000", "Pago": "#16a34a", "Atrasado": "#dc2626" };
import FinanceiroCard from "@/components/financeiro/FinanceiroCard";
import FluxoMes from "@/components/dashboard/FluxoMes";

const defaultForm = () => ({
  tipo: "Receita", categoria: "", descricao: "", valor: 0,
  data_vencimento: new Date().toISOString().split("T")[0], data_pagamento: "",
  status: "Pendente", forma_pagamento: "", ordem_servico_id: "", cliente_id: "", observacoes: ""
});

const statusColor = { "Pendente": "text-yellow-400 bg-yellow-500/10", "Pago": "text-green-400 bg-green-500/10", "Atrasado": "text-red-400 bg-red-500/10", "Cancelado": "text-gray-400 bg-gray-500/10" };

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function getPeriodoRange(mes, ano) {
  const pad = n => String(n).padStart(2, "0");
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-31` };
}

export default function Financeiro() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("financeiro_viewmode") || "cards");
  const hoje = new Date();

  const [filtroTipo, setFiltroTipo] = useState(() => localStorage.getItem("fin_filtroTipo") || "Todos");
  const [filtroStatus, setFiltroStatus] = useState(() => localStorage.getItem("fin_filtroStatus") || "Todos");
  const [filtroMes, setFiltroMes] = useState(() => Number(localStorage.getItem("fin_filtroMes")) || hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(() => Number(localStorage.getItem("fin_filtroAno")) || hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(() => localStorage.getItem("fin_usandoOutro") === "true");
  const [customRange, setCustomRange] = useState(() => { try { return JSON.parse(localStorage.getItem("fin_customRange")); } catch { return null; } });
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const [sortCol, setSortCol] = useState("data_vencimento");
  const [sortDir, setSortDir] = useState("asc");
  const periodoDropRef = useRef(null);
  const hojeKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [saldoMesKey, setSaldoMesKey] = useState(() => localStorage.getItem("fin_saldoMes") || hojeKey);

  useEffect(() => {
    const handler = (e) => {
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) setPeriodoDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navegarMes = (direcao) => {
    setUsandoOutroPeriodo(false); localStorage.setItem("fin_usandoOutro", "false");
    setCustomRange(null); localStorage.removeItem("fin_customRange");
    let novoMes = filtroMes + direcao;
    let novoAno = filtroAno;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setFiltroMes(novoMes); localStorage.setItem("fin_filtroMes", novoMes);
    setFiltroAno(novoAno); localStorage.setItem("fin_filtroAno", novoAno);
  };

  const aplicarAtalho = (tipo) => {
    const hoje = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const salvarCustom = (range) => { setCustomRange(range); localStorage.setItem("fin_customRange", JSON.stringify(range)); setUsandoOutroPeriodo(true); localStorage.setItem("fin_usandoOutro", "true"); };
    const salvarMes = (m, a) => { setFiltroMes(m); localStorage.setItem("fin_filtroMes", m); setFiltroAno(a); localStorage.setItem("fin_filtroAno", a); setUsandoOutroPeriodo(false); localStorage.setItem("fin_usandoOutro", "false"); setCustomRange(null); localStorage.removeItem("fin_customRange"); };
    if (tipo === 'hoje') {
      const d = fmt(hoje); salvarCustom({ inicio: d, fim: d });
    } else if (tipo === 'ontem') {
      const d = new Date(hoje); d.setDate(hoje.getDate() - 1); const s = fmt(d);
      salvarCustom({ inicio: s, fim: s });
    } else if (tipo === 'semana') {
      const dow = hoje.getDay();
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow);
      const fim = new Date(hoje); fim.setDate(hoje.getDate() + (6 - dow));
      salvarCustom({ inicio: fmt(ini), fim: fmt(fim) });
    } else if (tipo === 'semana_passada') {
      const dow = hoje.getDay();
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow - 7);
      const fim = new Date(hoje); fim.setDate(hoje.getDate() - dow - 1);
      salvarCustom({ inicio: fmt(ini), fim: fmt(fim) });
    } else if (tipo === 'mes') {
      salvarMes(hoje.getMonth() + 1, hoje.getFullYear());
    } else if (tipo === 'mes_passado') {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      salvarMes(d.getMonth() + 1, d.getFullYear());
    } else if (tipo === 'ano') {
      salvarCustom({ inicio: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` });
    } else if (tipo === 'ano_passado') {
      const a = hoje.getFullYear() - 1;
      salvarCustom({ inicio: `${a}-01-01`, fim: `${a}-12-31` });
    } else if (tipo === 'tudo') {
      salvarCustom({ inicio: '2000-01-01', fim: '2099-12-31' });
    }
    setPeriodoDropOpen(false);
  };

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    const range = { inicio: outroPeriodoInicio, fim: outroPeriodoFim };
    setCustomRange(range); localStorage.setItem("fin_customRange", JSON.stringify(range));
    setUsandoOutroPeriodo(true); localStorage.setItem("fin_usandoOutro", "true");
    setPeriodoDropOpen(false);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [data, vendas] = await Promise.all([
        base44.entities.Financeiro.list("-data_vencimento", 9999),
        base44.entities.Vendas.list("-created_date", 9999),
      ]);
      // IDs de vendas com status Orçamento
      const idsOrcamento = new Set(vendas.filter(v => v.status === "Orçamento").map(v => v.id));
      // Filtra lançamentos vinculados a Orçamentos
      const semOrcamento = data.filter(i => {
        const vinculo = i.ordem_venda_id || i.ordem_servico_id;
        return !vinculo || !idsOrcamento.has(vinculo);
      });
      // Auto-marcar como Atrasado se vencido e não pago
      const hoje = new Date().toISOString().split("T")[0];
      const aAtualizar = semOrcamento.filter(i => i.status === "Pendente" && i.data_vencimento && i.data_vencimento < hoje);
      for (const item of aAtualizar) {
        try { await base44.entities.Financeiro.update(item.id, { status: "Atrasado" }); } catch (_) {}
      }
      const atualizado = aAtualizar.length > 0
        ? (await base44.entities.Financeiro.list("-data_vencimento", 9999)).filter(i => {
            const vinculo = i.ordem_venda_id || i.ordem_servico_id;
            return !vinculo || !idsOrcamento.has(vinculo);
          })
        : semOrcamento;
      setItems(atualizado);
    } catch (err) {
      console.error("Erro ao carregar financeiro:", err);
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    if (!form.descricao) return alert("Informe a descrição.");
    if (!form.valor) return alert("Informe o valor.");
    if (editando) {
      await base44.entities.Financeiro.update(editando.id, form);
    } else {
      await base44.entities.Financeiro.create(form);
    }
    setShowForm(false);
    setEditando(null);
    setForm(defaultForm());
    load();
  };

  const excluir = async (id) => {
    if (!confirm("Excluir este lançamento?")) return;
    await base44.entities.Financeiro.delete(id);
    load();
  };

  const verificarEConcluirVenda = async (vendaId) => {
    if (!vendaId) return;
    const fins = await base44.entities.Financeiro.filter({ ordem_venda_id: vendaId }, "-created_date", 100);
    const receitas = fins.filter(f => f.tipo === "Receita");
    if (receitas.length > 0 && receitas.every(f => f.status === "Pago")) {
      const vendas = await base44.entities.Vendas.filter({ id: vendaId }, "-created_date", 1);
      const venda = vendas[0];
      if (venda && venda.status !== "Concluído") {
        await base44.entities.Vendas.update(vendaId, { status: "Concluído", data_conclusao: new Date().toISOString().split("T")[0] });
      }
    }
  };

  const alterarStatus = async (item, novoStatus) => {
    const update = { status: novoStatus };
    if (novoStatus === "Pago") update.data_pagamento = new Date().toISOString().split("T")[0];
    if (novoStatus === "Pendente" || novoStatus === "Atrasado") update.data_pagamento = "";
    await base44.entities.Financeiro.update(item.id, update);
    if (novoStatus === "Pago" && item.ordem_venda_id) {
      await verificarEConcluirVenda(item.ordem_venda_id);
    }
    load();
  };

  const alterarEtiqueta = async (item, novaEtiqueta) => {
    await base44.entities.Financeiro.update(item.id, { etiqueta: novaEtiqueta });
    load();
  };

  const alterarPagamento = async (item, novaForma) => {
    const update = { forma_pagamento: novaForma };
    if (["Dinheiro", "PIX"].includes(novaForma)) {
      update.status = "Pago";
      update.data_pagamento = new Date().toISOString().split("T")[0];
    }
    await base44.entities.Financeiro.update(item.id, update);
    if (update.status === "Pago" && item.ordem_venda_id) {
      await verificarEConcluirVenda(item.ordem_venda_id);
    }

    // Sincronizar com Vendas
    if (item.ordem_venda_id) {
      try {
        const vendas = await base44.entities.Vendas.filter({ id: item.ordem_venda_id }, "-created_date", 1);
        const venda = vendas[0];
        if (venda) {
          const match = item.descricao?.match(/Parcela (\d+)\//);
          const numParcela = match ? parseInt(match[1]) : 1;
          const novasParcelas = (venda.parcelas_detalhes || []).map(p =>
            p.numero === numParcela ? { ...p, forma_pagamento: novaForma } : p
          );
          const formas = [...new Set(novasParcelas.map(p => p.forma_pagamento).filter(Boolean))];
          await base44.entities.Vendas.update(item.ordem_venda_id, {
            parcelas_detalhes: novasParcelas,
            forma_pagamento: formas.length === 1 ? formas[0] : novaForma,
          });
        }
      } catch (_) {}
    }

    load();
  };

  const periodoRange = usandoOutroPeriodo && customRange
    ? customRange
    : getPeriodoRange(filtroMes, filtroAno);

  const itemsNoPeriodo = items.filter(i => {
    const ref = i.data_vencimento || i.data_pagamento || "";
    return ref >= periodoRange.inicio && ref <= periodoRange.fim;
  });

  const filtrados = itemsNoPeriodo.filter(i => {
    const matchSearch = !search || i.descricao?.toLowerCase().includes(search.toLowerCase()) || i.categoria?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filtroTipo === "Todos" || i.tipo === filtroTipo || (filtroTipo === "Saída" && (i.tipo === "Saída" || i.tipo === "Despesa"));
    const matchStatus = filtroStatus === "Todos" || i.status === filtroStatus;
    return matchSearch && matchTipo && matchStatus;
  });

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const extractNum = (desc) => { const m = (desc || "").match(/#(\d+)/); if (m) return parseInt(m[1]) || 0; const n = (desc || "").match(/(\d+)/); return n ? parseInt(n[1]) || 0 : 0; };

  const sortedFiltrados = [...filtrados].sort((a, b) => {
    let va = a[sortCol] || "";
    let vb = b[sortCol] || "";
    if (sortCol === "valor") { va = Number(a.valor||0); vb = Number(b.valor||0); return sortDir === "asc" ? va-vb : vb-va; }
    if (sortCol === "data_vencimento") {
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
      // mesma data: ordenar por número na descrição
      return extractNum(a.descricao) - extractNum(b.descricao);
    }
    if (sortCol === "descricao") {
      const matchA = va.match(/Venda #(\d+)/);
      const matchB = vb.match(/Venda #(\d+)/);
      if (matchA && matchB) {
        const numA = parseInt(matchA[1]) || 0;
        const numB = parseInt(matchB[1]) || 0;
        return sortDir === "asc" ? numA - numB : numB - numA;
      }
    }
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  // Cálculos (baseados no período selecionado)
  const pendente = itemsNoPeriodo.filter(i => i.status === "Pendente").reduce((a, i) => a + Number(i.valor || 0), 0);
  const atrasado = itemsNoPeriodo.filter(i => i.status === "Atrasado").reduce((a, i) => a + Number(i.valor || 0), 0);

  if (loading) return null;

  return (
    <div className="space-y-4">

      {/* Header — Botões no topo */}
      <div className="flex flex-col gap-2">
        {/* Linha 1: + Receita / + Despesa */}
        <div className="flex gap-2">
              <button onClick={() => { setForm({ ...defaultForm(), tipo: "Receita" }); setShowForm(true); setEditando(null); }} className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all" style={{background: "#00ff00", color: "#fff"}} onMouseEnter={e => e.currentTarget.style.background = "#00dd00"} onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
                <Plus className="w-4 h-4" /> Receita
              </button>
              <button onClick={() => { setForm({ ...defaultForm(), tipo: "Saída" }); setShowForm(true); setEditando(null); }} className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all" style={{background: "#cc0000", color: "#fff"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
                <Plus className="w-4 h-4" /> Saída
              </button>
            </div>

        {/* Filtro de Período */}
        <div className="flex gap-2 items-center">
          <div className={`flex-1 flex items-center h-11 rounded-xl text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button onClick={() => { setUsandoOutroPeriodo(false); localStorage.setItem("fin_usandoOutro","false"); setCustomRange(null); localStorage.removeItem("fin_customRange"); }} className="flex-1 text-center truncate h-full hover:bg-white/10 transition-all cursor-pointer">{MESES[filtroMes - 1]} - {filtroAno}</button>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="relative flex-1" ref={periodoDropRef}>
            <button
              onClick={() => setPeriodoDropOpen(v => !v)}
              className={`w-full flex items-center justify-center gap-2 px-4 h-11 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}
            >
              {usandoOutroPeriodo && customRange
                ? `${customRange.inicio.split("-").reverse().join("/")} — ${customRange.fim.split("-").reverse().join("/")}`
                : `${String(1).padStart(2, "0")}/${String(filtroMes).padStart(2, "0")}/${filtroAno} — ${String(new Date(filtroAno, filtroMes, 0).getDate()).padStart(2, "0")}/${String(filtroMes).padStart(2, "0")}/${filtroAno}`}
              <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${periodoDropOpen ? "rotate-180" : ""}`} />
            </button>
            {periodoDropOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 space-y-3">
                <p className="text-xs text-gray-400 font-medium">Atalhos</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['hoje','Hoje'],['ontem','Ontem'],['semana','Semana'],['semana_passada','Sem. Passada'],['mes','Mês'],['mes_passado','Mês Passado'],['ano','Ano'],['ano_passado','Ano Passado'],['tudo','Tudo']].map(([tipo, label]) => (
                    <button key={tipo} onClick={() => aplicarAtalho(tipo)}
                      className="py-2 text-xs text-white bg-gray-800 hover:bg-[#062C9B] border border-gray-700 rounded-lg font-medium transition-all">
                      {label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-700 pt-3 space-y-3">
                <p className="text-xs text-gray-400 font-medium">Período personalizado</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">De</label>
                  <input type="date" value={outroPeriodoInicio} onChange={e => setOutroPeriodoInicio(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Até</label>
                  <input type="date" value={outroPeriodoFim} onChange={e => setOutroPeriodoFim(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPeriodoDropOpen(false)}
                    className="flex-1 py-2 text-xs text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">
                    Cancelar
                  </button>
                  <button onClick={aplicarOutroPeriodo}
                    className="flex-1 py-2 text-xs text-white rounded-lg font-medium transition-all" style={{background: "#062C9B"}} onMouseEnter={e => e.currentTarget.style.background = "#041a4d"} onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}>
                    Aplicar
                  </button>
                </div>
                </div>
                </div>
            )}
          </div>
        </div>

        {/* Gráficos */}
        <FluxoMes financeiro={itemsNoPeriodo} />

        {/* Saldo do Caixa */}
        {(() => {
          const mesesComMovimento = new Set(items
            .filter(f => f.status === "Pago" && (f.data_pagamento || f.data_vencimento))
            .map(f => (f.data_pagamento || f.data_vencimento).substring(0, 7)));
          const mesesFuturos = new Set(items
            .filter(f => (f.data_vencimento || "") > hojeKey)
            .map(f => f.data_vencimento.substring(0, 7)));
          const todosMeses = Array.from(new Set([...mesesComMovimento, ...mesesFuturos, hojeKey])).sort();
          const idxAtual = todosMeses.indexOf(saldoMesKey);
          const saldoMesSeguro = idxAtual === -1 ? hojeKey : saldoMesKey;
          const idxSeguro = idxAtual === -1 ? todosMeses.indexOf(hojeKey) : idxAtual;
          const navSaldo = (dir) => {
            const novoIdx = idxSeguro + dir;
            if (novoIdx >= 0 && novoIdx < todosMeses.length) {
              const novo = todosMeses[novoIdx];
              setSaldoMesKey(novo);
              localStorage.setItem("fin_saldoMes", novo);
            }
          };
          const [saldoAno, saldoMesNum] = saldoMesSeguro.split("-").map(Number);
          const fmtV = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const totalRecebido = items.filter(f => f.tipo === "Receita" && f.status === "Pago" && (f.data_vencimento || "").startsWith(saldoMesSeguro)).reduce((acc, f) => acc + Number(f.valor || 0), 0);
          const totalPago = items.filter(f => f.tipo === "Despesa" && f.status === "Pago" && (f.data_vencimento || "").startsWith(saldoMesSeguro)).reduce((acc, f) => acc + Number(f.valor || 0), 0);
          const saldoAnterior = items.filter(f => f.status === "Pago" && (f.data_vencimento || "") < saldoMesSeguro).reduce((acc, f) => acc + (f.tipo === "Receita" ? 1 : -1) * Number(f.valor || 0), 0);
          const saldo = saldoAnterior + totalRecebido - totalPago;
          return (
            <div className="rounded-2xl p-4" style={{background: "linear-gradient(135deg, #0a1929 0%, #132642 100%)", border: "1px solid #1e4d7b"}}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-bold text-lg">Saldo do Caixa</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => navSaldo(-1)} disabled={idxSeguro === 0} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all" style={{background:"rgba(255,255,255,0.07)"}}>
                    <ChevronLeft className="w-3 h-3 text-white" />
                  </button>
                  <span className="text-white text-xs font-semibold px-2 min-w-[110px] text-center">{MESES[saldoMesNum - 1]} - {saldoAno}</span>
                  <button onClick={() => navSaldo(1)} disabled={idxSeguro === todosMeses.length - 1} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all" style={{background:"rgba(255,255,255,0.07)"}}>
                    <ChevronRight className="w-3 h-3 text-white" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 rounded-xl px-2 py-2 flex flex-col items-center justify-center gap-1 min-w-0" style={{background: "#0d1b2a", border: "1px solid #1e3a5f"}}>
                  <span className="text-xs font-semibold text-gray-400 tracking-wide">Saldo Anterior</span>
                  <span className="text-xs font-bold truncate" style={{color: saldoAnterior >= 0 ? "#60a5fa" : "#FF4444"}}>{saldoAnterior >= 0 ? fmtV(saldoAnterior) : `- ${fmtV(Math.abs(saldoAnterior))}`}</span>
                </div>
                <div className="flex-1 rounded-xl px-2 py-2 flex flex-col items-center justify-center gap-1 min-w-0" style={{background: "#0d1b2a", border: "1px solid #1e3a5f"}}>
                  <span className="text-xs font-semibold text-gray-400 tracking-wide">Recebido</span>
                  <span className="text-xs font-bold text-green-400 truncate">{fmtV(totalRecebido)}</span>
                </div>
                <div className="flex-1 rounded-xl px-2 py-2 flex flex-col items-center justify-center gap-1 min-w-0" style={{background: "#0d1b2a", border: "1px solid #1e3a5f"}}>
                  <span className="text-xs font-semibold text-gray-400 tracking-wide">Pago</span>
                  <span className="text-xs font-bold text-red-400 truncate">{fmtV(totalPago)}</span>
                </div>
                <div className="flex-1 rounded-xl px-2 py-2 flex flex-col items-center justify-center gap-1 min-w-0" style={{background: saldo >= 0 ? "#0d1b2a" : "#2a0d0d", border: saldo >= 0 ? "1px solid #1e3a5f" : "1px solid #5f1e1e"}}>
                  <span className="text-xs font-semibold text-gray-400 tracking-wide">Saldo Real</span>
                  <span className="text-xs font-bold truncate" style={{color: saldo >= 0 ? "#00C957" : "#FF4444"}}>{saldo >= 0 ? fmtV(saldo) : `- ${fmtV(Math.abs(saldo))}`}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Linha 3: filtro tipo — Receita / Despesa / Todos */}
            <div className="flex gap-2">
               {["Todos","Receita","Saída"].map(t => (
                 <button key={t} onClick={() => { setFiltroTipo(t); localStorage.setItem("fin_filtroTipo", t); }} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${filtroTipo === t ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>{t === "Todos" ? "Tudo" : t}</button>
               ))}
             </div>

            {/* Linha 4: filtro status — Pendente / Atrasado / Pago / Todos */}
            <div className="flex gap-2">
              {["Todos","Pendente","Atrasado","Pago"].map(s => (
                <button key={s} onClick={() => { setFiltroStatus(s); localStorage.setItem("fin_filtroStatus", s); }} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${filtroStatus === s ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>{s === "Todos" ? "Tudo" : s}</button>
              ))}
            </div>

            {/* Linha 5: busca + toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div className="flex bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                <button onClick={() => { setViewMode("list"); localStorage.setItem("financeiro_viewmode","list"); }} className="px-3 py-2 transition-all" style={{background:viewMode==="list"?"#062C9B":"transparent",color:viewMode==="list"?"#fff":"#6b7280"}}><List className="w-5 h-5"/></button>
                <button onClick={() => { setViewMode("cards"); localStorage.setItem("financeiro_viewmode","cards"); }} className="px-3 py-2 transition-all" style={{background:viewMode==="cards"?"#062C9B":"transparent",color:viewMode==="cards"?"#fff":"#6b7280"}}><LayoutGrid className="w-5 h-5"/></button>
              </div>
            </div>
          </div>

          {/* Cards/Lista */}
          {filtrados.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-12 text-center space-y-3">
              <p className="text-gray-500">Nenhum lançamento encontrado neste período</p>
              {items.length > 0 && itemsNoPeriodo.length === 0 && (
                <p className="text-yellow-400 text-sm">
                  Há {items.length} lançamento(s) em outros períodos.{" "}
                  <button onClick={() => aplicarAtalho('tudo')} className="underline hover:text-yellow-300">Clique aqui para ver tudo</button>
                </p>
              )}
            </div>
          ) : viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedFiltrados.map(item => (
                <FinanceiroCard key={item.id} item={item} onEdit={(i) => { setForm({ ...defaultForm(), ...i }); setEditando(i); setShowForm(true); }} onDelete={excluir} onAlterarStatus={alterarStatus} onAlterarPagamento={alterarPagamento} />
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
              <div style={{minWidth: 700}}>
              {/* Cabeçalho com ordenação */}
               <div className="flex items-center px-2 py-2 border-b border-gray-700 bg-gray-800/50">
                 <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0 text-center">Tipo</span>
                 <div className="w-px h-6 bg-gray-700 mx-1" />
                 <span className="text-xs font-semibold text-gray-400 w-16 flex-shrink-0 text-center">Data</span>
                 <div className="w-px h-6 bg-gray-700 mx-1" />
                 <span className="text-xs font-semibold text-gray-400 flex-1 text-center">Descrição</span>
                 <div className="w-px h-6 bg-gray-700 mx-1" />
                 <span className="text-xs font-semibold text-gray-400 w-20 flex-shrink-0 text-center">Valor</span>
                 <div className="w-px h-6 bg-gray-700 mx-1" />
                 <span className="text-xs font-semibold text-gray-400 w-20 flex-shrink-0 text-center">Etiqueta</span>
                 <div className="w-px h-6 bg-gray-700 mx-1" />
                 <span className="text-xs font-semibold text-gray-400 w-28 flex-shrink-0 text-center">Pagamento</span>
                 <div className="w-px h-6 bg-gray-700 mx-1" />
                 <span className="text-xs font-semibold text-gray-400 w-44 flex-shrink-0 text-center">Status</span>
                 <div className="w-px h-6 bg-gray-700 mx-1" />
                 <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0 text-center">Ações</span>
               </div>
              {sortedFiltrados.map(item => (
                <ListRow key={item.id} item={item}
                  onEdit={() => { setForm({...defaultForm(),...item}); setEditando(item); setShowForm(true); }}
                  onDelete={() => excluir(item.id)}
                  onAlterarStatus={alterarStatus}
                  onAlterarPagamento={alterarPagamento}
                  onAlterarEtiqueta={alterarEtiqueta}
                />
              ))}
              </div>
            </div>
          )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">{editando ? "Editar Lançamento" : `Novo ${form.tipo}`}</h2>
              <button onClick={() => { setShowForm(false); setEditando(null); }}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Tipo">
                    <div className={`input-dark flex items-center ${form.tipo === "Receita" ? "text-green-400" : form.tipo === "Saída" || form.tipo === "Despesa" ? "text-red-400" : ""}`}>
                      {form.tipo === "Despesa" ? "Saída" : form.tipo}
                    </div>
                  </F>
                <F label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-dark">
                    {["Pendente","Pago","Atrasado","Cancelado"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </F>
                <F label="Descrição *" className="col-span-2">
                  <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="input-dark" />
                </F>
                <F label="Categoria">
                  <input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="input-dark" placeholder="Ex: Aluguel, Material..." />
                </F>
                <F label="Valor (R$) *">
                  <input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: Number(e.target.value) })} className="input-dark" />
                </F>
                <F label="Data Vencimento">
                  <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} className="input-dark" />
                </F>
                <F label="Data Pagamento">
                  <input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} className="input-dark" />
                </F>
                <F label="Forma Pagamento" className="col-span-2">
                  <select value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })} className="input-dark">
                    <option value="">—</option>
                    {["A Combinar","Boleto","Cartão","Dinheiro","PIX"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </F>
              </div>
              <F label="Observações">
                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input-dark" rows={2} />
              </F>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="px-4 py-2 text-sm text-white rounded-lg transition-all font-medium" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>Cancelar</button>
              <button onClick={salvar} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all" style={{background: "#062C9B"}} onMouseEnter={e => e.currentTarget.style.background = "#041a4d"} onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}>
                {editando ? "Salvar" : "Lançar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; }`}</style>
    </div>
  );
}



function FluxoCaixa({ items }) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const ano = new Date().getFullYear();

  const dados = meses.map((mes, i) => {
    const mesNum = String(i + 1).padStart(2, "0");
    const prefixo = `${ano}-${mesNum}`;
    const r = items.filter(x => x.tipo === "Receita" && x.status === "Pago" && x.data_pagamento?.startsWith(prefixo)).reduce((a, x) => a + Number(x.valor || 0), 0);
    const d = items.filter(x => x.tipo === "Despesa" && x.status === "Pago" && x.data_pagamento?.startsWith(prefixo)).reduce((a, x) => a + Number(x.valor || 0), 0);
    return { mes, receitas: r, despesas: d, saldo: r - d };
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold">Fluxo de Caixa — {ano}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="px-4 py-3 text-left">Mês</th>
              <th className="px-4 py-3 text-right text-green-400">Receitas</th>
              <th className="px-4 py-3 text-right text-red-400">Despesas</th>
              <th className="px-4 py-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-white">{d.mes}</td>
                <td className="px-4 py-3 text-right text-green-400">R$ {d.receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-red-400">R$ {d.despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className={`px-4 py-3 text-right font-bold ${d.saldo >= 0 ? "text-orange-400" : "text-red-400"}`}>
                  R$ {d.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }) {
  const colors = { green: "text-green-400 bg-green-500/10", red: "text-red-400 bg-red-500/10", orange: "text-orange-400 bg-orange-500/10", yellow: "text-yellow-400 bg-yellow-500/10" };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-xl font-bold ${colors[color].split(" ")[0]}`}>
        R$ {Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

const ETIQUETA_OPTIONS = ["Receita", "Despesa", "Ativo", "Retirada"];
const ETIQUETA_COLORS = { "Receita": "#16a34a", "Despesa": "#cc0000", "Ativo": "#062C9B", "Retirada": "#7c3aed" };

function ListRow({ item, onEdit, onDelete, onAlterarStatus, onAlterarPagamento, onAlterarEtiqueta }) {
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const [etiquetaOpen, setEtiquetaOpen] = useState(false);
  const pagamentoRef = useRef(null);
  const pagamentoBtnRef = useRef(null);
  const etiquetaRef = useRef(null);
  const etiquetaBtnRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const [etiquetaPos, setEtiquetaPos] = useState({ top: 0, left: 0, width: 0 });

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

  const calcEtiquetaPos = () => {
    if (!etiquetaBtnRef.current) return;
    const rect = etiquetaBtnRef.current.getBoundingClientRect();
    const itemHeight = ETIQUETA_OPTIONS.length * 36;
    const openUp = window.innerHeight - rect.bottom < itemHeight + 8;
    setEtiquetaPos({
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
      if (etiquetaRef.current && !etiquetaRef.current.contains(e.target) &&
          etiquetaBtnRef.current && !etiquetaBtnRef.current.contains(e.target)) {
        setEtiquetaOpen(false);
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

  useEffect(() => {
    if (!etiquetaOpen) return;
    const onScroll = () => calcEtiquetaPos();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [etiquetaOpen]);

  const abrirDropdown = () => {
    if (item.status === "Pago") return;
    calcPos();
    setPagamentoOpen(v => !v);
  };

  const abrirEtiqueta = () => {
    // Receita não pode mudar etiqueta
    if (item.tipo === "Receita") return;
    calcEtiquetaPos();
    setEtiquetaOpen(v => !v);
  };

  // Etiqueta padrão baseada no tipo
  const etiquetaAtual = item.etiqueta || (item.tipo === "Receita" ? "Receita" : "Despesa");
  const etiquetaColor = ETIQUETA_COLORS[etiquetaAtual] || "#374151";

  const fmt = v => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="flex items-center px-2 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-all">
      {/* Tipo badge */}
      <span className={`text-xs px-1 py-1 rounded-full font-medium flex-shrink-0 w-14 text-center ${item.tipo==="Receita"?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{item.tipo === "Despesa" ? "Saída" : item.tipo}</span>
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Data */}
      <span className="text-gray-400 text-xs flex-shrink-0 w-16 text-center">{item.data_vencimento ? item.data_vencimento.split("-").reverse().join("/") : "—"}</span>
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Descrição */}
      <div className="flex-1 text-center" style={{minWidth: 120}}>
        <p className="text-white font-semibold text-xs whitespace-nowrap">{item.descricao}</p>
      </div>
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Valor */}
      <span className={`font-bold text-xs flex-shrink-0 w-20 text-center ${item.tipo==="Receita"?"text-green-400":item.tipo==="Saída"||item.tipo==="Despesa"?"text-red-400":""}`}>R$ {fmt(item.valor)}</span>
      <div className="w-px h-6 bg-gray-700 mx-1" />



      {/* Etiqueta — dropdown via portal */}
      <div className="relative flex-shrink-0 w-20 flex justify-center">
        <button
          ref={etiquetaBtnRef}
          onClick={abrirEtiqueta}
          className="rounded-lg text-xs font-bold text-center transition-all"
          style={{
            width: 70,
            padding: "4px 0",
            background: etiquetaColor,
            color: "#fff",
            cursor: item.tipo === "Receita" ? "default" : "pointer",
            opacity: item.tipo === "Receita" ? 0.8 : 1,
            flexShrink: 0,
          }}
          title={item.tipo === "Receita" ? "Receitas sempre têm etiqueta Receita" : "Clique para alterar"}
        >
          {etiquetaAtual}
        </button>
        {etiquetaOpen && createPortal(
          <div
            ref={etiquetaRef}
            style={{ position: "fixed", top: etiquetaPos.top, left: etiquetaPos.left, width: etiquetaPos.width, zIndex: 999999 }}
            className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          >
            {["Despesa", "Ativo", "Retirada"].map(op => (
              <button key={op} onClick={() => {
                onAlterarEtiqueta(item, op);
                setEtiquetaOpen(false);
              }}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-all"
                style={{ background: etiquetaAtual === op ? "#062C9B" : "transparent", color: etiquetaAtual === op ? "#fff" : undefined }}
              >
                {op}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Pagamento — dropdown via portal */}
      <div className="relative flex-shrink-0 w-28 flex justify-center">
        <button
          ref={pagamentoBtnRef}
          onClick={abrirDropdown}
          className="rounded-lg text-xs font-bold text-center transition-all"
          style={{
            width: 90,
            padding: "4px 2px",
            background: "#374151",
            color: item.status === "Pago" ? "#9ca3af" : "#fff",
            cursor: item.status === "Pago" ? "not-allowed" : "pointer",
            opacity: item.status === "Pago" ? 0.6 : 1,
            flexShrink: 0,
            fontSize: 9,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={item.status === "Pago" ? "Não é possível alterar a forma de pagamento de um lançamento já pago" : "Clique para alterar"}
        >
          {item.forma_pagamento || "—"}
        </button>
        {pagamentoOpen && createPortal(
           <div
             ref={pagamentoRef}
             style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 999999 }}
            className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          >
            {PAGAMENTO_OPTIONS.map(op => (
              <button key={op} onClick={() => {
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
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Status — botões sempre visíveis */}
      <div className="flex gap-1 flex-shrink-0 w-44 justify-center">
        {STATUS_OPTIONS.map(s => {
          const bloqueado = s === "Pago" && (!item.forma_pagamento || item.forma_pagamento === "A Combinar");
          const isActive = item.status === s || (s === "Pendente" && item.status === "Atrasado");
          return (
            <button key={s}
              onClick={() => {
                if (bloqueado) {
                  toast.error("Defina a forma de pagamento antes de marcar como Pago.");
                  return;
                }
                onAlterarStatus(item, s);
              }}
              className="rounded-lg text-xs font-bold transition-all"
              style={{
                width: 60,
                padding: "4px 0",
                textAlign: "center",
                background: isActive ? STATUS_BG_LIST[s] : "#374151",
                color: "#fff",
                opacity: isActive ? 1 : bloqueado ? 0.25 : 0.45,
                cursor: bloqueado ? "not-allowed" : "pointer",
                flexShrink: 0,
              }}
              title={bloqueado ? "Selecione a forma de pagamento primeiro" : undefined}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Ações */}
      <div className="flex gap-1 flex-shrink-0 w-14 justify-center">
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-700 transition-all"><Edit className="w-3.5 h-3.5"/></button>
        <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-700 transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>
    </div>
  );
}

function F({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Loader() { return null; }