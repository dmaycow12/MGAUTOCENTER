import React from "react";

function F({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function SecaoPagamentoNF({ 
  form, 
  setForm, 
  vendas,
  FORMAS_PAGAMENTO,
  atualizarDadosAdicionais 
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <F label="Forma de Pagamento">
          <select value={form.forma_pagamento} onChange={e => {
            const novaForma = e.target.value;
            setForm(f => ({ ...f, forma_pagamento: novaForma }));
            atualizarDadosAdicionais(form, novaForma);
          }} className="input-dark">
            {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
          </select>
        </F>
        
        <F label="Nº Parcelas">
          <input type="number" value={form.parcelas || 1} onChange={e => {
            const novaQtd = parseInt(e.target.value) || 1;
            setForm(f => ({ ...f, parcelas: novaQtd }));
            setTimeout(() => atualizarDadosAdicionais({...form, parcelas: novaQtd}, form.forma_pagamento), 100);
          }} className="input-dark" min="1" max="48" />
        </F>

        <F label="Vinculada com Ordem de Venda">
          <select value={form.ordem_venda_id || ''} onChange={e => {
            const ovId = e.target.value;
            const ov = vendas.find(v => v.id === ovId);
            if (ov) {
              setForm(f => ({ ...f, ordem_venda_id: ovId }));
              setTimeout(() => atualizarDadosAdicionais({...form, ordem_venda_id: ovId}, form.forma_pagamento), 100);
            }
          }} className="input-dark">
            <option value="">— Nenhuma —</option>
            {vendas.filter(v => v.cliente_id === form.cliente_id).map(v => (
              <option key={v.id} value={v.id}>#{v.numero} - R$ {(v.valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</option>
            ))}
          </select>
        </F>
      </div>

      {/* Parcelas detalhes */}
      {form.parcelas > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-300">Parcelas</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Array.from({ length: parseInt(form.parcelas) || 1 }, (_, i) => {
              const valorParcela = form.valor_total / (parseInt(form.parcelas) || 1);
              return (
                <div key={i} className="flex gap-2 items-end text-xs">
                  <div className="flex-1">
                    <label className="block text-gray-400 mb-0.5">Vencimento {i+1}</label>
                    <input type="date" value={form[`parcela_${i}_vencimento`] || ''} onChange={e => {
                      setForm(f => ({ ...f, [`parcela_${i}_vencimento`]: e.target.value }));
                      setTimeout(() => atualizarDadosAdicionais({...form, [`parcela_${i}_vencimento`]: e.target.value}, form.forma_pagamento), 100);
                    }} className="input-dark w-full py-1" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-gray-400 mb-0.5">Valor (R$)</label>
                    <div className="input-dark text-gray-300 py-1 text-center">{valorParcela.toFixed(2)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <F label="Dados Adicionais">
        <textarea value={form.dados_adicionais || ''} onChange={e => setForm(f => ({ ...f, dados_adicionais: e.target.value }))}
          className="input-dark" rows={6} placeholder="Preenche automaticamente com: forma de pagamento, parcelas, datas, veículo e ordem de venda. Edite se necessário." autoComplete="off" />
      </F>

      <style>{`.input-dark{width:100%;background:#1f2937;border:1px solid #374151;color:#fff;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input-dark:focus{border-color:#f97316}.input-dark::placeholder{color:#6b7280}`}</style>
    </div>
  );
}