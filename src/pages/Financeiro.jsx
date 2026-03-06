import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, TrendingUp, TrendingDown, DollarSign, X, Filter, ChevronDown } from "lucide-react";
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
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroStatus, setFiltroStatus] = useState("Todos");

  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState(hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(false);
  const [mesDropOpen, setMesDropOpen] = useState(false);
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const [customRange, setCustomRange] = useState(null);
  const mesDropRef = useRef(null);
  const periodoDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (mesDropRef.current && !mesDropRef.current.contains(e.target)) setMesDropOpen(false);
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) setPeriodoDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Gera lista dos últimos 12 meses (incluindo o atual)
  const ultimos12Meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return { mes: d.getMonth() + 1, ano: d.getFullYear() };
  });

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    setCustomRange({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
    setUsandoOutroPeriodo(true);
    setPeriodoDropOpen(false);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await base44.entities.Financeiro.list("-data_vencimento", 500);
    // Auto-marcar como Atrasado se vencido e não pago
    const hoje = new Date().toISOString().split("T")[0];
    const aAtualizar = data.filter(i => i.status === "Pendente" && i.data_vencimento && i.data_vencimento < hoje);
    for (const item of aAtualizar) {
      await base44.entities.Financeiro.update(item.id, { status: "Atrasado" });
    }
    const atualizado = aAtualizar.length > 0
      ? await base44.entities.Financeiro.list("-data_vencimento", 500)
      : data;
    setItems(atualizado);
    setLoading(false);
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

  const alterarStatus = async (item, novoStatus) => {
    const update = { status: novoStatus };
    if (novoStatus === "Pago") update.data_pagamento = new Date().toISOString().split("T")[0];
    if (novoStatus === "Pendente" || novoStatus === "Atrasado") update.data_pagamento = "";
    await base44.entities.Financeiro.update(item.id, update);
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
    const matchTipo = filtroTipo === "Todos" || i.tipo === filtroTipo;
    const matchStatus = filtroStatus === "Todos" || i.status === filtroStatus;
    return matchSearch && matchTipo && matchStatus;
  });

  // Cálculos (baseados no período selecionado)
  const receitas = itemsNoPeriodo.filter(i => i.tipo === "Receita");
  const despesas = itemsNoPeriodo.filter(i => i.tipo === "Despesa");
  const receitaTotal = receitas.filter(i => i.status === "Pago").reduce((a, i) => a + Number(i.valor || 0), 0);
  const despesaTotal = despesas.filter(i => i.status === "Pago").reduce((a, i) => a + Number(i.valor || 0), 0);
  const saldo = receitaTotal - despesaTotal;
  const pendente = itemsNoPeriodo.filter(i => i.status === "Pendente").reduce((a, i) => a + Number(i.valor || 0), 0);
  const atrasado = itemsNoPeriodo.filter(i => i.status === "Atrasado").reduce((a, i) => a + Number(i.valor || 0), 0);

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Fluxo do Mês — Gráficos no topo */}
      <FluxoMes recRealizado={receitaTotal} recPrevisto={receitas.reduce((a, i) => a + Number(i.valor || 0), 0)} pagRealizado={despesaTotal} pagPrevisto={despesas.reduce((a, i) => a + Number(i.valor || 0), 0)} />

      {/* Filtro de Período */}
      <div className="flex gap-2 items-center">
        {/* Botão Mês/Ano com dropdown */}
        <div className="relative flex-1" ref={mesDropRef}>
          <button
            onClick={() => { setMesDropOpen(v => !v); setPeriodoDropOpen(false); }}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${!usandoOutroPeriodo ? "bg-orange-500 text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}
          >
            <span>{MESES[filtroMes - 1]} - {filtroAno}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${mesDropOpen ? "rotate-180" : ""}`} />
          </button>
          {mesDropOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full py-1 max-h-64 overflow-y-auto">
              {ultimos12Meses.map(({ mes, ano }) => (
                <button
                  key={`${ano}-${mes}`}
                  onClick={() => { setFiltroMes(mes); setFiltroAno(ano); setUsandoOutroPeriodo(false); setCustomRange(null); setMesDropOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-all ${filtroMes === mes && filtroAno === ano && !usandoOutroPeriodo ? "text-orange-400" : "text-gray-300"}`}
                >
                  {MESES[mes - 1]}/{ano}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Botão Período customizado */}
        <div className="relative" ref={periodoDropRef}>
          <button
            onClick={() => { setPeriodoDropOpen(v => !v); setMesDropOpen(false); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${usandoOutroPeriodo ? "bg-orange-500 text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}
          >
            {usandoOutroPeriodo && customRange
              ? `${customRange.inicio.split("-").reverse().join("/")} - ${customRange.fim.split("-").reverse().join("/")}`
              : "Período"}
            <ChevronDown className={`w-4 h-4 transition-transform ${periodoDropOpen ? "rotate-180" : ""}`} />
          </button>
          {periodoDropOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 space-y-3">
              <p className="text-xs text-gray-400 font-medium">Selecione o período</p>
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
                  className="flex-1 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all">
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Receitas Pagas" value={receitaTotal} color="green" />
        <KpiCard icon={TrendingDown} label="Despesas Pagas" value={despesaTotal} color="red" />
        <KpiCard icon={DollarSign} label="Saldo" value={saldo} color={saldo >= 0 ? "orange" : "red"} />
        <KpiCard icon={Filter} label="Pendente/Atrasado" value={pendente + atrasado} color="yellow" />
      </div>

      <>
          {/* Header */}
          <div className="flex flex-col gap-2">
            {/* Linha 1: + Receita / + Despesa */}
            <div className="flex gap-2">
              <button onClick={() => { setForm({ ...defaultForm(), tipo: "Receita" }); setShowForm(true); setEditando(null); }} className="flex-1 flex items-center justify-center gap-2 text-white py-3 rounded-xl text-sm font-semibold transition-all" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
                <Plus className="w-4 h-4" /> Receita
              </button>
              <button onClick={() => { setForm({ ...defaultForm(), tipo: "Despesa" }); setShowForm(true); setEditando(null); }} className="flex-1 flex items-center justify-center gap-2 text-white py-3 rounded-xl text-sm font-semibold transition-all" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
                <Plus className="w-4 h-4" /> Despesa
              </button>
            </div>

            {/* Linha 3: filtro tipo — Receita / Despesa / Todos */}
            <div className="flex gap-2">
              {["Receita","Despesa","Todos"].map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroTipo === t ? "bg-orange-500 text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>{t}</button>
              ))}
            </div>

            {/* Linha 4: filtro status — Pendente / Atrasado / Pago / Todos */}
            <div className="flex gap-2">
              {["Pendente","Atrasado","Pago","Todos"].map(s => (
                <button key={s} onClick={() => setFiltroStatus(s)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroStatus === s ? "bg-orange-500 text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>{s}</button>
              ))}
            </div>

            {/* Linha 5: busca — ocupa linha toda */}
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>

          {/* Cards */}
          {filtrados.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-12 text-center text-gray-500">Nenhum lançamento encontrado</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtrados.map(item => (
                <FinanceiroCard
                  key={item.id}
                  item={item}
                  onEdit={(i) => { setForm({ ...defaultForm(), ...i }); setEditando(i); setShowForm(true); }}
                  onDelete={excluir}
                  onAlterarStatus={alterarStatus}
                />
              ))}
            </div>
          )}
          </>

          {/* Fluxo de Caixa — No final */}
          <FluxoCaixa items={items} />

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
                  <div className={`input-dark flex items-center ${form.tipo === "Receita" ? "text-green-400" : "text-red-400"}`}>
                    {form.tipo}
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
                    {["Dinheiro","Cartão de Crédito","Cartão de Débito","PIX","Boleto","Transferência"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </F>
              </div>
              <F label="Observações">
                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input-dark" rows={2} />
              </F>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={salvar} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
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

function F({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
}