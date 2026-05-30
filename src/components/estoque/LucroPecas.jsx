import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function normalizarTipo(tipo) {
  if (!tipo) return "";
  return tipo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

const fmt = (v) => Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2});

export default function LucroPecas({ items }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const irMesAnterior = () => {
    if (mes === 0) { setMes(11); setAno(a => a - 1); }
    else setMes(m => m - 1);
  };
  const irProximoMes = () => {
    if (mes === 11) { setMes(0); setAno(a => a + 1); }
    else setMes(m => m + 1);
  };

  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59);
  const fmtData = (d) => d.toLocaleDateString("pt-BR");

  const dados = useMemo(() => {
    const resultado = [];
    for (const item of items) {
      const historico = item.historico || [];
      const saidas = historico.filter(h => {
        const tipo = normalizarTipo(h.tipo);
        if (tipo !== "saida") return false;
        const data = h.data ? new Date(h.data) : null;
        if (!data) return false;
        return data >= inicioMes && data <= fimMes;
      });
      if (saidas.length === 0) continue;

      const qtdVendida = saidas.reduce((s, h) => s + Number(h.quantidade || 0), 0);
      const receita = saidas.reduce((s, h) => s + Number(h.valor_unitario || 0) * Number(h.quantidade || 0), 0);
      const custo = Number(item.valor_custo || 0) * qtdVendida;
      const lucro = receita - custo;
      const margem = receita > 0 ? (lucro / receita) * 100 : 0;

      resultado.push({ item, qtdVendida, receita, custo, lucro, margem });
    }
    return resultado.sort((a, b) => b.lucro - a.lucro);
  }, [items, mes, ano]);

  const totais = useMemo(() => ({
    receita: dados.reduce((s, d) => s + d.receita, 0),
    custo: dados.reduce((s, d) => s + d.custo, 0),
    lucro: dados.reduce((s, d) => s + d.lucro, 0),
  }), [dados]);

  const margemTotal = totais.receita > 0 ? (totais.lucro / totais.receita) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Seletor de Mês */}
      <div className="flex gap-2">
        <div className="flex items-center flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <button onClick={irMesAnterior} className="px-3 py-3 hover:bg-gray-800 text-gray-400 hover:text-white transition-all flex-shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center text-sm font-bold text-white py-3">
            {MESES[mes]} - {ano}
          </div>
          <button onClick={irProximoMes} className="px-3 py-3 hover:bg-gray-800 text-gray-400 hover:text-white transition-all flex-shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl px-4 text-xs text-gray-400 whitespace-nowrap">
          {fmtData(inicioMes)} — {fmtData(fimMes)}
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Produtos Vendidos</p>
          <p className="text-white font-bold text-lg">{dados.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Receita Total</p>
          <p className="text-green-400 font-bold">R$ {fmt(totais.receita)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Custo Total</p>
          <p className="text-red-400 font-bold">R$ {fmt(totais.custo)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Lucro Bruto</p>
          <p className={`font-bold ${totais.lucro >= 0 ? "text-green-400" : "text-red-400"}`}>
            R$ {fmt(totais.lucro)}
            <span className="text-xs ml-1 font-normal text-gray-400">({margemTotal.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      {/* Tabela */}
      {dados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nenhuma venda registrada em {MESES[mes]} {ano}</p>
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
                  <th className="px-4 py-3 text-right">Custo</th>
                  <th className="px-4 py-3 text-right">Lucro</th>
                  <th className="px-4 py-3 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {dados.map(({ item, qtdVendida, receita, custo, lucro, margem }, idx) => (
                  <tr key={item.id} className={`border-b border-gray-800 transition-all hover:bg-gray-800/40 ${idx % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                    <td className="px-4 py-3 text-gray-600 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium text-xs">{item.descricao}</p>
                      {item.codigo && <p className="text-gray-600 font-mono text-[10px]">{item.codigo}</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-white font-semibold">{qtdVendida}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-medium">R$ {fmt(receita)}</td>
                    <td className="px-4 py-3 text-right text-red-400">R$ {fmt(custo)}</td>
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