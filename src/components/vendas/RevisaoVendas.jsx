import { useState, useMemo } from "react";
import { Search, Edit, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function RevisaoVendas({ ordens, onEdit }) {
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState([]);
  const [expandido, setExpandido] = useState(null);
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

  const getCustoPeca = (p) => Number(p.valor_custo || 0);
  const getCustoTotal = (o) => {
    const custoPecas = (o.pecas || []).reduce((s, p) => s + getCustoPeca(p) * Number(p.quantidade || 1), 0);
    const custoServicos = (o.servicos || []).reduce((s, sv) => s + Number(sv.valor_custo || 0) * Number(sv.quantidade ?? 1), 0);
    return custoPecas + custoServicos;
  };
  const getLucro = (o) => {
    const custo = getCustoTotal(o);
    return (o.valor_servicos || 0) + (o.valor_pecas || 0) - custo - (o.desconto || 0);
  };

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

  const fmtValor = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtData = d => d ? d.split("-").reverse().join("/") : "—";

  const totalValor = filtradas.reduce((acc, o) => acc + (o.valor_total || 0), 0);
  const totalCusto = filtradas.reduce((acc, o) => acc + getCustoTotal(o), 0);
  const totalLucro = filtradas.reduce((acc, o) => acc + getLucro(o), 0);

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

      {/* Totais */}
      <div className="grid grid-cols-4 gap-0.5">
        <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
          <span className="text-xs font-semibold text-gray-400 tracking-wide">QTD</span>
          <span className="text-sm font-bold text-white">{filtradas.length}</span>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
          <span className="text-xs font-semibold text-gray-400 tracking-wide">VALOR</span>
          <span className="text-sm font-bold text-white">{fmtValor(totalValor)}</span>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
          <span className="text-xs font-semibold text-gray-400 tracking-wide">CUSTO</span>
          <span className="text-sm font-bold text-white">{fmtValor(totalCusto)}</span>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-1" style={{background:"#0d1b2a", border:"1px solid #1e3a5f"}}>
          <span className="text-xs font-semibold text-gray-400 tracking-wide">LUCRO</span>
          <span className={`text-sm font-bold ${totalLucro >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtValor(totalLucro)}</span>
        </div>
      </div>

      {/* Tabela */}
      {filtradas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">Nenhuma venda encontrada</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div style={{overflowX:'auto'}}>
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-10"></th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-16">Nº</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-24">Data</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase">Cliente</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-28">Veículo</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-20">Status</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-28">Valor</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-28">Custo</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase w-28">Lucro</th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(o => {
                  const isOpen = expandido === o.id;
                  const lucro = getLucro(o);
                  return (
                    <>
                      <tr key={o.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                        <td className="px-3 py-2">
                          <button onClick={() => setExpandido(isOpen ? null : o.id)} className="text-gray-400 hover:text-white">
                            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm font-bold text-white">#{o.numero}</td>
                        <td className="px-3 py-2 text-sm text-gray-300">{fmtData(o.data_entrada)}</td>
                        <td className="px-3 py-2 text-sm text-gray-200">{o.cliente_nome || "—"}</td>
                        <td className="px-3 py-2 text-sm text-gray-300">{o.veiculo_modelo || o.veiculo_placa || "—"}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{
                            background: o.status === "Concluído" ? "#064e3b" : o.status === "Orçamento" ? "#78350f" : "#1e3a5f",
                            color: o.status === "Concluído" ? "#6ee7b7" : o.status === "Orçamento" ? "#fbbf24" : "#93c5fd"
                          }}>{o.status}</span>
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-white font-medium">{fmtValor(o.valor_total)}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-300">{fmtValor(getCustoTotal(o))}</td>
                        <td className={`px-3 py-2 text-sm text-right font-medium ${lucro >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtValor(lucro)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => onEdit(o)} className="text-gray-400 hover:text-white">
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t" style={{borderColor: "#1e3a5f", background: "#0a1628"}}>
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Serviços</p>
                                {(o.servicos || []).length === 0 ? (
                                  <p className="text-sm text-gray-600">Nenhum serviço</p>
                                ) : (
                                  <div className="space-y-1">
                                    {(o.servicos || []).map((sv, i) => (
                                      <div key={i} className="flex justify-between text-sm">
                                        <span className="text-gray-300">{sv.descricao || "—"}</span>
                                        <span className="text-gray-200">{fmtValor(sv.valor)} × {sv.quantidade ?? 1}{sv.tecnico ? ` (${sv.tecnico})` : ""}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Peças</p>
                                {(o.pecas || []).length === 0 ? (
                                  <p className="text-sm text-gray-600">Nenhuma peça</p>
                                ) : (
                                  <div className="space-y-1">
                                    {(o.pecas || []).map((p, i) => (
                                      <div key={i} className="flex justify-between text-sm">
                                        <span className="text-gray-300">{p.descricao || p.codigo || "—"}</span>
                                        <span className="text-gray-200">{fmtValor(p.valor_unitario)} × {p.quantidade || 1}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {o.defeito_relatado && (
                                <div className="md:col-span-2">
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Defeito Relatado</p>
                                  <p className="text-sm text-gray-300">{o.defeito_relatado}</p>
                                </div>
                              )}
                              {o.diagnostico && (
                                <div className="md:col-span-2">
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Diagnóstico</p>
                                  <p className="text-sm text-gray-300">{o.diagnostico}</p>
                                </div>
                              )}
                              {o.observacoes && (
                                <div className="md:col-span-2">
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Observações</p>
                                  <p className="text-sm text-gray-300">{o.observacoes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}