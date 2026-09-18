import React from "react";
import { FileText, ClipboardCheck, Tag } from "lucide-react";

const fmtValor = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CORES = {
  vendas: "#4d7fff",
  notas: "#f97316",
  avulsos: "#9ca3af",
};

function LinhaOrigem({ cor, icone: Icon, titulo, sub, qtd, valor, pct }) {
  return (
    <div className="flex items-center gap-3 bg-black/40 rounded-lg px-3 py-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cor}1a`, border: `1px solid ${cor}44` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: cor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">{titulo}</p>
        <p className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{sub}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-white">{fmtValor(valor)}</p>
        <p className="text-[10px] text-gray-500">{qtd} lançamento(s) · {pct.toFixed(1)}%</p>
      </div>
    </div>
  );
}

export default function OrigemLancamentos({ origem }) {
  const total = (origem.vendas.valor || 0) + (origem.notas_entrada.valor || 0) + (origem.avulsos.valor || 0);
  const pct = (v) => (total > 0 ? (v / total) * 100 : 0);
  const ativos = origem.vendas.qtd + origem.notas_entrada.qtd + origem.avulsos.qtd;

  const segmentos = [
    ["vendas", origem.vendas.valor],
    ["notas", origem.notas_entrada.valor],
    ["avulsos", origem.avulsos.valor],
  ].filter(([, v]) => v > 0);

  return (
    <div className="rounded-xl border border-gray-800 bg-black/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">De onde vem cada lançamento</p>
        <span className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">
          {ativos} ativos{origem.cancelados > 0 ? ` · ${origem.cancelados} cancelados` : ""}
        </span>
      </div>

      {segmentos.length > 0 ? (
        <div className="h-2.5 rounded-full overflow-hidden flex gap-0.5" style={{ background: "#1f2937" }}>
          {segmentos.map(([k, v]) => (
            <div key={k} className="h-full" style={{ width: `${pct(v)}%`, background: CORES[k] }} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">Nenhum lançamento ativo</p>
      )}

      <div className="space-y-1.5">
        <LinhaOrigem cor={CORES.vendas} icone={ClipboardCheck} titulo="Vendas"
          sub="Receitas vinculadas a uma venda" qtd={origem.vendas.qtd} valor={origem.vendas.valor} pct={pct(origem.vendas.valor)} />
        <LinhaOrigem cor={CORES.notas} icone={FileText} titulo="Notas de entrada"
          sub="Compras e despesas vindas de NF de fornecedor" qtd={origem.notas_entrada.qtd} valor={origem.notas_entrada.valor} pct={pct(origem.notas_entrada.valor)} />
        <LinhaOrigem cor={CORES.avulsos} icone={Tag} titulo="Avulsos"
          sub="Lançados direto no financeiro, sem vínculo" qtd={origem.avulsos.qtd} valor={origem.avulsos.valor} pct={pct(origem.avulsos.valor)} />
      </div>
    </div>
  );
}