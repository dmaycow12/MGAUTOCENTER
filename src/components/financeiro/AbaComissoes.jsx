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

  if (loading) return <div className="py-12 text-center text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-3 mt-2">
      {/* Filtro de período */}
      <FiltroPerioodoAvancado onFiltroChange={({ periodoRange: pr }) => setPeriodoRange(pr)} />

      {/* Banner Total */}
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #0a1929 0%, #132642 100%)", border: "1px solid #1e4d7b" }}>
        <div>
          <p className="text-xs text-gray-400 font-medium tracking-wide">TOTAL DE COMISSÕES</p>
          <p className="text-2xl font-bold text-yellow-400 mt-0.5">{fmtV(totalComissoes)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{resultados.length} técnico(s)</p>
          <p className="text-xs text-gray-500">{vendasPeriodo.length} venda(s) no período</p>
        </div>
      </div>

      {/* Config de técnicos */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ background: "rgba(6,44,155,0.25)", borderBottom: "1px solid #1e3a5f" }}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full" style={{ background: "#062C9B" }} />
            <h3 className="text-white text-sm font-bold tracking-wide">CONFIGURAÇÃO DE COMISSÕES</h3>
          </div>
          <button
            onClick={() => setShowAddTec(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
            style={{ background: showAddTec ? "#cc0000" : "#062C9B" }}
          >
            <Plus className="w-3 h-3" /> {showAddTec ? "Cancelar" : "+ Técnico"}
          </button>
        </div>

        <div className="px-5 py-3 space-y-2">
          {/* Formulário adicionar */}
          {showAddTec && (
            <div className="rounded-xl p-3 mb-1 flex gap-2 items-end" style={{ background: "#132642", border: "1px solid #1e4d7b" }}>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Funcionário</label>
                <select
                  value={novoTecSel}
                  onChange={e => setNovoTecSel(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  style={{ background: "#0d1b2a", border: "1px solid #1e4d7b" }}
                >
                  <option value="">— Selecionar —</option>
                  {funcionariosDisponiveis.map(f => (
                    <option key={f.id} value={f.nome}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs text-gray-400 mb-1">Comissão %</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={novoTecPct}
                    onChange={e => setNovoTecPct(e.target.value)}
                    className="w-full rounded-lg px-2 py-2 text-xs text-white text-center focus:outline-none"
                    style={{ background: "#0d1b2a", border: "1px solid #1e4d7b" }}
                  />
                  <span className="text-gray-400 text-xs">%</span>
                </div>
              </div>
              <button onClick={adicionarTecnico} className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-all" style={{ background: "#16a34a" }}>
                Salvar
              </button>
            </div>
          )}

          {Object.keys(comissaoConfig).length === 0 ? (
            <p className="text-gray-500 text-xs py-3 text-center">Nenhum técnico configurado.</p>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(comissaoConfig).map(([nome, pct]) => (
                <div key={nome} className="flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all" style={{ background: "#132642", border: "1px solid #1e4d7b" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "#062C9B" }}>
                    {nome.substring(0, 2)}
                  </div>
                  <span className="text-white text-xs font-semibold flex-1">{nome}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={editPct[nome] !== undefined ? editPct[nome] : pct}
                      onChange={e => setEditPct(prev => ({ ...prev, [nome]: e.target.value }))}
                      onBlur={() => salvarPct(nome)}
                      className="w-14 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none"
                      style={{ background: "#0d1b2a", border: "1px solid #1e4d7b" }}
                    />
                    <span className="text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <button onClick={() => removerTecnico(nome)} className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resultados */}
      {resultados.length === 0 ? (
        <div className="rounded-2xl py-10 text-center text-gray-500 text-sm" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
          Nenhum serviço com técnico atribuído neste período
        </div>
      ) : (
        <div className="space-y-2">
          {resultados.map((r, idx) => (
            <div key={r.tec} className="rounded-2xl overflow-hidden" style={{ background: "#0a1929", border: "1px solid #1e3a5f" }}>
              <button
                onClick={() => setExpandido(expandido === r.tec ? null : r.tec)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-all"
              >
                {/* Rank + Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #062C9B, #1a4fd8)" }}>
                    {r.tec.substring(0, 2)}
                  </div>
                  {idx === 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: "#f59e0b", fontSize: 8, fontWeight: "bold" }}>1</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="text-white text-sm font-bold">{r.tec}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{r.qtdVendas} venda(s)</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                    <span className="text-xs font-semibold" style={{ color: "#60a5fa" }}>{r.pct}% comissão</span>
                  </div>
                </div>

                {/* Valores */}
                <div className="text-right flex-shrink-0">
                  <div className="text-yellow-400 font-bold text-base">{fmtV(r.comissao)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">base: <span className="text-gray-300">{fmtV(r.servicos)}</span></div>
                </div>

                {/* Barra progresso proporcional */}
                <div className="w-16 flex-shrink-0 hidden sm:block">
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${totalComissoes > 0 ? Math.round(r.comissao / totalComissoes * 100) : 0}%`, background: "linear-gradient(90deg, #062C9B, #f59e0b)" }} />
                  </div>
                  <div className="text-center text-gray-500 mt-0.5" style={{ fontSize: 9 }}>{totalComissoes > 0 ? Math.round(r.comissao / totalComissoes * 100) : 0}%</div>
                </div>
              </button>

              {expandido === r.tec && (
                <div style={{ borderTop: "1px solid #1e3a5f" }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "rgba(6,44,155,0.15)" }}>
                          <th className="px-4 py-2.5 text-left text-gray-400 font-semibold">Venda</th>
                          <th className="px-4 py-2.5 text-left text-gray-400 font-semibold">Cliente</th>
                          <th className="px-4 py-2.5 text-left text-gray-400 font-semibold">Serviço</th>
                          <th className="px-4 py-2.5 text-right text-gray-400 font-semibold">Valor</th>
                          <th className="px-4 py-2.5 text-right text-yellow-400 font-semibold">Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.detalhes.map((d, i) => (
                          <tr key={i} className="transition-all hover:bg-white/5" style={{ borderTop: "1px solid #1e3a5f" }}>
                            <td className="px-4 py-2.5 text-blue-400 font-bold">#{d.venda}</td>
                            <td className="px-4 py-2.5 text-gray-300">{d.cliente || "—"}</td>
                            <td className="px-4 py-2.5 text-gray-300">{d.servico}</td>
                            <td className="px-4 py-2.5 text-right text-green-400 font-semibold">{fmtV(d.valor)}</td>
                            <td className="px-4 py-2.5 text-right text-yellow-400 font-bold">{fmtV(d.valor * r.pct / 100)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}