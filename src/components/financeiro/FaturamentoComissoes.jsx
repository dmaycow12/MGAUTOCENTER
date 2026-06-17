import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmt = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Extrai técnico da lista de serviços de uma venda
function getTecnicos(venda) {
  const tecnicos = new Set();
  (venda.servicos || []).forEach(s => {
    if (s.tecnico && s.tecnico.trim()) tecnicos.add(s.tecnico.trim().toUpperCase());
  });
  return Array.from(tecnicos);
}

export default function FaturamentoComissoes() {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [comissaoPct, setComissaoPct] = useState(() => Number(localStorage.getItem("comissao_pct") || 10));
  const [editandoPct, setEditandoPct] = useState(false);
  const [pctInput, setPctInput] = useState(String(comissaoPct));

  useEffect(() => {
    base44.entities.Vendas.list("-created_date", 9999).then(data => {
      setVendas(data.filter(v => v.status !== "Orçamento"));
      setLoading(false);
    });
  }, []);

  const navegarMes = (dir) => {
    let novoMes = mes + dir;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
  };

  const salvarPct = () => {
    const v = parseFloat(String(pctInput).replace(",", ".")) || 0;
    setComissaoPct(v);
    localStorage.setItem("comissao_pct", String(v));
    setEditandoPct(false);
  };

  const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;

  // Vendas do mês
  const vendasMes = vendas.filter(v => {
    const ref = v.data_conclusao || v.data_entrada || v.created_date || "";
    return ref.startsWith(mesStr);
  });

  // Faturamento total do mês
  const faturamentoTotal = vendasMes.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
  const totalServicos = vendasMes.reduce((acc, v) => acc + Number(v.valor_servicos || 0), 0);
  const totalPecas = vendasMes.reduce((acc, v) => acc + Number(v.valor_pecas || 0), 0);
  const totalCusto = vendasMes.reduce((acc, v) => {
    const custoP = (v.pecas || []).reduce((s, p) => s + Number(p.valor_custo || 0) * Number(p.quantidade || 1), 0);
    const custoS = (v.servicos || []).reduce((s, sv) => s + Number(sv.valor_custo || 0) * Number(sv.quantidade ?? 1), 0);
    return acc + custoP + custoS;
  }, 0);
  const lucroTotal = faturamentoTotal - totalCusto;

  // Por técnico
  const tecnicoMap = {};
  vendasMes.forEach(v => {
    (v.servicos || []).forEach(s => {
      const tec = (s.tecnico || "SEM TÉCNICO").trim().toUpperCase() || "SEM TÉCNICO";
      if (!tecnicoMap[tec]) tecnicoMap[tec] = { servicos: 0, pecas: 0, total: 0, qtdVendas: new Set(), comissao: 0 };
      const val = Number(s.valor || 0) * Number(s.quantidade ?? 1);
      tecnicoMap[tec].servicos += val;
      tecnicoMap[tec].qtdVendas.add(v.id);
    });
    // Atribuir peças ao técnico principal da venda
    const tecnicos = getTecnicos(v);
    if (tecnicos.length > 0) {
      const principal = tecnicos[0];
      if (!tecnicoMap[principal]) tecnicoMap[principal] = { servicos: 0, pecas: 0, total: 0, qtdVendas: new Set(), comissao: 0 };
      const valPecas = Number(v.valor_pecas || 0);
      tecnicoMap[principal].pecas += valPecas;
    }
  });

  const tecnicoRows = Object.entries(tecnicoMap).map(([nome, d]) => {
    const total = d.servicos + d.pecas;
    const comissao = (total * comissaoPct) / 100;
    return { nome, servicos: d.servicos, pecas: d.pecas, total, comissao, qtdVendas: d.qtdVendas.size };
  }).sort((a, b) => b.total - a.total);

  // Por mês — últimos 12 meses
  const historicoMeses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(ano, mes - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const vMs = vendas.filter(v => {
      const ref = v.data_conclusao || v.data_entrada || v.created_date || "";
      return ref.startsWith(key);
    });
    const fat = vMs.reduce((acc, v) => acc + Number(v.valor_total || 0), 0);
    const custo = vMs.reduce((acc, v) => {
      const cp = (v.pecas || []).reduce((s, p) => s + Number(p.valor_custo || 0) * Number(p.quantidade || 1), 0);
      const cs = (v.servicos || []).reduce((s, sv) => s + Number(sv.valor_custo || 0) * Number(sv.quantidade ?? 1), 0);
      return acc + cp + cs;
    }, 0);
    return { key, label: `${MESES[d.getMonth()].substring(0,3)} ${d.getFullYear()}`, faturamento: fat, lucro: fat - custo, qtd: vMs.length };
  }).reverse();

  if (loading) return <div className="text-gray-400 text-sm text-center py-12">Carregando...</div>;

  return (
    <div className="space-y-3">
      {/* Navegação de mês */}
      <div className="flex items-center gap-0.5">
        <div className="flex-1 flex items-center h-11 rounded-xl text-sm font-semibold overflow-hidden bg-[#062C9B] text-white">
          <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-3 hover:bg-white/20 transition-all" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="flex-1 text-center">{MESES[mes - 1]} — {ano}</span>
          <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-3 hover:bg-white/20 transition-all" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {/* % de comissão */}
        <div className="flex items-center gap-1 px-3 h-11 bg-gray-800 border border-gray-700 rounded-xl">
          <span className="text-gray-400 text-xs">Comissão:</span>
          {editandoPct ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={pctInput}
                onChange={e => setPctInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") salvarPct(); if (e.key === "Escape") setEditandoPct(false); }}
                className="w-12 bg-gray-700 border border-orange-500 text-white rounded px-1 py-0.5 text-xs text-center focus:outline-none"
              />
              <span className="text-gray-400 text-xs">%</span>
              <button onClick={salvarPct} className="text-xs px-2 py-0.5 rounded font-bold text-black" style={{background:"#00ff00"}}>OK</button>
            </div>
          ) : (
            <button onClick={() => { setPctInput(String(comissaoPct)); setEditandoPct(true); }}
              className="text-white font-bold text-sm hover:text-orange-400 transition-all">
              {comissaoPct}%
            </button>
          )}
        </div>
      </div>

      {/* KPIs do mês */}
      <div className="grid grid-cols-2 gap-0.5">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Faturamento</p>
          <p className="text-green-400 font-bold text-sm">{fmt(faturamentoTotal)}</p>
          <p className="text-gray-500 text-xs">{vendasMes.length} vendas</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Lucro Bruto</p>
          <p className={`font-bold text-sm ${lucroTotal >= 0 ? "text-orange-400" : "text-red-400"}`}>{fmt(lucroTotal)}</p>
          <p className="text-gray-500 text-xs">{faturamentoTotal > 0 ? ((lucroTotal / faturamentoTotal) * 100).toFixed(1) : 0}% margem</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Serviços</p>
          <p className="text-blue-400 font-bold text-sm">{fmt(totalServicos)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Peças</p>
          <p className="text-purple-400 font-bold text-sm">{fmt(totalPecas)}</p>
        </div>
      </div>

      {/* Comissões por Técnico */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm">Comissões por Técnico — {MESES[mes - 1]}/{ano}</h3>
          <p className="text-gray-500 text-xs mt-0.5">Base: {comissaoPct}% sobre serviços + peças</p>
        </div>
        {tecnicoRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nenhuma venda com técnico registrado neste mês</div>
        ) : (
          <div>
            {/* Header */}
            <div className="grid gap-2 px-3 py-2 bg-gray-800/50 text-xs text-gray-400 font-semibold" style={{gridTemplateColumns:"1fr 80px 80px 90px 90px"}}>
              <span>Técnico</span>
              <span className="text-right">Serviços</span>
              <span className="text-right">Peças</span>
              <span className="text-right">Total</span>
              <span className="text-right text-yellow-400">Comissão</span>
            </div>
            {tecnicoRows.map((row, i) => (
              <div key={row.nome} className={`grid gap-2 px-3 py-2.5 border-t border-gray-800 items-center ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/20"}`} style={{gridTemplateColumns:"1fr 80px 80px 90px 90px"}}>
                <div>
                  <p className="text-white font-medium text-xs">{row.nome}</p>
                  <p className="text-gray-500 text-xs">{row.qtdVendas} venda(s)</p>
                </div>
                <span className="text-blue-400 text-xs text-right">{fmt(row.servicos)}</span>
                <span className="text-purple-400 text-xs text-right">{fmt(row.pecas)}</span>
                <span className="text-green-400 text-xs font-semibold text-right">{fmt(row.total)}</span>
                <span className="text-yellow-400 text-xs font-bold text-right">{fmt(row.comissao)}</span>
              </div>
            ))}
            {/* Total */}
            <div className="grid gap-2 px-3 py-2.5 border-t-2 border-gray-700 bg-gray-800/40 items-center" style={{gridTemplateColumns:"1fr 80px 80px 90px 90px"}}>
              <span className="text-white font-bold text-xs">TOTAL</span>
              <span className="text-blue-400 text-xs font-bold text-right">{fmt(tecnicoRows.reduce((a, r) => a + r.servicos, 0))}</span>
              <span className="text-purple-400 text-xs font-bold text-right">{fmt(tecnicoRows.reduce((a, r) => a + r.pecas, 0))}</span>
              <span className="text-green-400 text-xs font-bold text-right">{fmt(tecnicoRows.reduce((a, r) => a + r.total, 0))}</span>
              <span className="text-yellow-400 text-xs font-bold text-right">{fmt(tecnicoRows.reduce((a, r) => a + r.comissao, 0))}</span>
            </div>
          </div>
        )}
      </div>

      {/* Histórico de Faturamento — últimos 12 meses */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm">Histórico — Últimos 12 meses</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-800/50 text-gray-400">
                <th className="px-3 py-2 text-left">Mês</th>
                <th className="px-3 py-2 text-right">Vendas</th>
                <th className="px-3 py-2 text-right text-green-400">Faturamento</th>
                <th className="px-3 py-2 text-right text-orange-400">Lucro</th>
                <th className="px-3 py-2 text-right text-gray-400">Margem</th>
              </tr>
            </thead>
            <tbody>
              {historicoMeses.map((h, i) => (
                <tr key={h.key} className={`border-t border-gray-800 ${h.key === mesStr ? "bg-blue-900/20" : i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/10"}`}>
                  <td className={`px-3 py-2 font-medium ${h.key === mesStr ? "text-blue-400" : "text-white"}`}>{h.label}</td>
                  <td className="px-3 py-2 text-gray-400 text-right">{h.qtd}</td>
                  <td className="px-3 py-2 text-green-400 font-semibold text-right">{fmt(h.faturamento)}</td>
                  <td className={`px-3 py-2 font-semibold text-right ${h.lucro >= 0 ? "text-orange-400" : "text-red-400"}`}>{fmt(h.lucro)}</td>
                  <td className="px-3 py-2 text-gray-400 text-right">{h.faturamento > 0 ? ((h.lucro / h.faturamento) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}