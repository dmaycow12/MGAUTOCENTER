import { useState, useMemo } from "react";
import { Search, Edit, ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function RevisaoVendas({ ordens, onEdit }) {
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState([]);
  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState(hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(false);
  const [customRange, setCustomRange] = useState(null);

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
    } else if (tipo === 'ano') {
      setCustomRange({ inicio: `${hoje.getFullYear()}-01-01`, fim: `${hoje.getFullYear()}-12-31` });
      setUsandoOutroPeriodo(true);
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
    }).sort((a, b) => parseInt(b.numero || 0) - parseInt(a.numero || 0));
  }, [ordens, search, filtroStatus, periodoRange]);

  const toggleStatus = (s) => {
    setFiltroStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
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

        {/* Período */}
        <div className="flex gap-0.5">
          <div className={`flex-1 flex items-center rounded-xl text-sm font-semibold overflow-hidden ${!usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300"}`}>
            <button onClick={() => navegarMes(-1)} className="flex items-center justify-center h-full px-2 hover:bg-white/20 flex-shrink-0" style={{borderRight: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button onClick={() => { setUsandoOutroPeriodo(false); setCustomRange(null); }} className="flex-1 text-center py-3 hover:bg-white/10 px-1" style={{fontSize:"clamp(11px,1.5vw,15px)"}}>{MESES[filtroMes - 1]} - {filtroAno}</button>
            <button onClick={() => navegarMes(1)} className="flex items-center justify-center h-full px-2 hover:bg-white/20 flex-shrink-0" style={{borderLeft: "1px solid rgba(255,255,255,0.15)"}}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <button onClick={() => aplicarAtalho('tudo')} className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${usandoOutroPeriodo ? "bg-[#062C9B] text-white" : "bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"}`}>
            Tudo
          </button>
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
                <span className="text-sm text-gray-200 flex-1 truncate">{o.cliente_nome || "—"}</span>
                {o.veiculo_modelo && <span className="text-sm text-gray-400 whitespace-nowrap hidden sm:inline">{o.veiculo_modelo}</span>}
                <span className="text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap" style={{
                  background: o.status === "Concluído" ? "#064e3b" : o.status === "Orçamento" ? "#78350f" : "#1e3a5f",
                  color: o.status === "Concluído" ? "#6ee7b7" : o.status === "Orçamento" ? "#fbbf24" : "#93c5fd"
                }}>{o.status}</span>
                <span className="text-sm font-bold text-white whitespace-nowrap">{fmtValor(o.valor_total)}</span>
                <button onClick={() => onEdit(o)} className="text-gray-400 hover:text-white flex-shrink-0">
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              {/* Produtos e Serviços — sempre visíveis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                {/* Serviços */}
                <div className="p-3" style={{borderRight:"1px solid #1e3a5f"}}>
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
                        <span className="w-16 text-right">Tot. Custo</span>
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
                        <span className="text-white w-16 text-right whitespace-nowrap">{fmtValor((o.servicos || []).reduce((s, sv) => s + (sv.valor || 0) * (sv.quantidade ?? 1), 0))}</span>
                        <span className="w-8"></span>
                        <span className="text-white w-16 text-right whitespace-nowrap">{fmtValor((o.servicos || []).reduce((s, sv) => s + (sv.valor || 0) * (sv.quantidade ?? 1), 0))}</span>
                        <span className="text-gray-300 w-16 text-right whitespace-nowrap">{fmtValor((o.servicos || []).reduce((s, sv) => s + (sv.valor_custo || 0) * (sv.quantidade ?? 1), 0))}</span>
                        <span className="text-gray-300 w-16 text-right whitespace-nowrap">{fmtInt((o.servicos || []).reduce((s, sv) => s + (sv.valor_custo || 0) * (sv.quantidade ?? 1), 0))}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Produtos */}
                <div className="p-3">
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
                        <span className="w-16 text-right">Tot. Custo</span>
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
                        <span className="text-white w-16 text-right whitespace-nowrap">{fmtValor((o.pecas || []).reduce((s, p) => s + (p.valor_unitario || 0) * (p.quantidade || 1), 0))}</span>
                        <span className="w-8"></span>
                        <span className="text-white w-16 text-right whitespace-nowrap">{fmtValor((o.pecas || []).reduce((s, p) => s + (p.valor_unitario || 0) * (p.quantidade || 1), 0))}</span>
                        <span className="text-gray-300 w-16 text-right whitespace-nowrap">{fmtValor((o.pecas || []).reduce((s, p) => s + (p.valor_custo || 0) * (p.quantidade || 1), 0))}</span>
                        <span className="text-gray-300 w-16 text-right whitespace-nowrap">{fmtInt((o.pecas || []).reduce((s, p) => s + (p.valor_custo || 0) * (p.quantidade || 1), 0))}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}