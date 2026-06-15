import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, AlertTriangle, Camera, Image, GripVertical } from "lucide-react";
import SearchableSelect from "@/components/notas/SearchableSelect";
import { reduzirEstoque, restaurarEstoque, restaurarEstoqueCompletoPeca } from "./estoqueUtils";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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
  data_entrada: "",
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
  dados_adicionais: "",
});

function getFeriadosBrasil(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  const pascoa = new Date(ano, mes - 1, dia);
  const fmt = dt => `${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  const addDias = (dt, n) => { const r = new Date(dt); r.setDate(r.getDate() + n); return r; };
  return new Set([
    "01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25",
    fmt(addDias(pascoa, -48)), fmt(addDias(pascoa, -47)),
    fmt(addDias(pascoa, -2)), fmt(pascoa), fmt(addDias(pascoa, 60)),
  ]);
}

function proximoDiaUtil(dataBase) {
  const dt = dataBase ? new Date(dataBase + "T12:00:00") : new Date();
  dt.setDate(dt.getDate() + 1);
  const feriados = getFeriadosBrasil(dt.getFullYear());
  const fmtKey = d => `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  for (let i = 0; i < 10; i++) {
    const dow = dt.getDay();
    if (dow !== 0 && dow !== 6 && !feriados.has(fmtKey(dt))) break;
    dt.setDate(dt.getDate() + 1);
  }
  return dt.toISOString().split("T")[0];
}

function calcularVencimentoParcela(formaPagamento, dataEntrada) {
  if (!formaPagamento || formaPagamento === "A Combinar") {
    const base = dataEntrada ? new Date(dataEntrada + "T12:00:00") : new Date();
    base.setDate(base.getDate() + 30);
    return base.toISOString().split("T")[0];
  }
  return proximoDiaUtil(dataEntrada || new Date().toISOString().split("T")[0]);
}

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
      financeiro_status: "Pendente",
    };
  });
}

function sanitizar(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7F]/g, '').toUpperCase();
}

function recalcular(servicos, pecas, desconto) {
  const vs = (servicos || []).reduce((acc, s) => acc + Number(s.valor || 0) * Number(s.quantidade ?? 1), 0);
  const vp = (pecas || []).reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
  const total = vs + vp - Number(desconto || 0);
  return { valor_servicos: vs, valor_pecas: vp, valor_total: Math.max(0, total) };
}

export default function VendaForm({ os, clientes, veiculos, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const base = os ? { ...defaultForm(), ...os, fotos: os.fotos || [] } : defaultForm();
    if (!os && !base.data_entrada) {
      const hoje = new Date();
      base.data_entrada = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    }
    return base;
  });
  const [parcelas, setParcelas] = useState(() => {
    if (os?.parcelas_detalhes?.length > 0) return os.parcelas_detalhes;
    return gerarParcelas(os?.valor_total || 0, os?.parcelas || 1, os?.data_entrada);
  });
  const parcelasRef = useRef(parcelas);
  const setParcelasSync = (val) => {
    const next = typeof val === 'function' ? val(parcelasRef.current) : val;
    parcelasRef.current = next;
    setParcelas(next);
  };

  const [saving, setSaving] = useState(false);
  const [erroTelefone, setErroTelefone] = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const contatoRef = useRef(null);
  const veiculoRef = useRef(null);
  const placaRef = useRef(null);
  const kmRef = useRef(null);

  const handleNavKey = (e, nextRef) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSugestoes, setClienteSugestoes] = useState([]);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [novoClienteForm, setNovoClienteForm] = useState({ tipo: "Pessoa Física", nome: "", nome_fantasia: "", cpf_cnpj: "", rg_ie: "", telefone: "", email: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", observacoes: "" });
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const buscarCnpjNovoCliente = async () => {
    const cnpj = novoClienteForm.cpf_cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return alert('Digite um CNPJ válido com 14 dígitos.');
    setBuscandoCnpj(true);
    try {
      const resp = await base44.functions.invoke('buscarCnpj', { cnpj });
      if (!resp.data?.sucesso) throw new Error(resp.data?.error || 'CNPJ não encontrado.');
      const d = resp.data.data;
      const est = d.estabelecimento;
      const ie = est?.inscricoes_estaduais?.find(i => i.ativo)?.inscricao_estadual || '';
      setNovoClienteForm(f => ({
        ...f,
        tipo: 'Pessoa Jurídica',
        nome: d.razao_social || f.nome,
        nome_fantasia: est?.nome_fantasia || f.nome_fantasia,
        rg_ie: ie,
        email: est?.email || f.email,
        telefone: est?.ddd1 && est?.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : f.telefone,
        cep: est?.cep || f.cep,
        endereco: est?.logradouro || f.endereco,
        numero: est?.numero || f.numero,
        complemento: est?.complemento || f.complemento,
        bairro: est?.bairro || f.bairro,
        cidade: est?.cidade?.nome || f.cidade,
        estado: est?.estado?.sigla || f.estado,
      }));
    } catch (e) {
      alert('Erro ao buscar CNPJ: ' + e.message);
    }
    setBuscandoCnpj(false);
  };

  const [veiculosCliente, setVeiculosCliente] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [servicosCad, setServicosCad] = useState([]);
  const [produtoSugestoes, setProdutoSugestoes] = useState({ idx: null, lista: [] });
  const [servicoSugestoes, setServicoSugestoes] = useState({ idx: null, lista: [] });
  const [showAvisoReabrir, setShowAvisoReabrir] = useState(false);
  const [statusPendente, setStatusPendente] = useState(null);
  const [showDadosCliente, setShowDadosCliente] = useState(false);
  const [showDadosVeiculo, setShowDadosVeiculo] = useState(false);
  const [descontoInput, setDescontoInput] = useState(0);
  const [pagandoParcela, setPagandoParcela] = useState(null);
  const [showConfirmCustoZero, setShowConfirmCustoZero] = useState(false);
  const [parcelaAPagar, setParcelaAPagar] = useState(null);
  const [alertaModal, setAlertaModal] = useState(null); // { titulo, mensagem }
  const custoInputRefs = useRef({});
  const [xxCustos, setXXCustos] = useState({});

  useEffect(() => {
    Promise.all([
      base44.entities.Estoque.list("-created_date", 500),
      base44.entities.Servico.list("-created_date", 500),
    ]).then(([e, s]) => {
      setEstoque(e);
      const sortedServicos = s.slice().sort((a, b) => {
        const aMao = a.descricao?.toUpperCase().includes('MAO DE OBRA');
        const bMao = b.descricao?.toUpperCase().includes('MAO DE OBRA');
        if (aMao && !bMao) return -1;
        if (!aMao && bMao) return 1;
        return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR');
      });
      setServicosCad(sortedServicos);
      setForm(f => ({
        ...f,
        servicos: f.servicos.map(svc => {
          if (svc.codigo) return svc;
          const match = s.find(sc => sc.descricao?.toLowerCase().trim() === svc.descricao?.toLowerCase().trim());
          return { ...svc, codigo: match?.codigo || "101" };
        }),
        pecas: f.pecas.map(p => {
          const match = e.find(est =>
            (p.estoque_id && est.id === p.estoque_id) ||
            (!p.estoque_id && est.descricao?.toLowerCase().trim() === p.descricao?.toLowerCase().trim())
          );
          if (match) {
            const isXX = (p.codigo || match.codigo || '').toUpperCase() === 'XX';
            return {
              ...p,
              codigo: p.codigo || match.codigo,
              estoque_id: p.estoque_id || match.id,
              // Preserva custo já salvo na venda — NUNCA sobrescreve com valor atual do estoque
              valor_custo: isXX ? (p.valor_custo || 0) : Number(p.valor_custo ?? match.valor_custo ?? 0),
            };
          }
          return p;
        }),
      }));
    });
  }, []);

  useEffect(() => {
    if (!os) {
      base44.entities.Vendas.list("-created_date", 9999).then(all => {
        const usados = new Set(all.map(o => parseInt(o.numero, 10)).filter(n => !isNaN(n) && n > 0));
        let proximo = 1;
        while (usados.has(proximo)) proximo++;
        setForm(f => ({ ...f, numero: String(proximo) }));
      });
    }
  }, []);

  useEffect(() => {
    if (!os && clientes.length > 0 && !form.cliente_id) {
      const consumidor = clientes.find(c => c.nome?.toUpperCase() === "CONSUMIDOR");
      if (consumidor) onClienteChange(consumidor.id);
    }
  }, [clientes]);

  useEffect(() => {
    if (form.cliente_id) {
      setVeiculosCliente((veiculos || []).filter(v => v.cliente_id === form.cliente_id));
    }
  }, [form.cliente_id, veiculos]);

  useEffect(() => {
    if (!os?.id) return;
    base44.entities.Financeiro.filter({ ordem_venda_id: os.id }, "-created_date", 100).then(fins => {
      if (!fins || fins.length === 0) return;
      setParcelasSync(prev => prev.map(p => {
        if (!p.financeiro_id) {
          const idx = prev.indexOf(p);
          const desc = `Parcela ${idx+1}/${prev.length}`;
          const fin = fins.find(f => f.id === p.financeiro_id || f.descricao?.includes(desc));
          if (fin) return { ...p, financeiro_id: fin.id, financeiro_status: fin.status };
          return p;
        }
        const fin = fins.find(f => f.id === p.financeiro_id);
        if (fin && fin.status !== p.financeiro_status) return { ...p, financeiro_status: fin.status };
        return p;
      }));
    });
  }, [os?.id]);

  const prevTotalRef = useRef(form.valor_total);
  const prevQtdRef = useRef(form.parcelas);
  useEffect(() => {
    const totalMudou = prevTotalRef.current !== form.valor_total;
    prevTotalRef.current = form.valor_total;
    if (totalMudou) {
      setParcelasSync(prev => {
        if (prev.length === 0) return prev;
        const n = prev.length;
        const valorNova = parseFloat((form.valor_total / n).toFixed(2));
        return prev.map((p, i) => ({ ...p, valor: valorNova }));
      });
    }
  }, [form.valor_total]);

  useEffect(() => {
    const qtdMudou = String(prevQtdRef.current) !== String(form.parcelas);
    prevQtdRef.current = form.parcelas;
    if (!qtdMudou) return;
    const n = Math.max(1, Number(form.parcelas) || 1);
    const base = form.data_entrada ? new Date(form.data_entrada + "T00:00:00") : new Date();
    setParcelasSync(prev => {
      const totalPago = prev.reduce((acc, p) => (p.financeiro_status || "Pendente") === "Pago" ? acc + Number(p.valor || 0) : acc, 0);
      const totalPendente = parseFloat((form.valor_total - totalPago).toFixed(2));
      const qtdPagasNoRange = prev.filter((p, i) => i < n && (p.financeiro_status || "Pendente") === "Pago").length;
      const qtdNovas = n - qtdPagasNoRange;
      const valorNova = qtdNovas > 0 ? parseFloat((totalPendente / qtdNovas).toFixed(2)) : 0;
      return Array.from({ length: n }, (_, i) => {
        if (prev[i] && (prev[i].financeiro_status || "Pendente") === "Pago") {
          return { ...prev[i], numero: i + 1 };
        }
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        return {
          numero: i + 1,
          valor: valorNova,
          vencimento: prev[i]?.vencimento || d.toISOString().split("T")[0],
          forma_pagamento: prev[i]?.forma_pagamento || "A Combinar",
          financeiro_id: prev[i]?.financeiro_id,
          financeiro_status: prev[i]?.financeiro_status || "Pendente",
        };
      });
    });
  }, [form.parcelas]);

  const onClienteChange = (clienteId) => {
    const c = clientes.find(c => c.id === clienteId);
    const isConsumidorSelecionado = c?.nome?.toUpperCase() === "CONSUMIDOR";
    setForm(f => ({
      ...f,
      cliente_id: clienteId,
      cliente_nome: c?.nome || "",
      cliente_nome_fantasia: isConsumidorSelecionado ? (f.cliente_nome_fantasia || "") : (c?.nome_fantasia || ""),
      cliente_telefone: isConsumidorSelecionado ? (f.cliente_telefone || "") : (c?.telefone || ""),
      cliente_email: isConsumidorSelecionado ? (f.cliente_email || "") : (c?.email || ""),
      cliente_cpf_cnpj: isConsumidorSelecionado ? (f.cliente_cpf_cnpj || "") : (c?.cpf_cnpj || ""),
      cliente_endereco: isConsumidorSelecionado ? (f.cliente_endereco || "") : (c?.endereco || ""),
      cliente_numero: isConsumidorSelecionado ? (f.cliente_numero || "") : (c?.numero || ""),
      cliente_bairro: isConsumidorSelecionado ? (f.cliente_bairro || "") : (c?.bairro || ""),
      cliente_cidade: isConsumidorSelecionado ? (f.cliente_cidade || "") : (c?.cidade || ""),
      cliente_estado: isConsumidorSelecionado ? (f.cliente_estado || "") : (c?.estado || ""),
    }));
    setClienteSearch("");
    setClienteSugestoes([]);
    setShowDadosCliente(true);
  };

  const handleClienteSearch = (val) => {
    setClienteSearch(val);
    if (val.length > 0) {
      const filtro = clientes
        .filter(c =>
          c.nome?.toLowerCase().includes(val.toLowerCase()) ||
          c.nome_fantasia?.toLowerCase().includes(val.toLowerCase())
        )
        .slice(0, 6);
      setClienteSugestoes(filtro);
    } else {
      setClienteSugestoes([]);
    }
  };

  const salvarNovoCliente = async () => {
    if (!novoClienteForm.nome.trim()) return alert("Informe o nome do cliente.");
    setSalvandoCliente(true);
    const criado = await base44.entities.Cadastro.create({ ...novoClienteForm, categoria: "Cliente" });
    clientes.push(criado);
    onClienteChange(criado.id);
    setShowNovoCliente(false);
    setNovoClienteForm({ tipo: "Pessoa Física", nome: "", nome_fantasia: "", cpf_cnpj: "", rg_ie: "", telefone: "", email: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", observacoes: "" });
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
    const novos = [...(form.servicos || []), { _new: true, codigo: "", descricao: "", quantidade: 1, valor: 0 }];
    const calc = recalcular(novos, form.pecas, form.desconto);
    setForm(f => ({ ...f, servicos: novos, ...calc }));
  };

  const updateServico = (i, field, val) => {
    const valFinal = field === "descricao" ? sanitizar(val) : (field === "valor" ? parseNum(val) : val);
    if ((field === "codigo" || field === "descricao") && val.length > 0) {
      setServicoSugestoes({ idx: i, lista: servicosCad.filter(s =>
        s.codigo?.toLowerCase().includes(val.toLowerCase()) || s.descricao?.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6) });
    } else if (val === "") {
      setServicoSugestoes({ idx: null, lista: [] });
    }
    setForm(f => {
      const novos = f.servicos.map((s, idx) => idx === i ? { ...s, _new: false, [field]: valFinal } : s);
      const calc = recalcular(novos, f.pecas, f.desconto);
      return { ...f, servicos: novos, ...calc };
    });
  };

  const selecionarServico = (i, item) => {
    setServicoSugestoes({ idx: null, lista: [] });
    setForm(f => {
      const novos = f.servicos.map((s, idx) => idx === i ? { ...s, _new: false, codigo: item.codigo || "101", descricao: item.descricao || "", valor: Number(item.valor || 0) } : s);
      return { ...f, servicos: novos, ...recalcular(novos, f.pecas, f.desconto) };
    });
  };

  const removeServico = (i) => {
    const novos = form.servicos.filter((_, idx) => idx !== i);
    const calc = recalcular(novos, form.pecas, form.desconto);
    setForm(f => ({ ...f, servicos: novos, ...calc }));
  };

  const addPeca = () => {
    const novos = [...(form.pecas || []), { _new: true, descricao: "", quantidade: 1, valor_unitario: 0, valor_total: 0 }];
    const calc = recalcular(form.servicos, novos, form.desconto);
    setForm(f => ({ ...f, pecas: novos, ...calc }));
  };

  const parseNum = (val) => Number(String(val).replace(',', '.')) || 0;

  const updatePeca = async (i, field, val) => {
    const pecaAntiga = form.pecas[i];
    const valFinal = field === "descricao" ? sanitizar(val) : val;
    const novos = form.pecas.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, _new: false, [field]: ["quantidade", "valor_unitario"].includes(field) ? parseNum(valFinal) : valFinal };
      updated.valor_total = Number(updated.quantidade || 0) * Number(updated.valor_unitario || 0);
      return updated;
    });

    // Se é uma venda já salva e houve mudança de quantidade, sincronizar estoque
    if (os?.id && field === "quantidade" && pecaAntiga.estoque_id) {
      const qtdAnterior = Number(pecaAntiga.quantidade || 0);
      const qtdNova = Number(valFinal) || 0;
      if (qtdAnterior !== qtdNova && estoque.length > 0) {
        try {
          if (qtdNova < qtdAnterior) {
            // Reduzido: restaura a diferença
            const diff = { ...pecaAntiga, quantidade: qtdAnterior - qtdNova };
            await restaurarEstoque([diff], os.id, estoque);
          } else if (qtdNova > qtdAnterior) {
            // Aumentado: reduz a diferença adicional
            const diff = { ...pecaAntiga, quantidade: qtdNova - qtdAnterior };
            await reduzirEstoque([diff], { id: os.id, numero: os.numero }, estoque);
          }
        } catch (e) {
          console.warn("Erro ao sincronizar quantidade no estoque:", e);
        }
      }
    }

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

  const selecionarProduto = async (i, item) => {
    setProdutoSugestoes({ idx: null, lista: [] });
    let qtdSelecionada = 1;
    setForm(f => {
      const novos = f.pecas.map((p, idx) => {
        if (idx !== i) return p;
        qtdSelecionada = Number(p.quantidade || 1);
        const updated = { ...p, _new: false, estoque_id: item.id, codigo: item.codigo || "", descricao: item.descricao || "", valor_unitario: Number(item.valor_venda || 0), valor_custo: Number(item.valor_custo || 0) };
        updated.valor_total = Number(updated.quantidade || 1) * updated.valor_unitario;
        return updated;
      });
      return { ...f, pecas: novos, ...recalcular(f.servicos, novos, f.desconto) };
    });

  };

  const removePeca = async (i) => {
     const peca = form.pecas[i];
     // Se é uma venda já salva e a peça tem estoque, deleta completamente a movimentação
     if (os?.id && peca.estoque_id && Number(peca.quantidade) > 0) {
       try {
         await restaurarEstoqueCompletoPeca(peca, os.id, estoque);
       } catch (e) {
         console.warn("Erro ao restaurar estoque na exclusão:", e);
       }
     }
     const novos = form.pecas.filter((_, idx) => idx !== i);
     const calc = recalcular(form.servicos, novos, form.desconto);
     setForm(f => ({ ...f, pecas: novos, ...calc }));
   };

  const onDragEnd = (result, tipo) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    setForm(f => {
      const lista = [...(f[tipo] || [])];
      const [item] = lista.splice(from, 1);
      lista.splice(to, 0, item);
      return { ...f, [tipo]: lista, ...recalcular(tipo === 'servicos' ? lista : f.servicos, tipo === 'pecas' ? lista : f.pecas, f.desconto) };
    });
  };

  const onDesconto = (val) => {
    const d = Number(val) || 0;
    const calc = recalcular(form.servicos, form.pecas, d);
    setForm(f => ({ ...f, desconto: d, ...calc }));
  };

  const handleDescontoChange = (val) => {
    setDescontoInput(val);
  };

  const aplicarDescontoAgora = () => {
    const d = parseFloat(String(descontoInput).replace(',', '.')) || 0;
    if (d <= 0) return;
    const totalBruto = form.valor_servicos + form.valor_pecas;
    if (totalBruto <= 0) return;
    if (form.tipo_desconto === 'reais') {
      let novasPecas = [...form.pecas];
      let novosServicos = [...form.servicos];
      if (novasPecas.length > 0) {
        const last = novasPecas[novasPecas.length - 1];
        const novoTotal = parseFloat((Number(last.valor_total || 0) - d).toFixed(2));
        const novoUnit = parseFloat((novoTotal / Number(last.quantidade || 1)).toFixed(2));
        novasPecas = [...novasPecas.slice(0, -1), { ...last, valor_unitario: novoUnit, valor_total: novoTotal }];
      } else if (novosServicos.length > 0) {
        const last = novosServicos[novosServicos.length - 1];
        novosServicos = [...novosServicos.slice(0, -1), { ...last, valor: parseFloat((Number(last.valor || 0) - d).toFixed(2)) }];
      }
      const calc = recalcular(novosServicos, novasPecas, 0);
      setForm(f => ({ ...f, servicos: novosServicos, pecas: novasPecas, desconto: 0, ...calc }));
    } else {
      const fator = 1 - d / totalBruto;
      let novosServicos = form.servicos.map(s => ({ ...s, valor: parseFloat((Number(s.valor || 0) * fator).toFixed(2)) }));
      let novasPecas = form.pecas.map(p => { const novoUnit = parseFloat((Number(p.valor_unitario || 0) * fator).toFixed(2)); return { ...p, valor_unitario: novoUnit, valor_total: parseFloat((novoUnit * Number(p.quantidade || 1)).toFixed(2)) }; });
      const totalDistribuido = parseFloat((novosServicos.reduce((s, x) => s + Number(x.valor || 0), 0) + novasPecas.reduce((s, x) => s + Number(x.valor_total || 0), 0)).toFixed(2));
      const totalEsperado = parseFloat((totalBruto - d).toFixed(2));
      const diff = parseFloat((totalEsperado - totalDistribuido).toFixed(2));
      if (diff !== 0) { if (novasPecas.length > 0) { const last = novasPecas[novasPecas.length - 1]; const novoTotal = parseFloat((Number(last.valor_total || 0) + diff).toFixed(2)); const novoUnit = parseFloat((novoTotal / Number(last.quantidade || 1)).toFixed(2)); novasPecas = [...novasPecas.slice(0, -1), { ...last, valor_unitario: novoUnit, valor_total: novoTotal }]; } else if (novosServicos.length > 0) { const last = novosServicos[novosServicos.length - 1]; novosServicos = [...novosServicos.slice(0, -1), { ...last, valor: parseFloat((Number(last.valor || 0) + diff).toFixed(2)) }]; } }
      const calc = recalcular(novosServicos, novasPecas, 0);
      setForm(f => ({ ...f, servicos: novosServicos, pecas: novasPecas, desconto: 0, ...calc }));
    }
    setDescontoInput(0);
  };

  const updateParcela = (i, field, val) => {
    if (field === "forma_pagamento") {
      const novoVenc = calcularVencimentoParcela(val, new Date().toISOString().split("T")[0]);
      setParcelasSync(prev => prev.map((p, idx) => idx === i ? { ...p, forma_pagamento: val, vencimento: novoVenc } : p));
      return;
    }
    setParcelasSync(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: field === "valor" ? (Number(val) || 0) : val } : p));
  };

  const onStatusChange = (novoStatus) => {
    setForm(f => ({ ...f, status: novoStatus }));
  };

  const confirmarReabrir = async () => {
    setForm(f => ({ ...f, status: statusPendente }));
    setShowAvisoReabrir(false);
    setStatusPendente(null);
  };

  const aplicarDesconto = () => {
    const d = parseFloat(String(descontoInput).replace(',', '.')) || 0;
    if (d <= 0) return;
    const totalBruto = form.valor_servicos + form.valor_pecas;
    if (totalBruto <= 0) return;
    const fator = 1 - d / totalBruto;

    let novosServicos = form.servicos.map(s => ({
      ...s,
      valor: parseFloat((Number(s.valor || 0) * fator).toFixed(2))
    }));

    let novasPecas = form.pecas.map(p => {
      const novoUnit = parseFloat((Number(p.valor_unitario || 0) * fator).toFixed(2));
      return { ...p, valor_unitario: novoUnit, valor_total: parseFloat((novoUnit * Number(p.quantidade || 1)).toFixed(2)) };
    });

    const totalDistribuido = parseFloat((
      novosServicos.reduce((s, x) => s + Number(x.valor || 0), 0) +
      novasPecas.reduce((s, x) => s + Number(x.valor_total || 0), 0)
    ).toFixed(2));

    const totalEsperado = parseFloat((totalBruto - d).toFixed(2));
    const diff = parseFloat((totalEsperado - totalDistribuido).toFixed(2));

    if (diff !== 0) {
      if (novasPecas.length > 0) {
        const last = novasPecas[novasPecas.length - 1];
        const novoTotal = parseFloat((Number(last.valor_total || 0) + diff).toFixed(2));
        const novoUnit = parseFloat((novoTotal / Number(last.quantidade || 1)).toFixed(2));
        novasPecas = [...novasPecas.slice(0, -1), { ...last, valor_unitario: novoUnit, valor_total: novoTotal }];
      } else if (novosServicos.length > 0) {
        const last = novosServicos[novosServicos.length - 1];
        novosServicos = [...novosServicos.slice(0, -1), { ...last, valor: parseFloat((Number(last.valor || 0) + diff).toFixed(2)) }];
      }
    }

    const calc = recalcular(novosServicos, novasPecas, 0);
    setForm(f => ({ ...f, servicos: novosServicos, pecas: novasPecas, desconto: 0, ...calc }));
    setDescontoInput(0);
  };

  const temCustoZero = () => {
    return (form.pecas || []).some(p => Number(p.valor_custo || 0) === 0);
  };

  const pagarParcelaInternal = (i) => {
    setParcelasSync(prev => prev.map((par, idx) => idx === i ? { ...par, financeiro_status: "Pago" } : par));
  };

  const pagarParcela = (i) => {
    if (temCustoZero()) {
      setParcelaAPagar(i);
      setShowConfirmCustoZero(true);
      return;
    }
    pagarParcelaInternal(i);
  };

  const cancelarParcela = (i) => {
    setParcelasSync(prev => prev.map((par, idx) => idx === i ? { ...par, financeiro_status: "Pendente" } : par));
    if (form.status === "Concluído") {
      setForm(f => ({ ...f, status: "Aberto" }));
    }
  };

  const onFormaParcelaChange = async (i, val) => {
    const p = parcelas[i];
    const novas = parcelas.map((par, idx) => idx === i ? { ...par, forma_pagamento: val } : par);
    setParcelasSync(novas);
    if (p.financeiro_id && os?.id) {
      await base44.entities.Financeiro.update(p.financeiro_id, { forma_pagamento: val });
      await base44.entities.Vendas.update(os.id, { parcelas_detalhes: novas });
    }
  };

  const validarTelefone = (val) => {
    if (!val) return true;
    const digits = val.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
  };

  const salvar = async () => {
    if (!form.cliente_nome && !form.cliente_id) return alert("Selecione ou informe o cliente.");
    if (!validarTelefone(form.cliente_telefone)) {
      setErroTelefone("O telefone de contato deve ter exatamente 10 ou 11 dígitos (DDD + número).\nEx: 34 3822 2085 ou 34 98885 1245");
      return;
    }
    const pecasPendentes = (form.pecas || []).filter(p => p._new);
    const servicosPendentes = (form.servicos || []).filter(s => s._new);
    if (pecasPendentes.length > 0) return alert("Selecione o produto antes de salvar. Há produto(s) adicionados sem seleção.");
    if (servicosPendentes.length > 0) return alert("Selecione o serviço antes de salvar. Há serviço(s) adicionados sem seleção.");
    const pecasSemCodigo = form.status !== "Orçamento" ? (form.pecas || []).filter(p => !p.codigo?.trim()) : [];
    const servicosSemCodigo = form.status !== "Orçamento" ? (form.servicos || []).filter(s => !s.codigo?.trim()) : [];
    if (pecasSemCodigo.length > 0) return alert(`Produto(s) sem código: ${pecasSemCodigo.map(p => p.descricao || 'sem descrição').join(', ')}. Preencha o código antes de salvar.`);
    if (servicosSemCodigo.length > 0) return alert(`Serviço(s) sem código: ${servicosSemCodigo.map(s => s.descricao || 'sem descrição').join(', ')}. Preencha o código antes de salvar.`);
    const totalParcelas = parcelasRef.current.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const diff = Math.abs(totalParcelas - form.valor_total);
    if (diff > 0.05) {
      setAlertaModal({
        titulo: "Parcelas não conferem",
        mensagem: `O total das parcelas (R$ ${totalParcelas.toLocaleString('pt-BR', {minimumFractionDigits:2})}) não confere com o valor da venda (R$ ${Number(form.valor_total).toLocaleString('pt-BR', {minimumFractionDigits:2})}).\n\nCorrija os valores antes de salvar.`
      });
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      const t0 = performance.now();
      const log = (msg) => console.log(`[SALVAR] ${msg} — ${(performance.now()-t0).toFixed(0)}ms`);
      const parcelasNormalizadas = parcelasRef.current.map(p => ({ ...p, valor: Number(p.valor) || 0 }));
      const formaPrincipal = parcelasNormalizadas[0]?.forma_pagamento || form.forma_pagamento || "A Combinar";
      const pecasLimpas = (form.pecas || []).map(({ _new, _custoStr, ...p }, idx) => {
        const isXX = (p.codigo || '').toUpperCase() === 'XX';
        if (isXX) {
          const custoStr = xxCustos[idx];
          const val = custoStr !== undefined
            ? (parseFloat(String(custoStr).replace(',', '.')) || 0)
            : (p.valor_custo || 0);
          return { ...p, valor_custo: val };
        }
        return { ...p };
      });

      const servicosLimpos = (form.servicos || []).map(({ _new, ...s }) => ({ ...s, codigo: s.codigo?.trim() || "101" }));
      let formFinal = { ...form, pecas: pecasLimpas, servicos: servicosLimpos, parcelas_detalhes: parcelasNormalizadas, forma_pagamento: formaPrincipal };

      // Para nova venda, usa o número já calculado no useEffect (form.numero)
      // Não precisa fazer list novamente

      const eraAberta = os?.status !== "Concluído";
      const ficouConcluida = formFinal.status === "Concluído";
      let savedId = os?.id;

      if (!os) {
        const criado = await base44.entities.Vendas.create(formFinal);
        savedId = criado.id;
        log('Venda criada');
      } else {
        await base44.entities.Vendas.update(os.id, formFinal);
        log('Venda atualizada');
      }

      if (formFinal.status === "Orçamento") {
        onSave({ ...formFinal, id: savedId });
        return;
      }
      const finExistentes = await base44.entities.Financeiro.filter({ ordem_venda_id: savedId }, "-created_date", 100);
      log('Financeiro buscado');
      const parcelasAtualizadas = [...parcelasNormalizadas];

      // Processar todas as parcelas em PARALELO
      await Promise.all(parcelasAtualizadas.map(async (parcela, idx) => {
        const descParcela = `Parcela ${idx+1}/${parcelasAtualizadas.length}`;
        const jaExiste = parcela.financeiro_id
          ? finExistentes.find(f => f.id === parcela.financeiro_id)
          : finExistentes.find(f => f.descricao?.includes(descParcela));

        if (jaExiste) {
          const statusFin = parcela.financeiro_status || "Pendente";
          await base44.entities.Financeiro.update(jaExiste.id, {
            data_vencimento: parcela.vencimento,
            forma_pagamento: parcela.forma_pagamento || "A Combinar",
            valor: parcela.valor || 0,
            status: statusFin,
            data_pagamento: statusFin === "Pago" ? (jaExiste.data_pagamento || new Date().toISOString().split("T")[0]) : "",
          });
          if (!parcela.financeiro_id) {
            parcelasAtualizadas[idx] = { ...parcela, financeiro_id: jaExiste.id };
          }
        } else {
          const statusSelecionado = parcela.financeiro_status || "Pendente";
          const fin = await base44.entities.Financeiro.create({
            tipo: "Receita",
            categoria: "Ordem de Venda",
            descricao: `Venda #${formFinal.numero} — ${formFinal.cliente_nome || ""} — Parcela ${idx+1}/${parcelasAtualizadas.length}`,
            valor: parcela.valor || 0,
            data_vencimento: parcela.vencimento,
            status: statusSelecionado,
            data_pagamento: statusSelecionado === "Pago" ? new Date().toISOString().split("T")[0] : "",
            forma_pagamento: parcela.forma_pagamento || "A Combinar",
            ordem_venda_id: savedId,
            cliente_id: formFinal.cliente_id || "",
          });
          parcelasAtualizadas[idx] = { ...parcela, financeiro_id: fin.id, financeiro_status: statusSelecionado };
        }
      }));

      // Salvar parcelas atualizadas e deletar financeiros órfãos em paralelo
      const idsNovos = new Set(parcelasAtualizadas.map(p => p.financeiro_id).filter(Boolean));
      const finParaDeletar = finExistentes.filter(fin => !idsNovos.has(fin.id));
      await Promise.all([
        base44.entities.Vendas.update(savedId, { parcelas_detalhes: parcelasAtualizadas }),
        ...finParaDeletar.map(fin => base44.entities.Financeiro.delete(fin.id)),
      ]);
      log('Parcelas/financeiro salvos');

      const todasPagas = parcelasAtualizadas.length > 0 && parcelasAtualizadas.every(p => (p.financeiro_status || "Pendente") === "Pago");
      if (todasPagas && formFinal.status !== "Concluído") {
        const dataConclusao = new Date().toISOString().split("T")[0];
        formFinal = { ...formFinal, status: "Concluído", data_conclusao: dataConclusao };
        await base44.entities.Vendas.update(savedId, { status: "Concluído", data_conclusao: dataConclusao });
      }

      log('Iniciando ajuste estoque');
      // Ajuste de estoque: SEMPRE ao salvar (exceto Orçamento)
      if (savedId) {
        const oldPecas = os?.pecas || [];
        const newPecas = formFinal.pecas || [];
        // Reutiliza o estoque já carregado em memória — evita nova chamada ao banco
        const estoqueAtual = estoque;

        if (!os) {
          // Nova venda: reduzir todas as peças
          if (newPecas.length > 0) await reduzirEstoque(newPecas, { id: savedId, numero: formFinal.numero }, estoqueAtual);
        } else {
          // Editando: diff old vs new
          const removidas = oldPecas.filter(op => op.estoque_id && !newPecas.find(np => np.estoque_id === op.estoque_id));
          const adicionadas = newPecas.filter(np => np.estoque_id && !oldPecas.find(op => op.estoque_id === np.estoque_id));
          const alteradas = newPecas.filter(np => {
            if (!np.estoque_id) return false;
            const old = oldPecas.find(op => op.estoque_id === np.estoque_id);
            return old && Number(old.quantidade) !== Number(np.quantidade);
          });
          if (removidas.length > 0) await restaurarEstoque(removidas, os.id, estoqueAtual);
          if (alteradas.length > 0) {
            const oldAlteradas = alteradas.map(np => oldPecas.find(op => op.estoque_id === np.estoque_id));
            await restaurarEstoque(oldAlteradas, os.id, estoqueAtual);
            // Reutiliza estoqueAtual após restaurar (otimização: evita novo list)
            await reduzirEstoque(alteradas, { id: savedId, numero: formFinal.numero }, estoqueAtual);
          }
          if (adicionadas.length > 0) await reduzirEstoque(adicionadas, { id: savedId, numero: formFinal.numero }, estoqueAtual);
        }
      }

      log('FIM - tudo concluído');
      onSave({ ...formFinal, id: savedId });
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl my-4">
        <div style={{display:"none"}} aria-hidden="true">
          <input type="text" name="username" autoComplete="username" tabIndex={-1} />
          <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
          <input type="text" name="address" autoComplete="street-address" tabIndex={-1} />
          <input type="email" name="email" autoComplete="email" tabIndex={-1} />
        </div>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{os ? `Venda #${os.numero}` : "Nova Venda"}</h2>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>



        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Número Venda">
              {os ? (
                <div className="input-dark text-gray-400" style={{cursor:'default'}}>{form.numero}</div>
              ) : (
                <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className="input-dark" autoComplete="off" />
              )}
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => onStatusChange(e.target.value)} className="input-dark">
                {["Aberto", "Orçamento", "Concluído"].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Data Entrada">
              <input type="date" value={form.data_entrada} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} className="input-dark" autoComplete="off" />
            </Field>
          </div>

          <React.Fragment>
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
                                <span className="font-medium">{item.nome}</span>
                                {item.nome_fantasia && <span className="text-gray-400 ml-1">— {item.nome_fantasia}</span>}
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
                  <Field label="Nome Social / Nome Fantasia">
                    <input value={form.cliente_nome_fantasia || ""} onChange={e => setForm(f => ({ ...f, cliente_nome_fantasia: e.target.value }))} className="input-dark" autoComplete="new-password" />
                  </Field>
                  <Field label="Contato">
                    <input ref={contatoRef} value={form.cliente_telefone} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))}
                      onBlur={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        let formatted = e.target.value;
                        if (digits.length === 10) formatted = `${digits.slice(0,2)} ${digits.slice(2,6)} ${digits.slice(6)}`;
                        else if (digits.length === 11) formatted = `${digits.slice(0,2)} ${digits.slice(2,7)} ${digits.slice(7)}`;
                        setForm(f => ({ ...f, cliente_telefone: formatted }));
                      }}
                      onKeyDown={e => handleNavKey(e, veiculoRef)} className="input-dark" autoComplete="new-password" />
                  </Field>

                </div>
              </Section>

              <div>
                <div className="border-b border-gray-700 pb-2 mb-3">
                  <h3 className="text-sm font-medium text-white">Veículo</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {form.cliente_id && veiculosCliente.length > 0 && (
                    <Field label="Selecionar Veículo" className="col-span-2 md:col-span-4">
                      <select value={form.veiculo_id} onChange={e => onVeiculoChange(e.target.value)} className="input-dark">
                        <option value="">— Selecione —</option>
                        {veiculosCliente.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo} {v.ano}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Modelo"><input ref={veiculoRef} value={form.veiculo_modelo} onChange={e => setForm(f => ({ ...f, veiculo_modelo: e.target.value }))} onKeyDown={e => handleNavKey(e, placaRef)} className="input-dark" autoComplete="new-password" /></Field>
                  <Field label="Placa"><input ref={placaRef} value={form.veiculo_placa} onChange={e => setForm(f => ({ ...f, veiculo_placa: e.target.value }))} onKeyDown={e => handleNavKey(e, kmRef)} className="input-dark" autoComplete="new-password" placeholder="AAA0000" /></Field>
                  <Field label="KM"><input ref={kmRef} value={form.quilometragem} onChange={e => setForm(f => ({ ...f, quilometragem: e.target.value }))} className="input-dark" autoComplete="new-password" /></Field>
                </div>
              </div>



              <Section title="Produtos">
                <DragDropContext onDragEnd={r => onDragEnd(r, 'pecas')}>
                  <Droppable droppableId="pecas">
                    {provided => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {(form.pecas || []).map((p, i) => (
                          <Draggable key={p.estoque_id ? `peca-${p.estoque_id}-${i}` : `peca-new-${i}`} draggableId={p.estoque_id ? `peca-${p.estoque_id}-${i}` : `peca-new-${i}`} index={i} isDragDisabled={p._new}>
                            {(drag, snap) => (
                              <div ref={drag.innerRef} {...drag.draggableProps} className={`bg-gray-800/50 rounded-xl p-3 mb-2 ${snap.isDragging ? 'ring-2 ring-orange-500' : ''}`}>
                                {p._new ? (
                                  <div className="flex gap-2 items-center">
                                    <div className="flex-1">
                                      <SearchableSelect
                                        placeholder="Selecionar produto do estoque..."
                                        options={[...estoque].sort((a, b) => {
                                           if (a.codigo?.toUpperCase() === 'XX') return -1;
                                           if (b.codigo?.toUpperCase() === 'XX') return 1;
                                           return 0;
                                         }).map(e => ({ value: e.id, label: e.descricao, sublabel: [e.codigo ? `Cód: ${e.codigo}` : '', e.valor_venda ? `R$ ${Number(e.valor_venda).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : ''].filter(Boolean).join(' | ') }))}
                                        onSelect={opt => { const item = estoque.find(e => e.id === opt.value); if (item) selecionarProduto(i, item); }}
                                      />
                                    </div>
                                    <button onClick={() => removePeca(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-2"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                   {/* Desktop */}
                                   <div className="hidden lg:flex flex-wrap lg:flex-nowrap gap-2 items-end">
                                     <div {...drag.dragHandleProps} className="flex items-center self-center pb-0.5 cursor-grab text-gray-600 hover:text-gray-400 flex-shrink-0">
                                       <GripVertical className="w-4 h-4" />
                                     </div>
                                     <div className="w-16 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Código</label>
                                       <input value={p.codigo || ''} onChange={e => updatePeca(i, "codigo", e.target.value)} className="input-dark text-sm" autoComplete="off" />
                                     </div>
                                     <div className="flex-1 min-w-[200px]">
                                       <label className="text-xs text-gray-500 mb-1 block">Produto</label>
                                       <input value={p.descricao} onChange={e => updatePeca(i, "descricao", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div className="w-16 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                                       <input value={p.quantidade} onChange={e => updatePeca(i, "quantidade", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div className="w-20 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label>
                                       <input
                                         type="text"
                                         inputMode="decimal"
                                         value={p.valor_unitario}
                                         onChange={e => updatePeca(i, "valor_unitario", e.target.value)}
                                         className="input-dark" autoComplete="off" />
                                     </div>
                                     <div className="w-20 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Total</label>
                                       <div className="input-dark text-gray-300 text-sm">{Number(p.valor_total || 0).toFixed(2)}</div>
                                     </div>
                                     <div className="w-20 flex-shrink-0">
                                      <label className="text-xs text-gray-500 mb-1 block">Custo</label>
                                      {(p.codigo || '').toUpperCase() === 'XX' ? (
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={xxCustos[i] !== undefined ? xxCustos[i] : String(p.valor_custo || 0)}
                                          onChange={e => {
                                            const raw = e.target.value;
                                            setXXCustos(prev => ({ ...prev, [i]: raw }));
                                          }}
                                          onBlur={e => {
                                            const raw = e.target.value;
                                            const val = parseFloat(raw.replace(',', '.')) || 0;
                                            setXXCustos(prev => ({ ...prev, [i]: String(val) }));
                                            setForm(f => ({ ...f, pecas: f.pecas.map((x, xi) => xi !== i ? x : { ...x, valor_custo: val }) }));
                                          }}
                                          className="input-dark text-yellow-400 text-sm"
                                          autoComplete="off"
                                        />
                                      ) : (
                                        <div className="input-dark text-yellow-400 text-sm">{Number(p.valor_custo || 0).toFixed(2)}</div>
                                      )}
                                     </div>
                                     <button onClick={() => removePeca(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-2 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                                   </div>
                                   {/* Tablet */}
                                   <div className="hidden md:grid lg:hidden gap-2 grid-cols-3">
                                     <div className="col-span-3">
                                       <label className="text-xs text-gray-500 mb-1 block">Produto</label>
                                       <input value={p.descricao} onChange={e => updatePeca(i, "descricao", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div>
                                       <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                                       <input value={p.quantidade} onChange={e => updatePeca(i, "quantidade", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div>
                                       <label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label>
                                       <input type="text" inputMode="decimal" value={p.valor_unitario} onChange={e => updatePeca(i, "valor_unitario", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div>
                                       <label className="text-xs text-gray-500 mb-1 block">Total</label>
                                       <div className="text-gray-300 text-sm font-semibold">R$ {Number(p.valor_total || 0).toFixed(2)}</div>
                                     </div>
                                     <div className="col-span-3 flex justify-between items-end">
                                       <div>
                                         <label className="text-xs text-gray-500 mb-1 block">Custo</label>
                                         {(p.codigo || '').toUpperCase() === 'XX' ? (
                                           <input type="text" inputMode="decimal" value={xxCustos[i] !== undefined ? xxCustos[i] : String(p.valor_custo || 0)} onChange={e => setXXCustos(prev => ({ ...prev, [i]: e.target.value }))} className="input-dark text-yellow-400 text-sm" autoComplete="off" />
                                         ) : (
                                           <div className="input-dark text-yellow-400 text-sm">{Number(p.valor_custo || 0).toFixed(2)}</div>
                                         )}
                                       </div>
                                       <button onClick={() => removePeca(i)} className="text-red-400 hover:text-red-300 p-2"><Trash2 className="w-4 h-4" /></button>
                                     </div>
                                   </div>
                                   {/* Mobile */}
                                    <div className="md:hidden space-y-2">
                                      <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex-1 min-w-0">
                                              <label className="text-xs text-gray-400 block mb-1">Produto</label>
                                              <input value={p.descricao} onChange={e => updatePeca(i, "descricao", e.target.value)} className="input-dark text-sm w-full" autoComplete="off" />
                                            </div>
                                            <button onClick={() => removePeca(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-1 mt-6"><Trash2 className="w-4 h-4" /></button>
                                          </div>
                                        <div className="grid grid-cols-3 gap-2">
                                          <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                                            <input value={p.quantidade} onChange={e => updatePeca(i, "quantidade", e.target.value)} className="input-dark text-sm" inputMode="numeric" autoComplete="off" />
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label>
                                            <input type="text" inputMode="decimal" value={p.valor_unitario} onChange={e => updatePeca(i, "valor_unitario", e.target.value)} className="input-dark text-sm" autoComplete="off" />
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Total</label>
                                            <div className="input-dark text-sm text-orange-400 font-semibold text-center">{Number(p.valor_total || 0).toFixed(2)}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                <div className="flex justify-end mb-3">
                  <button onClick={addPeca} className="flex items-center gap-2 text-black px-4 py-2 rounded-lg text-sm font-semibold" style={{background:"#00ff00"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
                </Section>

              <Section title="Serviços">
                <DragDropContext onDragEnd={r => onDragEnd(r, 'servicos')}>
                  <Droppable droppableId="servicos">
                    {provided => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {(form.servicos || []).map((s, i) => (
                          <Draggable key={s.codigo ? `servico-${s.codigo}-${i}` : `servico-new-${i}`} draggableId={s.codigo ? `servico-${s.codigo}-${i}` : `servico-new-${i}`} index={i} isDragDisabled={s._new}>
                            {(drag, snap) => (
                              <div ref={drag.innerRef} {...drag.draggableProps} className={`bg-gray-800/50 rounded-xl p-3 mb-2 ${snap.isDragging ? 'ring-2 ring-orange-500' : ''}`}>
                                {s._new ? (
                                  <div className="flex gap-2 items-center">
                                    <div className="flex-1">
                                      <SearchableSelect
                                        placeholder="Selecionar serviço cadastrado..."
                                        options={servicosCad.map(sv => ({ value: sv.id, label: sv.descricao, sublabel: sv.valor ? `R$ ${Number(sv.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '' }))}
                                        onSelect={opt => { const item = servicosCad.find(sv => sv.id === opt.value); if (item) selecionarServico(i, item); }}
                                      />
                                    </div>
                                    <button onClick={() => removeServico(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-2"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                   {/* Desktop */}
                                   <div className="hidden lg:flex flex-wrap lg:flex-nowrap gap-2 items-end">
                                     <div {...drag.dragHandleProps} className="flex items-center self-center pb-0.5 cursor-grab text-gray-600 hover:text-gray-400 flex-shrink-0">
                                       <GripVertical className="w-4 h-4" />
                                     </div>
                                     <div className="w-16 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Código</label>
                                       <input value={s.codigo || ''} onChange={e => updateServico(i, "codigo", e.target.value)} className="input-dark text-sm" autoComplete="off" />
                                     </div>
                                     <div className="flex-1 min-w-[200px]">
                                       <label className="text-xs text-gray-500 mb-1 block">Serviço</label>
                                       <input value={s.descricao} onChange={e => updateServico(i, "descricao", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div className="w-16 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                                       <input value={s.quantidade ?? 1} onChange={e => updateServico(i, "quantidade", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div className="w-20 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label>
                                       <input
                                         type="text"
                                         inputMode="decimal"
                                         value={s.valor}
                                         onChange={e => updateServico(i, "valor", e.target.value)}
                                         className="input-dark" autoComplete="off" />
                                     </div>
                                     <div className="w-20 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Total</label>
                                       <div className="input-dark text-gray-300 text-sm">{(Number(s.valor || 0) * Number(s.quantidade ?? 1)).toFixed(2)}</div>
                                     </div>
                                     <div className="w-20 flex-shrink-0">
                                       <label className="text-xs text-gray-500 mb-1 block">Custo</label>
                                       <input
                                         type="text"
                                         inputMode="decimal"
                                         value={s.valor_custo || 0}
                                         onChange={e => {
                                           const val = Number(String(e.target.value).replace(',', '.')) || 0;
                                           setForm(f => ({ ...f, servicos: f.servicos.map((x, idx) => idx === i ? { ...x, valor_custo: val } : x) }));
                                         }}
                                         className="input-dark text-yellow-400 text-sm"
                                         autoComplete="off"
                                       />
                                     </div>
                                     <button onClick={() => removeServico(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-2 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                                   </div>
                                   {/* Tablet */}
                                   <div className="hidden md:grid lg:hidden gap-2 grid-cols-3">
                                     <div className="col-span-3">
                                       <label className="text-xs text-gray-500 mb-1 block">Serviço</label>
                                       <input value={s.descricao} onChange={e => updateServico(i, "descricao", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div>
                                       <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                                       <input value={s.quantidade ?? 1} onChange={e => updateServico(i, "quantidade", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div>
                                       <label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label>
                                       <input type="text" inputMode="decimal" value={s.valor} onChange={e => updateServico(i, "valor", e.target.value)} className="input-dark" autoComplete="off" />
                                     </div>
                                     <div>
                                       <label className="text-xs text-gray-500 mb-1 block">Total</label>
                                       <div className="text-gray-300 text-sm font-semibold">R$ {(Number(s.valor || 0) * Number(s.quantidade ?? 1)).toFixed(2)}</div>
                                     </div>
                                     <div className="col-span-3 flex justify-between items-end">
                                       <div>
                                         <label className="text-xs text-gray-500 mb-1 block">Custo</label>
                                         <input type="text" inputMode="decimal" value={s.valor_custo || 0} onChange={e => { const val = Number(String(e.target.value).replace(',', '.')) || 0; setForm(f => ({ ...f, servicos: f.servicos.map((x, idx) => idx === i ? { ...x, valor_custo: val } : x) })); }} className="input-dark text-yellow-400 text-sm" autoComplete="off" />
                                       </div>
                                       <button onClick={() => removeServico(i)} className="text-red-400 hover:text-red-300 p-2"><Trash2 className="w-4 h-4" /></button>
                                     </div>
                                   </div>
                                   {/* Mobile */}
                                   <div className="md:hidden space-y-2">
                                     <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
                                       <div className="flex items-start justify-between gap-2 mb-2">
                                           <div className="flex-1 min-w-0">
                                             <label className="text-xs text-gray-400 block mb-1">Serviço</label>
                                             <input value={s.descricao} onChange={e => updateServico(i, "descricao", e.target.value)} className="input-dark text-sm w-full" autoComplete="off" />
                                           </div>
                                           <button onClick={() => removeServico(i)} className="text-red-400 hover:text-red-300 flex-shrink-0 p-1 mt-6"><Trash2 className="w-4 h-4" /></button>
                                         </div>
                                       <div className="grid grid-cols-3 gap-2">
                                         <div>
                                           <label className="text-xs text-gray-500 mb-1 block">Qtd</label>
                                           <input value={s.quantidade ?? 1} onChange={e => updateServico(i, "quantidade", e.target.value)} className="input-dark text-sm" inputMode="numeric" autoComplete="off" />
                                         </div>
                                         <div>
                                           <label className="text-xs text-gray-500 mb-1 block">Valor Unit.</label>
                                           <input type="text" inputMode="decimal" value={s.valor} onChange={e => updateServico(i, "valor", e.target.value)} className="input-dark text-sm" autoComplete="off" />
                                         </div>
                                         <div>
                                           <label className="text-xs text-gray-500 mb-1 block">Total</label>
                                           <div className="input-dark text-sm text-orange-400 font-semibold text-center">{(Number(s.valor || 0) * Number(s.quantidade ?? 1)).toFixed(2)}</div>
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                <div className="flex justify-end">
                  <button onClick={addServico} className="flex items-center gap-2 text-black px-4 py-2 rounded-lg text-sm font-semibold" style={{background:"#00ff00"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
                </Section>

              <Section title="Pagamento">
                {/* Desktop */}
                <div className="hidden lg:grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Desconto</label>
                    <select value={form.tipo_desconto || 'reais'} onChange={e => setForm({...form, tipo_desconto: e.target.value})} className="input-dark">
                      <option value="reais">Em R$</option>
                      <option value="percentual">Em %</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Valor</label>
                    <div className="flex gap-2">
                      <input type="text" inputMode="decimal" value={descontoInput} onChange={e => handleDescontoChange(e.target.value)} className="input-dark" placeholder="0" autoComplete="off" />
                      <button type="button" onClick={aplicarDescontoAgora} className="px-3 py-1 rounded text-black text-sm font-semibold whitespace-nowrap transition-all" style={{background:"#00ff00"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>Aplicar</button>
                    </div>
                  </div>
                  <Field label="Nº de Parcelas">
                    <input value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} className="input-dark" autoComplete="off" />
                  </Field>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Total Geral</label>
                    <div className="input-dark font-bold text-orange-400">R$ {fmt(form.valor_total)}</div>
                  </div>
                </div>
                {/* Mobile/Tablet */}
                <div className="lg:hidden space-y-3 mb-4">
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Desconto</label>
                      <select value={form.tipo_desconto || 'reais'} onChange={e => setForm({...form, tipo_desconto: e.target.value})} className="input-dark text-sm" style={{paddingRight: '24px'}}>
                        <option value="reais">Em R$</option>
                        <option value="percentual">Em %</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Valor</label>
                      <input type="text" inputMode="decimal" value={descontoInput} onChange={e => handleDescontoChange(e.target.value)} className="input-dark text-sm" placeholder="0" autoComplete="off" />
                    </div>
                    <button type="button" onClick={aplicarDescontoAgora} className="px-2 py-2 rounded text-black text-xs font-semibold transition-all" style={{background:"#00ff00"}} onMouseEnter={e => e.currentTarget.style.background="#00dd00"} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>Aplicar</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Nº de Parcelas">
                      <input value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))} className="input-dark text-sm" autoComplete="off" />
                    </Field>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Total Geral</label>
                      <div className="input-dark font-bold text-orange-400 text-sm">R$ {fmt(form.valor_total)}</div>
                    </div>
                  </div>
                </div>

                {parcelas.length > 0 && (
                  <div className="border border-gray-700 rounded-xl overflow-x-auto">
                    {/* Desktop */}
                    <div className="hidden lg:block">
                      <div className="bg-gray-800 px-3 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wider grid gap-2" style={{gridTemplateColumns:'1fr 1fr 1fr auto'}}>
                        <span>Vencimento</span>
                        <span>Valor (R$)</span>
                        <span>Forma Pgto</span>
                        <span>Status</span>
                      </div>
                      {parcelas.map((p, i) => (
                        <div key={i} className={`grid gap-2 px-3 py-2 items-center ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/40"}`} style={{gridTemplateColumns:'1fr 1fr 1fr auto'}}>
                          <input type="date" value={p.vencimento || ""} onChange={e => updateParcela(i, "vencimento", e.target.value)} className="input-dark text-xs py-1.5" />
                          <input type="text" inputMode="decimal" value={p.valor} onChange={e => updateParcela(i, "valor", e.target.value)} className="input-dark text-xs py-1.5" style={{MozAppearance:"textfield", appearance:"textfield"}} />
                          <select value={p.forma_pagamento || "A Combinar"} onChange={e => onFormaParcelaChange(i, e.target.value)} className="input-dark text-xs py-1.5">
                            {["A Combinar","Boleto","Cartão","Cheque","Dinheiro","PIX"].map(s => <option key={s}>{s}</option>)}
                          </select>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {p.financeiro_id ? (
                              <>
                                <button type="button" onClick={() => cancelarParcela(i)} className="text-xs font-semibold px-2 py-1.5 rounded whitespace-nowrap transition-all" style={{background: (p.financeiro_status || "Pendente") === "Pendente" ? "#062C9B" : "#374151", color: "#fff"}}>Pend</button>
                                <button type="button" onClick={() => pagarParcela(i)} className="text-xs font-semibold px-2 py-1.5 rounded whitespace-nowrap transition-all" style={{background: (p.financeiro_status || "Pendente") === "Pago" ? "#16a34a" : "#374151", color: "#fff"}}>Pago</button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => { updateParcela(i, "financeiro_status", "Pendente"); if (form.status === "Conclu\u00eddo") { setForm(f => ({ ...f, status: "Aberto" })); if (os?.id) base44.entities.Vendas.update(os.id, { status: "Aberto" }); } }} className="text-xs font-semibold px-2 py-1.5 rounded whitespace-nowrap transition-all" style={{background: (p.financeiro_status || "Pendente") === "Pendente" ? "#062C9B" : "#374151", color: "#fff"}}>Pend</button>
                                <button type="button" onClick={() => updateParcela(i, "financeiro_status", "Pago")} className="text-xs font-semibold px-2 py-1.5 rounded whitespace-nowrap transition-all" style={{background: (p.financeiro_status || "Pendente") === "Pago" ? "#16a34a" : "#374151", color: "#fff"}}>Pago</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Mobile/Tablet */}
                    <div className="lg:hidden space-y-2 p-3">
                      {parcelas.map((p, i) => (
                        <div key={i} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 space-y-2">
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Vencimento</label>
                              <input type="date" value={p.vencimento || ""} onChange={e => updateParcela(i, "vencimento", e.target.value)} className="input-dark text-sm w-full" style={{paddingRight: '32px'}} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Valor</label>
                              <input type="text" inputMode="decimal" value={p.valor} onChange={e => updateParcela(i, "valor", e.target.value)} className="input-dark text-sm w-full" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Forma de Pagamento</label>
                            <select value={p.forma_pagamento || "A Combinar"} onChange={e => onFormaParcelaChange(i, e.target.value)} className="input-dark text-sm w-full">
                              {["A Combinar","Boleto","Cartão","Cheque","Dinheiro","PIX"].map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            {p.financeiro_id ? (
                              <>
                                <button type="button" onClick={() => cancelarParcela(i)} className="flex-1 text-sm font-semibold py-2 rounded transition-all" style={{background: (p.financeiro_status || "Pendente") === "Pendente" ? "#062C9B" : "#374151", color: "#fff"}}>Pendente</button>
                                <button type="button" onClick={() => pagarParcela(i)} className="flex-1 text-sm font-semibold py-2 rounded transition-all" style={{background: (p.financeiro_status || "Pendente") === "Pago" ? "#16a34a" : "#374151", color: "#fff"}}>Pago</button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => { updateParcela(i, "financeiro_status", "Pendente"); if (form.status === "Conclu\u00eddo") { setForm(f => ({ ...f, status: "Aberto" })); if (os?.id) base44.entities.Vendas.update(os.id, { status: "Aberto" }); } }} className="flex-1 text-sm font-semibold py-2 rounded transition-all" style={{background: (p.financeiro_status || "Pendente") === "Pendente" ? "#062C9B" : "#374151", color: "#fff"}}>Pendente</button>
                                <button type="button" onClick={() => updateParcela(i, "financeiro_status", "Pago")} className="flex-1 text-sm font-semibold py-2 rounded transition-all" style={{background: (p.financeiro_status || "Pendente") === "Pago" ? "#16a34a" : "#374151", color: "#fff"}}>Pago</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
              </React.Fragment>
        </div>

        {/* Lucro Bruto */}
        {(() => {
          const custoTotal = (form.pecas || []).reduce((acc, p) => acc + Number(p.valor_custo || 0) * Number(p.quantidade || 1), 0) + (form.servicos || []).reduce((acc, s) => acc + Number(s.valor_custo || 0) * Number(s.quantidade ?? 1), 0);
          const lucro = form.valor_total - custoTotal;
          const margem = form.valor_total > 0 ? (lucro / form.valor_total) * 100 : 0;
          return (
            <div className="mx-5 mb-4 p-3 rounded-xl border border-green-500/30 bg-green-500/5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Custo</div>
                  <div className="text-sm font-bold text-red-400">{fmt(custoTotal)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Lucro</div>
                  <div className={`text-sm font-bold ${lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(lucro)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Margem</div>
                  <div className={`text-sm font-bold ${margem >= 0 ? 'text-green-400' : 'text-red-400'}`}>{margem.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          );
        })()}
        <Section title="Dados Adicionais">
          <textarea
            value={form.dados_adicionais || ""}
            onChange={e => setForm(f => ({ ...f, dados_adicionais: e.target.value }))}
            className="input-dark"
            rows={3}
            placeholder="Informações complementares que aparecerão na nota impressa..."
            autoComplete="off"
          />
        </Section>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">Cancelar</button>
          <button type="button" onClick={salvar} disabled={saving} className="px-4 py-2 text-sm text-black rounded-lg font-semibold disabled:opacity-50 transition-all" style={{background:"#00ff00"}} onMouseEnter={e => !saving && (e.currentTarget.style.background="#00dd00")} onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
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
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-gray-800">
            <h3 className="text-white font-semibold">Novo Cadastro</h3>
            <button onClick={() => setShowNovoCliente(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tipo">
                <select value={novoClienteForm.tipo} onChange={e => setNovoClienteForm(f => ({ ...f, tipo: e.target.value }))} className="input-dark">
                  <option>Pessoa Física</option>
                  <option>Pessoa Jurídica</option>
                </select>
              </Field>
              <Field label="CPF / CNPJ">
                <div className="flex gap-2">
                  <input value={novoClienteForm.cpf_cnpj} onChange={e => setNovoClienteForm(f => ({ ...f, cpf_cnpj: e.target.value }))} className="input-dark" autoComplete="off" />
                  {novoClienteForm.tipo === 'Pessoa Jurídica' && (
                    <button type="button" onClick={buscarCnpjNovoCliente} disabled={buscandoCnpj}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-white flex-shrink-0 disabled:opacity-50"
                      style={{background:'#062C9B'}}>
                      {buscandoCnpj ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : '🔍'} Buscar
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Nome / Razão Social *">
                <input value={novoClienteForm.nome} onChange={e => setNovoClienteForm(f => ({ ...f, nome: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Nome Social / Nome Fantasia">
                <input value={novoClienteForm.nome_fantasia} onChange={e => setNovoClienteForm(f => ({ ...f, nome_fantasia: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Inscrição Estadual">
                <input value={novoClienteForm.rg_ie} onChange={e => setNovoClienteForm(f => ({ ...f, rg_ie: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Telefone Contato">
                <input value={novoClienteForm.telefone} onChange={e => setNovoClienteForm(f => ({ ...f, telefone: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="E-mail">
                <input value={novoClienteForm.email} onChange={e => setNovoClienteForm(f => ({ ...f, email: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="CEP">
                <input value={novoClienteForm.cep} onChange={e => setNovoClienteForm(f => ({ ...f, cep: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Endereço">
                <input value={novoClienteForm.endereco} onChange={e => setNovoClienteForm(f => ({ ...f, endereco: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Número">
                <input value={novoClienteForm.numero} onChange={e => setNovoClienteForm(f => ({ ...f, numero: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Complemento">
                <input value={novoClienteForm.complemento} onChange={e => setNovoClienteForm(f => ({ ...f, complemento: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Bairro">
                <input value={novoClienteForm.bairro} onChange={e => setNovoClienteForm(f => ({ ...f, bairro: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Cidade">
                <input value={novoClienteForm.cidade} onChange={e => setNovoClienteForm(f => ({ ...f, cidade: e.target.value }))} className="input-dark" autoComplete="off" />
              </Field>
              <Field label="Estado">
                <input value={novoClienteForm.estado} onChange={e => setNovoClienteForm(f => ({ ...f, estado: e.target.value }))} className="input-dark" maxLength={2} autoComplete="off" />
              </Field>
            </div>
            <Field label="Observações">
              <textarea value={novoClienteForm.observacoes} onChange={e => setNovoClienteForm(f => ({ ...f, observacoes: e.target.value }))} className="input-dark" rows={2} />
            </Field>
          </div>
          <div className="flex gap-3 justify-end p-5 border-t border-gray-800">
            <button onClick={() => setShowNovoCliente(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg">Cancelar</button>
            <button onClick={salvarNovoCliente} disabled={salvandoCliente} className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50" style={{background:'#00ff00'}}>
              {salvandoCliente ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </div>
    )}

    {erroTelefone && (
      <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-orange-500/40 rounded-2xl w-full max-w-sm p-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">📞</span>
          </div>
          <h3 className="text-white font-bold text-lg">Telefone Inválido</h3>
          <p className="text-gray-300 text-sm whitespace-pre-line">{erroTelefone}</p>
          <button onClick={() => setErroTelefone(null)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{background:"#f97316"}}>
            Corrigir
          </button>
        </div>
      </div>
    )}

    {alertaModal && (
      <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{background:"rgba(239,68,68,0.15)"}}>
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{alertaModal.titulo}</h3>
              <p className="text-gray-300 text-sm mt-2 whitespace-pre-line">{alertaModal.mensagem}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={() => setAlertaModal(null)}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{background:"#062C9B"}}>
              Entendido
            </button>
          </div>
        </div>
      </div>
    )}

    {showConfirmCustoZero && (
      <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl w-full max-w-sm p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Custo Zero Detectado</h3>
              <p className="text-gray-300 text-sm mt-2">
                Este orçamento contém produtos ou serviços sem custo registrado. Você realmente deseja marcar a parcela como paga?
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-700">
            <button onClick={() => { setShowConfirmCustoZero(false); setParcelaAPagar(null); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 border border-gray-600 hover:border-gray-500">
              Cancelar
            </button>
            <button onClick={() => { setShowConfirmCustoZero(false); pagarParcelaInternal(parcelaAPagar); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{background:"#16a34a"}}>
              Confirmar
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
      <div className="mb-3">
        <h3 className="text-sm font-medium text-white border-b border-gray-700 pb-2">{title}</h3>
      </div>
      {children}
    </div>
  );
}