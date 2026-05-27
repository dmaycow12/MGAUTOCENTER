import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function normalizar(str) {
  if (!str) return str;
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .toUpperCase()
    .trim();
}

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const COLORS = ["#062C9B", "#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];

export default function EstatisticasProdutosServicos({ vendas, servicosCad = [], estoque = [] }) {
  const [aba, setAba] = useState(() => localStorage.getItem("eps_aba") || "produtos");
  const [busca, setBusca] = useState("");
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [modoValor, setModoValor] = useState(() => localStorage.getItem("eps_modoValor") || "receita");

  const { rankServicos, rankProdutos, rankServicosCodigo, rankProdutosCodigo, totalServicos, totalProdutos, semCodigoProdutos, semCodigoServicos } = useMemo(() => {
    const mapServicos = {};
    const mapProdutos = {};
    const mapServicosCodigo = {};
    const mapProdutosCodigo = {};
    const semCodigoProdutos = [];
    const semCodigoServicos = [];

    const vendasValidas = vendas.filter(v => v.status !== "Orçamento");
    vendasValidas.forEach(venda => {
      // Serviços
      (venda.servicos || []).forEach(s => {
        const desc = normalizar(s.descricao || "SEM NOME");
        const total = Number(s.valor || 0) * Number(s.quantidade || 1);
        const custo = Number(s.valor_custo || 0) * Number(s.quantidade || 1);
        const codigoServico = (s.codigo && s.codigo.trim()) ? s.codigo.trim() : servicosCad.find(sc => sc.descricao?.toLowerCase().trim() === (s.descricao || '').toLowerCase().trim())?.codigo || '';
        if (!mapServicos[desc]) mapServicos[desc] = { descricao: desc, codigo: codigoServico, receita: 0, custo: 0, quantidade: 0, vezes: 0 };
        mapServicos[desc].receita += total;
        mapServicos[desc].custo += custo;
        mapServicos[desc].quantidade += Number(s.quantidade || 1);
        mapServicos[desc].vezes += 1;

        if (codigoServico) {
          const cod = codigoServico.toUpperCase().trim();
          const servicoDesc = servicosCad.find(sc => sc.codigo?.toUpperCase().trim() === cod)?.descricao || cod;
          if (!mapServicosCodigo[cod]) mapServicosCodigo[cod] = { codigo: cod, descricao: servicoDesc, receita: 0, custo: 0, quantidade: 0, vezes: 0 };
          mapServicosCodigo[cod].receita += total;
          mapServicosCodigo[cod].custo += custo;
          mapServicosCodigo[cod].quantidade += Number(s.quantidade || 1);
          mapServicosCodigo[cod].vezes += 1;
        } else if (total > 0) {
          semCodigoServicos.push({ venda_numero: venda.numero || venda.id, cliente: venda.cliente_nome || '-', descricao: desc, valor: total });
        }
      });

      // Produtos (peças)
      (venda.pecas || []).forEach(p => {
        const desc = normalizar(p.descricao || "SEM NOME");
        const total = Number(p.valor_total || 0) || Number(p.valor_unitario || 0) * Number(p.quantidade || 1);
        const itemEst = estoque.find(e => e.id === p.estoque_id || (p.codigo && e.codigo?.toUpperCase().trim() === p.codigo?.toUpperCase().trim()));
        const custoPeca = (Number(p.valor_custo || 0) > 0 ? Number(p.valor_custo) : Number(itemEst?.valor_custo || 0)) * Number(p.quantidade || 1);
        if (!mapProdutos[desc]) mapProdutos[desc] = { descricao: desc, codigo: p.codigo || '', receita: 0, custo: 0, quantidade: 0, vezes: 0 };
        mapProdutos[desc].receita += total;
        mapProdutos[desc].custo += custoPeca;
        mapProdutos[desc].quantidade += Number(p.quantidade || 1);
        mapProdutos[desc].vezes += 1;
        // Por código (ignora sem código)
        if (p.codigo && p.codigo.trim()) {
          const cod = p.codigo.toUpperCase().trim();
          // Sempre usa a descrição real do cadastro, nunca a editada na venda
          const itemCadastro = estoque.find(e => e.codigo?.toUpperCase().trim() === cod);
          const descReal = itemCadastro?.descricao ? normalizar(itemCadastro.descricao) : cod;
          if (!mapProdutosCodigo[cod]) mapProdutosCodigo[cod] = { codigo: cod, descricao: descReal, receita: 0, custo: 0, quantidade: 0, vezes: 0 };
          mapProdutosCodigo[cod].receita += total;
          mapProdutosCodigo[cod].custo += custoPeca;
          mapProdutosCodigo[cod].quantidade += Number(p.quantidade || 1);
          mapProdutosCodigo[cod].vezes += 1;
        } else if (total > 0) {
          semCodigoProdutos.push({ venda_numero: venda.numero || venda.id, cliente: venda.cliente_nome || '-', descricao: desc, valor: total });
        }
      });
    });

    const rankServicos = Object.values(mapServicos).sort((a, b) => b.receita - a.receita);
    const rankProdutos = Object.values(mapProdutos).sort((a, b) => b.receita - a.receita);
    const rankServicosCodigo = Object.values(mapServicosCodigo).sort((a, b) => b.receita - a.receita);
    const rankProdutosCodigo = Object.values(mapProdutosCodigo).sort((a, b) => b.receita - a.receita);
    const totalServicos = rankServicos.reduce((acc, s) => acc + s.receita, 0);
    const totalProdutos = rankProdutos.reduce((acc, p) => acc + p.receita, 0);

    return { rankServicos, rankProdutos, rankServicosCodigo, rankProdutosCodigo, totalServicos, totalProdutos, semCodigoProdutos, semCodigoServicos };
  }, [vendas]);

  const rankAtualServicos = rankServicosCodigo;
  const rankAtualProdutos = rankProdutosCodigo;
  const lista = (aba === "servicos" ? rankAtualServicos : aba === "semcodigo" ? [] : rankAtualProdutos)
    .map(item => ({
      ...item,
      valor: modoValor === "lucro" ? Math.max(0, item.receita - item.custo) : item.receita,
      label: item.codigo ? `${item.codigo} - ${item.descricao}` : item.descricao,
    }))
    .sort((a, b) => b.valor - a.valor);
  const totalAtual = aba === "semcodigo"
    ? [...semCodigoProdutos, ...semCodigoServicos].reduce((acc, i) => acc + i.valor, 0)
    : lista.reduce((acc, i) => acc + i.valor, 0);

  const listaFiltrada = lista.filter(i =>
    i.descricao.toLowerCase().includes(busca.toLowerCase())
  );
  const topChart = aba === "semcodigo" ? [] : lista.slice(0, 8);
  const listaExibida = mostrarTodos ? listaFiltrada : listaFiltrada.slice(0, 10);

  const semCodigoAtual = aba === "semcodigo"
    ? [...semCodigoProdutos.map(i => ({...i, tipo: 'PRODUTO'})), ...semCodigoServicos.map(i => ({...i, tipo: 'SERVIÇO'}))]
        .sort((a, b) => b.valor - a.valor)
    : [];
  const semCodigoFiltrado = semCodigoAtual.filter(i =>
    i.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    (i.venda_numero || '').toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-base">{modoValor === "lucro" ? "Lucro Real por Produto/Serviço" : "Receita por Produto/Serviço"}</h2>
        <span className="text-gray-400 text-xs">
          Total: <span className="text-green-400 font-bold">{fmt(totalAtual)}</span>
        </span>
      </div>

      {/* Toggle Receita / Lucro */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => { setModoValor("receita"); localStorage.setItem("eps_modoValor", "receita"); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={modoValor === "receita" ? { background: "#062C9B", color: "#fff" } : { color: "#9ca3af" }}
        >
          Receita Bruta
        </button>
        <button
          onClick={() => { setModoValor("lucro"); localStorage.setItem("eps_modoValor", "lucro"); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={modoValor === "lucro" ? { background: "#062C9B", color: "#fff" } : { color: "#9ca3af" }}
        >
          Lucro Real
        </button>
      </div>



      {/* Abas */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => { setAba("produtos"); localStorage.setItem("eps_aba", "produtos"); setMostrarTodos(false); setBusca(""); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={aba === "produtos" ? { background: "#062C9B", color: "#fff" } : { color: "#9ca3af" }}
        >
          Produtos ({rankProdutos.length})
        </button>
        <button
          onClick={() => { setAba("servicos"); localStorage.setItem("eps_aba", "servicos"); setMostrarTodos(false); setBusca(""); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={aba === "servicos" ? { background: "#062C9B", color: "#fff" } : { color: "#9ca3af" }}
        >
          Serviços ({rankServicos.length})
        </button>
        <button
          onClick={() => { setAba("semcodigo"); localStorage.setItem("eps_aba", "semcodigo"); setMostrarTodos(false); setBusca(""); }}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={aba === "semcodigo" ? { background: "#b91c1c", color: "#fff" } : { color: "#f87171" }}
        >
          Sem Código ({semCodigoProdutos.length + semCodigoServicos.length})
        </button>
      </div>

      {/* Gráfico top 8 */}
      {topChart.length > 0 && (
        <ResponsiveContainer width="100%" height={topChart.length * 26 + 10}>
          <BarChart data={topChart} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }} data-truncate={false}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={200} tick={{ fill: "#9ca3af", fontSize: 9, textAnchor: "end" }} axisLine={false} tickLine={false} />
            <Bar dataKey="valor" barSize={14} radius={[0, 4, 4, 0]} label={{ position: 'insideRight', formatter: (v) => fmt(v), fill: '#fff', fontSize: 10, dx: 75 }}>
              {topChart.map((_, i) => (
                <Cell key={i} fill={COLORS[Math.min(i, COLORS.length - 1)]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Diagnóstico: sem código */}
      {aba === "semcodigo" && (
        <div className="space-y-2">
          {semCodigoAtual.length === 0 ? (
            <p className="text-green-400 text-xs text-center py-4">Nenhum item sem código encontrado!</p>
          ) : (
            <>
              <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-xs text-red-300 mb-2">
                <span className="font-bold text-red-400">⚠ {semCodigoAtual.length} itens sem código</span> — valor total fora do ranking: <span className="text-red-300 font-bold">{fmt(totalAtual)}</span>
              </div>
              <input
                type="text"
                placeholder="Buscar venda ou descrição..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
              <div className="overflow-auto max-h-96">
                <table className="w-full text-xs text-gray-300">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-1 pr-2">Venda</th>
                      <th className="text-left py-1 pr-2">Cliente</th>
                      <th className="text-left py-1 pr-2">Descrição</th>
                      <th className="text-left py-1 pr-2">Tipo</th>
                      <th className="text-right py-1">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semCodigoFiltrado.map((item, i) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                        <td className="py-1 pr-2 text-blue-400 font-bold">{item.venda_numero}</td>
                        <td className="py-1 pr-2 text-gray-400">{item.cliente}</td>
                        <td className="py-1 pr-2 text-white">{item.descricao}</td>
                        <td className="py-1 pr-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${item.tipo === 'PRODUTO' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                            {item.tipo}
                          </span>
                        </td>
                        <td className="py-1 text-right text-green-400 font-bold">{fmt(item.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}