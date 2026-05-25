import React, { useState } from "react";
import { X, Plus, Trash2, Package, History, ArrowDown, ArrowUp } from "lucide-react";

const GREEN = "#00ff00";

function sanitizar(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7F]/g, '').toUpperCase();
}
const arredondarVendaParaCinco = (valor) => Math.ceil(valor / 5) * 5;

function F({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function ModalEstoqueForm({ editando, form, setForm, onSalvar, onClose }) {
  const [aba, setAba] = useState("dados");
  const [novoCodigoInput, setNovoCodigoInput] = useState("");

  const codigos = form.codigos || [];
  const historico = [...(form.historico || [])].reverse(); // mais recente primeiro
  const originalLen = (form.historico || []).length;

  const excluirHistorico = (reversedIdx) => {
    const originalIdx = originalLen - 1 - reversedIdx;
    setForm(f => ({ ...f, historico: (f.historico || []).filter((_, i) => i !== originalIdx) }));
  };

  const adicionarCodigo = () => {
    const val = novoCodigoInput.trim().toUpperCase();
    if (!val || codigos.includes(val)) return;
    setForm(f => ({ ...f, codigos: [...(f.codigos || []), val] }));
    setNovoCodigoInput("");
  };

  const removerCodigo = (idx) => {
    setForm(f => ({ ...f, codigos: (f.codigos || []).filter((_, i) => i !== idx) }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-white font-semibold">{editando ? "Editar Item" : "Novo Item de Estoque"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-800 px-5 pt-3 gap-1 flex-shrink-0">
          <button onClick={() => setAba("dados")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all -mb-px ${aba === "dados" ? "bg-gray-800 text-white border border-gray-700 border-b-gray-800" : "text-gray-500 hover:text-gray-300"}`}>
            <Package className="w-4 h-4" /> Dados
          </button>
          {editando && (
            <button onClick={() => setAba("historico")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all -mb-px ${aba === "historico" ? "bg-gray-800 text-white border border-gray-700 border-b-gray-800" : "text-gray-500 hover:text-gray-300"}`}>
              <History className="w-4 h-4" /> Histórico {historico.length > 0 && <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded-full">{historico.length}</span>}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* ABA DADOS */}
          {aba === "dados" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Código Principal">
                  <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="input-dark" />
                </F>
                <F label="Quantidade">
                  <input type="text" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: Number(e.target.value.replace(/[^0-9.]/g, "") || 0) })} className="input-dark" />
                </F>
                <F label="Descrição *" className="col-span-2">
                  <input value={form.descricao} onChange={e => setForm({ ...form, descricao: sanitizar(e.target.value) })} className="input-dark" />
                </F>
                <F label="Marca">
                  <input value={form.marca || ""} onChange={e => setForm({ ...form, marca: e.target.value })} className="input-dark" />
                </F>
                <F label="Estoque Mínimo">
                  <input type="text" value={form.estoque_minimo} onChange={e => setForm({ ...form, estoque_minimo: Number(e.target.value.replace(/[^0-9.]/g, "") || 0) })} className="input-dark" />
                </F>
                <F label="Valor de Custo (R$)">
                  <input type="text" value={form.valor_custo} onChange={e => setForm({ ...form, valor_custo: Number(e.target.value.replace(/[^0-9.]/g, "") || 0) })} className="input-dark" />
                </F>
                <F label="Valor de Venda (R$)">
                  <input type="text" value={form.valor_venda} onChange={e => setForm({ ...form, valor_venda: arredondarVendaParaCinco(Number(e.target.value.replace(/[^0-9.]/g, "") || 0)) })} className="input-dark" />
                </F>
              </div>

              {/* Códigos adicionais */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Códigos Alternativos</p>
                <div className="flex gap-2 mb-2">
                  <input
                    value={novoCodigoInput}
                    onChange={e => setNovoCodigoInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && adicionarCodigo()}
                    className="input-dark flex-1"
                    placeholder="Digite um código adicional e pressione Enter"
                  />
                  <button onClick={adicionarCodigo}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-black flex-shrink-0 flex items-center gap-1"
                    style={{ background: GREEN }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {codigos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {codigos.map((cod, i) => (
                      <div key={i} className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1">
                        <span className="text-gray-300 font-mono text-xs">{cod}</span>
                        <button onClick={() => removerCodigo(i)} className="text-gray-500 hover:text-red-400 transition-all ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dados Fiscais */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Dados Fiscais</p>
                <div className="grid grid-cols-2 gap-4">
                  <F label="NCM">
                    <input value={form.ncm || ""} onChange={e => setForm({ ...form, ncm: e.target.value })} className="input-dark" placeholder="87089990" maxLength={8} />
                  </F>
                  <F label="CFOP">
                    <input value={form.cfop || ""} onChange={e => setForm({ ...form, cfop: e.target.value })} className="input-dark" placeholder="5405" maxLength={4} />
                  </F>
                  <F label="CEST" className="col-span-2">
                    <input value={form.cest || ""} onChange={e => setForm({ ...form, cest: e.target.value })} className="input-dark" />
                  </F>
                </div>
              </div>

              <F label="Observações">
                <textarea value={form.observacoes || ""} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input-dark" rows={2} />
              </F>
            </div>
          )}

          {/* ABA HISTÓRICO */}
          {aba === "historico" && (
            <div>
              {historico.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Nenhuma movimentação registrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-800/60">
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">Tipo</th>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">Data</th>
                        <th className="px-3 py-2 text-right text-gray-400 font-medium">Qtd</th>
                        <th className="px-3 py-2 text-right text-gray-400 font-medium">Valor Unit.</th>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">Fornecedor / O.V.</th>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">Observação</th>
                        <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                      {historico.map((mov, i) => {
                        const isEntrada = mov.tipo === "entrada";
                        return (
                          <tr key={i} className={`border-b border-gray-800/60 last:border-0 ${isEntrada ? "bg-green-500/5" : "bg-red-500/5"}`}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                {isEntrada
                                  ? <ArrowDown className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                  : <ArrowUp className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                                <span className={`font-bold uppercase ${isEntrada ? "text-green-400" : "text-red-400"}`}>
                                  {isEntrada ? "Entrada" : "Saída"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                              {mov.data ? new Date(mov.data).toLocaleDateString("pt-BR") : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-white font-medium">{mov.quantidade ?? "—"}</td>
                            <td className="px-3 py-2 text-right text-white font-medium whitespace-nowrap">
                              R$ {Number(mov.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-gray-300 max-w-[160px] truncate">
                              {isEntrada
                                ? (mov.fornecedor || "—")
                                : (mov.ordem_venda_numero ? `#${mov.ordem_venda_numero}` : "—")}
                            </td>
                            <td className="px-3 py-2 text-gray-500 italic max-w-[120px] truncate">
                              {mov.observacao || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => excluirHistorico(i)} className="text-gray-600 hover:text-red-400 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                            </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white rounded-lg transition-all" style={{ background: "#cc0000" }} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>Cancelar</button>
          <button onClick={onSalvar} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all" style={{ background: "#062C9B" }} onMouseEnter={e => e.currentTarget.style.background = "#041a4d"} onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}>
            {editando ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
      <style>{`.input-dark{width:100%;background:#1f2937;border:1px solid #374151;color:#fff;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input-dark:focus{border-color:#f97316}.input-dark::placeholder{color:#6b7280}`}</style>
    </div>
  );
}