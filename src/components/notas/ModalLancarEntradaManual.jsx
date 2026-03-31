import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, PlusCircle, MinusCircle, CheckCircle, AlertCircle } from "lucide-react";

function defaultItem() {
  return { descricao: "", codigo: "", estoque_id: "", quantidade: 1, valor_unitario: 0, valor_total: 0 };
}

const FORMAS = ["Boleto", "PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Transferência", "A Prazo"];

function parseItemsFromNota(nota) {
  if (!nota.xml_content) return [defaultItem()];
  try {
    const parsed = JSON.parse(nota.xml_content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(i => ({
        descricao: i.descricao || "",
        codigo: i.codigo || "",
        estoque_id: "",
        quantidade: Number(i.quantidade) || 1,
        valor_unitario: Number(i.valor_unitario) || 0,
        valor_total: Number(i.valor_total) || 0,
        ncm: i.ncm || "",
        cfop: i.cfop || "",
      }));
    }
  } catch {}
  return [defaultItem()];
}

export default function ModalLancarEntradaManual({ nota, estoque, onClose, onSalvo }) {
  const [aba, setAba] = useState("produtos");
  const [items, setItems] = useState(() => parseItemsFromNota(nota));
  const [formaPagamento, setFormaPagamento] = useState("Boleto");
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split("T")[0]);
  const [parcelas, setParcelas] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const totalItens = items.reduce((s, i) => s + (Number(i.valor_total) || 0), 0);

  const atualizarItem = (idx, campo, valor) => {
    setItems(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [campo]: valor };
      if (campo === "quantidade" || campo === "valor_unitario") {
        arr[idx].valor_total = Number(arr[idx].quantidade) * Number(arr[idx].valor_unitario);
      }
      if (campo === "valor_total") {
        arr[idx].valor_unitario = arr[idx].quantidade > 0
          ? Number(valor) / Number(arr[idx].quantidade)
          : Number(valor);
      }
      return arr;
    });
  };

  const selecionarEstoque = (idx, id) => {
    const prod = estoque.find(p => p.id === id);
    if (!prod) { atualizarItem(idx, "estoque_id", ""); return; }
    setItems(prev => {
      const arr = [...prev];
      arr[idx] = {
        ...arr[idx],
        estoque_id: prod.id,
        descricao: prod.descricao || "",
        codigo: prod.codigo || "",
        valor_unitario: prod.valor_custo || 0,
        valor_total: (prod.valor_custo || 0) * Number(arr[idx].quantidade),
      };
      return arr;
    });
  };

  const confirmar = async () => {
    if (items.some(i => !i.descricao?.trim())) {
      setMsg({ tipo: "erro", texto: "Preencha a descrição de todos os itens." });
      return;
    }
    setSalvando(true);
    try {
      const total = totalItens || nota.valor_total || 0;
      const valorParcela = parseFloat((total / Math.max(1, parcelas)).toFixed(2));

      // Criar lançamentos financeiros (Despesa)
      for (let p = 1; p <= parcelas; p++) {
        const d = new Date(dataVencimento + "T00:00:00");
        d.setMonth(d.getMonth() + (p - 1));
        await base44.entities.Financeiro.create({
          tipo: "Despesa",
          categoria: "Compra de Peças",
          descricao: `NF ${nota.numero || nota.id.slice(-6)} — ${nota.cliente_nome || "Fornecedor"} — Parcela ${p}/${parcelas}`,
          valor: valorParcela,
          data_vencimento: d.toISOString().split("T")[0],
          status: "Pendente",
          forma_pagamento: formaPagamento,
          ordem_servico_id: "",
          cliente_id: nota.cliente_id || "",
        });
      }

      // Dar entrada no estoque para itens vinculados
      for (const item of items) {
        if (item.estoque_id) {
          const prod = estoque.find(p => p.id === item.estoque_id);
          if (prod) {
            const novaQtd = Number(prod.quantidade || 0) + Number(item.quantidade || 0);
            await base44.entities.Estoque.update(item.estoque_id, { quantidade: novaQtd });
          }
        }
      }

      // Salvar itens na nota e marcar como processada
      await base44.entities.NotaFiscal.update(nota.id, {
        xml_content: JSON.stringify(items),
        observacoes: (nota.observacoes || "") + " [Lançada manualmente]",
      });

      setMsg({ tipo: "sucesso", texto: "Lançamento realizado com sucesso!" });
      setTimeout(() => { onSalvo?.(); }, 1500);
    } catch (e) {
      setMsg({ tipo: "erro", texto: "Erro: " + e.message });
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Lançar Nota de Entrada</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              NF {nota.tipo} nº {nota.numero || "—"} — {nota.cliente_nome || "Fornecedor"}
            </p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Feedback */}
        {msg && (
          <div className={`mx-5 mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${msg.tipo === "sucesso" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {msg.tipo === "sucesso" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.texto}
          </div>
        )}

        {/* Abas */}
        <div className="px-5 pt-4 flex gap-1 border-b border-gray-800 flex-shrink-0">
          {[["produtos", "1. Produtos"], ["pagamento", "2. Pagamento"]].map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all -mb-px ${aba === id ? "bg-gray-800 text-white border border-gray-700 border-b-gray-800" : "text-gray-500 hover:text-gray-300"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ABA PRODUTOS */}
          {aba === "produtos" && (
            <>
              <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                Adicione os produtos desta nota. Se vinculados ao estoque, a quantidade será incrementada automaticamente.
              </p>
              {items.map((item, idx) => (
                <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300">
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Vincular ao Estoque (opcional)</label>
                    <select className="input-dark" value={item.estoque_id} onChange={e => selecionarEstoque(idx, e.target.value)}>
                      <option value="">— Selecione para vincular —</option>
                      {estoque.map(p => (
                        <option key={p.id} value={p.id}>{p.descricao}{p.codigo ? ` (${p.codigo})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 mb-1 block">Descrição *</label>
                      <input className="input-dark" value={item.descricao}
                        onChange={e => atualizarItem(idx, "descricao", e.target.value)}
                        placeholder="Descrição do produto" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Quantidade</label>
                      <input type="number" className="input-dark" value={item.quantidade}
                        onChange={e => atualizarItem(idx, "quantidade", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Valor Unitário (R$)</label>
                      <input type="number" className="input-dark" value={item.valor_unitario}
                        onChange={e => atualizarItem(idx, "valor_unitario", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 mb-1 block">Total (R$)</label>
                      <input type="number" className="input-dark" value={item.valor_total}
                        onChange={e => atualizarItem(idx, "valor_total", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setItems(p => [...p, defaultItem()])}
                className="flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm transition-all">
                <PlusCircle className="w-4 h-4" /> Adicionar item
              </button>
              <div className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
                <span className="text-gray-400 font-medium text-sm">Total dos Itens</span>
                <span className="text-xl font-bold text-green-400">
                  R$ {totalItens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setAba("pagamento")}
                  className="px-6 py-2 text-sm text-black rounded-lg font-medium"
                  style={{ background: "#00ff00" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
                  onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
                  Próximo: Pagamento →
                </button>
              </div>
            </>
          )}

          {/* ABA PAGAMENTO */}
          {aba === "pagamento" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Forma de Pagamento</label>
                  <select className="input-dark" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
                    {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Vencimento (1ª parcela)</label>
                  <input type="date" className="input-dark" value={dataVencimento}
                    onChange={e => setDataVencimento(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Número de Parcelas</label>
                  <input type="number" className="input-dark" min={1} max={24} value={parcelas}
                    onChange={e => setParcelas(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2 text-sm">
                <h3 className="text-white font-medium">Resumo do Lançamento</h3>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-gray-500">Fornecedor</span><span className="text-white">{nota.cliente_nome || "—"}</span>
                  <span className="text-gray-500">Nota</span><span className="text-white">{nota.tipo} nº {nota.numero || "—"}</span>
                  <span className="text-gray-500">Itens</span><span className="text-white">{items.length} produto(s)</span>
                  <span className="text-gray-500">Pagamento</span><span className="text-white">{formaPagamento} — {parcelas}x</span>
                  <span className="text-gray-500 font-semibold">Total</span>
                  <span className="text-green-400 font-bold text-lg">
                    R$ {(totalItens || nota.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setAba("produtos")}
                  className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">
                  ← Voltar
                </button>
                <button onClick={confirmar} disabled={salvando}
                  className="px-6 py-2 text-sm text-black rounded-lg font-medium disabled:opacity-50"
                  style={{ background: "#00ff00" }}
                  onMouseEnter={e => !salvando && (e.currentTarget.style.background = "#00dd00")}
                  onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
                  {salvando ? "Lançando..." : "Confirmar Lançamento"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`.input-dark{width:100%;background:#1f2937;border:1px solid #374151;color:#fff;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input-dark:focus{border-color:#f97316}`}</style>
    </div>
  );
}