import React, { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export default function FiltroPerioido({ onFiltroChange }) {
  const [filtroMes, setFiltroMes] = useState(() => Number(localStorage.getItem("notas_filtroMes")) || new Date().getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(() => Number(localStorage.getItem("notas_filtroAno")) || new Date().getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(() => localStorage.getItem("notas_usandoOutro") === "true");
  const [customRange, setCustomRange] = useState(() => { try { return JSON.parse(localStorage.getItem("notas_customRange")); } catch { return null; } });
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const periodoDropRef = useRef(null);
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  useEffect(() => {
    const handler = (e) => {
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) setPeriodoDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pad = n => String(n).padStart(2, "0");
  const periodoRange = usandoOutroPeriodo && customRange ? customRange : { inicio: `${filtroAno}-${pad(filtroMes)}-01`, fim: `${filtroAno}-${pad(filtroMes)}-31` };

  useEffect(() => {
    onFiltroChange(periodoRange);
  }, [periodoRange, onFiltroChange]);

  const salvarCustom = (range) => { setCustomRange(range); localStorage.setItem("notas_customRange", JSON.stringify(range)); setUsandoOutroPeriodo(true); localStorage.setItem("notas_usandoOutro", "true"); };
  const salvarMes = (m, a) => { setFiltroMes(m); localStorage.setItem("notas_filtroMes", m); setFiltroAno(a); localStorage.setItem("notas_filtroAno", a); setUsandoOutroPeriodo(false); localStorage.setItem("notas_usandoOutro", "false"); setCustomRange(null); localStorage.removeItem("notas_customRange"); };
  const navegarMes = (dir) => { let m = filtroMes + dir, a = filtroAno; if (m > 12) { m = 1; a++; } if (m < 1) { m = 12; a--; } salvarMes(m, a); };
  const aplicarOutroPeriodo = () => { if (!outroPeriodoInicio || !outroPeriodoFim) return; salvarCustom({ inicio: outroPeriodoInicio, fim: outroPeriodoFim }); setPeriodoDropOpen(false); };

  return (
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
        <button onClick={() => setPeriodoDropOpen(v => !v)} className={`w-full flex items-center justify-center gap-2 px-4 h-11 rounded-xl text-sm font-semibold transition-all ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}>
          {usandoOutroPeriodo && customRange ? `${customRange.inicio.split("-").reverse().join("/")} — ${customRange.fim.split("-").reverse().join("/")}` : `${String(1).padStart(2, "0")}/${String(filtroMes).padStart(2, "0")}/${filtroAno} — ${String(new Date(filtroAno, filtroMes, 0).getDate()).padStart(2, "0")}/${String(filtroMes).padStart(2, "0")}/${filtroAno}`}
          <ChevronDown className={`w-4 h-4 transition-transform ${periodoDropOpen ? "rotate-180" : ""}`} />
        </button>
        {periodoDropOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 space-y-3">
            <p className="text-xs text-gray-400 font-medium">Atalhos</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[['hoje','Hoje'],['ontem','Ontem'],['semana','Semana'],['semana_passada','Sem. Passada'],['mes','Mês'],['mes_passado','Mês Passado'],['ano','Ano'],['ano_passado','Ano Passado'],['tudo','Tudo']].map(([tipo, label]) => {
                const hoje = new Date();
                const pad = n => String(n).padStart(2, '0');
                const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                return (
                  <button key={tipo} onClick={() => {
                    if (tipo === 'hoje') { const d = fmt(hoje); salvarCustom({ inicio: d, fim: d }); }
                    else if (tipo === 'ontem') { const d = new Date(hoje); d.setDate(hoje.getDate() - 1); const s = fmt(d); salvarCustom({ inicio: s, fim: s }); }
                    else if (tipo === 'semana') { const dow = hoje.getDay(); const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow); const fim = new Date(hoje); fim.setDate(hoje.getDate() + (6 - dow)); salvarCustom({ inicio: fmt(ini), fim: fmt(fim) }); }
                    else if (tipo === 'semana_passada') { const dow = hoje.getDay(); const ini = new Date(hoje); ini.setDate(hoje.getDate() - dow - 7); const fim = new Date(hoje); fim.setDate(hoje.getDate() - dow - 1); salvarCustom({ inicio: fmt(ini), fim: fmt(fim) }); }
                    else if (tipo === 'mes') { salvarMes(hoje.getMonth() + 1, hoje.getFullYear()); }
                    else if (tipo === 'mes_passado') { const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); salvarMes(d.getMonth() + 1, d.getFullYear()); }
                    else if (tipo === 'ano') { salvarCustom({ inicio: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` }); }
                    else if (tipo === 'ano_passado') { const a = hoje.getFullYear() - 1; salvarCustom({ inicio: `${a}-01-01`, fim: `${a}-12-31` }); }
                    else if (tipo === 'tudo') { salvarCustom({ inicio: '2000-01-01', fim: '2099-12-31' }); }
                    setPeriodoDropOpen(false);
                  }} className="py-2 text-xs text-white bg-gray-800 hover:bg-[#062C9B] border border-gray-700 rounded-lg font-medium transition-all">
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
  );
}