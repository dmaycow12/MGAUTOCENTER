import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Search, Users, ChevronDown } from "lucide-react";

const PAGAMENTO_OPTIONS = ["A Combinar", "Boleto", "Cartão", "Dinheiro", "PIX"];
const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function AbaDevedores({ items, onAlterarStatus, onAlterarPagamento }) {
  const [nomesVendas, setNomesVendas] = useState({});
  const [search, setSearch] = useState("");
  const [expandidos, setExpandidos] = useState(new Set());

  const abertos = (items || []).filter(i => i.status === "Pendente" || i.status === "Atrasado");

  useEffect(() => {
    (async () => {
      const ids = [...new Set(abertos.map(i => i.ordem_venda_id).filter(Boolean))];
      if (!ids.length) { setNomesVendas({}); return; }
      try {
        const vs = await base44.entities.Vendas.filter({ id: { $in: ids } }, "-created_date", 9999);
        const mapa = {};
        vs.forEach(v => { mapa[v.id] = v; });
        setNomesVendas(mapa);
      } catch (e) {
        console.error("Erro ao carregar vendas dos devedores:", e);
      }
    })();
  }, [items]);

  const nomeDevedor = (item) => {
    const v = item.ordem_venda_id ? nomesVendas[item.ordem_venda_id] : null;
    if (v) return v.cliente_nome || v.cliente_nome_fantasia || `Venda #${v.numero || "?"}`;
    const m = String(item.descricao || "").match(/^#\s*\d+\s*[—–-]\s*(.+?)\s*[—–-]/);
    if (m) return m[1];
    const mv = String(item.descricao || "").match(/Venda #(\d+)/);
    if (mv) return `Venda #${mv[1]}`;
    return item.descricao || "Sem cliente";
  };

  const busca = search.trim().toLowerCase();

  const grupos = {};
  abertos.forEach(i => {
    const nome = nomeDevedor(i);
    if (!grupos[nome]) grupos[nome] = [];
    grupos[nome].push(i);
  });

  let listaGrupos = Object.entries(grupos).map(([nome, registros]) => {
    const nomeMatch = busca && nome.toLowerCase().includes(busca);
    const regs = nomeMatch ? registros : registros.filter(r => !busca || (r.descricao || "").toLowerCase().includes(busca));
    return {
      nome,
      registros: [...regs].sort((a, b) => (a.data_vencimento || "").localeCompare(b.data_vencimento || "")),
      total: regs.reduce((a, i) => a + Number(i.valor || 0), 0),
    };
  }).filter(g => g.registros.length > 0);
  listaGrupos.sort((a, b) => b.total - a.total);

  const totalGeral = abertos.reduce((a, i) => a + Number(i.valor || 0), 0);

  const toggleGrupo = (nome) => setExpandidos(prev => {
    const n = new Set(prev);
    if (n.has(nome)) n.delete(nome); else n.add(nome);
    return n;
  });

  return (
    <div className="flex flex-col gap-0.5">
      {/* Busca + resumo */}
      <div className="flex gap-0.5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Buscar devedor ou parcela..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div className="flex items-center justify-center gap-2 rounded-xl px-4 flex-shrink-0" style={{ background: "#16202c" }}>
          <Users className="w-4 h-4" style={{ color: "#8f9bb3" }} />
          <span className="text-xs font-medium" style={{ color: "#8f9bb3" }}>{listaGrupos.length} devedor(es)</span>
          <span className="text-xs font-medium" style={{ color: "#8f9bb3" }}>·</span>
          <span className="text-xs font-medium" style={{ color: "#8f9bb3" }}>Aberto:</span>
          <span className="text-base font-bold text-white whitespace-nowrap">R$ {fmt(totalGeral)}</span>
        </div>
      </div>

      {/* Grupos por devedor */}
      {listaGrupos.map(g => (
        <div key={g.nome} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <button onClick={() => toggleGrupo(g.nome)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-800/40 transition-all">
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${expandidos.has(g.nome) ? "" : "-rotate-90"}`} />
            <span className="text-white font-semibold text-sm flex-1 text-left truncate">{g.nome}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{g.registros.length} parcela(s)</span>
            <span className="text-sm font-bold text-white flex-shrink-0 w-28 text-right">R$ {fmt(g.total)}</span>
          </button>
          {expandidos.has(g.nome) && g.registros.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-800 hover:bg-gray-800/40 transition-all">
              <span className={`text-xs w-20 text-center flex-shrink-0 ${item.status === "Atrasado" ? "text-red-400 font-bold" : "text-gray-400"}`}>
                {item.data_vencimento ? item.data_vencimento.split("-").reverse().join("/") : "—"}
              </span>
              <span className="flex-1 text-xs text-white truncate min-w-0">{item.descricao}</span>
              <span className="text-xs font-bold text-green-400 w-24 text-right flex-shrink-0">R$ {fmt(item.valor)}</span>
              <select
                value={item.forma_pagamento || ""}
                onChange={e => { if (e.target.value) onAlterarPagamento(item, e.target.value); }}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange-500 w-28 flex-shrink-0"
                title="Forma de pagamento"
              >
                <option value="">—</option>
                {PAGAMENTO_OPTIONS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <div className="flex gap-0.5 flex-shrink-0">
                {["Pendente", "Pago"].map(s => {
                  const bloqueado = s === "Pago" && (!item.forma_pagamento || item.forma_pagamento === "A Combinar");
                  const isActive = item.status === s || (s === "Pendente" && item.status === "Atrasado");
                  return (
                    <button key={s}
                      onClick={() => {
                        if (bloqueado) return toast.error("Defina a forma de pagamento antes de marcar como Pago.");
                        onAlterarStatus(item, s);
                      }}
                      className="rounded-lg text-xs font-bold transition-all"
                      style={{
                        width: 60,
                        padding: "4px 0",
                        background: isActive ? (s === "Pago" ? "#16a34a" : "#cc0000") : "#374151",
                        color: "#fff",
                        opacity: isActive ? 1 : bloqueado ? 0.25 : 0.45,
                        cursor: bloqueado ? "not-allowed" : "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {listaGrupos.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-12 text-center">
          <p className="text-gray-500">Nenhuma parcela em aberto</p>
        </div>
      )}
    </div>
  );
}