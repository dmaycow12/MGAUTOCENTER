import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function normalizarTipo(tipo) {
  if (!tipo) return "";
  return tipo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

const fmt = (v) => Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2});

export default function LucroPecas({ items }) {
  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState(() => Number(localStorage.getItem("lucro_filtroMes")) || hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(() => Number(localStorage.getItem("lucro_filtroAno")) || hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(() => localStorage.getItem("lucro_usandoOutro") === "true");
  const [customRange, setCustomRange] = useState(() => { try { return JSON.parse(localStorage.getItem("lucro_customRange")); } catch { return null; } });
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const periodoDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) setPeriodoDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const salvarCustom = (range) => { setCustomRange(range); localStorage.setItem("lucro_customRange", JSON.stringify(range)); setUsandoOutroPeriodo(true); localStorage.setItem("lucro_usandoOutro", "true"); };
  const salvarMes = (m, a) => { setFiltroMes(m); localStorage.setItem("lucro_filtroMes", m); setFiltroAno(a); localStorage.setItem("lucro_filtroAno", a); setUsandoOutroPeriodo(false); localStorage.setItem("lucro_usandoOutro", "false"); setCustomRange(null); localStorage.removeItem("lucro_customRange"); };

  const navegarMes = (dir) => {
    let m = filtroMes + dir, a = filtroAno;
    if (m > 12) { m = 1; a++; } if (m < 1) { m = 12; a--; }
    salvarMes(m, a);
  };

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    salvarCustom({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
    setPeriodoDropOpen(false);
  };

  const pad = n => String(n).padStart(2, "0");
  const periodoRange = usandoOutroPeriodo && customRange
    ? customRange
    : { inicio: `${filtroAno}-${pad(filtroMes)}-01`, fim: `${filtroAno}-${pad(filtroMes)}-31` };

  const margemTotal = useMemo(() => {
   const resultado = [];
   for (const item of items) {
     if (item.descricao?.toUpperCase() === "PRODUTO") continue;
     const historico = item.historico || [];
     const saidas = historico.filter(h => {
       const tipo = normalizarTipo(h.tipo);
       if (tipo !== "saida") return false;
       const dataStr = h.data || "";
       if (!dataStr) return false;
       return dataStr >= periodoRange.inicio && dataStr <= periodoRange.fim;
     });

      const qtdVendida = saidas.reduce((s, h) => s + Number(h.quantidade || 0), 0);
      const receita = saidas.reduce((s, h) => s + Number(h.valor_unitario || 0) * Number(h.quantidade || 0), 0);
      const custoUnitario = Number(item.valor_custo || 0);
      const estoqueAlocado = Number(item.estoque_minimo || 0);
      const valorAlocado = estoqueAlocado * custoUnitario;
      const custoVendido = custoUnitario * qtdVendida;
      const lucro = receita - custoVendido;
      const margem = valorAlocado > 0 ? (lucro / valorAlocado) * 100 : 0;

      resultado.push({ item, qtdVendida, receita, valorAlocado, lucro, margem });
    }
    return resultado.sort((a, b) => b.margem - a.margem);
  }, [items, periodoRange]);

  const totais = useMemo(() => ({
    receita: margemTotal.reduce((s, d) => s + d.receita, 0),
    valorAlocado: margemTotal.reduce((s, d) => s + d.valorAlocado, 0),
    lucro: margemTotal.reduce((s, d) => s + d.lucro, 0),
  }), [margemTotal]);

  const margemTotalPct = totais.valorAlocado > 0 ? (totais.lucro / totais.valorAlocado) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Filtro de Período */}
      <div className="flex gap-2 items-center">
        <div className={`flex-1 flex items-center h-11 rounded-xl text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
          <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 hover:bg-white/20 transition-all" style={{borderRight:"1px solid rgba(255,255,255,0.15)"}}>
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button onClick={() => salvarMes(filtroMes, filtroAno)} className="flex-1 text-center h-full hover:bg-white/10 transition-all cursor-pointer">{MESES[filtroMes - 1]} - {filtroAno}</button>
          <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 hover:bg-white/20 transition-all" style={{borderLeft:"1px solid rgba(255,255,255,0.15)"}}>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="relative flex-1" ref={periodoDropRef}>
          <button onClick={() => setPeriodoDropOpen(v => !v)}
            className={`w-full flex items-center justify-center gap-2 px-4 h-11 rounded-xl text-sm font-semibold transition-all ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}>
            {usandoOutroPeriodo && customRange
              ? `${customRange.inicio.split("-").reverse().join("/")} — ${customRange.fim.split("-").reverse().join("/")}`
              : `${String(1).padStart(2, "0")}/${String(filtroMes).padStart(2, "0")}/${filtroAno} — ${String(new Date(filtroAno, filtroMes, 0).getDate()).padStart(2, "0")}/${String(filtroMes).padStart(2, "0")}/${filtroAno}`}
            <ChevronDown className={`w-4 h-4 transition-transform ${periodoDropOpen ? "rotate-180" : ""}`} />
          </button>
          {periodoDropOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 space-y-3">
              <p className="text-xs text-gray-400 font-medium">Atalhos</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[["hoje","Hoje"],["ontem","Ontem"],["semana","Semana"],["semana_passada","Sem. Passada"],["mes","Mês"],["mes_passado","Mês Passado"],["ano","Ano"],["ano_passado","Ano Passado"],["tudo","Tudo"]].map(([tipo, label]) => {
                  const hoje = new Date();
                  const pad = n => String(n).padStart(2, "0");
                  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                  return (
                  <button key={tipo} onClick={() => {
                    if (tipo === "hoje") {
                      const d = fmt(hoje); salvarCustom({ inicio: d, fim: d });
                    } else if (tipo === "ontem") {
                      const d = new Date(hoje); d.setDate(hoje.getDate() - 1); const s = fmt(d); salvarCustom({ inicio: s, fim: s });
                    } else if (tipo === "semana") {
                      const dow = hoje.getDay();
                      const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow);
                      const fim = new Date(hoje); fim.setDate(hoje.getDate() + (6 - dow));
                      salvarCustom({ inicio: fmt(ini), fim: fmt(fim) });
                    } else if (tipo === "semana_passada") {
                      const dow = hoje.getDay();
                      const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow - 7);
                      const fim = new Date(hoje); fim.setDate(hoje.getDate() - dow - 1);
                      salvarCustom({ inicio: fmt(ini), fim: fmt(fim) });
                    } else if (tipo === "mes") {
                      salvarMes(hoje.getMonth() + 1, hoje.getFullYear());
                    } else if (tipo === "mes_passado") {
                      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); salvarMes(d.getMonth() + 1, d.getFullYear());
                    } else if (tipo === "ano") {
                      salvarCustom({ inicio: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` });
                    } else if (tipo === "ano_passado") {
                      const a = hoje.getFullYear() - 1; salvarCustom({ inicio: `${a}-01-01`, fim: `${a}-12-31` });
                    } else if (tipo === "tudo") {
                      salvarCustom({ inicio: "2000-01-01", fim: "2099-12-31" });
                    }
                    setPeriodoDropOpen(false);
                  }}
                    className="py-2 text-xs text-white bg-gray-800 hover:bg-[#062C9B] border border-gray-700 rounded-lg font-medium transition-all">
                    {label}
                  </button>
                  );
                })}
              </div>
              <div className="border-t border-gray-700 pt-3 space-y-3">
              <p className="text-xs text-gray-400 font-medium">Período personalizado</p>
              <div><label className="block text-xs text-gray-500 mb-1">De</label>
                <input type="date" value={outroPeriodoInicio} onChange={e => setOutroPeriodoInicio(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Até</label>
                <input type="date" value={outroPeriodoFim} onChange={e => setOutroPeriodoFim(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <div className="flex gap-2">
                <button onClick={() => setPeriodoDropOpen(false)} className="flex-1 py-2 text-xs text-gray-400 border border-gray-700 rounded-lg hover:text-white">Cancelar</button>
                <button onClick={aplicarOutroPeriodo} className="flex-1 py-2 text-xs text-white rounded-lg font-medium" style={{background: "#062C9B"}} onMouseEnter={e => e.currentTarget.style.background = "#041a4d"} onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}>Aplicar</button>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Produtos Vendidos</p>
          <p className="text-white font-bold text-lg">{margemTotal.filter(d => d.qtdVendida > 0).length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Receita Total</p>
          <p className="text-green-400 font-bold">R$ {fmt(totais.receita)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Valor Alocado Total</p>
          <p className="text-red-400 font-bold">R$ {fmt(totais.valorAlocado)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Lucro Bruto</p>
          <p className={`font-bold ${totais.lucro >= 0 ? "text-green-400" : "text-red-400"}`}>
            R$ {fmt(totais.lucro)}
            <span className="text-xs ml-1 font-normal text-gray-400">({margemTotalPct.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      {/* Tabela */}
      {items.filter(i => i.descricao?.toUpperCase() !== "PRODUTO").length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma venda registrada neste período</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800 bg-gray-900/80">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 text-center">Qtd Vendida</th>
                  <th className="px-4 py-3 text-right">Receita</th>
                  <th className="px-4 py-3 text-right">Valor Alocado</th>
                  <th className="px-4 py-3 text-right">Lucro</th>
                  <th className="px-4 py-3 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {margemTotal.map(({ item, qtdVendida, receita, valorAlocado, lucro, margem }, idx) => (
                  <tr key={item.id} className={`border-b border-gray-800 transition-all hover:bg-gray-800/40 ${idx % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                    <td className="px-4 py-3 text-gray-600 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium text-xs">{item.descricao}</p>
                      {item.codigo && <p className="text-gray-600 font-mono text-[10px]">{item.codigo}</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-white font-semibold">{qtdVendida}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-medium">R$ {fmt(receita)}</td>
                    <td className="px-4 py-3 text-right text-red-400">R$ {fmt(valorAlocado)}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{color: lucro >= 0 ? "#00ff00" : "#ef4444"}}>
                      <span className="flex items-center justify-end gap-1">
                        {lucro >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        R$ {fmt(lucro)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${margem >= 20 ? "bg-green-500/15 text-green-400" : margem >= 0 ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400"}`}>
                        {margem.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}