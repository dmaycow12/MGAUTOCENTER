import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2 } from "lucide-react";

const defaultForm = () => ({
  numero: "",
  status: "Orçamento",
  cliente_id: "",
  cliente_nome: "",
  cliente_telefone: "",
  veiculo_id: "",
  veiculo_placa: "",
  veiculo_modelo: "",
  veiculo_ano: "",
  quilometragem: "",
  data_entrada: new Date().toISOString().split("T")[0],
  data_previsao: "",
  data_conclusao: "",
  defeito_relatado: "",
  diagnostico: "",
  servicos: [],
  pecas: [],
  valor_servicos: 0,
  valor_pecas: 0,
  desconto: 0,
  valor_total: 0,
  forma_pagamento: "",
  parcelas: 1,
  observacoes: "",
});

export default function OSForm({ os, clientes, veiculos, onClose, onSave }) {
  const [form, setForm] = useState(os ? { ...defaultForm(), ...os } : defaultForm());
  const [saving, setSaving] = useState(false);
  const [veiculosCliente, setVeiculosCliente] = useState([]);

  // Auto-number for new OS — sequencial a partir de 1
  useEffect(() => {
    if (!os) {
      base44.entities.OrdemServico.list("-created_date", 500).then(all => {
        const nums = all.map(o => parseInt(o.numero, 10)).filter(n => !isNaN(n));
        const proximo = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        setForm(f => ({ ...f, numero: String(proximo) }));
      });
    }
  }, []);

  useEffect(() => {
    if (form.cliente_id) {
      setVeiculosCliente(veiculos.filter(v => v.cliente_id === form.cliente_id));
    }
  }, [form.cliente_id, veiculos]);

  const onClienteChange = (clienteId) => {
    const c = clientes.find(c => c.id === clienteId);
    const primeiroNome = c?.nome ? c.nome.split(" ")[0] : "";
    setForm(f => ({
      ...f,
      cliente_id: clienteId,
      cliente_nome: primeiroNome,
      cliente_telefone: c?.telefone || "",
      veiculo_id: "",
      veiculo_placa: "",
      veiculo_modelo: "",
      veiculo_ano: "",
    }));
  };

  const onVeiculoChange = (veiculoId) => {
    const v = veiculos.find(v => v.id === veiculoId);
    setForm(f => ({
      ...f,
      veiculo_id: veiculoId,
      veiculo_placa: v?.placa || "",
      veiculo_modelo: `${v?.marca || ""} ${v?.modelo || ""}`.trim(),
      veiculo_ano: v?.ano || "",
    }));
  };

  const recalcular = (servicos, pecas, desconto) => {
    const vs = (servicos || []).reduce((acc, s) => acc + Number(s.valor || 0), 0);
    const vp = (pecas || []).reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
    const total = vs + vp - Number(desconto || 0);
    return { valor_servicos: vs, valor_pecas: vp, valor_total: Math.max(0, total) };
  };

  const addServico = () => {
    const novos = [...(form.servicos || []), { descricao: "", valor: 0, tecnico: "" }];
    setForm(f => ({ ...f, servicos: novos, ...recalcular(novos, f.pecas, f.desconto) }));
  };

  const updateServico = (i, field, val) => {
    const novos = form.servicos.map((s, idx) => idx === i ? { ...s, [field]: field === "valor" ? Number(val) : val } : s);
    setForm(f => ({ ...f, servicos: novos, ...recalcular(novos, f.pecas, f.desconto) }));
  };

  const removeServico = (i) => {
    const novos = form.servicos.filter((_, idx) => idx !== i);
    setForm(f => ({ ...f, servicos: novos, ...recalcular(novos, f.pecas, f.desconto) }));
  };

  const addPeca = () => {
    const novos = [...(form.pecas || []), { descricao: "", quantidade: 1, valor_unitario: 0, valor_total: 0 }];
    setForm(f => ({ ...f, pecas: novos, ...recalcular(f.servicos, novos, f.desconto) }));
  };

  const updatePeca = (i, field, val) => {
    const novos = form.pecas.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, [field]: ["quantidade", "valor_unitario"].includes(field) ? Number(val) : val };
      updated.valor_total = Number(updated.quantidade || 0) * Number(updated.valor_unitario || 0);
      return updated;
    });
    setForm(f => ({ ...f, pecas: novos, ...recalcular(f.servicos, novos, f.desconto) }));
  };

  const removePeca = (i) => {
    const novos = form.pecas.filter((_, idx) => idx !== i);
    setForm(f => ({ ...f, pecas: novos, ...recalcular(f.servicos, novos, f.desconto) }));
  };

  const onDesconto = (val) => {
    const d = Number(val) || 0;
    setForm(f => ({ ...f, desconto: d, ...recalcular(f.servicos, f.pecas, d) }));
  };

  const salvar = async () => {
    if (!form.cliente_nome && !form.cliente_id) return alert("Selecione ou informe o cliente.");
    setSaving(true);
    if (os) {
      await base44.entities.OrdemServico.update(os.id, form);
    } else {
      await base44.entities.OrdemServico.create(form);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{os ? `Editar OS #${os.numero}` : "Nova Ordem de Serviço"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Header Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Número OS">
              <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className="input-dark" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input-dark">
                {["Em Aberto","Concluída","Cancelada"].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Data Entrada">
              <input type="date" value={form.data_entrada} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} className="input-dark" />
            </Field>
          </div>

          {/* Cliente */}
          <Section title="Cliente">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Selecionar Cliente">
                <select value={form.cliente_id} onChange={e => onClienteChange(e.target.value)} className="input-dark">
                  <option value="">— Selecione —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
              <Field label="Nome do Cliente">
                <input value={form.cliente_nome ? form.cliente_nome.split(" ")[0] : ""} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} className="input-dark" placeholder="Ou digite manualmente" />
              </Field>
            </div>
          </Section>

          {/* Veículo */}
          <Section title="Veículo">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {form.cliente_id && veiculosCliente.length > 0 && (
                <Field label="Selecionar Veículo" className="col-span-2 md:col-span-4">
                  <select value={form.veiculo_id} onChange={e => onVeiculoChange(e.target.value)} className="input-dark">
                    <option value="">— Selecione —</option>
                    {veiculosCliente.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo} {v.ano}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Modelo">
                <input value={form.veiculo_modelo} onChange={e => setForm(f => ({ ...f, veiculo_modelo: e.target.value }))} className="input-dark" />
              </Field>
              <Field label="Placa">
                <input value={form.veiculo_placa} onChange={e => setForm(f => ({ ...f, veiculo_placa: e.target.value }))} className="input-dark" placeholder="AAA0000" />
              </Field>
              <Field label="Ano">
                <input value={form.veiculo_ano} onChange={e => setForm(f => ({ ...f, veiculo_ano: e.target.value }))} className="input-dark" />
              </Field>
              <Field label="KM">
                <input type="number" value={form.quilometragem} onChange={e => setForm(f => ({ ...f, quilometragem: e.target.value }))} className="input-dark" />
              </Field>
            </div>
          </Section>

          {/* Defeito / Diagnóstico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Defeito Relatado">
              <textarea value={form.defeito_relatado} onChange={e => setForm(f => ({ ...f, defeito_relatado: e.target.value }))} className="input-dark" rows={2} />
            </Field>
            <Field label="Diagnóstico">
              <textarea value={form.diagnostico} onChange={e => setForm(f => ({ ...f, diagnostico: e.target.value }))} className="input-dark" rows={2} />
            </Field>
          </div>

          {/* Serviços */}
          <Section title="Serviços">
            {(form.servicos || []).length > 0 && (
              <div className="mb-2">
                <div className="grid grid-cols-[90px_1fr_70px_90px_80px_32px] gap-2 mb-1 px-1">
                  <span className="text-xs text-gray-500">Código</span>
                  <span className="text-xs text-gray-500">Nome do Serviço</span>
                  <span className="text-xs text-gray-500">Qtd</span>
                  <span className="text-xs text-gray-500">Valor Unit.</span>
                  <span className="text-xs text-gray-500 text-right">Total</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {(form.servicos || []).map((s, i) => (
                    <div key={i} className="grid grid-cols-[90px_1fr_70px_90px_80px_32px] gap-2 items-center">
                      <input value={s.codigo || ""} onChange={e => updateServico(i, "codigo", e.target.value)} className="input-dark" placeholder="Código" />
                      <input value={s.descricao} onChange={e => updateServico(i, "descricao", e.target.value)} className="input-dark" placeholder="Nome do serviço" />
                      <input type="number" value={s.quantidade ?? 1} onChange={e => updateServico(i, "quantidade", e.target.value)} className="input-dark" placeholder="Qtd" min="1" />
                      <input type="number" value={s.valor} onChange={e => updateServico(i, "valor", e.target.value)} className="input-dark" placeholder="R$ 0,00" />
                      <span className="text-gray-300 text-xs text-right">R$ {(Number(s.valor || 0) * Number(s.quantidade ?? 1)).toFixed(2)}</span>
                      <button onClick={() => removeServico(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={addServico} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </Section>

          {/* Peças */}
          <Section title="Peças">
            {(form.pecas || []).length > 0 && (
              <div className="mb-2">
                <div className="grid grid-cols-[90px_1fr_70px_90px_80px_32px] gap-2 mb-1 px-1">
                  <span className="text-xs text-gray-500">Código</span>
                  <span className="text-xs text-gray-500">Nome da Peça</span>
                  <span className="text-xs text-gray-500">Qtd</span>
                  <span className="text-xs text-gray-500">Valor Unit.</span>
                  <span className="text-xs text-gray-500 text-right">Total</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {(form.pecas || []).map((p, i) => (
                    <div key={i} className="grid grid-cols-[90px_1fr_70px_90px_80px_32px] gap-2 items-center">
                      <input value={p.codigo || ""} onChange={e => updatePeca(i, "codigo", e.target.value)} className="input-dark" placeholder="Código" />
                      <input value={p.descricao} onChange={e => updatePeca(i, "descricao", e.target.value)} className="input-dark" placeholder="Nome da peça" />
                      <input type="number" value={p.quantidade} onChange={e => updatePeca(i, "quantidade", e.target.value)} className="input-dark" placeholder="Qtd" />
                      <input type="number" value={p.valor_unitario} onChange={e => updatePeca(i, "valor_unitario", e.target.value)} className="input-dark" placeholder="R$ 0,00" />
                      <span className="text-gray-300 text-xs text-right">R$ {Number(p.valor_total || 0).toFixed(2)}</span>
                      <button onClick={() => removePeca(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={addPeca} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </Section>

          {/* Totais e Pagamento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Desconto (R$)">
              <input type="number" value={form.desconto} onChange={e => onDesconto(e.target.value)} className="input-dark" />
            </Field>
            <Field label="Forma de Pagamento">
              <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))} className="input-dark">
                <option value="">—</option>
                {["Dinheiro","Cartão de Crédito","Cartão de Débito","PIX","Boleto","Transferência","A Prazo"].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Parcelas">
              <input type="number" value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} className="input-dark" min={1} />
            </Field>
            <Field label="Total Geral">
              <div className="input-dark font-bold text-orange-400 pointer-events-none">
                R$ {Number(form.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </Field>
          </div>

          <Field label="Observações">
            <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className="input-dark" rows={2} />
          </Field>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-all">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all disabled:opacity-50">
            {saving ? "Salvando..." : os ? "Salvar Alterações" : "Criar OS"}
          </button>
        </div>
      </div>

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; }`}</style>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white border-b border-gray-700 pb-2 flex-1">{title}</h3>
        {action && <div className="ml-3">{action}</div>}
      </div>
      {children}
    </div>
  );
}