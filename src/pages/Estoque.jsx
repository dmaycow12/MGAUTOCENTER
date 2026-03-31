import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, X, TrendingUp, Upload, FileSpreadsheet, CheckCircle2, LayoutGrid, List, CheckSquare, ChevronUp, ChevronDown, Download, Filter, Tag } from "lucide-react";
import ProgressoReajuste from "../components/estoque/ProgressoReajuste";

const arredondarVendaParaCinco = (valor) => {
  return Math.ceil(valor / 5) * 5;
};

const defaultForm = () => ({
  codigo: "", descricao: "", categoria: "", marca: "",
  quantidade: 0, estoque_minimo: 0, valor_custo: 0, valor_venda: 0,
  localizacao: "", fornecedor: "", ncm: "87089990", cfop: "5405", cest: "", observacoes: ""
});

export default function Estoque() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [filtro, setFiltro] = useState("Todos");
  const [showReajuste, setShowReajuste] = useState(false);
  const [reajusteGrupo, setReajusteGrupo] = useState("Todos");
  const [reajusteTipo, setReajusteTipo] = useState("percentual");
  const [reajusteValor, setReajusteValor] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [showImport, setShowImport] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const [selecionados, setSelecionados] = useState([]);
  const [editandoCell, setEditandoCell] = useState(null); // { id, field }
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: "asc" });
  const [deletando, setDeletando] = useState(false);
  const [progressoReajuste, setProgressoReajuste] = useState({ isOpen: false, progresso: 0, status: 'processando', sucessos: 0, erro: null });
  const [filtroMarcas, setFiltroMarcas] = useState([]);
  const [filtroCategorias, setFiltroCategorias] = useState([]);
  const [showMarcaDropdown, setShowMarcaDropdown] = useState(false);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [colunas, setColunas] = useState(() => {
    const saved = localStorage.getItem("estoque_colunas");
    return saved ? JSON.parse(saved) : { codigo: true, categoria: true, marca: true, estoque_minimo: true, valor_custo: true, valor_venda: true };
  });
  const marcaDropdownRef = useRef(null);
  const catDropdownRef = useRef(null);
  const filterRef = useRef(null);

  const toggleColuna = (col) => {
    const updated = { ...colunas, [col]: !colunas[col] };
    setColunas(updated);
    localStorage.setItem("estoque_colunas", JSON.stringify(updated));
  };

  const colunasDisponiveis = [
    { key: "codigo", label: "CÓDIGO" },
    { key: "categoria", label: "CATEGORIA" },
    { key: "marca", label: "MARCA" },
    { key: "estoque_minimo", label: "MÍN. ESTOQUE" },
    { key: "valor_custo", label: "CUSTO" },
    { key: "valor_venda", label: "VENDA" },
  ];

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (marcaDropdownRef.current && !marcaDropdownRef.current.contains(e.target)) setShowMarcaDropdown(false);
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target)) setShowCatDropdown(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const load = async () => {
    const data = await base44.entities.Estoque.list("-created_date", 500);
    setItems(data);
    setLoading(false);
  };

  const salvar = async () => {
    if (!form.descricao) return alert("Informe a descrição.");
    if (editando) {
      await base44.entities.Estoque.update(editando.id, form);
    } else {
      await base44.entities.Estoque.create(form);
    }
    setShowForm(false);
    setEditando(null);
    setForm(defaultForm());
    load();
  };

  const excluir = async (id) => {
    if (!confirm("Excluir este item?")) return;
    await base44.entities.Estoque.delete(id);
    setSelecionados(prev => prev.filter(s => s !== id));
    load();
  };

  const excluirSelecionados = async () => {
    if (selecionados.length === 0) return;
    if (!confirm(`Excluir ${selecionados.length} item(s) selecionado(s)?`)) return;
    setDeletando(true);
    const batch = 10;
    for (let i = 0; i < selecionados.length; i += batch) {
      const chunk = selecionados.slice(i, i + batch);
      await Promise.all(chunk.map(id => base44.entities.Estoque.delete(id)));
      await new Promise(r => setTimeout(r, 100));
    }
    setSelecionados([]);
    setDeletando(false);
    load();
  };

  const toggleSelecionado = (id) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleTodos = () => {
    if (selecionados.length === filtrados.length) {
      setSelecionados([]);
    } else {
      setSelecionados(filtrados.map(i => i.id));
    }
  };

  const editar = (item) => {
    setForm({ ...defaultForm(), ...item });
    setEditando(item);
    setShowForm(true);
  };

  const iniciarEdicaoCell = (item, field) => {
    setEditandoCell({ id: item.id, field, valorInicial: item[field] !== undefined && item[field] !== null ? String(item[field]) : "" });
  };

  const salvarEdicaoCell = async (itemId, field, valor) => {
    setEditandoCell(null);
    let val = CAMPOS_NUMERICOS.includes(field) ? Number(valor) : valor;
    if (field === "valor_venda") val = arredondarVendaParaCinco(val);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: val } : i));
    await base44.entities.Estoque.update(itemId, { [field]: val });
  };

  const cancelarEdicaoCell = () => {
    setEditandoCell(null);
  };



  const handleSort = (campo) => {
    if (ordenacao.campo === campo) {
      setOrdenacao({ campo, direcao: ordenacao.direcao === "asc" ? "desc" : "asc" });
    } else {
      setOrdenacao({ campo, direcao: "asc" });
    }
  };

  let filtrados = items.filter(i => {
    const matchSearch = !search ||
      i.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      i.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      i.categoria?.toLowerCase().includes(search.toLowerCase()) ||
      i.marca?.toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === "Todos" || (filtro === "Estoque Baixo" && i.quantidade <= i.estoque_minimo);
    const matchMarca = filtroMarcas.length === 0 || filtroMarcas.includes(i.marca);
    const matchCategoria = filtroCategorias.length === 0 || filtroCategorias.includes(i.categoria);
    return matchSearch && matchFiltro && matchMarca && matchCategoria;
  });

  // Aplicar ordenação
  if (ordenacao.campo) {
    filtrados = [...filtrados].sort((a, b) => {
      let aVal = a[ordenacao.campo];
      let bVal = b[ordenacao.campo];
      
      // Tratar números
      if (typeof aVal === "number" && typeof bVal === "number") {
        return ordenacao.direcao === "asc" ? aVal - bVal : bVal - aVal;
      }
      
      // Tratar strings
      aVal = String(aVal || "").toLowerCase();
      bVal = String(bVal || "").toLowerCase();
      return ordenacao.direcao === "asc" 
        ? aVal.localeCompare(bVal, "pt-BR")
        : bVal.localeCompare(aVal, "pt-BR");
    });
  }

  const estoqueBaixo = items.filter(i => i.quantidade <= i.estoque_minimo).length;

  const exportarSelecionados = () => {
    const lista = selecionados.length > 0
      ? filtrados.filter(i => selecionados.includes(i.id))
      : filtrados;
    if (lista.length === 0) return alert("Nenhum item para exportar.");
    const header = ["Código", "Descrição", "Categoria", "Marca", "Quantidade", "Estoque Mínimo", "Valor Custo", "Valor Venda", "Localização", "Fornecedor"];
    const rows = lista.map(i => [
      i.codigo || "", i.descricao || "", i.categoria || "", i.marca || "",
      i.quantidade || 0, i.estoque_minimo || 0,
      Number(i.valor_custo || 0).toFixed(2), Number(i.valor_venda || 0).toFixed(2),
      i.localizacao || "", i.fornecedor || ""
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "estoque.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const grupos = ["Todos", ...Array.from(new Set(items.map(i => i.categoria).filter(Boolean)))];

  const aplicarReajuste = async () => {
    if (!reajusteValor || Number(reajusteValor) <= 0) return alert("Informe um valor válido.");
    const alvo = reajusteGrupo === "Todos" ? items : items.filter(i => i.categoria === reajusteGrupo);
    if (!confirm(`Reajustar preço de venda de ${alvo.length} produto(s)?`)) return;
    
    setAplicando(true);
    setProgressoReajuste({ isOpen: true, progresso: 0, status: 'processando', sucessos: 0, erro: null });
    setShowReajuste(false);
    
    try {
      let sucessosTotal = 0;
      let falhasTotal = 0;
      const batchSize = 50;
      
      // Processa em lotes pequenos para atualizar barra em tempo real
      for (let i = 0; i < alvo.length; i += batchSize) {
        const batch = alvo.slice(i, i + batchSize);
        
        const response = await base44.functions.invoke('reajustarEstoqueStream', {
          items: batch,
          reajusteTipo,
          reajusteValor: Number(reajusteValor)
        });
        
        sucessosTotal += response.data.sucesso;
        falhasTotal += response.data.falhas;
        
        // Atualiza progresso em tempo real
        setProgressoReajuste(prev => ({
          ...prev,
          progresso: sucessosTotal + falhasTotal,
          sucessos: sucessosTotal,
          status: 'processando'
        }));
        
        // Pequena pausa entre lotes
        await new Promise(r => setTimeout(r, 100));
      }
      
      const mensagemErro = falhasTotal > 0 
        ? `${falhasTotal} produto(s) falharam. Verifique a conexão e tente novamente.`
        : null;
      
      setProgressoReajuste(prev => ({
        ...prev,
        status: falhasTotal > 0 ? 'aviso' : 'sucesso',
        erro: mensagemErro
      }));
      
      await new Promise(r => setTimeout(r, 2000));
      load();
    } catch (err) {
      setProgressoReajuste(prev => ({
        ...prev,
        status: 'erro',
        erro: String(err.message || 'Erro ao processar reajuste')
      }));
    } finally {
      setAplicando(false);
      setReajusteValor("");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportando(true);
    setImportResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  codigo: { type: "string" },
                  descricao: { type: "string" },
                  categoria: { type: "string" },
                  marca: { type: "string" },
                  quantidade: { type: "number" },
                  estoque_minimo: { type: "number" },
                  valor_custo: { type: "number" },
                  valor_venda: { type: "number" },
                  localizacao: { type: "string" },
                  fornecedor: { type: "string" },
                  ncm: { type: "string" },
                  cfop: { type: "string" },
                  cest: { type: "string" },
                  }
              }
            }
          }
        }
      });
      if (result.status !== "success" || !result.output?.items?.length) {
        setImportResult({ sucesso: 0, falha: 0, erro: "Nenhum produto encontrado no arquivo." });
        setImportando(false);
        return;
      }
      const produtos = result.output.items;
      let sucesso = 0, falha = 0;
      for (const p of produtos) {
        if (!p.descricao) { falha++; continue; }
        await base44.entities.Estoque.create({
          ...defaultForm(),
          ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? (typeof defaultForm()[k] === "number" ? 0 : "")])),
        });
        sucesso++;
      }
      setImportResult({ sucesso, falha });
      load();
    } catch (err) {
      setImportResult({ sucesso: 0, falha: 0, erro: err.message });
    }
    setImportando(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Botão Principal */}
      <button
        onClick={() => { setShowForm(true); setEditando(null); setForm(defaultForm()); }}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold transition-all"
        style={{background: "#00ff00", color: "#fff"}}
        onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
        onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
      >
        <Plus className="w-5 h-5" /> Novo Item
      </button>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-white text-sm font-medium mb-2">Total de Itens</p>
          <p className="text-white text-sm font-medium">{items.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-white text-sm font-medium mb-2">Estoque Baixo</p>
          <p className="text-white text-sm font-medium">{estoqueBaixo}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-white text-sm font-medium mb-2">Valor Total (Custo)</p>
          <p className="text-white text-sm font-medium">
            R$ {items.reduce((acc, i) => acc + (i.quantidade * i.valor_custo || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-white text-sm font-medium mb-2">Valor Total (Venda)</p>
          <p className="text-green-400 text-sm font-bold">
            R$ {items.reduce((acc, i) => acc + (i.quantidade * i.valor_venda || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2">
        {/* Linha 1: busca + filtro + toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar item..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              ⚙️ Colunas
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 z-50 w-56 space-y-2">
                <p className="text-xs text-gray-400 font-semibold mb-3">COLUNAS VISÍVEIS</p>
                {colunasDisponiveis.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-2 rounded transition-all">
                    <input type="checkbox" checked={colunas[col.key]} onChange={() => toggleColuna(col.key)} className="w-4 h-4" />
                    <span className="text-xs text-gray-300">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <button onClick={() => setViewMode("table")} className="px-3 py-2 transition-all" style={{background:viewMode==="table"?"#062C9B":"transparent",color:viewMode==="table"?"#fff":"#6b7280"}}><List className="w-5 h-5"/></button>
            <button onClick={() => setViewMode("cards")} className="px-3 py-2 transition-all" style={{background:viewMode==="cards"?"#062C9B":"transparent",color:viewMode==="cards"?"#fff":"#6b7280"}}><LayoutGrid className="w-5 h-5"/></button>
          </div>
        </div>

        {/* Linha 2: filtros azuis flexíveis */}
        <div className="flex gap-2">
          {/* Filtro Marca */}
          <div ref={marcaDropdownRef} className="relative flex-1">
            <button
              onClick={() => { setShowMarcaDropdown(v => !v); setShowCatDropdown(false); }}
              className="w-full flex items-center justify-center gap-2 h-11 px-3 rounded-xl text-sm font-semibold transition-all relative"
              style={{background: filtroMarcas.length > 0 ? "#0a4fd4" : "#062C9B", color: "#fff", border: "1px solid #1a5ce6"}}
            >
              <span className="truncate">{filtroMarcas.length > 0 ? `Marca (${filtroMarcas.length})` : "Marca"}</span>
              {filtroMarcas.length > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-all"
                  onClick={e => { e.stopPropagation(); setFiltroMarcas([]); }}>
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
            {showMarcaDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl z-20 shadow-xl p-2 max-h-56 overflow-y-auto space-y-0.5">
                {Array.from(new Set(items.map(i => i.marca).filter(Boolean))).sort().map(marca => (
                  <label key={marca} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 cursor-pointer transition-all">
                    <input type="checkbox" checked={filtroMarcas.includes(marca)}
                      onChange={() => setFiltroMarcas(prev => prev.includes(marca) ? prev.filter(m => m !== marca) : [...prev, marca])}
                      className="accent-blue-500 w-4 h-4 cursor-pointer" />
                    <span className="text-sm text-gray-300 flex-1">{marca}</span>
                    <span className="text-xs text-gray-600">{items.filter(i => i.marca === marca).length}</span>
                  </label>
                ))}
                {items.filter(i => i.marca).length === 0 && <p className="text-gray-500 text-xs text-center py-3">Sem marcas</p>}
              </div>
            )}
          </div>

          {/* Filtro Categoria */}
          <div ref={catDropdownRef} className="relative flex-1">
            <button
              onClick={() => { setShowCatDropdown(v => !v); setShowMarcaDropdown(false); }}
              className="w-full flex items-center justify-center gap-2 h-11 px-3 rounded-xl text-sm font-semibold transition-all relative"
              style={{background: filtroCategorias.length > 0 ? "#0a4fd4" : "#062C9B", color: "#fff", border: "1px solid #1a5ce6"}}
            >
              <span className="truncate">{filtroCategorias.length > 0 ? `Categ. (${filtroCategorias.length})` : "Categoria"}</span>
              {filtroCategorias.length > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-all"
                  onClick={e => { e.stopPropagation(); setFiltroCategorias([]); }}>
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
            {showCatDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl z-20 shadow-xl p-2 max-h-56 overflow-y-auto space-y-0.5">
                {Array.from(new Set(items.map(i => i.categoria).filter(Boolean))).sort().map(cat => (
                  <label key={cat} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 cursor-pointer transition-all">
                    <input type="checkbox" checked={filtroCategorias.includes(cat)}
                      onChange={() => setFiltroCategorias(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                      className="accent-blue-500 w-4 h-4 cursor-pointer" />
                    <span className="text-sm text-gray-300 flex-1">{cat}</span>
                    <span className="text-xs text-gray-600">{items.filter(i => i.categoria === cat).length}</span>
                  </label>
                ))}
                {items.filter(i => i.categoria).length === 0 && <p className="text-gray-500 text-xs text-center py-3">Sem categorias</p>}
              </div>
            )}
          </div>

          {/* Filtro Estoque Baixo */}
          <button
            onClick={() => setFiltro(filtro === "Estoque Baixo" ? "Todos" : "Estoque Baixo")}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all"
            style={{background: filtro === "Estoque Baixo" ? "#dc2626" : "#062C9B", color: "#fff", border: `1px solid ${filtro === "Estoque Baixo" ? "#ef4444" : "#1a5ce6"}`}}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Estoque Baixo{filtro === "Estoque Baixo" ? ` (${filtrados.length})` : ` (${estoqueBaixo})`}</span>
          </button>
        </div>

        {/* Linha 3: ações */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowReajuste(true)}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all"
            style={{background: "#00ff00", color: "#fff"}}
            onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
            onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
          >
            <TrendingUp className="w-4 h-4" /> Reajustar
          </button>
          <button
            onClick={exportarSelecionados}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all"
            style={{background: "#00ff00", color: "#fff"}}
            onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
            onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
          >
            <Download className="w-4 h-4" /> {selecionados.length > 0 ? `Exportar (${selecionados.length})` : "Exportar"}
          </button>
        </div>

        {/* Linha 3: ações de seleção (aparece se houver selecionados) */}
        {selecionados.length > 0 && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
            <span className="text-red-400 text-sm font-medium flex-1">{selecionados.length} item(s) selecionado(s)</span>
            <button onClick={() => setSelecionados([])} className="text-gray-400 hover:text-white text-xs px-3 py-1.5 border border-gray-700 rounded-lg transition-all">Cancelar</button>
            <button onClick={excluirSelecionados} disabled={deletando} className="flex items-center gap-2 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50" style={{background:"#cc0000"}} onMouseEnter={e=>!deletando && (e.currentTarget.style.background="#aa0000")} onMouseLeave={e=>e.currentTarget.style.background="#cc0000"}>
              <Trash2 className="w-3.5 h-3.5" /> {deletando ? "Deletando..." : "Excluir Selecionados"}
            </button>
          </div>
        )}
      </div>

      {/* Modal Reajuste */}
      {showReajuste && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-400" /> Reajustar Preço de Venda</h2>
              <button onClick={() => setShowReajuste(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <F label="Grupo / Categoria">
                <select value={reajusteGrupo} onChange={e => setReajusteGrupo(e.target.value)} className="input-dark">
                  {grupos.map(g => <option key={g}>{g}</option>)}
                </select>
              </F>
              <F label="Tipo de reajuste">
                <div className="flex gap-2">
                  <button onClick={() => setReajusteTipo("percentual")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${reajusteTipo === "percentual" ? "bg-blue-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-400"}`}>
                    % Percentual
                  </button>
                  <button onClick={() => setReajusteTipo("fixo")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${reajusteTipo === "fixo" ? "bg-blue-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-400"}`}>
                    R$ Valor Fixo
                  </button>
                </div>
              </F>
              <F label={reajusteTipo === "percentual" ? "Percentual de aumento (%)" : "Valor a acrescentar (R$)"}>
                <input type="text" step="0.01" min="0" value={reajusteValor} onChange={e => setReajusteValor(e.target.value.replace(/[^0-9.]/g, ""))} className="input-dark" placeholder={reajusteTipo === "percentual" ? "Ex: 10" : "Ex: 5.00"} />
              </F>
              <p className="text-xs text-gray-500">
                Serão reajustados: <span className="text-white font-medium">{reajusteGrupo === "Todos" ? items.length : items.filter(i => i.categoria === reajusteGrupo).length} produto(s)</span>
              </p>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowReajuste(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={aplicarReajuste} disabled={aplicando} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all disabled:opacity-50" style={{background: "#00ff00", color: "#000"}} onMouseEnter={e => !aplicando && (e.currentTarget.style.background = "#00dd00")} onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
                {aplicando ? "Aplicando..." : "Aplicar Reajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table/Cards */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum item encontrado</p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map(item => (
            <div key={item.id} className={`bg-gray-900 border rounded-2xl overflow-hidden ${item.quantidade <= item.estoque_minimo ? "border-red-500/40" : "border-gray-800"}`}>
              {/* Cabeçalho do card */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="flex items-center gap-2 min-w-0">
                  <input type="checkbox" checked={selecionados.includes(item.id)} onChange={() => toggleSelecionado(item.id)} className="accent-red-500 cursor-pointer w-4 h-4 flex-shrink-0" />
                  {item.codigo && <span className="text-orange-400 font-mono text-xs font-bold flex-shrink-0">#{item.codigo}</span>}
                  {item.quantidade <= item.estoque_minimo && (
                    <span className="flex items-center gap-1 bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      <AlertTriangle className="w-3 h-3" /> Baixo
                    </span>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => editar(item)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg transition-all"><Edit className="w-4 h-4"/></button>
                  <button onClick={() => excluir(item.id)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg transition-all"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              {/* Descrição */}
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Produto</p>
                <p className="text-white font-bold text-sm leading-tight">{item.descricao}</p>
                {item.marca && <p className="text-gray-500 text-xs mt-0.5">{item.marca}</p>}
              </div>
              {/* Detalhes em grade */}
              <div className="grid grid-cols-2 border-b border-gray-800">
                <div className="px-4 py-3 border-r border-gray-800">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Quantidade</p>
                  <p className={`font-bold text-sm ${item.quantidade <= item.estoque_minimo ? "text-red-400" : "text-white"}`}>{item.quantidade} {item.unidade || "UN"}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Mín. Estoque</p>
                  <p className="text-white font-bold text-sm">{item.estoque_minimo}</p>
                </div>
              </div>
              <div className="grid grid-cols-2">
                <div className="px-4 py-3 border-r border-gray-800">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Custo</p>
                  <p className="text-gray-300 font-bold text-sm">R$ {Number(item.valor_custo||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Venda</p>
                  <p className="text-green-400 font-bold text-sm">R$ {Number(item.valor_venda||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p>
                </div>
              </div>
              {item.categoria && (
                <div className="px-4 pb-3">
                  <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded-full">{item.categoria}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800 bg-gray-900/80">
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={filtrados.length > 0 && selecionados.length === filtrados.length} onChange={toggleTodos} className="accent-red-500 cursor-pointer w-4 h-4" />
                  </th>
                  {colunas.codigo && <th className="px-4 py-3 cursor-pointer hover:text-white transition-all" onClick={() => handleSort("codigo")}><div className="flex items-center gap-1">Código {ordenacao.campo === "codigo" && (ordenacao.direcao === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div></th>}
                  <th className="px-4 py-3 cursor-pointer hover:text-white transition-all" onClick={() => handleSort("descricao")}>
                    <div className="flex items-center gap-1">Descrição {ordenacao.campo === "descricao" && (ordenacao.direcao === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </th>
                  {colunas.categoria && <th className="px-4 py-3 cursor-pointer hover:text-white transition-all" onClick={() => handleSort("categoria")}><div className="flex items-center gap-1">Categoria {ordenacao.campo === "categoria" && (ordenacao.direcao === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div></th>}
                  {colunas.marca && <th className="px-4 py-3 cursor-pointer hover:text-white transition-all" onClick={() => handleSort("marca")}><div className="flex items-center gap-1">Marca {ordenacao.campo === "marca" && (ordenacao.direcao === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div></th>}
                  <th className="px-4 py-3 text-center cursor-pointer hover:text-white transition-all" onClick={() => handleSort("quantidade")}>
                    <div className="flex items-center justify-center gap-1">Qtd {ordenacao.campo === "quantidade" && (ordenacao.direcao === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </th>
                  {colunas.estoque_minimo && <th className="px-4 py-3 text-center cursor-pointer hover:text-white transition-all" onClick={() => handleSort("estoque_minimo")}><div className="flex items-center justify-center gap-1">Mín. {ordenacao.campo === "estoque_minimo" && (ordenacao.direcao === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div></th>}
                  {colunas.valor_custo && <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-all" onClick={() => handleSort("valor_custo")}><div className="flex items-center justify-end gap-1">Custo {ordenacao.campo === "valor_custo" && (ordenacao.direcao === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div></th>}
                  {colunas.valor_venda && <th className="px-4 py-3 text-right cursor-pointer hover:text-white transition-all" onClick={() => handleSort("valor_venda")}><div className="flex items-center justify-end gap-1">Venda {ordenacao.campo === "valor_venda" && (ordenacao.direcao === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div></th>}
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item, idx) => {
                  const prox = filtrados[idx + 1] || null;
                  return (
                  <tr key={item.id} className={`border-b border-gray-800 hover:bg-gray-800/50 transition-all ${selecionados.includes(item.id) ? "bg-red-500/5" : item.quantidade <= item.estoque_minimo ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selecionados.includes(item.id)} onChange={() => toggleSelecionado(item.id)} className="accent-red-500 cursor-pointer w-4 h-4" />
                    </td>
                    {colunas.codigo && <td className="px-4 py-3 text-gray-400 font-mono text-xs"><CellEdit item={item} field="codigo" className="text-gray-400 font-mono text-xs" editandoCell={editandoCell} onIniciar={iniciarEdicaoCell} onSalvar={salvarEdicaoCell} onCancelar={cancelarEdicaoCell} proximoItem={prox} /></td>}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.quantidade <= item.estoque_minimo && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        <CellEdit item={item} field="descricao" className="text-white font-medium" editandoCell={editandoCell} onIniciar={iniciarEdicaoCell} onSalvar={salvarEdicaoCell} onCancelar={cancelarEdicaoCell} proximoItem={prox} />
                      </div>
                    </td>
                    {colunas.categoria && <td className="px-4 py-3 text-gray-400"><CellEdit item={item} field="categoria" className="text-gray-400" editandoCell={editandoCell} onIniciar={iniciarEdicaoCell} onSalvar={salvarEdicaoCell} onCancelar={cancelarEdicaoCell} proximoItem={prox} /></td>}
                    {colunas.marca && <td className="px-4 py-3 text-gray-400"><CellEdit item={item} field="marca" className="text-gray-400" editandoCell={editandoCell} onIniciar={iniciarEdicaoCell} onSalvar={salvarEdicaoCell} onCancelar={cancelarEdicaoCell} proximoItem={prox} /></td>}
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${item.quantidade <= item.estoque_minimo ? "text-red-400" : "text-white"}`}>
                        <CellEdit item={item} field="quantidade" className={item.quantidade <= item.estoque_minimo ? "text-red-400 font-bold" : "text-white font-bold"} editandoCell={editandoCell} onIniciar={iniciarEdicaoCell} onSalvar={salvarEdicaoCell} onCancelar={cancelarEdicaoCell} proximoItem={prox} />
                      </span>
                    </td>
                    {colunas.estoque_minimo && <td className="px-4 py-3 text-center text-gray-500"><CellEdit item={item} field="estoque_minimo" className="text-gray-500" editandoCell={editandoCell} onIniciar={iniciarEdicaoCell} onSalvar={salvarEdicaoCell} onCancelar={cancelarEdicaoCell} proximoItem={prox} /></td>}
                    {colunas.valor_custo && <td className="px-4 py-3 text-right text-gray-400"><CellEdit item={item} field="valor_custo" className="text-gray-400" editandoCell={editandoCell} onIniciar={iniciarEdicaoCell} onSalvar={salvarEdicaoCell} onCancelar={cancelarEdicaoCell} proximoItem={prox} /></td>}
                    {colunas.valor_venda && <td className="px-4 py-3 text-right text-green-400 font-medium"><CellEdit item={item} field="valor_venda" className="text-green-400 font-medium" editandoCell={editandoCell} onIniciar={iniciarEdicaoCell} onSalvar={salvarEdicaoCell} onCancelar={cancelarEdicaoCell} proximoItem={prox} /></td>}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => editar(item)} className="p-1 text-gray-500 hover:text-blue-400 transition-all"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => excluir(item.id)} className="p-1 text-gray-500 hover:text-red-400 transition-all"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Importar */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-green-400" /> Importar Produtos via Excel
              </h2>
              <button onClick={() => { setShowImport(false); setImportResult(null); }}>
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-gray-400 text-sm">
                Selecione um arquivo Excel (.xlsx) ou CSV com os produtos. As colunas reconhecidas são:
              </p>
              <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 font-mono space-y-1">
                <p><span className="text-orange-400">codigo</span>, <span className="text-orange-400">descricao</span>, <span className="text-orange-400">categoria</span>, <span className="text-orange-400">marca</span></p>
                <p><span className="text-orange-400">quantidade</span>, <span className="text-orange-400">estoque_minimo</span></p>
                <p><span className="text-orange-400">valor_custo</span>, <span className="text-orange-400">valor_venda</span></p>
                <p><span className="text-orange-400">localizacao</span>, <span className="text-orange-400">fornecedor</span>, <span className="text-orange-400">ncm</span>, <span className="text-orange-400">cfop</span></p>
              </div>

              {!importResult && !importando && (
                <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-700 hover:border-green-500 rounded-xl p-8 cursor-pointer transition-all group">
                  <Upload className="w-8 h-8 text-gray-500 group-hover:text-green-400 transition-all" />
                  <span className="text-gray-400 text-sm group-hover:text-white transition-all">Clique para selecionar o arquivo</span>
                  <span className="text-gray-600 text-xs">.xlsx, .xls ou .csv</span>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
                </label>
              )}

              {importando && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Processando arquivo...</p>
                </div>
              )}

              {importResult && (
                <div className="space-y-3">
                  {importResult.erro ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{importResult.erro}</div>
                  ) : (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-green-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Importação concluída!
                      </div>
                      <p className="text-sm text-gray-300">✅ <span className="text-green-400 font-bold">{importResult.sucesso}</span> produto(s) importado(s)</p>
                      {importResult.falha > 0 && <p className="text-sm text-gray-300">⚠️ <span className="text-yellow-400 font-bold">{importResult.falha}</span> linha(s) ignorada(s) (sem descrição)</p>}
                    </div>
                  )}
                  <button
                    onClick={() => setImportResult(null)}
                    className="w-full py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all"
                  >
                    Importar mais
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end p-5 border-t border-gray-800">
              <button onClick={() => { setShowImport(false); setImportResult(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">{editando ? "Editar Item" : "Novo Item de Estoque"}</h2>
              <button onClick={() => { setShowForm(false); setEditando(null); }}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Código"><input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className="input-dark" /></F>
                <F label="Quantidade"><input type="text" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: Number(e.target.value.replace(/[^0-9.]/g, "") || 0) })} className="input-dark" /></F>
                <F label="Descrição *" className="col-span-2">
                  <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="input-dark" />
                </F>
                <F label="Categoria"><input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="input-dark" /></F>
                <F label="Marca"><input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} className="input-dark" /></F>
                <F label="Estoque Mínimo">
                  <input type="text" value={form.estoque_minimo} onChange={e => setForm({ ...form, estoque_minimo: Number(e.target.value.replace(/[^0-9.]/g, "") || 0) })} className="input-dark" />
                </F>
                <F label="Valor de Custo (R$)">
                  <input type="text" step="0.01" value={form.valor_custo} onChange={e => setForm({ ...form, valor_custo: Number(e.target.value.replace(/[^0-9.]/g, "") || 0) })} className="input-dark" />
                </F>
                <F label="Valor de Venda (R$)">
                   <input type="text" step="0.01" value={form.valor_venda} onChange={e => {
                     const val = Number(e.target.value.replace(/[^0-9.]/g, "") || 0);
                     setForm({ ...form, valor_venda: arredondarVendaParaCinco(val) });
                   }} className="input-dark" />
                 </F>
                <F label="Localização"><input value={form.localizacao} onChange={e => setForm({ ...form, localizacao: e.target.value })} className="input-dark" /></F>
                <F label="Fornecedor"><input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} className="input-dark" /></F>
              </div>

              {/* Dados Fiscais */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Dados Fiscais</p>
                <div className="grid grid-cols-2 gap-4">
                  <F label="NCM">
                    <input value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} className="input-dark" placeholder="87089990" maxLength={8} />
                  </F>
                  <F label="CFOP">
                    <input value={form.cfop} onChange={e => setForm({ ...form, cfop: e.target.value })} className="input-dark" placeholder="5405" maxLength={4} />
                  </F>
                  <F label="CEST" className="col-span-2">
                    <input value={form.cest} onChange={e => setForm({ ...form, cest: e.target.value })} className="input-dark" placeholder="Ex: 0100100" />
                  </F>
                </div>
              </div>

              <F label="Observações"><textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input-dark" rows={2} /></F>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={salvar} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all" style={{background: "#cc0000"}} onMouseEnter={e => e.currentTarget.style.background = "#aa0000"} onMouseLeave={e => e.currentTarget.style.background = "#cc0000"}>
                {editando ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProgressoReajuste
        isOpen={progressoReajuste.isOpen}
        onClose={() => setProgressoReajuste(prev => ({ ...prev, isOpen: false }))}
        total={items.length > 0 ? (reajusteGrupo === "Todos" ? items.length : items.filter(i => i.categoria === reajusteGrupo).length) : 0}
        progresso={progressoReajuste.progresso}
        status={progressoReajuste.status}
        erro={progressoReajuste.erro}
        sucessos={progressoReajuste.sucessos}
      />

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; text-transform:uppercase; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; text-transform:none; }`}</style>
    </div>
  );
}

const CAMPOS_NUMERICOS = ["quantidade", "estoque_minimo", "valor_custo", "valor_venda"];

function CellEdit({ item, field, className = "", editandoCell, onIniciar, onSalvar, onCancelar, proximoItem }) {
  const isEditing = editandoCell?.id === item.id && editandoCell?.field === field;
  const [localVal, setLocalVal] = React.useState("");

  React.useEffect(() => {
    if (isEditing) setLocalVal(editandoCell.valorInicial || "");
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        autoFocus
        type="text"
        value={localVal}
        onChange={e => {
          const v = CAMPOS_NUMERICOS.includes(field)
            ? e.target.value.replace(/[^0-9.]/g, "")
            : e.target.value.toUpperCase();
          setLocalVal(v);
        }}
        onBlur={(e) => {
          // Não salva no blur se Tab foi pressionado (handled no onKeyDown)
          if (!e.relatedTarget || !e.relatedTarget.dataset.celltab) {
            onSalvar(item.id, field, localVal);
          }
        }}
        onKeyDown={e => {
          if (e.key === "Escape") { onCancelar(); }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            onSalvar(item.id, field, localVal);
            if (proximoItem) setTimeout(() => onIniciar(proximoItem, field), 50);
          }
        }}
        data-celltab="true"
        className={`bg-gray-700 border border-green-500 text-white rounded px-2 py-0.5 text-sm focus:outline-none w-full ${className}`}
        style={{textTransform: CAMPOS_NUMERICOS.includes(field) ? "none" : "uppercase"}}
      />
    );
  }

  const display = ["valor_custo", "valor_venda"].includes(field)
    ? `R$ ${Number(item[field] || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : (item[field] || "—");

  return (
    <span
      onClick={() => onIniciar(item, field)}
      className={`cursor-pointer hover:underline hover:text-white transition-all rounded px-1 -mx-1 ${className}`}
      title="Clique para editar"
    >
      {display}
    </span>
  );
}

function F({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
}