import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Edit, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function RevisaoVendas({ ordens, onEdit }) {
  const STORAGE_KEY = "revisao_vendas_filtros";
  const hoje = new Date();
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { return null; }
  })();
  const [search, setSearch] = useState(saved?.search || "");
  const [filtroStatus, setFiltroStatus] = useState(saved?.filtroStatus || []);
  const [filtroSecoes, setFiltroSecoes] = useState(saved?.filtroSecoes || ["Produtos", "Serviços", "Parcelas"]);
  const [filtroMes, setFiltroMes] = useState(saved?.filtroMes || hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(saved?.filtroAno || hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(!!saved?.usandoOutroPeriodo);
  const [customRange, setCustomRange] = useState(saved?.customRange || null);
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState(saved?.customRange?.inicio || "");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState(saved?.customRange?.fim || "");
  const periodoDropRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      search, filtroStatus, filtroSecoes, filtroMes, filtroAno, usandoOutroPeriodo, customRange
    }));
  }, [search, filtroStatus, filtroSecoes, filtroMes, filtroAno, usandoOutroPeriodo, customRange]);
  const [finStatus, setFinStatus] = useState({});
  const [finByVenda, setFinByVenda] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const map = {};
        const byVenda = {};
        let skip = 0;
        while (true) {
          const batch = await base44.entities.Financeiro.list("-created_date", 500, skip);
          if (!batch || !batch.length) break;
          for (const f of batch) {
            if (f.id) map[f.id] = f.status;
            if (f.ordem_venda_id) {
              if (!byVenda[f.ordem_venda_id]) byVenda[f.ordem_venda_id] = [];
              byVenda[f.ordem_venda_id].push({ id: f.id, status: f.status, data_vencimento: f.data_vencimento });
            }
          }
          skip += 500;
          if (batch.length < 500) break;
        }
        // Ordena cada venda por vencimento para casar por posição
        for (const k of Object.keys(byVenda)) {
          byVenda[k].sort((a, b) => (a.data_vencimento || "").localeCompare(b.data_vencimento || ""));
        }
        if (active) { setFinStatus(map); setFinByVenda(byVenda); }
      } catch (_) {}
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (periodoDropRef.current && !periodoDropRef.current.contains(e.target)) {
        setPeriodoDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pad = n => String(n).padStart(2, "0");
  const periodoRange = usandoOutroPeriodo && customRange
    ? customRange
    : { inicio: `${filtroAno}-${pad(filtroMes)}-01`, fim: `${filtroAno}-${pad(filtroMes)}-31` };

  const navegarMes = (dir) => {
    setUsandoOutroPeriodo(false);
    setCustomRange(null);
    let m = filtroMes + dir, a = filtroAno;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    setFiltroMes(m);
    setFiltroAno(a);
  };

  const aplicarAtalho = (tipo) => {
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    if (tipo === 'tudo') {
      setCustomRange({ inicio: '2000-01-01', fim: '2099-12-31' });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'mes') {
      setUsandoOutroPeriodo(false);
      setCustomRange(null);
      setFiltroMes(hoje.getMonth() + 1);
      setFiltroAno(hoje.getFullYear());
    } else if (tipo === 'mes_passado') {
      let m = hoje.getMonth(), a = hoje.getFullYear();
      if (m < 0) { m = 11; a--; }
      setUsandoOutroPeriodo(false);
      setCustomRange(null);
      setFiltroMes(m + 1);
      setFiltroAno(a);
    } else if (tipo === 'ano') {
      setCustomRange({ inicio: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'ano_passado') {
      setCustomRange({ inicio: `${hoje.getFullYear()-1}-01-01`, fim: `${hoje.getFullYear()-1}-12-31` });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'hoje') {
      setCustomRange({ inicio: fmt(hoje), fim: fmt(hoje) });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'ontem') {
      const o = new Date(hoje); o.setDate(o.getDate() - 1);
      setCustomRange({ inicio: fmt(o), fim: fmt(o) });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'semana') {
      const seg = new Date(hoje); const dow = (seg.getDay() + 6) % 7; seg.setDate(seg.getDate() - dow);
      const dom = new Date(seg); dom.setDate(dom.getDate() + 6);
      setCustomRange({ inicio: fmt(seg), fim: fmt(dom) });
      setUsandoOutroPeriodo(true);
    } else if (tipo === 'semana_passada') {
      const seg = new Date(hoje); const dow = (seg.getDay() + 6) % 7; seg.setDate(seg.getDate() - dow - 7);
      const dom = new Date(seg); dom.setDate(dom.getDate() + 6);
      setCustomRange({ inicio: fmt(seg), fim: fmt(dom) });
      setUsandoOutroPeriodo(true);
    }
    setPeriodoDropOpen(false);
  };

  const aplicarOutroPeriodo = () => {
    if (outroPeriodoInicio && outroPeriodoFim) {
      setCustomRange({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
      setUsandoOutroPeriodo(true);
      setPeriodoDropOpen(false);
    }
  };

  const fmtValor = v => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = v => Math.round(Number(v || 0)).toLocaleString("pt-BR");
  const fmtData = d => d ? d.split("-").reverse().join("/") : "—";

  const filtradas = useMemo(() => {
    return ordens.filter(o => {
      const s = search.toLowerCase();
      const matchSearch = !search ||
        o.numero?.toLowerCase().includes(s) ||
        o.cliente_nome?.toLowerCase().includes(s) ||
        o.cliente_nome_fantasia?.toLowerCase().includes(s) ||
        o.veiculo_placa?.toLowerCase().includes(s) ||
        o.veiculo_modelo?.toLowerCase().includes(s);
      const matchStatus = filtroStatus.length === 0 || filtroStatus.includes(o.status);
      const matchPeriodo = !periodoRange || (o.data_entrada && o.data_entrada >= periodoRange.inicio && o.data_entrada <= periodoRange.fim);
      return matchSearch && matchStatus && matchPeriodo;
    }).sort((a, b) => {
      const da = a.data_entrada || "";
      const db = b.data_entrada || "";
      if (da !== db) return da < db ? -1 : da > db ? 1 : 0;
      return parseInt(a.numero || 0) - parseInt(b.numero || 0);
    });
  }, [ordens, search, filtroStatus, periodoRange]);

  const toggleStatus = (s) => {
    setFiltroStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };
  const toggleSecao = (s) => {
    setFiltroSecoes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  return (
    <div className="space-y-0.5">
      {/* Filtros */}
      <div className="flex flex-col gap-0.5">
        {/* Filtro status */}
        <div className="flex gap-0.5">
          {["Aberto", "Orçamento", "Concluído"].map(s => (
            <button key={s} onClick={() => toggleStatus(s)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroStatus.includes(s) ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Filtro seções */}
        <div className="flex gap-0.5">
          {["Produtos", "Serviços", "Parcelas"].map(s => (
            <button key={s} onClick={() => toggleSecao(s)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${filtroSecoes.includes(s) ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Período */}
        <div className="flex gap-0.5 items-stretch">
          <div className={`flex-1 flex items-center rounded-xl text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button onClick={() => { setUsandoOutroPeriodo(false); setCustomRange(null); }} className="flex-1 text-center py-3 hover:bg-white/10 transition-all cursor-pointer px-1 leading-tight" style={{fontSize:"clamp(11px,1.5vw,15px)"}}>{MESES[filtroMes - 1]} - {filtroAno}</button>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 transition-all flex-shrink-0 hover:bg-white/20" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="relative flex-1" ref={periodoDropRef}>
            <button
              onClick={() => setPeriodoDropOpen(v => !v)}
              className={`w-full h-full min-h-[48px] flex items-center justify-center gap-1 px-2 rounded-xl font-semibold transition-all ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}
              style={{fontSize:"clamp(11px,1.5vw,13px)"}}
            >
              <span className="text-center leading-tight flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span>
                  {usandoOutroPeriodo && customRange
                    ? customRange.inicio.split("-").reverse().join("/")
                    : `${String(1).padStart(2,"0")}/${String(filtroMes).padStart(2,"0")}/${filtroAno}`}
                </span>
                <span className="hidden sm:inline">—</span>
                <span>
                  {usandoOutroPeriodo && customRange
                    ? customRange.fim.split("-").reverse().join("/")
                    : `${String(new Date(filtroAno,filtroMes,0).getDate()).padStart(2,"0")}/${String(filtroMes).padStart(2,"0")}/${filtroAno}`}
                </span>
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${periodoDropOpen ? "rotate-180" : ""}`} />
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
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Até</label>
                    <input type="date" value={outroPeriodoFim} onChange={e => setOutroPeriodoFim(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
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

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder=""
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Lista de vendas com produtos e serviços visíveis */}
      {filtradas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">Nenhuma venda encontrada</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtradas.map(o => (
            <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Cabeçalho da venda */}
              <div className="flex items-center gap-3 px-4 py-2.5" style={{background:"#0d1b2a", borderBottom:"1px solid #1e3a5f"}}>
                <span className="text-sm font-bold text-white whitespace-nowrap">#{o.numero}</span>
                <span className="text-sm text-gray-400 whitespace-nowrap">{fmtData(o.data_entrada)}</span>
                <span className="text-sm text-gray-200 flex-1 truncate">{o.cliente_nome_fantasia || o.cliente_nome || "—"}</span>
                {o.veiculo_modelo && <span className="text-sm text-gray-400 whitespace-nowrap hidden sm:inline">{o.veiculo_modelo}</span>}
                {o.veiculo_placa && <span className="text-xs text-gray-400 whitespace-nowrap hidden md:inline px-1.5 py-0.5 rounded" style={{background:"#1e3a5f"}}>{o.veiculo_placa}</span>}
                {o.quilometragem && <span className="text-xs text-gray-400 whitespace-nowrap hidden md:inline">{o.quilometragem} KM</span>}
                {o.tecnico && <span className="text-xs text-gray-400 whitespace-nowrap hidden md:inline">{o.tecnico}</span>}
                <span className="text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap" style={{
                  background: o.status === "Concluído" ? "#064e3b" : o.status === "Orçamento" ? "#78350f" : "#1e3a5f",
                  color: o.status === "Concluído" ? "#6ee7b7" : o.status === "Orçamento" ? "#fbbf24" : "#93c5fd"
                }}>{o.status}</span>
                <span className="text-sm font-bold text-white whitespace-nowrap">{fmtValor(o.valor_total)}</span>
                <button onClick={() => onEdit(o)} className="text-gray-400 hover:text-white flex-shrink-0">
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              {/* Produtos, Serviços e Parcelas — empilhados verticalmente */}
              <div className="flex flex-col gap-0">
                {/* Produtos */}
                {filtroSecoes.includes("Produtos") && <div className="p-3" style={{borderBottom:"1px solid #1e3a5f"}}>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Produtos {(o.pecas || []).length > 0 && `(${o.pecas.length})`}</p>
                  {(o.pecas || []).length === 0 ? (
                    <p className="text-sm text-gray-600">Nenhum produto</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex gap-2 text-xs text-gray-500 uppercase font-semibold pb-1" style={{borderBottom:"1px solid #1e3a5f"}}>
                        <span className="flex-1">Descrição</span>
                        <span className="w-16 text-right">Valor</span>
                        <span className="w-8 text-right">Qtd</span>
                        <span className="w-16 text-right">Total</span>
                        <span className="w-16 text-right">Custo</span>
                        <span className="w-16 text-right">Total</span>
                      </div>
                      {(o.pecas || []).map((p, i) => (
                        <div key={i} className="flex gap-2 text-sm items-center">
                          <span className="text-gray-300 flex-1 truncate">{p.descricao || p.codigo || "—"}</span>
                          <span className="text-gray-200 w-16 text-right whitespace-nowrap">{fmtValor(p.valor_unitario)}</span>
                          <span className="text-gray-500 w-8 text-right">{p.quantidade || 1}</span>
                          <span className="text-gray-200 w-16 text-right whitespace-nowrap">{fmtValor((p.valor_unitario || 0) * (p.quantidade || 1))}</span>
                          <span className="text-gray-400 w-16 text-right whitespace-nowrap">{fmtValor(p.valor_custo)}</span>
                          <span className="text-gray-400 w-16 text-right whitespace-nowrap">{fmtInt((p.valor_custo || 0) * (p.quantidade || 1))}</span>
                        </div>
                      ))}
                      <div className="flex gap-2 text-sm font-bold pt-1 mt-1" style={{borderTop:"1px solid #1e3a5f"}}>
                        <span className="text-gray-400 flex-1 uppercase text-xs">Total</span>
                        <span className="w-16"></span>
                        <span className="w-8"></span>
                        <span className="text-white w-16 text-right whitespace-nowrap">{fmtValor((o.pecas || []).reduce((s, p) => s + (p.valor_unitario || 0) * (p.quantidade || 1), 0))}</span>
                        <span className="w-16"></span>
                        <span className="text-gray-300 w-16 text-right whitespace-nowrap">{fmtInt((o.pecas || []).reduce((s, p) => s + (p.valor_custo || 0) * (p.quantidade || 1), 0))}</span>
                      </div>
                    </div>
                  )}
                </div>}

                {/* Serviços */}
                {filtroSecoes.includes("Serviços") && <div className="p-3" style={{borderBottom:"1px solid #1e3a5f"}}>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Serviços {(o.servicos || []).length > 0 && `(${o.servicos.length})`}</p>
                  {(o.servicos || []).length === 0 ? (
                    <p className="text-sm text-gray-600">Nenhum serviço</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex gap-2 text-xs text-gray-500 uppercase font-semibold pb-1" style={{borderBottom:"1px solid #1e3a5f"}}>
                        <span className="flex-1">Descrição</span>
                        <span className="w-16 text-right">Valor</span>
                        <span className="w-8 text-right">Qtd</span>
                        <span className="w-16 text-right">Total</span>
                        <span className="w-16 text-right">Custo</span>
                        <span className="w-16 text-right">Total</span>
                      </div>
                      {(o.servicos || []).map((sv, i) => (
                        <div key={i} className="flex gap-2 text-sm items-center">
                          <span className="text-gray-300 flex-1 truncate">{sv.descricao || "—"}</span>
                          <span className="text-gray-200 w-16 text-right whitespace-nowrap">{fmtValor(sv.valor)}</span>
                          <span className="text-gray-500 w-8 text-right">{sv.quantidade ?? 1}</span>
                          <span className="text-gray-200 w-16 text-right whitespace-nowrap">{fmtValor((sv.valor || 0) * (sv.quantidade ?? 1))}</span>
                          <span className="text-gray-400 w-16 text-right whitespace-nowrap">{fmtValor(sv.valor_custo)}</span>
                          <span className="text-gray-400 w-16 text-right whitespace-nowrap">{fmtInt((sv.valor_custo || 0) * (sv.quantidade ?? 1))}</span>
                        </div>
                      ))}
                      <div className="flex gap-2 text-sm font-bold pt-1 mt-1" style={{borderTop:"1px solid #1e3a5f"}}>
                        <span className="text-gray-400 flex-1 uppercase text-xs">Total</span>
                        <span className="w-16"></span>
                        <span className="w-8"></span>
                        <span className="text-white w-16 text-right whitespace-nowrap">{fmtValor((o.servicos || []).reduce((s, sv) => s + (sv.valor || 0) * (sv.quantidade ?? 1), 0))}</span>
                        <span className="w-16"></span>
                        <span className="text-gray-300 w-16 text-right whitespace-nowrap">{fmtInt((o.servicos || []).reduce((s, sv) => s + (sv.valor_custo || 0) * (sv.quantidade ?? 1), 0))}</span>
                      </div>
                    </div>
                  )}
                </div>}

                {/* Parcelas */}
                {filtroSecoes.includes("Parcelas") && <div className="p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Parcelas {(o.parcelas_detalhes || []).length > 0 && `(${o.parcelas_detalhes.length})`}</p>
                  {(o.parcelas_detalhes || []).length === 0 ? (
                    <p className="text-sm text-gray-600">Nenhuma parcela</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex gap-2 text-xs text-gray-500 uppercase font-semibold pb-1" style={{borderBottom:"1px solid #1e3a5f"}}>
                        <span className="w-8 text-center">Nº</span>
                        <span className="flex-1 text-right">Vencimento</span>
                        <span className="w-24 text-right">Forma</span>
                        <span className="w-20 text-right">Valor</span>
                        <span className="w-20 text-right">Status</span>
                      </div>
                      {(o.parcelas_detalhes || []).map((par, i) => {
                        let st = "Pendente";
                        if (par.financeiro_id && finStatus[par.financeiro_id]) {
                          st = finStatus[par.financeiro_id] === "Pago" ? "Pago" : "Pendente";
                        } else if (o.id && finByVenda[o.id] && finByVenda[o.id].length > 0) {
                          const fin = finByVenda[o.id][i];
                          if (fin) st = fin.status === "Pago" ? "Pago" : "Pendente";
                        } else {
                          st = (par.financeiro_status === "Pago") ? "Pago" : "Pendente";
                        }
                        const cor = st === "Pago" ? "#6ee7b7" : "#fbbf24";
                        return (
                          <div key={i} className="flex gap-2 text-sm items-center">
                            <span className="text-gray-300 w-8 text-center">{par.numero ?? i + 1}</span>
                            <span className="text-gray-200 flex-1 text-right whitespace-nowrap">{fmtData(par.vencimento)}</span>
                            <span className="text-gray-400 w-24 text-right truncate">{par.forma_pagamento || "—"}</span>
                            <span className="text-gray-200 w-20 text-right whitespace-nowrap">{fmtValor(par.valor)}</span>
                            <span className="w-20 text-right whitespace-nowrap font-medium" style={{color: cor}}>{st}</span>
                          </div>
                        );
                      })}
                      <div className="flex gap-2 text-sm font-bold pt-1 mt-1" style={{borderTop:"1px solid #1e3a5f"}}>
                        <span className="text-gray-400 w-8"></span>
                        <span className="text-gray-400 flex-1 uppercase text-xs text-right">Total</span>
                        <span className="w-24"></span>
                        <span className="text-white w-20 text-right whitespace-nowrap">{fmtValor((o.parcelas_detalhes || []).reduce((s, par) => s + (par.valor || 0), 0))}</span>
                        <span className="w-20"></span>
                      </div>
                    </div>
                  )}
                </div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}