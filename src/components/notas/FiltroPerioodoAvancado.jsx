import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function FiltroPerioodoAvancado({ onFiltroChange }) {
  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState(() => Number(localStorage.getItem("notas_filtroMes")) || hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(() => Number(localStorage.getItem("notas_filtroAno")) || hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(() => localStorage.getItem("notas_usandoOutro") === "true");
  const [customRange, setCustomRange] = useState(() => { try { return JSON.parse(localStorage.getItem("notas_customRange")); } catch { return null; } });
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const periodoDropRef = useRef(null);

  const pad = n => String(n).padStart(2, "0");
  const periodoRange = usandoOutroPeriodo && customRange ? customRange : { inicio: `${filtroAno}-${pad(filtroMes)}-01`, fim: `${filtroAno}-${pad(filtroMes)}-31` };

  const salvarMes = (m, a) => {
    setFiltroMes(m);
    localStorage.setItem("notas_filtroMes", m);
    setFiltroAno(a);
    localStorage.setItem("notas_filtroAno", a);
    setUsandoOutroPeriodo(false);
    localStorage.setItem("notas_usandoOutro", "false");
    setCustomRange(null);
    localStorage.removeItem("notas_customRange");
    const ultimoDia = new Date(a, m, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");
    onFiltroChange({ filtroMes: m, filtroAno: a, usandoOutroPeriodo: false, customRange: null, periodoRange: { inicio: `${a}-${pad(m)}-01`, fim: `${a}-${pad(m)}-${pad(ultimoDia)}` } });
  };

  const navegarMes = (dir) => {
    let m = filtroMes + dir, a = filtroAno;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    salvarMes(m, a);
  };

  const salvarCustom = (range) => {
    setCustomRange(range);
    localStorage.setItem("notas_customRange", JSON.stringify(range));
    setUsandoOutroPeriodo(true);
    localStorage.setItem("notas_usandoOutro", "true");
    onFiltroChange({ filtroMes, filtroAno, usandoOutroPeriodo: true, customRange: range, periodoRange: range });
  };

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    salvarCustom({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
    setPeriodoDropOpen(false);
  };

  return (
    <div className="flex gap-2 items-center mb-0.5">
      <div className={`flex-1 flex items-center h-9 rounded-lg text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
        <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 hover:bg-white/20 transition-all" style={{borderRight:"1px solid rgba(255,255,255,0.15)"}}>
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button onClick={() => salvarMes(filtroMes, filtroAno)} className="flex-1 text-center h-full hover:bg-white/10 transition-all cursor-pointer">{MESES[filtroMes - 1]} - {filtroAno}</button>
        <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 hover:bg-white/20 transition-all" style={{borderLeft:"1px solid rgba(255,255,255,0.15)"}}>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="relative flex-1" ref={periodoDropRef}>
        <button onClick={() => setPeriodoDropOpen(v => !v)} className={`w-full flex items-center justify-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold transition-all ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}>
          {usandoOutroPeriodo && customRange ? `${customRange.inicio.split("-").reverse().join("/")} — ${customRange.fim.split("-").reverse().join("/")}` : `${pad(1)}/${pad(filtroMes)}/${filtroAno} — ${pad(new Date(filtroAno, filtroMes, 0).getDate())}/${pad(filtroMes)}/${filtroAno}`}
          <ChevronDown className={`w-4 h-4 transition-transform ${periodoDropOpen ? "rotate-180" : ""}`} />
        </button>
        {periodoDropOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-72 space-y-3">
            <p className="text-xs text-gray-400 font-medium">Atalhos</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[['hoje','Hoje'],['ontem','Ontem'],['semana','Semana'],['semana_passada','Sem. Pass.'],['mes','Mês'],['mes_passado','Mês Pass.'],['ano','Ano'],['ano_passado','Ano Pass.'],['tudo','Tudo']].map(([tipo, label]) => {
                const d = new Date();
                const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                let range = null;
                if (tipo === 'hoje') range = { inicio: fmt(d), fim: fmt(d) };
                else if (tipo === 'ontem') { const dt = new Date(d); dt.setDate(d.getDate() - 1); range = { inicio: fmt(dt), fim: fmt(dt) }; }
                else if (tipo === 'semana') { const dow = d.getDay(); const ini = new Date(d); ini.setDate(d.getDate() - dow); const fim = new Date(d); fim.setDate(d.getDate() + (6 - dow)); range = { inicio: fmt(ini), fim: fmt(fim) }; }
                else if (tipo === 'semana_passada') { const dow = d.getDay(); const ini = new Date(d); ini.setDate(d.getDate() - dow - 7); const fim = new Date(d); fim.setDate(d.getDate() - dow - 1); range = { inicio: fmt(ini), fim: fmt(fim) }; }
                else if (tipo === 'mes') return <button key={tipo} onClick={() => { salvarMes(d.getMonth() + 1, d.getFullYear()); setPeriodoDropOpen(false); }} className="py-2 text-xs text-white bg-gray-800 hover:bg-[#062C9B] border border-gray-700 rounded-lg font-medium transition-all">{label}</button>;
                else if (tipo === 'mes_passado') { const dt = new Date(d.getFullYear(), d.getMonth() - 1, 1); return <button key={tipo} onClick={() => { salvarMes(dt.getMonth() + 1, dt.getFullYear()); setPeriodoDropOpen(false); }} className="py-2 text-xs text-white bg-gray-800 hover:bg-[#062C9B] border border-gray-700 rounded-lg font-medium transition-all">{label}</button>; }
                else if (tipo === 'ano') range = { inicio: `${d.getFullYear()}-01-01`, fim: `${d.getFullYear()}-12-31` };
                else if (tipo === 'ano_passado') { const a = d.getFullYear() - 1; range = { inicio: `${a}-01-01`, fim: `${a}-12-31` }; }
                else if (tipo === 'tudo') range = { inicio: '2000-01-01', fim: '2099-12-31' };
                return <button key={tipo} onClick={() => { if (range) { salvarCustom(range); setPeriodoDropOpen(false); } }} className="py-2 text-xs text-white bg-gray-800 hover:bg-[#062C9B] border border-gray-700 rounded-lg font-medium transition-all">{label}</button>;
              })}
            </div>
            <div className="border-t border-gray-700 pt-3 space-y-3">
              <p className="text-xs text-gray-400 font-medium">Período personalizado</p>
              <div><label className="block text-xs text-gray-500 mb-1">De</label><input type="date" value={outroPeriodoInicio} onChange={e => setOutroPeriodoInicio(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Até</label><input type="date" value={outroPeriodoFim} onChange={e => setOutroPeriodoFim(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" /></div>
              <div className="flex gap-2"><button onClick={() => setPeriodoDropOpen(false)} className="flex-1 py-2 text-xs text-gray-400 border border-gray-700 rounded-lg hover:text-white">Cancelar</button><button onClick={aplicarOutroPeriodo} className="flex-1 py-2 text-xs text-white rounded-lg font-medium" style={{background: "#062C9B"}} onMouseEnter={e => e.currentTarget.style.background = "#041a4d"} onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}>Aplicar</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}