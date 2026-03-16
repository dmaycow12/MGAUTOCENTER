import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, AlertTriangle, Camera, Image } from "lucide-react";

// Input que BLOQUEIA autocomplete do browser usando readonly trick
function NoAutoInput({ value, onChange, className, placeholder, type = "text", disabled, name, ...props }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  return (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={onChange}
      className={className}
      placeholder={focused ? placeholder : ""}
      disabled={disabled}
      readOnly={!focused}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      autoComplete="new-password"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck="false"
      name={name || `f_${Math.random()}`}
      {...props}
    />
  );
}
import { reduzirEstoque, restaurarEstoque, excluirLancamentosOS } from "./estoqueUtils";

const defaultForm = () => ({
  numero: "",
  status: "Aberto",
  cliente_id: "",
  cliente_nome: "",
  cliente_telefone: "",
  cliente_email: "",
  cliente_cpf_cnpj: "",
  cliente_endereco: "",
  cliente_bairro: "",
  cliente_cidade: "",
  cliente_estado: "",
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
  forma_pagamento: "A Combinar",
  parcelas: 1,
  parcelas_detalhes: [],
  fotos: [],
  observacoes: "",
});

function gerarParcelas(total, qtd, formaPagamento, dataBase) {
  const valorParcela = total / Math.max(1, qtd);
  const base = dataBase ? new Date(dataBase + "T00:00:00") : new Date();
  return Array.from({ length: qtd }, (_, i) => {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    return {
      numero: i + 1,
      valor: parseFloat(valorParcela.toFixed(2)),
      vencimento: d.toISOString().split("T")[0],
      forma_pagamento: formaPagamento || "Dinheiro",
    };
  });
}

export default function OSForm({ os, clientes, veiculos, onClose, onSave }) {
  const isConcluida = os?.status === "Concluído";
  const [form, setForm] = useState(os ? { ...defaultForm(), ...os, fotos: os.fotos || [] } : defaultForm());
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const handleFotoUpload = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, fotos: [...(f.fotos || []), file_url] }));
    setUploadingFoto(false);
  };

  const removerFoto = (idx) => {
    setForm(f => ({ ...f, fotos: f.fotos.filter((_, i) => i !== idx) }));
  };
  const [veiculosCliente, setVeiculosCliente] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [servicosCad, setServicosCad] = useState([]);
  const [produtoSugestoes, setProdutoSugestoes] = useState({ idx: null, lista: [] });
  const [servicoSugestoes, setServicoSugestoes] = useState({ idx: null, lista: [] });
  const [showAvisoReabrir, setShowAvisoReabrir] = useState(false);
  const [statusPendente, setStatusPendente] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Estoque.list("-created_date", 500),
      base44.entities.Servico.list("-created_date", 500),
    ]).then(([e, s]) => { setEstoque(e); setServicosCad(s); });
  }, []);

  useEffect(() => {
    if (!os) {
      base44.entities.OrdemServico.list("-created_date", 500).then(all => {
        const nums = all.map(o => parseInt(o.numero, 10)).filter(n => !isNaN(n));
        const proximo = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        setForm(f => ({ ...f, numero: String(proximo) }));
      });
    }
  }, []);

  // Seleciona CONSUMIDOR como cliente padrão em nova OS
  useEffect(() => {
    if (!os && clientes.length > 0) {
      const consumidor = clientes.find(c => c.nome?.toUpperCase() === "CONSUMIDOR");
      if (consumidor) onClienteChange(consumidor.id);
    }
  }, [clientes]);

  useEffect(() => {
    if (form.cliente_id) {
      setVeiculosCliente(veiculos.filter(v => v.cliente_id === form.cliente_id));
    }
  }, [form.cliente_id, veiculos]);

  const onClienteChange = (clienteId) => {
    const c = clientes.find(c => c.id === clienteId);
    const end = [c?.endereco, c?.numero].filter(Boolean).join(", ");
    setForm(f => ({
      ...f,
      cliente_id: clienteId,
      cliente_nome: c?.nome || "",
      cliente_telefone: c?.telefone || "",
      cliente_email: c?.email || "",
      cliente_cpf_cnpj: c?.cpf_cnpj || "",
      cliente_endereco: end,
      cliente_bairro: c?.bairro || "",
      cliente_cidade: c?.cidade || "",
      cliente_estado: c?.estado || "",
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
    const vs = (servicos || []).reduce((acc, s) => acc + Number(s.valor || 0) * Number(s.quantidade ?? 1), 0);
    const vp = (pecas || []).reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
    const total = vs + vp - Number(desconto || 0);
    return { valor_servicos: vs, valor_pecas: vp, valor_total: Math.max(0, total) };
  };

  const addServico = () => {
    const novos = [...(form.servicos || []), { codigo: "", descricao: "", quantidade: 1, valor: 0 }];
    setForm(f => ({ ...f, servicos: novos, ...recalcular(novos, f.pecas, f.desconto) }));
  };

  const updateServico = (i, field, val) => {
    const novos = form.servicos.map((s, idx) => idx === i ? { ...s, [field]: field === "valor" ? Number(val) : val } : s);
    const campo = field === "codigo" || field === "descricao" ? val : null;
    if (campo && campo.length > 0) {
      const filtro = servicosCad.filter(s =>
        s.codigo?.toLowerCase().includes(campo.toLowerCase()) ||
        s.descricao?.toLowerCase().includes(campo.toLowerCase())
      ).slice(0, 6);
      setServicoSugestoes({ idx: i, lista: filtro });
    } else if (campo === "") {
      setServicoSugestoes({ idx: null, lista: [] });
    }
    setForm(f => ({ ...f, servicos: novos, ...recalcular(novos, f.pecas, f.desconto) }));
  };

  const selecionarServico = (i, item) => {
    const novos = form.servicos.map((s, idx) => idx === i ? { ...s, codigo: item.codigo || "", descricao: item.descricao || "", valor: Number(item.valor || 0) } : s);
    setServicoSugestoes({ idx: null, lista: [] });
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
    const campo = field === "codigo" || field === "descricao" ? val : null;
    if (campo && campo.length > 0) {
      const filtro = estoque.filter(e =>
        e.codigo?.toLowerCase().includes(campo.toLowerCase()) ||
        e.descricao?.toLowerCase().includes(campo.toLowerCase())
      ).slice(0, 6);
      setProdutoSugestoes({ idx: i, lista: filtro });
    } else if (campo === "") {
      setProdutoSugestoes({ idx: null, lista: [] });
    }
    setForm(f => ({ ...f, pecas: novos, ...recalcular(f.servicos, novos, f.desconto) }));
  };

  const selecionarProduto = (i, item) => {
    const novos = form.pecas.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, estoque_id: item.id, codigo: item.codigo || "", descricao: item.descricao || "", valor_unitario: Number(item.valor_venda || 0) };
      updated.valor_total = Number(updated.quantidade || 1) * Number(updated.valor_unitario || 0);
      return updated;
    });
    setProdutoSugestoes({ idx: null, lista: [] });
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

  // Recalcula parcelas automaticamente quando valor ou quantidade de parcelas muda
  useEffect(() => {
    setForm(f => {
      const detalhes = gerarParcelas(f.valor_total, Number(f.parcelas) || 1, f.forma_pagamento, f.data_entrada);
      return { ...f, parcelas_detalhes: detalhes };
    });
  }, [form.valor_total, form.parcelas]);

  const updateParcela = (i, field, val) => {
    setForm(f => {
      if (field === "valor") {
        const novoValor = Number(val) || 0;
        const valorAnterior = Number(f.parcelas_detalhes[i]?.valor || 0);
        const diferenca = novoValor - valorAnterior;
        const outrasParcelasCount = f.parcelas_detalhes.length - 1;
        const ajusteDistribuido = outrasParcelasCount > 0 ? diferenca / outrasParcelasCount : 0;

        const novos = f.parcelas_detalhes.map((p, idx) => {
          if (idx === i) return { ...p, valor: novoValor };
          return { ...p, valor: Math.max(0, Number(p.valor || 0) - ajusteDistribuido) };
        });
        return { ...f, parcelas_detalhes: novos };
      } else {
        const novos = f.parcelas_detalhes.map((p, idx) =>
          idx === i ? { ...p, [field]: val } : p
        );
        return { ...f, parcelas_detalhes: novos };
      }
    });
  };

  const onStatusChange = (novoStatus) => {
    // Se está tentando sair de Concluído para outra coisa, mostrar aviso
    if (form.status === "Concluído" && novoStatus !== "Concluído") {
      setStatusPendente(novoStatus);
      setShowAvisoReabrir(true);
      return;
    }
    setForm(f => ({ ...f, status: novoStatus }));
  };

  const confirmarReabrir = async () => {
    if (os?.id) {
      await excluirLancamentosOS(os.id);
      await restaurarEstoque(os.pecas);
    }
    setForm(f => ({ ...f, status: statusPendente }));
    setShowAvisoReabrir(false);
    setStatusPendente(null);
  };

  const gerarLancamentosFinanceiros = async (osData) => {
    const formaPrincipal = osData.forma_pagamento || "A Combinar";
    const pagoNaHora = ["Dinheiro", "PIX"].includes(formaPrincipal);

    const parcelas = osData.parcelas_detalhes && osData.parcelas_detalhes.length > 0
      ? osData.parcelas_detalhes
      : gerarParcelas(osData.valor_total, Number(osData.parcelas) || 1, formaPrincipal, osData.data_entrada);

    for (const p of parcelas) {
      await base44.entities.Financeiro.create({
        tipo: "Receita",
        categoria: "Ordem de Serviço",
        descricao: `OS #${osData.numero} — ${osData.cliente_nome || ""} — Parcela ${p.numero}/${parcelas.length}`,
        valor: p.valor,
        data_vencimento: p.vencimento,
        status: pagoNaHora ? "Pago" : "Pendente",
        data_pagamento: pagoNaHora ? new Date().toISOString().split("T")[0] : "",
        forma_pagamento: formaPrincipal,
        ordem_servico_id: osData.id || "",
        cliente_id: osData.cliente_id || "",
      });
    }
  };

  const salvar = async () => {
    if (!form.cliente_nome && !form.cliente_id) return alert("Selecione ou informe o cliente.");
    setSaving(true);

    try {
      // Validar número duplicado (apenas na criação)
      if (!os) {
        const todas = await base44.entities.OrdemServico.list("-created_date", 500);
        const existe = todas.some(o => String(o.numero).trim() === String(form.numero).trim());
        if (existe) {
          alert(`Já existe uma Ordem de Venda com o número #${form.numero}. Use outro número.`);
          setSaving(false);
          return;
        }
      }

      const eraAberta = os?.status !== "Concluído";
      const ficouConcluida = form.status === "Concluído";

      let savedId = os?.id;

      const formToSave = {
        ...form,
        quilometragem: form.quilometragem === "" || form.quilometragem === null || form.quilometragem === undefined
          ? null
          : Number(form.quilometragem),
      };

      if (os) {
        await base44.entities.OrdemServico.update(os.id, formToSave);
      } else {
        const criada = await base44.entities.OrdemServico.create(formToSave);
        savedId = criada.id;

        // Auto-registra veículo se for nova OS (exceto CONSUMIDOR)
        if (form.veiculo_placa && form.cliente_id && form.cliente_nome?.toUpperCase() !== "CONSUMIDOR") {
          const veiculo_marca = form.veiculo_modelo?.split(" ")[0] || "";
          const veiculo_modelo = form.veiculo_modelo?.substring(veiculo_marca.length).trim() || "";
          await base44.functions.invoke('autoRegistrarVeiculo', {
            cliente_id: form.cliente_id,
            veiculo_placa: form.veiculo_placa,
            veiculo_marca,
            veiculo_modelo,
            veiculo_ano: form.veiculo_ano,
          });
        }
      }

      // Gera lançamentos financeiros e baixa estoque se mudou para Concluída
      if (eraAberta && ficouConcluida && savedId) {
        await gerarLancamentosFinanceiros({ ...form, id: savedId });
        await reduzirEstoque(form.pecas);
      }

      onSave();
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <>
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4 pt-8">
      <form autoComplete="off" onSubmit={e => e.preventDefault()} className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{os ? `Ordem de Venda #${os.numero}` : "Nova Ordem de Venda"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Aviso OS Concluído — só pode mudar status */}
         {isConcluida && (
           <div className="mx-5 mt-4 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-400 text-sm">
             <AlertTriangle className="w-5 h-5 flex-shrink-0" />
             <span>OS Concluído — apenas o status pode ser alterado. Para editar, mude o status para <b>Aberto</b>.</span>
           </div>
         )}

        <div className="p-5 space-y-5">
          {/* Header Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Número OS">
              <NoAutoInput value={form.numero} disabled={isConcluida} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className={`input-dark ${isConcluida ? "opacity-50 cursor-not-allowed" : ""}`} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => onStatusChange(e.target.value)} className="input-dark">
                {["Aberto", "Orçamento", "Concluído"].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Data Entrada">
              <input type="date" value={form.data_entrada} disabled={isConcluida} autoComplete="off" onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} className={`input-dark ${isConcluida ? "opacity-50 cursor-not-allowed" : ""}`} />
            </Field>
          </div>

          {!isConcluida && (
            <>
              {/* Cliente */}
              <Section title="Cliente">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Selecionar Cliente">
                    <select value={form.cliente_id} onChange={e => onClienteChange(e.target.value)} className="input-dark">
                      {clientes.filter(c => c.id !== form.cliente_id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Field>
                  <Field label="Nome Social / Nome Fantasia">
                    <NoAutoInput value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} className="input-dark" placeholder="Ou digite manualmente" />
                  </Field>
                  <Field label="Telefone / WhatsApp">
                    <NoAutoInput value={form.cliente_telefone} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))} className="input-dark" placeholder="(XX) XXXXX-XXXX" />
                  </Field>
                  <Field label="E-mail">
                    <NoAutoInput value={form.cliente_email} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} className="input-dark" placeholder="email@exemplo.com" />
                  </Field>
                  <Field label="CPF / CNPJ">
                    <NoAutoInput value={form.cliente_cpf_cnpj} onChange={e => setForm(f => ({ ...f, cliente_cpf_cnpj: e.target.value }))} className="input-dark" placeholder="000.000.000-00" />
                  </Field>
                  <Field label="Endereço">
                    <NoAutoInput value={form.cliente_endereco || ""} onChange={e => setForm(f => ({ ...f, cliente_endereco: e.target.value }))} className="input-dark" placeholder="Rua, número" />
                  </Field>
                  <Field label="Bairro">
                    <NoAutoInput value={form.cliente_bairro || ""} onChange={e => setForm(f => ({ ...f, cliente_bairro: e.target.value }))} className="input-dark" placeholder="Bairro" />
                  </Field>
                  <Field label="Cidade">
                    <NoAutoInput value={form.cliente_cidade || ""} onChange={e => setForm(f => ({ ...f, cliente_cidade: e.target.value }))} className="input-dark" placeholder="Cidade" />
                  </Field>
                  <Field label="Estado">
                    <NoAutoInput value={form.cliente_estado || ""} onChange={e => setForm(f => ({ ...f, cliente_estado: e.target.value }))} className="input-dark" placeholder="UF" />
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
                    <NoAutoInput value={form.veiculo_modelo} onChange={e => setForm(f => ({ ...f, veiculo_modelo: e.target.value }))} className="input-dark" />
                  </Field>
                  <Field label="Placa">
                    <NoAutoInput value={form.veiculo_placa} onChange={e => setForm(f => ({ ...f, veiculo_placa: e.target.value }))} className="input-dark" placeholder="AAA0000" />
                  </Field>
                  <Field label="KM">
                    <NoAutoInput value={form.quilometragem} onChange={e => setForm(f => ({ ...f, quilometragem: e.target.value }))} className="input-dark" />
                  </Field>
                </div>
              </Section>

              {/* Defeito / Diagnóstico */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Defeito Relatado">
                  <textarea value={form.defeito_relatado} autoComplete="off" onChange={e => setForm(f => ({ ...f, defeito_relatado: e.target.value }))} className="input-dark" rows={2} />
                </Field>
                <Field label="Diagnóstico">
                  <textarea value={form.diagnostico} autoComplete="off" onChange={e => setForm(f => ({ ...f, diagnostico: e.target.value }))} className="input-dark" rows={2} />
                </Field>
              </div>

              {/* Fotos */}
              <Section title="Fotos do Veículo / Serviço">
                <div className="flex flex-wrap gap-2 mb-3">
                  {(form.fotos || []).map((foto, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group">
                      <img src={foto} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removerFoto(i)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ))}
                  {uploadingFoto && (
                    <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                    <Camera className="w-4 h-4" /> Câmera
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                    <Image className="w-4 h-4" /> Galeria
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFotoUpload(e.target.files[0]); e.target.value = ""; }} />
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { Array.from(e.target.files || []).forEach(f => handleFotoUpload(f)); e.target.value = ""; }} />
              </Section>

              {/* Produtos */}
              <Section title="Produtos">
                {(form.pecas || []).length > 0 && (
                  <div className="mb-2 space-y-3">
                    {(form.pecas || []).map((p, i) => (
                      <div key={i} className="bg-gray-800/50 rounded-xl p-3">
                        <div className="flex flex-wrap md:flex-nowrap gap-2 items-end">
                          <div className="w-24 flex-shrink-0">
                            <label className="text-xs text-gray-500 mb-1 block">Código</label>
                            <NoAutoInput value={p.codigo || ""} onChange={e => updatePeca(i, "codigo", e.target.value)} onBlur={() => setTimeout(() => setProdutoSugestoes({ idx: null, lista: [] }), 200)} className="input-dark" placeholder="Cód." />
                          </div>
                          <div className="relative flex-1 min-w-[140px]">
                            <label className="text-xs text-gray-500 mb-1 block">Nome do Produto</label>
                            <NoAutoInput value={p.descricao} onChange={e => updatePeca(i, "descricao", e.target.value)} onBlur={() => setTimeout(() => setProdutoSugestoes({ idx: null, lista: [] }), 200)} className="input-dark" placeholder="Nome do produto" />
                            {produtoSugestoes.idx === i && produtoSugestoes.lista.length > 0 && (
                              <div className="absolute z-50 top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-64 max-h-48 overflow-y-auto">
                                {produtoSugestoes.lista.map(item => (
                                  <button key={item.id} onMouseDown={() => selecionarProduto(i, item)} className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 border-b border-gray-700 last:border-0">
                                    <span className="text-orange-400 font-mono mr-2">{item.codigo}</span>{item.descricao}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="w-12 flex-shrink-0">
                            <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                            <NoAutoInput value={p.quantidade} onChange={e => updatePeca(i, "quantidade", e.target.value)} className="input-dark" />
                          </div>
                          <div className="flex-1 min-w-[70px]">
                            <label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label>
                            <NoAutoInput value={p.valor_unitario} onChange={e => updatePeca(i, "valor_unitario", e.target.value)} className="input-dark" />
                          </div>
                          <div className="flex-1 min-w-[70px]">
                            <label className="text-xs text-gray-500 mb-1 block">Total</label>
                            <div className="input-dark text-gray-300 pointer-events-none text-sm">R$ {Number(p.valor_total || 0).toFixed(2)}</div>
                          </div>
                          <button onClick={() => removePeca(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-2 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={addPeca} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{background:"#00ff00"}} onMouseEnter={e=>e.currentTarget.style.background="#00dd00"} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </Section>

              {/* Serviços */}
              <Section title="Serviços">
                {(form.servicos || []).length > 0 && (
                  <div className="mb-2 space-y-3">
                    {(form.servicos || []).map((s, i) => (
                      <div key={i} className="bg-gray-800/50 rounded-xl p-3">
                        <div className="flex flex-wrap md:flex-nowrap gap-2 items-end">
                          <div className="w-24 flex-shrink-0">
                            <label className="text-xs text-gray-500 mb-1 block">Código</label>
                            <NoAutoInput value={s.codigo || ""} onChange={e => updateServico(i, "codigo", e.target.value)} onBlur={() => setTimeout(() => setServicoSugestoes({ idx: null, lista: [] }), 200)} className="input-dark" placeholder="Cód." />
                          </div>
                          <div className="relative flex-1 min-w-[140px]">
                            <label className="text-xs text-gray-500 mb-1 block">Nome do Serviço</label>
                            <NoAutoInput value={s.descricao} onChange={e => updateServico(i, "descricao", e.target.value)} onBlur={() => setTimeout(() => setServicoSugestoes({ idx: null, lista: [] }), 200)} className="input-dark" placeholder="Nome do serviço" />
                            {servicoSugestoes.idx === i && servicoSugestoes.lista.length > 0 && (
                              <div className="absolute z-50 top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-64 max-h-48 overflow-y-auto">
                                {servicoSugestoes.lista.map(item => (
                                  <button key={item.id} onMouseDown={() => selecionarServico(i, item)} className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 border-b border-gray-700 last:border-0">
                                    <span className="text-orange-400 font-mono mr-2">{item.codigo}</span>{item.descricao}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="w-12 flex-shrink-0">
                            <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                            <NoAutoInput value={s.quantidade ?? 1} onChange={e => updateServico(i, "quantidade", e.target.value)} className="input-dark" />
                          </div>
                          <div className="flex-1 min-w-[70px]">
                            <label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label>
                            <NoAutoInput value={s.valor} onChange={e => updateServico(i, "valor", e.target.value)} className="input-dark" />
                          </div>
                          <div className="flex-1 min-w-[70px]">
                            <label className="text-xs text-gray-500 mb-1 block">Total</label>
                            <div className="input-dark text-gray-300 pointer-events-none text-sm">R$ {(Number(s.valor || 0) * Number(s.quantidade ?? 1)).toFixed(2)}</div>
                          </div>
                          <button onClick={() => removeServico(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-2 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={addServico} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{background:"#00ff00"}} onMouseEnter={e=>e.currentTarget.style.background="#00dd00"} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </Section>

              {/* Totais e Pagamento */}
              <Section title="Pagamento">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <Field label="Desconto (R$)">
                    <NoAutoInput value={form.desconto} onChange={e => onDesconto(e.target.value)} className="input-dark" />
                  </Field>
                  <Field label="Forma de Pagamento">
                    <select value={form.forma_pagamento} onChange={e => {
                      const novaForma = e.target.value;
                      setForm(f => ({ ...f, forma_pagamento: novaForma }));
                    }} className="input-dark">
                      {["A Combinar","Boleto","Cartão","Dinheiro","PIX"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Nº de Parcelas">
                    <NoAutoInput value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} className="input-dark" />
                  </Field>
                  <Field label="Total Geral">
                    <div className="input-dark font-bold text-orange-400 pointer-events-none">
                      R$ {fmt(form.valor_total)}
                    </div>
                  </Field>
                </div>

                {/* Tabela de Parcelas */}
                {form.parcelas_detalhes && form.parcelas_detalhes.length > 0 && (
                  <div className="border border-gray-700 rounded-xl overflow-hidden">
                    <div className="bg-gray-800 px-3 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wider grid grid-cols-3 gap-2">
                      <span>Vencimento</span>
                      <span>Valor (R$)</span>
                      <span>Forma Pgto</span>
                    </div>
                    {form.parcelas_detalhes.map((p, i) => (
                      <div key={i} className={`grid grid-cols-3 gap-2 px-3 py-2 items-center ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/40"}`}>
                        <input type="date" value={p.vencimento} autoComplete="off" onChange={e => updateParcela(i, "vencimento", e.target.value)}
                          className="input-dark text-xs py-1.5" />
                        <NoAutoInput value={p.valor} onChange={e => updateParcela(i, "valor", e.target.value)}
                          className="input-dark text-xs py-1.5" />
                        <div className="input-dark text-xs py-1.5 text-gray-400 pointer-events-none opacity-60">
                          {p.forma_pagamento || form.forma_pagamento}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Field label="Observações">
                <textarea value={form.observacoes} autoComplete="off" onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className="input-dark" rows={4} />
              </Field>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-all">Cancelar</button>
          <button type="button" onClick={salvar} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all disabled:opacity-50" style={{background:"#00ff00"}} onMouseEnter={e=>!saving&&(e.currentTarget.style.background="#00dd00")} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
        <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; }`}</style>
      </form>
      </div>
    </div>

    {/* Modal de aviso ao reabrir OS Concluída */}
    {showAvisoReabrir && (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-7 h-7 flex-shrink-0" />
            <h3 className="text-lg font-bold">Atenção!</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            Ao reabrir esta OS, <strong className="text-red-400">todos os lançamentos financeiros</strong> gerados quando ela foi concluído serão <strong className="text-red-400">excluídos automaticamente</strong>.
          </p>
          <p className="text-gray-400 text-sm">Deseja continuar?</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowAvisoReabrir(false); setStatusPendente(null); }}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">
              Cancelar
            </button>
            <button onClick={confirmarReabrir}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all">
              Sim, reabrir e excluir lançamentos
            </button>
          </div>
        </div>
      </div>
    )}
    </>
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

function Section({ title, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white border-b border-gray-700 pb-2 flex-1">{title}</h3>
      </div>
      {children}
    </div>
  );
}