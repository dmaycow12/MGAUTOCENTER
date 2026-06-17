import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fmtV = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function getPeriodoRange(mes, ano) {
  const pad = n => String(n).padStart(2, "0");
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-31` };
}

export default function AbaComissoes() {
  const [vendas, setVendas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

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

  const navMes = (dir) => {
    let novoMes = mes + dir;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
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

  const { inicio, fim } = getPeriodoRange(mes, ano);

  const vendasPeriodo = vendas.filter(v => {
    const d = (v.data_entrada || v.created_date || "").substring(0, 10);
    return d >= inicio && d <= fim;
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
      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#062C9B] rounded-xl overflow-hidden h-10">
          <button onClick={() => navMes(-1)} className="flex items-center justify-center px-2 h-full hover:bg-white/20 transition-all">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-white text-sm font-semibold px-3">{MESES[mes-1]} {ano}</span>
          <button onClick={() => navMes(1)} className="flex items-center justify-center px-2 h-full hover:bg-white/20 transition-all">
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Total Comissões</div>
          <div className="text-sm font-bold text-yellow-400">{fmtV(totalComissoes)}</div>
        </div>
      </div>

      {/* Config de técnicos */}
      <div className="rounded-xl p-4" style={{ background: "#0d1b2a", border: "1px solid #1e3a5f" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-sm font-semibold">Configuração de Comissões</h3>
          <button onClick={() => setShowAddTec(v => !v)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all" style={{ background: "#062C9B" }}>
            <Plus className="w-3 h-3" /> Técnico
          </button>
        </div>

        {showAddTec && (
          <div className="flex gap-2 mb-3">
            <select
              value={novoTecSel}
              onChange={e => setNovoTecSel(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500"
            >
              <option value="">— Selecionar funcionário —</option>
              {funcionariosDisponiveis.map(f => (
                <option key={f.id} value={f.nome}>{f.nome}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={novoTecPct}
                onChange={e => setNovoTecPct(e.target.value)}
                placeholder="%"
                className="w-16 bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-orange-500"
              />
              <span className="text-gray-400 text-xs">%</span>
            </div>
            <button onClick={adicionarTecnico} className="px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: "#16a34a" }}>
              Salvar
            </button>
          </div>
        )}

        {Object.keys(comissaoConfig).length === 0 ? (
          <p className="text-gray-500 text-xs">Nenhum técnico configurado. Adicione para definir percentuais de comissão.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(comissaoConfig).map(([nome, pct]) => (
              <div key={nome} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-white text-xs flex-1">{nome}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editPct[nome] !== undefined ? editPct[nome] : pct}
                    onChange={e => setEditPct(prev => ({ ...prev, [nome]: e.target.value }))}
                    onBlur={() => salvarPct(nome)}
                    className="w-16 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-500 text-center"
                  />
                  <span className="text-gray-400 text-xs">%</span>
                  <button onClick={() => removerTecnico(nome)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resultados */}
      {resultados.length === 0 ? (
        <div className="rounded-xl py-8 text-center text-gray-500 text-sm" style={{ background: "#0d1b2a", border: "1px solid #1e3a5f" }}>
          Nenhum serviço com técnico atribuído neste período
        </div>
      ) : (
        <div className="space-y-2">
          {resultados.map((r) => (
            <div key={r.tec} className="rounded-xl overflow-hidden" style={{ background: "#0d1b2a", border: "1px solid #1e3a5f" }}>
              <button
                onClick={() => setExpandido(expandido === r.tec ? null : r.tec)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#062C9B" }}>
                    {r.tec.substring(0, 2)}
                  </div>
                  <div className="text-left">
                    <div className="text-white text-sm font-semibold">{r.tec}</div>
                    <div className="text-gray-400 text-xs">{r.qtdVendas} venda(s) · {r.pct}% comissão</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-400 font-bold text-sm">{fmtV(r.comissao)}</div>
                  <div className="text-gray-400 text-xs">base: {fmtV(r.servicos)}</div>
                </div>
              </button>

              {expandido === r.tec && (
                <div className="border-t border-gray-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 bg-gray-800/50">
                        <th className="px-3 py-2 text-left">Venda</th>
                        <th className="px-3 py-2 text-left">Cliente</th>
                        <th className="px-3 py-2 text-left">Serviço</th>
                        <th className="px-3 py-2 text-right">Valor Serv.</th>
                        <th className="px-3 py-2 text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.detalhes.map((d, i) => (
                        <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30">
                          <td className="px-3 py-2 text-blue-400 font-semibold">#{d.venda}</td>
                          <td className="px-3 py-2 text-gray-300">{d.cliente || "—"}</td>
                          <td className="px-3 py-2 text-gray-300">{d.servico}</td>
                          <td className="px-3 py-2 text-right text-green-400">{fmtV(d.valor)}</td>
                          <td className="px-3 py-2 text-right text-yellow-400 font-semibold">{fmtV(d.valor * r.pct / 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}