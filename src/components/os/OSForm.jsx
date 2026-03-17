import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, AlertTriangle, Camera, Image } from "lucide-react";
import { reduzirEstoque } from "./estoqueUtils";

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
  forma_pagamento: "",
  parcelas: 1,
  parcelas_detalhes: [],
  fotos: [],
  observacoes: "",
});

function gerarParcelas(total, qtd, dataBase) {
  const n = Math.max(1, Number(qtd) || 1);
  const valorParcela = parseFloat((total / n).toFixed(2));
  const base = dataBase ? new Date(dataBase + "T00:00:00") : new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    return {
      numero: i + 1,
      valor: valorParcela,
      vencimento: d.toISOString().split("T")[0],
      forma_pagamento: "A Combinar",
    };
  });
}

function recalcular(servicos, pecas, desconto) {
  const vs = (servicos || []).reduce((acc, s) => acc + Number(s.valor || 0) * Number(s.quantidade ?? 1), 0);
  const vp = (pecas || []).reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
  const total = vs + vp - Number(desconto || 0);
  return { valor_servicos: vs, valor_pecas: vp, valor_total: Math.max(0, total) };
}

export default function OSForm({ os, clientes, veiculos, onClose, onSave }) {
  const isConcluida = os?.status === "Concluído";
  const [form, setForm] = useState(() => os ? { ...defaultForm(), ...os, fotos: os.fotos || [] } : defaultForm());
  const [parcelas, setParcelas] = useState(() => {
    if (os?.parcelas_detalhes?.length > 0) return os.parcelas_detalhes;
    return gerarParcelas(os?.valor_total || 0, os?.parcelas || 1, os?.data_entrada);
  });
  const parcelasRef = useRef(parcelas);
  useEffect(() => { parcelasRef.current = parcelas; }, [parcelas]);

  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSugestoes, setClienteSugestoes] = useState([]);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [novoClienteForm, setNovoClienteForm] = useState({ nome: "", telefone: "", cpf_cnpj: "" });
  const [salvandoCliente, setSalvandoCliente] = useState(false);

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

  const prevTotalRef = useRef(form.valor_total);
  const prevQtdRef = useRef(form.parcelas);
  useEffect(() => {
    const totalMudou = prevTotalRef.current !== form.valor_total;
    const qtdMudou = String(prevQtdRef.current) !== String(form.parcelas);
    prevTotalRef.current = form.valor_total;
    prevQtdRef.current = form.parcelas;
    if (qtdMudou) {
      const n = Math.max(1, Number(form.parcelas) || 1);
      const valorParcela = parseFloat((form.valor_total / n).toFixed(2));
      const base = form.data_entrada ? new Date(form.data_entrada + "T00:00:00") : new Date();
      // Ao mudar quantidade: recria parcelas preservando formas já definidas
      setParcelas(prev => Array.from({ length: n }, (_, i) => {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        return {
          numero: i + 1,
          valor: valorParcela,
          vencimento: prev[i]?.vencimento || d.toISOString().split("T")[0],
          forma_pagamento: prev[i]?.forma_pagamento || "A Combinar",
        };
      }));
    } else if (totalMudou) {
      const n = Math.max(1, Number(form.parcelas) || 1);
      const valorParcela = parseFloat((form.valor_total / n).toFixed(2));
      // Ao mudar total: só atualiza valor, PRESERVA forma_pagamento
      setParcelas(prev => prev.map(p => ({ ...p, valor: valorParcela })));
    }
  }, [form.valor_total, form.parcelas]);

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
    setClienteSearch("");
    setClienteSugestoes([]);
  };

  const handleClienteSearch = (val) => {
    setClienteSearch(val);
    if (val.length > 0) {
      const filtro = clientes
        .filter(c => c.id !== form.cliente_id && c.nome?.toLowerCase().includes(val.toLowerCase()))
        .slice(0, 6);
      setClienteSugestoes(filtro);
    } else {
      setClienteSugestoes([]);
    }
  };

  const salvarNovoCliente = async () => {
    if (!novoClienteForm.nome.trim()) return alert("Informe o nome do cliente.");
    setSalvandoCliente(true);
    const criado = await base44.entities.Cliente.create(novoClienteForm);
    clientes.push(criado);
    onClienteChange(criado.id);
    setShowNovoCliente(false);
    setNovoClienteForm({ nome: "", telefone: "", cpf_cnpj: "" });
    setSalvandoCliente(false);
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

  const addServico = () => {
    const novos = [...(form.servicos || []), { codigo: "", descricao: "", quantidade: 1, valor: 0 }];
    const calc = recalcular(novos, form.pecas, form.desconto);
    setForm(f => ({ ...f, servicos: novos, ...calc }));
  };

  const updateServico = (i, field, val) => {
    const novos = form.servicos.map((s, idx) => idx === i ? { ...s, [field]: field === "valor" ? Number(val) : val } : s);
    if ((field === "codigo" || field === "descricao") && val.length > 0) {
      setServicoSugestoes({ idx: i, lista: servicosCad.filter(s =>
        s.codigo?.toLowerCase().includes(val.toLowerCase()) || s.descricao?.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6) });
    } else if (val === "") {
      setServicoSugestoes({ idx: null, lista: [] });
    }
    const calc = recalcular(novos, form.pecas, form.desconto);
    setForm(f => ({ ...f, servicos: novos, ...calc }));
  };

  const selecionarServico = (i, item) => {
    const novos = form.servicos.map((s, idx) => idx === i ? { ...s, codigo: item.codigo || "", descricao: item.descricao || "", valor: Number(item.valor || 0) } : s);
    setServicoSugestoes({ idx: null, lista: [] });
    const calc = recalcular(novos, form.pecas, form.desconto);
    setForm(f => ({ ...f, servicos: novos, ...calc }));
  };

  const removeServico = (i) => {
    const novos = form.servicos.filter((_, idx) => idx !== i);
    const calc = recalcular(novos, form.pecas, form.desconto);
    setForm(f => ({ ...f, servicos: novos, ...calc }));
  };

  const addPeca = () => {
    const novos = [...(form.pecas || []), { descricao: "", quantidade: 1, valor_unitario: 0, valor_total: 0 }];
    const calc = recalcular(form.servicos, novos, form.desconto);
    setForm(f => ({ ...f, pecas: novos, ...calc }));
  };

  const updatePeca = (i, field, val) => {
    const novos = form.pecas.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, [field]: ["quantidade", "valor_unitario"].includes(field) ? Number(val) : val };
      updated.valor_total = Number(updated.quantidade || 0) * Number(updated.valor_unitario || 0);
      return updated;
    });
    if ((field === "codigo" || field === "descricao") && val.length > 0) {
      setProdutoSugestoes({ idx: i, lista: estoque.filter(e =>
        e.codigo?.toLowerCase().includes(val.toLowerCase()) || e.descricao?.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6) });
    } else if (val === "") {
      setProdutoSugestoes({ idx: null, lista: [] });
    }
    const calc = recalcular(form.servicos, novos, form.desconto);
    setForm(f => ({ ...f, pecas: novos, ...calc }));
  };

  const selecionarProduto = (i, item) => {
    const novos = form.pecas.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, estoque_id: item.id, codigo: item.codigo || "", descricao: item.descricao || "", valor_unitario: Number(item.valor_venda || 0) };
      updated.valor_total = Number(updated.quantidade || 1) * updated.valor_unitario;
      return updated;
    });
    setProdutoSugestoes({ idx: null, lista: [] });
    const calc = recalcular(form.servicos, novos, form.desconto);
    setForm(f => ({ ...f, pecas: novos, ...calc }));
  };

  const removePeca = (i) => {
    const novos = form.pecas.filter((_, idx) => idx !== i);
    const calc = recalcular(form.servicos, novos, form.desconto);
    setForm(f => ({ ...f, pecas: novos, ...calc }));
  };

  const onDesconto = (val) => {
    const d = Number(val) || 0;
    const calc = recalcular(form.servicos, form.pecas, d);
    setForm(f => ({ ...f, desconto: d, ...calc }));
  };

  const updateParcela = (i, field, val) => {
    if (field !== "valor") {
      setParcelas(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
      return;
    }
    // Rebalanceia as outras parcelas
    setParcelas(prev => {
      const novoValor = Number(val) || 0;
      const totalGeral = form.valor_total;
      const resto = parseFloat((totalGeral - novoValor).toFixed(2));
      const outras = prev.length - 1;
      const valorOutras = outras > 0 ? parseFloat((resto / outras).toFixed(2)) : 0;
      return prev.map((p, idx) => {
        if (idx === i) return { ...p, valor: novoValor };
        return { ...p, valor: valorOutras };
      });
    });
  };

  const onStatusChange = (novoStatus) => {
    if (form.status === "Concluído" && novoStatus !== "Concluído") {
      setStatusPendente(novoStatus);
      setShowAvisoReabrir(true);
      return;
    }
    setForm(f => ({ ...f, status: novoStatus }));
  };

  const confirmarReabrir = async () => {
    // Nota: A restauração de estoque é feita em OSCard ao alterar status
    // Aqui apenas atualizamos o form para permitir edição
    setForm(f => ({ ...f, status: statusPendente }));
    setShowAvisoReabrir(false);
    setStatusPendente(null);
  };

  const gerarLancamentosFinanceiros = async (osData, parcelasData) => {
    console.log("GERAR LANCAMENTOS - parcelasData:", JSON.stringify(parcelasData));
    const lista = parcelasData && parcelasData.length > 0
      ? parcelasData
      : gerarParcelas(osData.valor_total, Number(osData.parcelas) || 1, osData.data_entrada);

    for (const p of lista) {
      const formaParc = p.forma_pagamento || "A Combinar";
      console.log(`Parcela ${p.numero}: forma=${formaParc}`);
      const pago = ["Dinheiro", "PIX"].includes(formaParc);
      await base44.entities.Financeiro.create({
        tipo: "Receita",
        categoria: "Ordem de Serviço",
        descricao: `OS #${osData.numero} — ${osData.cliente_nome || ""} — Parcela ${p.numero}/${lista.length}`,
        valor: p.valor,
        data_vencimento: p.vencimento,
        status: pago ? "Pago" : "Pendente",
        data_pagamento: pago ? new Date().toISOString().split("T")[0] : "",
        forma_pagamento: formaParc,
        ordem_servico_id: osData.id || "",
        cliente_id: osData.cliente_id || "",
      });
    }
  };

  const salvar = async () => {
    if (!form.cliente_nome && !form.cliente_id) return alert("Selecione ou informe o cliente.");
    if (saving) return;
    setSaving(true);

    try {
      const parcelasNormalizadas = parcelasRef.current.map(p => ({ ...p, valor: Number(p.valor) || 0 }));
      console.log("PARCELAS AO SALVAR:", JSON.stringify(parcelasNormalizadas));
      let formFinal = { ...form, parcelas_detalhes: parcelasNormalizadas };

      if (!os) {
        const todas = await base44.entities.OrdemServico.list("-created_date", 500);
        const numerosUsados = new Set(todas.map(o => String(o.numero).trim()));
        let numeroTentativa = parseInt(formFinal.numero, 10) || 1;
        while (numerosUsados.has(String(numeroTentativa))) numeroTentativa++;
        formFinal = { ...formFinal, numero: String(numeroTentativa) };
        setForm(f => ({ ...f, numero: String(numeroTentativa) }));
      }

      const eraAberta = os?.status !== "Concluído";
      const ficouConcluida = formFinal.status === "Concluído";
      let savedId = os?.id;

      const formToSave = {
        ...formFinal,
        quilometragem: formFinal.quilometragem === "" || formFinal.quilometragem === null || formFinal.quilometragem === undefined
          ? null : Number(formFinal.quilometragem),
      };

      if (os) {
        await base44.entities.OrdemServico.update(os.id, formToSave);
      } else {
        const criada = await base44.entities.OrdemServico.create(formToSave);
        savedId = criada.id;
        if (formFinal.veiculo_placa && formFinal.cliente_id && formFinal.cliente_nome?.toUpperCase() !== "CONSUMIDOR") {
          const veiculo_marca = formFinal.veiculo_modelo?.split(" ")[0] || "";
          const veiculo_modelo = formFinal.veiculo_modelo?.substring(veiculo_marca.length).trim() || "";
          await base44.functions.invoke('autoRegistrarVeiculo', {
            cliente_id: formFinal.cliente_id,
            veiculo_placa: formFinal.veiculo_placa,
            veiculo_marca, veiculo_modelo,
            veiculo_ano: formFinal.veiculo_ano,
          });
        }
      }

      if (eraAberta && ficouConcluida && savedId) {
        await gerarLancamentosFinanceiros({ ...formFinal, id: savedId }, parcelasRef.current);
        await reduzirEstoque(formFinal.pecas);
      }

      onSave();
    } catch (err) {
      alert("Erro ao salvar: " + (err?.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <>
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4 pt-8">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-4">
        {/* Honeypot para bloquear autocomplete do browser */}
        <div style={{display:"none"}} aria-hidden="true">
          <input type="text" name="username" autoComplete="username" tabIndex={-1} />
          <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
          <input type="text" name="address" autoComplete="street-address" tabIndex={-1} />
          <input type="email" name="email" autoComplete="email" tabIndex={-1} />
        </div>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{os ? `Ordem de Venda #${os.numero}` : "Ordem de Venda"}</h2>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {isConcluida && (
          <div className="mx-5 mt-4 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-400 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>OS Concluído — apenas o status pode ser alterado. Para editar, mude o status para <b>Aberto</b>.</span>
          </div>
        )}

        <div className="p-5 space-y-5">
          {/* Header Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Número">
              <input value={form.numero} disabled={isConcluida} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className={`input-dark ${isConcluida ? "opacity-50 cursor-not-allowed" : ""}`} autoComplete="off" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => onStatusChange(e.target.value)} className="input-dark">
                {["Aberto", "Orçamento", "Concluído"].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Data Entrada">
              <input type="date" value={form.data_entrada} disabled={isConcluida} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} className={`input-dark ${isConcluida ? "opacity-50 cursor-not-allowed" : ""}`} autoComplete="off" />
            </Field>
          </div>

          {!isConcluida && (
            <>
              {/* Cliente */}
              <Section title="Cliente">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Selecionar Cliente</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input value={clienteSearch} onChange={e => handleClienteSearch(e.target.value)}
                          onBlur={() => setTimeout(() => setClienteSugestoes([]), 200)}
                          className="input-dark" placeholder={form.cliente_nome || "Digite para pesquisar..."} autoComplete="new-password" />
                        {clienteSugestoes.length > 0 && (
                          <div className="absolute z-50 top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-full max-h-48 overflow-y-auto">
                            {clienteSugestoes.map(item => (
                              <button key={item.id} onMouseDown={() => onClienteChange(item.id)}
                                className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 border-b border-gray-700 last:border-0">
                                {item.nome}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setShowNovoCliente(true)}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-white flex-shrink-0"
                        style={{background:"#062C9B"}}>
                        <Plus className="w-3.5 h-3.5" /> Novo
                      </button>
                    </div>
                  </div>
                  <Field label="Nome"><input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} className="input-dark" autoComplete="new-password" placeholder="Ou digite manualmente" /></Field>
                  <Field label="Telefone"><input value={form.cliente_telefone} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                  <Field label="E-mail"><input value={form.cliente_email} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                  <Field label="CPF / CNPJ"><input value={form.cliente_cpf_cnpj} onChange={e => setForm(f => ({ ...f, cliente_cpf_cnpj: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                  <Field label="Endereço"><input value={form.cliente_endereco || ""} onChange={e => setForm(f => ({ ...f, cliente_endereco: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                  <Field label="Bairro"><input value={form.cliente_bairro || ""} onChange={e => setForm(f => ({ ...f, cliente_bairro: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                  <Field label="Cidade"><input value={form.cliente_cidade || ""} onChange={e => setForm(f => ({ ...f, cliente_cidade: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                  <Field label="Estado"><input value={form.cliente_estado || ""} onChange={e => setForm(f => ({ ...f, cliente_estado: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
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
                  <Field label="Modelo"><input value={form.veiculo_modelo} onChange={e => setForm(f => ({ ...f, veiculo_modelo: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                  <Field label="Placa"><input value={form.veiculo_placa} onChange={e => setForm(f => ({ ...f, veiculo_placa: e.target.value }))} className="input-dark" autoComplete="new-password" placeholder="AAA0000" /></Field>
                  <Field label="KM"><input value={form.quilometragem} onChange={e => setForm(f => ({ ...f, quilometragem: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                </div>
              </Section>

              {/* Defeito / Diagnóstico */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Defeito Relatado"><textarea value={form.defeito_relatado} onChange={e => setForm(f => ({ ...f, defeito_relatado: e.target.value }))} className="input-dark" rows={2} autoComplete="off" /></Field>
                <Field label="Diagnóstico"><textarea value={form.diagnostico} onChange={e => setForm(f => ({ ...f, diagnostico: e.target.value }))} className="input-dark" rows={2} autoComplete="off" /></Field>
              </div>

              {/* Fotos */}
              <Section title="Fotos do Veículo / Serviço">
                <div className="flex flex-wrap gap-2 mb-3">
                  {(form.fotos || []).map((foto, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group">
                      <img src={foto} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removerFoto(i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ))}
                  {uploadingFoto && <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center"><div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs"><Camera className="w-4 h-4" /> Câmera</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs"><Image className="w-4 h-4" /> Galeria</button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFotoUpload(e.target.files[0]); e.target.value = ""; }} />
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { Array.from(e.target.files || []).forEach(f => handleFotoUpload(f)); e.target.value = ""; }} />
              </Section>

              {/* Produtos */}
              <Section title="Produtos">
                {(form.pecas || []).map((p, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-xl p-3 mb-2">
                    <div className="flex flex-wrap md:flex-nowrap gap-2 items-end">
                      <div className="w-24 flex-shrink-0">
                        <label className="text-xs text-gray-500 mb-1 block">Código</label>
                        <input value={p.codigo || ""} onChange={e => updatePeca(i, "codigo", e.target.value)} onBlur={() => setTimeout(() => setProdutoSugestoes({ idx: null, lista: [] }), 200)} className="input-dark" autoComplete="off" placeholder="Cód." />
                      </div>
                      <div className="relative flex-1 min-w-[140px]">
                        <label className="text-xs text-gray-500 mb-1 block">Nome do Produto</label>
                        <input value={p.descricao} onChange={e => updatePeca(i, "descricao", e.target.value)} onBlur={() => setTimeout(() => setProdutoSugestoes({ idx: null, lista: [] }), 200)} className="input-dark" autoComplete="new-password" placeholder="Nome do produto" />
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
                      <div className="w-12 flex-shrink-0"><label className="text-xs text-gray-500 mb-1 block">Qtd</label><input value={p.quantidade} onChange={e => updatePeca(i, "quantidade", e.target.value)} className="input-dark" autoComplete="off" /></div>
                      <div className="flex-1 min-w-[70px]"><label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label><input value={p.valor_unitario} onChange={e => updatePeca(i, "valor_unitario", e.target.value)} className="input-dark" autoComplete="off" /></div>
                      <div className="flex-1 min-w-[70px]"><label className="text-xs text-gray-500 mb-1 block">Total</label><div className="input-dark text-gray-300 text-sm">R$ {Number(p.valor_total || 0).toFixed(2)}</div></div>
                      <button onClick={() => removePeca(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-2 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                <button onClick={addPeca} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium" style={{background:"#00ff00"}}>
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </Section>

              {/* Serviços */}
              <Section title="Serviços">
                {(form.servicos || []).map((s, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-xl p-3 mb-2">
                    <div className="flex flex-wrap md:flex-nowrap gap-2 items-end">
                      <div className="w-24 flex-shrink-0">
                        <label className="text-xs text-gray-500 mb-1 block">Código</label>
                        <input value={s.codigo || ""} onChange={e => updateServico(i, "codigo", e.target.value)} onBlur={() => setTimeout(() => setServicoSugestoes({ idx: null, lista: [] }), 200)} className="input-dark" autoComplete="off" placeholder="Cód." />
                      </div>
                      <div className="relative flex-1 min-w-[140px]">
                        <label className="text-xs text-gray-500 mb-1 block">Nome do Serviço</label>
                        <input value={s.descricao} onChange={e => updateServico(i, "descricao", e.target.value)} onBlur={() => setTimeout(() => setServicoSugestoes({ idx: null, lista: [] }), 200)} className="input-dark" autoComplete="new-password" placeholder="Nome do serviço" />
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
                      <div className="w-12 flex-shrink-0"><label className="text-xs text-gray-500 mb-1 block">Qtd</label><input value={s.quantidade ?? 1} onChange={e => updateServico(i, "quantidade", e.target.value)} className="input-dark" autoComplete="off" /></div>
                      <div className="flex-1 min-w-[70px]"><label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label><input value={s.valor} onChange={e => updateServico(i, "valor", e.target.value)} className="input-dark" autoComplete="off" /></div>
                      <div className="flex-1 min-w-[70px]"><label className="text-xs text-gray-500 mb-1 block">Total</label><div className="input-dark text-gray-300 text-sm">R$ {(Number(s.valor || 0) * Number(s.quantidade ?? 1)).toFixed(2)}</div></div>
                      <button onClick={() => removeServico(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-2 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                <button onClick={addServico} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium" style={{background:"#00ff00"}}>
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </Section>

              {/* Pagamento */}
              <Section title="Pagamento">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <Field label="Desconto (R$)">
                    <input value={form.desconto} onChange={e => onDesconto(e.target.value)} className="input-dark" autoComplete="off" />
                  </Field>
                  <Field label="Nº de Parcelas">
                    <input value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} className="input-dark" autoComplete="off" />
                  </Field>
                  <Field label="Total Geral">
                    <div className="input-dark font-bold text-orange-400">R$ {fmt(form.valor_total)}</div>
                  </Field>
                </div>

                {parcelas.length > 0 && (
                  <div className="border border-gray-700 rounded-xl overflow-hidden">
                    <div className="bg-gray-800 px-3 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wider grid grid-cols-3 gap-2">
                      <span>Vencimento</span>
                      <span>Valor (R$)</span>
                      <span>Forma Pgto</span>
                    </div>
                    {parcelas.map((p, i) => (
                      <div key={i} className={`grid grid-cols-3 gap-2 px-3 py-2 items-center ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/40"}`}>
                        <input type="date" value={p.vencimento || ""} onChange={e => updateParcela(i, "vencimento", e.target.value)} className="input-dark text-xs py-1.5" />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={p.valor}
                          onChange={e => updateParcela(i, "valor", e.target.value)}
                          className="input-dark text-xs py-1.5"
                          style={{MozAppearance:"textfield", appearance:"textfield"}}
                        />
                        <select
                          value={p.forma_pagamento || "A Combinar"}
                          onChange={e => updateParcela(i, "forma_pagamento", e.target.value)}
                          className="input-dark text-xs py-1.5"
                        >
                          {["A Combinar","Boleto","Cartão","Dinheiro","PIX"].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Field label="Observações">
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className="input-dark" rows={4} autoComplete="off" />
              </Field>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">Cancelar</button>
          <button type="button" onClick={salvar} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50" style={{background:"#00ff00"}}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
        <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; }`}</style>
        <div style={{display:"none"}}><input type="text" name="prevent_autofill" /><input type="password" name="prevent_autofill_pw" /></div>
      </div>
      </div>
    </div>

    {showNovoCliente && (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Novo Cliente</h3>
            <button onClick={() => setShowNovoCliente(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-3">
            <Field label="Nome *"><input value={novoClienteForm.nome} onChange={e => setNovoClienteForm(f => ({ ...f, nome: e.target.value }))} className="input-dark" autoComplete="off" /></Field>
            <Field label="Telefone"><input value={novoClienteForm.telefone} onChange={e => setNovoClienteForm(f => ({ ...f, telefone: e.target.value }))} className="input-dark" autoComplete="off" /></Field>
            <Field label="CPF / CNPJ"><input value={novoClienteForm.cpf_cnpj} onChange={e => setNovoClienteForm(f => ({ ...f, cpf_cnpj: e.target.value }))} className="input-dark" autoComplete="off" /></Field>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowNovoCliente(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg">Cancelar</button>
            <button onClick={salvarNovoCliente} disabled={salvandoCliente} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{background:"#062C9B"}}>
              {salvandoCliente ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    )}

    {showAvisoReabrir && (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-7 h-7 flex-shrink-0" />
            <h3 className="text-lg font-bold">Atenção!</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            Ao reabrir esta OS, <strong className="text-red-400">todos os lançamentos financeiros</strong> serão <strong className="text-red-400">excluídos automaticamente</strong>.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowAvisoReabrir(false); setStatusPendente(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg">Cancelar</button>
            <button onClick={confirmarReabrir} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">Sim, reabrir</button>
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
      <div className="mb-3">
        <h3 className="text-sm font-medium text-white border-b border-gray-700 pb-2">{title}</h3>
      </div>
      {children}
    </div>
  );
}