import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2 } from "lucide-react";
import FiltroPerioodoAvancado from "@/components/notas/FiltroPerioodoAvancado";

const fmtV = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hoje = new Date();
const pad = n => String(n).padStart(2, "0");
function getPeriodoRange(mes, ano) {
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-31` };
}

export default function AbaComissoes() {
  const [vendas, setVendas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoRange, setPeriodoRange] = useState(() => getPeriodoRange(hoje.getMonth() + 1, hoje.getFullYear()));

  const [comissaoConfig, setComissaoConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem("comissao_config")) || {}; } catch { return {}; }
  });

  // Novo técnico a adicionar
  const [showAddTec, setShowAddTec] = useState(false);
  const [novoTecSel, setNovoTecSel] = useState("");
  const [novoTecPct, setNovoTecPct] = useState("10");

  // Edição inline de %
  const [editPct, setEditPct] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [data, funcs] = await Promise.all([
        base44.entities.Vendas.list("-created_date", 9999),
        base44.entities.Cadastro.filter({ categoria: "Funcionário" }, "nome", 200),
      ]);
      setVendas(data.filter(v => v.status !== "Orçamento"));
      setFuncionarios(funcs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const salvarConfig = (cfg) => {
    setComissaoConfig(cfg);
    localStorage.setItem("comissao_config", JSON.stringify(cfg));
  };

  const adicionarTecnico = () => {
    if (!novoTecSel) return;
    const nome = novoTecSel.trim().toUpperCase();
    const pct = parseFloat(novoTecPct) || 10;
    salvarConfig({ ...comissaoConfig, [nome]: pct });
    setNovoTecSel("");
    setNovoTecPct("10");
    setShowAddTec(false);
  };

  const removerTecnico = (nome) => {
    const cfg = { ...comissaoConfig };
    delete cfg[nome];
    salvarConfig(cfg);
  };

  const salvarPct = (nome) => {
    const val = parseFloat(editPct[nome]) || 0;
    salvarConfig({ ...comissaoConfig, [nome]: val });
    setEditPct(prev => { const n = {...prev}; delete n[nome]; return n; });
  };

  const vendasPeriodo = vendas.filter(v => {
    const d = (v.data_entrada || v.created_date || "").substring(0, 10);
    return d >= periodoRange.inicio && d <= periodoRange.fim;
  });

  // Calcular comissões por técnico — IGNORA serviços sem técnico
  const comissoesPorTec = {};
  vendasPeriodo.forEach(v => {
    (v.servicos || []).forEach(s => {
      const tec = (s.tecnico || "").trim().toUpperCase();
      if (!tec) return; // ignora sem técnico
      const valServico = Number(s.valor || 0) * Number(s.quantidade ?? 1);
      if (!comissoesPorTec[tec]) comissoesPorTec[tec] = { servicos: 0, vendas: new Set(), detalhes: [] };
      comissoesPorTec[tec].servicos += valServico;
      comissoesPorTec[tec].vendas.add(v.id);
      comissoesPorTec[tec].detalhes.push({ venda: v.numero, cliente: v.cliente_nome_fantasia || v.cliente_nome, servico: s.descricao, valor: valServico });
    });
  });

  const resultados = Object.entries(comissoesPorTec).map(([tec, dados]) => {
    const pct = comissaoConfig[tec] ?? comissaoConfig["*"] ?? 10;
    const comissao = dados.servicos * (pct / 100);
    return { tec, ...dados, pct, comissao, qtdVendas: dados.vendas.size };
  }).sort((a, b) => b.comissao - a.comissao);

  const totalComissoes = resultados.reduce((acc, r) => acc + r.comissao, 0);

  const [expandido, setExpandido] = useState(null);

  // Funcionários não configurados ainda
  const funcionariosDisponiveis = funcionarios.filter(f => !comissaoConfig[f.nome?.toUpperCase()]);

  if (loading) return <div className="py-12 text-center text-gray-500 text-sm">Carregando...</div>;

  const totalBase = resultados.reduce((acc, r) => acc + r.servicos, 0);

  return (
    <div className="space-y-2 mt-2">

      {/* ── FILTRO ── */}
      <FiltroPerioodoAvancado onFiltroChange={({ periodoRange: pr }) => setPeriodoRange(pr)} />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          <span className="text-gray-500 text-xs font-medium">BASE SERVIÇOS</span>
          <span className="text-white font-bold text-sm">{fmtV(totalBase)}</span>
        </div>
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          <span className="text-gray-500 text-xs font-medium">TOTAL COMISSÕES</span>
          <span className="text-yellow-400 font-bold text-sm">{fmtV(totalComissoes)}</span>
        </div>
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          <span className="text-gray-500 text-xs font-medium">TÉCNICOS</span>
          <span className="text-blue-400 font-bold text-sm">{resultados.length} · {vendasPeriodo.length} vendas</span>
        </div>
      </div>

      {/* ── CONFIG ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid #1e3a5f" }}>
          <span className="text-gray-300 text-xs font-bold tracking-widest">COMISSÕES POR TÉCNICO</span>
          <button
            onClick={() => setShowAddTec(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
            style={{ background: showAddTec ? "#7f1d1d" : "#062C9B" }}
          >
            <Plus className="w-3 h-3" /> {showAddTec ? "Cancelar" : "Adicionar"}
          </button>
        </div>

        {/* Form adicionar */}
        {showAddTec && (
          <div className="px-4 py-3 flex gap-2 items-end" style={{ borderBottom: "1px solid #1e3a5f", background: "rgba(6,44,155,0.08)" }}>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Funcionário</label>
              <select value={novoTecSel} onChange={e => setNovoTecSel(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                style={{ background: "#111827", border: "1px solid #374151" }}>
                <option value="">— selecionar —</option>
                {funcionariosDisponiveis.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
              </select>
            </div>
            <div className="w-20">
              <label className="block text-xs text-gray-500 mb-1">% Comissão</label>
              <input type="number" value={novoTecPct} onChange={e => setNovoTecPct(e.target.value)}
                className="w-full rounded-lg px-2 py-2 text-xs text-white text-center focus:outline-none"
                style={{ background: "#111827", border: "1px solid #374151" }} />
            </div>
            <button onClick={adicionarTecnico}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: "#16a34a" }}>
              Salvar
            </button>
          </div>
        )}

        {/* Lista config */}
        {Object.keys(comissaoConfig).length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-4">Nenhum técnico configurado</p>
        ) : (
          <div>
            {Object.entries(comissaoConfig).map(([nome, pct], i, arr) => (
              <div key={nome} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-all"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid #111827" : "none" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "#062C9B" }}>
                  {nome.substring(0, 2)}
                </div>
                <span className="text-white text-xs font-medium flex-1">{nome}</span>
                <div className="flex items-center gap-1">
                  <input type="number"
                    value={editPct[nome] !== undefined ? editPct[nome] : pct}
                    onChange={e => setEditPct(prev => ({ ...prev, [nome]: e.target.value }))}
                    onBlur={() => salvarPct(nome)}
                    className="w-12 rounded px-1.5 py-1 text-xs text-white text-center focus:outline-none"
                    style={{ background: "#111827", border: "1px solid #374151" }} />
                  <span className="text-gray-500 text-xs">%</span>
                </div>
                <button onClick={() => removerTecnico(nome)}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RESULTADOS ── */}
      {resultados.length === 0 ? (
        <div className="rounded-xl py-10 text-center text-gray-600 text-xs" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          Nenhum serviço com técnico atribuído neste período
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          {/* Header tabela */}
          <div className="grid px-4 py-2" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: "1px solid #1e3a5f", background: "rgba(6,44,155,0.12)" }}>
            <span className="text-gray-500 text-xs font-bold tracking-widest">TÉCNICO</span>
            <span className="text-gray-500 text-xs font-bold text-center">VENDAS</span>
            <span className="text-gray-500 text-xs font-bold text-right">BASE</span>
            <span className="text-yellow-600 text-xs font-bold text-right">COMISSÃO</span>
          </div>

          {resultados.map((r, idx) => (
            <div key={r.tec} style={{ borderBottom: "1px solid #0d1b2a" }}>
              {/* Linha principal */}
              <button
                onClick={() => setExpandido(expandido === r.tec ? null : r.tec)}
                className="w-full grid px-4 py-3 hover:bg-white/[0.04] transition-all items-center"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}
              >
                {/* Nome + avatar */}
                <div className="flex items-center gap-2.5 text-left">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: idx === 0 ? "linear-gradient(135deg,#7c3aed,#062C9B)" : "#132642" }}>
                      {r.tec.substring(0, 2)}
                    </div>
                    {idx === 0 && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center bg-yellow-500"
                        style={{ fontSize: 7, fontWeight: "bold", color: "#000" }}>★</div>
                    )}
                  </div>
                  <div>
                    <div className="text-white text-xs font-bold">{r.tec}</div>
                    <div className="text-gray-500 text-xs">{r.pct}% comissão</div>
                  </div>
                </div>

                {/* Qtd vendas */}
                <div className="text-center">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-blue-300"
                    style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    {r.qtdVendas}
                  </span>
                </div>

                {/* Base */}
                <div className="text-right text-gray-400 text-xs font-medium">{fmtV(r.servicos)}</div>

                {/* Comissão */}
                <div className="text-right">
                  <span className="text-yellow-400 text-sm font-bold">{fmtV(r.comissao)}</span>
                  {totalBase > 0 && (
                    <div className="mt-1 h-1 rounded-full bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400/60" style={{ width: `${Math.round(r.servicos / totalBase * 100)}%` }} />
                    </div>
                  )}
                </div>
              </button>

              {/* Detalhe expandido */}
              {expandido === r.tec && (
                <div className="overflow-x-auto" style={{ background: "rgba(0,0,0,0.3)", borderTop: "1px solid #1e3a5f" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "rgba(6,44,155,0.1)" }}>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold">Venda</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold">Cliente</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold">Serviço</th>
                        <th className="px-4 py-2 text-right text-gray-500 font-semibold">Valor</th>
                        <th className="px-4 py-2 text-right text-yellow-600 font-semibold">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.detalhes.map((d, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-all" style={{ borderTop: "1px solid #111827" }}>
                          <td className="px-4 py-2 text-blue-400 font-bold">#{d.venda}</td>
                          <td className="px-4 py-2 text-gray-400 truncate max-w-[120px]">{d.cliente || "—"}</td>
                          <td className="px-4 py-2 text-gray-300">{d.servico}</td>
                          <td className="px-4 py-2 text-right text-green-400 font-semibold">{fmtV(d.valor)}</td>
                          <td className="px-4 py-2 text-right text-yellow-400 font-bold">{fmtV(d.valor * r.pct / 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* Rodapé total */}
          <div className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", borderTop: "1px solid #1e3a5f", background: "rgba(6,44,155,0.08)" }}>
            <span className="text-gray-400 text-xs font-bold">TOTAL</span>
            <span />
            <span className="text-right text-gray-300 text-xs font-semibold">{fmtV(totalBase)}</span>
            <span className="text-right text-yellow-400 text-sm font-bold">{fmtV(totalComissoes)}</span>
          </div>
        </div>
      )}
    </div>
  );
}