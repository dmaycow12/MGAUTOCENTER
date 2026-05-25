import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const COLORS = ["#062C9B", "#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];

export default function EstatisticasProdutosServicos({ vendas, servicosCad = [] }) {
  const [aba, setAba] = useState("servicos");
  const [busca, setBusca] = useState("");
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [modoAgrupamento, setModoAgrupamento] = useState("descricao");

  const { rankServicos, rankProdutos, rankServicosCodigo, rankProdutosCodigo, totalServicos, totalProdutos } = useMemo(() => {
    const mapServicos = {};
    const mapProdutos = {};
    const mapServicosCodigo = {};
    const mapProdutosCodigo = {};

    const vendasValidas = vendas.filter(v => v.status !== "Orçamento");
    vendasValidas.forEach(venda => {
      // Serviços
      (venda.servicos || []).forEach(s => {
        const desc = (s.descricao || "SEM NOME").toUpperCase().trim();
        const total = Number(s.valor || 0) * Number(s.quantidade || 1);
        if (!mapServicos[desc]) mapServicos[desc] = { descricao: desc, receita: 0, quantidade: 0, vezes: 0 };
        mapServicos[desc].receita += total;
        mapServicos[desc].quantidade += Number(s.quantidade || 1);
        mapServicos[desc].vezes += 1;
        // Por código: usa codigo salvo ou busca no catálogo pela descrição
        const codigoServico = (s.codigo && s.codigo.trim())
          ? s.codigo.trim()
          : servicosCad.find(sc => sc.descricao?.toLowerCase().trim() === (s.descricao || '').toLowerCase().trim())?.codigo || '';
        if (codigoServico) {
          const cod = codigoServico.toUpperCase().trim();
          if (!mapServicosCodigo[cod]) mapServicosCodigo[cod] = { descricao: cod, receita: 0, quantidade: 0, vezes: 0 };
          mapServicosCodigo[cod].receita += total;
          mapServicosCodigo[cod].quantidade += Number(s.quantidade || 1);
          mapServicosCodigo[cod].vezes += 1;
        }
      });

      // Produtos (peças)
      (venda.pecas || []).forEach(p => {
        const desc = (p.descricao || "SEM NOME").toUpperCase().trim();
        const total = Number(p.valor_total || 0) || Number(p.valor_unitario || 0) * Number(p.quantidade || 1);
        if (!mapProdutos[desc]) mapProdutos[desc] = { descricao: desc, receita: 0, quantidade: 0, vezes: 0 };
        mapProdutos[desc].receita += total;
        mapProdutos[desc].quantidade += Number(p.quantidade || 1);
        mapProdutos[desc].vezes += 1;
        // Por código (ignora XX1 e sem código)
        if (p.codigo && p.codigo.trim() && p.codigo.toUpperCase().trim() !== 'XX1') {
          const cod = p.codigo.toUpperCase().trim();
          if (!mapProdutosCodigo[cod]) mapProdutosCodigo[cod] = { descricao: cod, receita: 0, quantidade: 0, vezes: 0 };
          mapProdutosCodigo[cod].receita += total;
          mapProdutosCodigo[cod].quantidade += Number(p.quantidade || 1);
          mapProdutosCodigo[cod].vezes += 1;
        }
      });
    });

    const rankServicos = Object.values(mapServicos).sort((a, b) => b.receita - a.receita);
    const rankProdutos = Object.values(mapProdutos).sort((a, b) => b.receita - a.receita);
    const rankServicosCodigo = Object.values(mapServicosCodigo).sort((a, b) => b.receita - a.receita);
    const rankProdutosCodigo = Object.values(mapProdutosCodigo).sort((a, b) => b.receita - a.receita);
    const totalServicos = rankServicos.reduce((acc, s) => acc + s.receita, 0);
    const totalProdutos = rankProdutos.reduce((acc, p) => acc + p.receita, 0);

    return { rankServicos, rankProdutos, rankServicosCodigo, rankProdutosCodigo, totalServicos, totalProdutos };
  }, [vendas]);

  const rankAtualServicos = modoAgrupamento === "descricao" ? rankServicos : rankServicosCodigo;
  const rankAtualProdutos = modoAgrupamento === "descricao" ? rankProdutos : rankProdutosCodigo;
  const lista = aba === "servicos" ? rankAtualServicos : rankAtualProdutos;
  const totalAtual = aba === "servicos" ? totalServicos : totalProdutos;

  const listaFiltrada = lista.filter(i =>
    i.descricao.toLowerCase().includes(busca.toLowerCase())
  );
  const topChart = lista.slice(0, 8);

  const listaExibida = mostrarTodos ? listaFiltrada : listaFiltrada.slice(0, 10);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-base">Receita por Produto/Serviço</h2>
        <span className="text-gray-400 text-xs">
          Total: <span className="text-green-400 font-bold">{fmt(totalAtual)}</span>
        </span>
      </div>

      {/* Toggle Descrição / Código */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => { setModoAgrupamento("descricao"); setBusca(""); setMostrarTodos(false); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={modoAgrupamento === "descricao" ? { background: "#065f46", color: "#6ee7b7" } : { color: "#9ca3af" }}
        >
          Por Descrição
        </button>
        <button
          onClick={() => { setModoAgrupamento("codigo"); setBusca(""); setMostrarTodos(false); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={modoAgrupamento === "codigo" ? { background: "#065f46", color: "#6ee7b7" } : { color: "#9ca3af" }}
        >
          Por Código
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => { setAba("servicos"); setMostrarTodos(false); setBusca(""); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={aba === "servicos" ? { background: "#062C9B", color: "#fff" } : { color: "#9ca3af" }}
        >
          Serviços ({rankServicos.length})
        </button>
        <button
          onClick={() => { setAba("produtos"); setMostrarTodos(false); setBusca(""); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={aba === "produtos" ? { background: "#062C9B", color: "#fff" } : { color: "#9ca3af" }}
        >
          Produtos ({rankProdutos.length})
        </button>
      </div>

      {/* Gráfico top 8 */}
      {topChart.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={topChart} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="descricao" width={120} tick={{ fill: "#9ca3af", fontSize: 9 }} axisLine={false} tickLine={false}
              tickFormatter={v => v.length > 18 ? v.substring(0, 18) + "…" : v}
            />
            <Tooltip
              formatter={(v) => [fmt(v), "Receita"]}
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#fff" }}
            />
            <Bar dataKey="receita" radius={[0, 4, 4, 0]}>
              {topChart.map((_, i) => (
                <Cell key={i} fill={COLORS[Math.min(i, COLORS.length - 1)]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Busca */}
      <input
        type="text"
        placeholder={`Buscar ${aba === "servicos" ? "serviço" : "produto"}...`}
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none placeholder-gray-500"
      />

      {/* Tabela */}
      <div className="space-y-1">
        <div className="grid grid-cols-12 gap-1 px-2 py-1">
          <span className="col-span-1 text-gray-500 text-xs">#</span>
          <span className="col-span-5 text-gray-500 text-xs">{modoAgrupamento === "descricao" ? "DESCRIÇÃO" : "CÓDIGO"}</span>
          <span className="col-span-2 text-gray-500 text-xs text-right">QTD</span>
          <span className="col-span-4 text-gray-500 text-xs text-right">RECEITA</span>
        </div>
        {listaExibida.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">Sem dados</p>
        ) : (
          listaExibida.map((item, i) => {
            const pct = totalAtual > 0 ? (item.receita / totalAtual) * 100 : 0;
            return (
              <div key={i} className="grid grid-cols-12 gap-1 px-2 py-2 rounded-lg hover:bg-gray-800 transition-all relative overflow-hidden group">
                {/* barra de fundo proporcional */}
                <div className="absolute inset-0 rounded-lg opacity-20 transition-all" style={{ width: `${pct}%`, background: COLORS[Math.min(i, COLORS.length-1)] }} />
                <span className="col-span-1 text-gray-500 text-xs z-10">{listaFiltrada.indexOf(item) + 1}</span>
                <span className="col-span-5 text-white text-xs font-medium z-10 truncate">{item.descricao}</span>
                <span className="col-span-2 text-gray-400 text-xs text-right z-10">{item.quantidade.toFixed(0)}</span>
                <span className="col-span-4 text-green-400 text-xs font-bold text-right z-10">{fmt(item.receita)}</span>
              </div>
            );
          })
        )}
      </div>

      {listaFiltrada.length > 10 && (
        <button
          onClick={() => setMostrarTodos(v => !v)}
          className="w-full py-2 text-xs text-gray-400 border border-gray-700 rounded-lg hover:text-white hover:border-gray-500 transition-all"
        >
          {mostrarTodos ? "Mostrar menos" : `Ver todos (${listaFiltrada.length})`}
        </button>
      )}
    </div>
  );
}