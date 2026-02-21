import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  FileText, Plus, Upload, Search, Trash2, Eye, X,
  CheckCircle, AlertCircle, Printer, Download, PlusCircle, MinusCircle, RefreshCw
} from "lucide-react";
import ModalEntradaNF from "@/components/notas/ModalEntradaNF";

const STATUS_COLOR = {
  Rascunho: "bg-gray-500/10 text-gray-400",
  Emitida: "bg-green-500/10 text-green-400",
  Cancelada: "bg-red-500/10 text-red-400",
  Importada: "bg-blue-500/10 text-blue-400",
};

const FORMAS_PAGAMENTO = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Boleto", "Transferência", "A Prazo"];

function defaultItem() {
  return { descricao: "", quantidade: 1, valor_unitario: 0, valor_total: 0 };
}

function defaultForm() {
  return {
    tipo: "NFSe",
    data_emissao: new Date().toISOString().split("T")[0],
    forma_pagamento: "PIX",
    observacoes: "",
    // cliente
    cliente_id: "",
    cliente_nome: "",
    cliente_cpf_cnpj: "",
    cliente_email: "",
    cliente_telefone: "",
    cliente_endereco: "",
    cliente_numero: "",
    cliente_bairro: "",
    cliente_cep: "",
    cliente_cidade: "",
    cliente_estado: "",
    // OS
    ordem_servico_id: "",
    // itens
    items: [defaultItem()],
    valor_total: 0,
  };
}

export default function NotasFiscais() {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos"); // Todos | Entrada | Saída
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showEntrada, setShowEntrada] = useState(false);
  const [xmlTexto, setXmlTexto] = useState("");
  const [xmlParaEntrada, setXmlParaEntrada] = useState("");
  const [importando, setImportando] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(defaultForm());
  const [emitindo, setEmitindo] = useState(false);
  const [transmitindo, setTransmitindo] = useState(null);
  const [msgFeedback, setMsgFeedback] = useState(null);
  const [temSpedy, setTemSpedy] = useState(false);
  const [abaForm, setAbaForm] = useState("cliente"); // 'cliente' | 'itens' | 'pagamento'

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [n, c, configs] = await Promise.all([
      base44.entities.NotaFiscal.list("-created_date", 200),
      base44.entities.Cliente.list("-created_date", 200),
      base44.entities.Configuracao.list("-created_date", 100),
    ]);
    setNotas(n);
    setClientes(c);
    const apiKey = configs.find(cfg => cfg.chave === "spedy_api_key")?.valor;
    setTemSpedy(!!(apiKey && apiKey.trim()));
    setLoading(false);
  };

  const selecionarCliente = (clienteId) => {
    const c = clientes.find(cl => cl.id === clienteId);
    if (!c) { setForm(f => ({ ...f, cliente_id: "", cliente_nome: "" })); return; }
    setForm(f => ({
      ...f,
      cliente_id: c.id,
      cliente_nome: c.nome || "",
      cliente_cpf_cnpj: c.cpf_cnpj || "",
      cliente_email: c.email || "",
      cliente_telefone: c.telefone || "",
      cliente_endereco: c.endereco || "",
      cliente_numero: c.numero || "",
      cliente_bairro: c.bairro || "",
      cliente_cep: c.cep || "",
      cliente_cidade: c.cidade || "",
      cliente_estado: c.estado || "",
    }));
  };

  const atualizarItem = (idx, campo, valor) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [campo]: valor };
      if (campo === "quantidade" || campo === "valor_unitario") {
        items[idx].valor_total = Number(items[idx].quantidade) * Number(items[idx].valor_unitario);
      }
      if (campo === "valor_total") {
        items[idx].valor_unitario = items[idx].quantidade > 0
          ? Number(valor) / Number(items[idx].quantidade)
          : Number(valor);
      }
      const total = items.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      return { ...f, items, valor_total: total };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, defaultItem()] }));
  const removeItem = (idx) => {
    setForm(f => {
      const items = f.items.filter((_, i) => i !== idx);
      const total = items.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
      return { ...f, items, valor_total: total };
    });
  };

  const excluir = async (id) => {
    if (!confirm("Excluir esta nota fiscal?")) return;
    await base44.entities.NotaFiscal.delete(id);
    load();
  };

  const importarXML = async () => {
    if (!xmlTexto.trim()) return alert("Cole o conteúdo do XML.");
    setImportando(true);
    const chave = xmlTexto.match(/chNFe[">]*>?([0-9]{44})/)?.[1] || "";
    const numero = xmlTexto.match(/nNF[">]*>(\d+)/)?.[1] || "";
    const serie = xmlTexto.match(/serie[">]*>(\d+)/)?.[1] || "";
    const valor = parseFloat(xmlTexto.match(/vNF[">]*>([\d.]+)/)?.[1] || "0");
    const nomeDest = xmlTexto.match(/<xNome>(.*?)<\/xNome>/)?.[1] || "";
    // Em vez de importar direto, abre o modal de entrada
    setXmlParaEntrada(xmlTexto);
    setXmlTexto("");
    setShowImport(false);
    setImportando(false);
    setShowEntrada(true);
  };

  const feedback = (tipo, msg) => {
    setMsgFeedback({ tipo, msg });
    setTimeout(() => setMsgFeedback(null), 6000);
  };

  const emitirNota = async (rascunhoNota = null) => {
    const f = rascunhoNota ? {
      ...defaultForm(),
      tipo: rascunhoNota.tipo,
      cliente_id: rascunhoNota.cliente_id,
      cliente_nome: rascunhoNota.cliente_nome,
      ordem_servico_id: rascunhoNota.ordem_servico_id,
      valor_total: rascunhoNota.valor_total,
      observacoes: rascunhoNota.observacoes,
      data_emissao: rascunhoNota.data_emissao,
      items: [{ descricao: rascunhoNota.observacoes || "Serviços", quantidade: 1, valor_unitario: rascunhoNota.valor_total, valor_total: rascunhoNota.valor_total }],
    } : form;

    if (!f.cliente_nome) return alert("Informe o nome do cliente.");
    if (!f.valor_total || f.valor_total <= 0) return alert("Informe o valor total.");

    if (rascunhoNota) setTransmitindo(rascunhoNota.id);
    else setEmitindo(true);

    try {
      const payload = { ...f, nota_id: rascunhoNota?.id || null };
      const response = await base44.functions.invoke("emitirNotaFiscal", payload);

      if (response.data?.sucesso) {
        // Salva a nota emitida no banco local
        const notaSalva = {
          tipo: f.tipo,
          status: "Emitida",
          cliente_id: f.cliente_id || "",
          cliente_nome: f.cliente_nome || "",
          ordem_servico_id: f.ordem_servico_id || "",
          valor_total: Number(f.valor_total),
          data_emissao: f.data_emissao || new Date().toISOString().split("T")[0],
          observacoes: f.observacoes || "",
          spedy_id: String(response.data.ordem_id || ""),
          numero: String(response.data.ordem?.number || response.data.ordem_id || ""),
          serie: String(response.data.ordem?.series || ""),
          pdf_url: response.data.ordem?.pdfUrl || "",
          xml_url: response.data.ordem?.xmlUrl || "",
        };

        if (rascunhoNota) {
          // Atualiza o rascunho existente para "Emitida"
          await base44.entities.NotaFiscal.update(rascunhoNota.id, notaSalva);
        } else {
          // Cria novo registro da nota emitida
          await base44.entities.NotaFiscal.create(notaSalva);
        }

        feedback("sucesso", `Nota ${f.tipo} transmitida com sucesso! ${response.data.mensagem || ""}`);
        setShowForm(false);
        setForm(defaultForm());
      } else {
        feedback("erro", response.data?.erro || "Erro ao emitir na Spedy.");
        if (!rascunhoNota) {
          await base44.entities.NotaFiscal.create({ ...f, status: "Rascunho" });
        }
      }
      load();
    } catch (e) {
      feedback("erro", "Erro: " + e.message);
      if (!rascunhoNota) {
        await base44.entities.NotaFiscal.create({ ...form, status: "Rascunho" });
        setShowForm(false);
        setForm(defaultForm());
        load();
      }
    }
    setEmitindo(false);
    setTransmitindo(null);
  };

  const salvarRascunho = async () => {
    await base44.entities.NotaFiscal.create({ ...form, status: "Rascunho" });
    setShowForm(false);
    setForm(defaultForm());
    feedback("sucesso", "Salvo como rascunho.");
    load();
  };

  const imprimirNota = (nota) => {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
      <title>NF ${nota.tipo} ${nota.numero || nota.id}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:800px;margin:0 auto}
        h1{font-size:22px;margin-bottom:4px} .sub{color:#888;font-size:13px;margin-bottom:20px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
        .field{} .label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px} .value{font-size:14px;font-weight:600;margin-top:2px}
        .full{grid-column:1/-1} hr{border:none;border-top:1px solid #eee;margin:16px 0}
        .badge{display:inline-block;background:#f3f4f6;padding:2px 10px;border-radius:20px;font-size:12px}
        .total{font-size:24px;font-weight:bold;color:#f97316}
        .chave{font-size:10px;color:#666;word-break:break-all;background:#f9f9f9;padding:8px;border-radius:4px;margin-top:12px}
        @media print{body{padding:20px}}
      </style></head><body>
      <h1>${nota.tipo} — Nota Fiscal</h1>
      <p class="sub">Emitida por Oficina Pro • ${nota.data_emissao || ""}</p>
      <span class="badge">${nota.status}</span>
      <hr/>
      <div class="grid">
        <div class="field"><div class="label">Número / Série</div><div class="value">${nota.numero || "—"}${nota.serie ? ` / ${nota.serie}` : ""}</div></div>
        <div class="field"><div class="label">Data de Emissão</div><div class="value">${nota.data_emissao || "—"}</div></div>
        <div class="field full"><div class="label">Cliente</div><div class="value">${nota.cliente_nome || "—"}</div></div>
        <div class="field full"><div class="label">Descrição / Serviços</div><div class="value">${nota.observacoes || "Serviços de manutenção automotiva"}</div></div>
        <div class="field"><div class="label">Valor Total</div><div class="total">R$ ${Number(nota.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
        ${nota.spedy_id ? `<div class="field"><div class="label">ID Spedy / Ordem</div><div class="value">${nota.spedy_id}</div></div>` : ""}
      </div>
      ${nota.chave_acesso ? `<div class="chave"><strong>Chave de Acesso:</strong> ${nota.chave_acesso}</div>` : ""}
      ${nota.pdf_url ? `<div style="margin-top:16px"><a href="${nota.pdf_url}" target="_blank" style="color:#f97316">Baixar PDF Oficial</a></div>` : ""}
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    win.document.close();
  };

  const filtradas = notas.filter(n => {
    const matchSearch = !search || n.numero?.includes(search) ||
      n.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      n.chave_acesso?.includes(search);
    const matchTipo = filtroTipo === "Todos" ||
      (filtroTipo === "Entrada" && n.tipo === "NFe" && n.status === "Importada") ||
      (filtroTipo === "Saída" && n.status !== "Importada");
    const matchInicio = !periodoInicio || (n.data_emissao && n.data_emissao >= periodoInicio);
    const matchFim = !periodoFim || (n.data_emissao && n.data_emissao <= periodoFim);
    return matchSearch && matchTipo && matchInicio && matchFim;
  });

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {msgFeedback && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${msgFeedback.tipo === "sucesso" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {msgFeedback.tipo === "sucesso" ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span>{msgFeedback.msg}</span>
        </div>
      )}

      {/* Header / Filtros */}
      <div className="flex flex-col gap-3">
        {/* Linha 1: busca + botões */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Buscar nota..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
              <Upload className="w-4 h-4" /> Importar XML
            </button>
            <button onClick={() => { setForm(defaultForm()); setAbaForm("cliente"); setShowForm(true); }} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
              <Plus className="w-4 h-4" /> Emitir Nota
            </button>
          </div>
        </div>

        {/* Linha 2: filtros de tipo e período */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Tipo */}
          <div className="flex gap-2">
            {["Todos", "Entrada", "Saída"].map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filtroTipo === t ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"}`}>
                {t}
              </button>
            ))}
          </div>
          {/* Período */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 text-xs whitespace-nowrap">Período:</span>
            <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" />
            <span className="text-gray-600 text-xs">até</span>
            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" />
            {(periodoInicio || periodoFim) && (
              <button onClick={() => { setPeriodoInicio(""); setPeriodoFim(""); }} className="text-gray-500 hover:text-white text-xs">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Tabela */}
      {filtradas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhuma nota fiscal encontrada</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 hidden md:table-cell">Emissão</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(nota => (
                  <tr key={nota.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-all">
                    <td className="px-4 py-3">
                      <span className="bg-orange-500/10 text-orange-400 text-xs px-2 py-1 rounded-full font-medium">{nota.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs">{nota.numero || "—"}{nota.serie ? `/${nota.serie}` : ""}</td>
                    <td className="px-4 py-3 text-white">{nota.cliente_nome || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{nota.data_emissao || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[nota.status] || "bg-gray-500/10 text-gray-400"}`}>{nota.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-orange-400 font-bold">
                      R$ {Number(nota.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {nota.status === "Rascunho" && temSpedy && (
                          <button
                            title="Transmitir para Spedy"
                            onClick={() => emitirNota(nota)}
                            disabled={transmitindo === nota.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-lg transition-all disabled:opacity-50"
                          >
                            {transmitindo === nota.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            {transmitindo === nota.id ? "..." : "Transmitir"}
                          </button>
                        )}
                        {nota.pdf_url && (
                          <a href={nota.pdf_url} target="_blank" rel="noreferrer" title="Baixar PDF" className="p-1 text-gray-500 hover:text-green-400 transition-all">
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button title="Imprimir" onClick={() => imprimirNota(nota)} className="p-1 text-gray-500 hover:text-blue-400 transition-all">
                          <Printer className="w-4 h-4" />
                        </button>
                        {nota.chave_acesso && (
                          <button title="Ver chave" onClick={() => alert(`Chave de Acesso:\n${nota.chave_acesso}`)} className="p-1 text-gray-500 hover:text-white transition-all">
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => excluir(nota.id)} className="p-1 text-gray-500 hover:text-red-400 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Importar XML */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h2 className="text-white font-semibold">Importar XML de Nota Fiscal</h2>
                <p className="text-gray-500 text-xs mt-0.5">Notas de entrada (compras) ou saída emitidas na SEFAZ</p>
              </div>
              <button onClick={() => setShowImport(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Upload de arquivo */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Selecionar arquivo XML</label>
                <label className="flex items-center justify-center gap-3 w-full border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl p-6 cursor-pointer transition-all group">
                  <Upload className="w-5 h-5 text-gray-500 group-hover:text-orange-400 transition-all" />
                  <span className="text-gray-500 group-hover:text-gray-300 text-sm transition-all">Clique para selecionar o arquivo .xml</span>
                  <input type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setXmlTexto(ev.target.result);
                    reader.readAsText(file, "UTF-8");
                  }} />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-gray-600 text-xs">ou cole o XML abaixo</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              <textarea value={xmlTexto} onChange={e => setXmlTexto(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-green-400 font-mono rounded-lg p-3 text-xs focus:outline-none focus:border-orange-500 resize-none"
                rows={8} placeholder='<?xml version="1.0" encoding="UTF-8"?>&#10;<nfeProc>...</nfeProc>' />

              {xmlTexto && (
                <p className="text-green-400 text-xs flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> XML carregado ({(xmlTexto.length / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { setShowImport(false); setXmlTexto(""); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white">Cancelar</button>
              <button onClick={importarXML} disabled={importando || !xmlTexto.trim()} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50">
                {importando ? "Importando..." : "Importar XML"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Emitir NF - Completo */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-white font-semibold text-lg">Emitir Nota Fiscal</h2>
                {!temSpedy && <p className="text-yellow-400 text-xs mt-0.5">⚠️ Spedy não configurada — será salvo como rascunho</p>}
                {temSpedy && <p className="text-green-400 text-xs mt-0.5">✓ Spedy configurada — será transmitida automaticamente</p>}
              </div>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>

            {/* Tipo + Data */}
            <div className="px-5 pt-4 flex-shrink-0 grid grid-cols-2 gap-4">
              <F label="Tipo de Nota Fiscal">
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="input-dark">
                  <option value="NFSe">NFSe — Nota de Serviço</option>
                  <option value="NFe">NFe — Nota de Produto</option>
                  <option value="NFCe">NFCe — Nota ao Consumidor</option>
                </select>
              </F>
              <F label="Data de Emissão">
                <input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} className="input-dark" />
              </F>
            </div>

            {/* Abas */}
            <div className="px-5 pt-3 flex-shrink-0 flex gap-1 border-b border-gray-800">
              {[["cliente", "1. Cliente"], ["itens", "2. Itens / Serviços"], ["pagamento", "3. Pagamento"]].map(([aba, label]) => (
                <button key={aba} onClick={() => setAbaForm(aba)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all -mb-px ${abaForm === aba ? "bg-gray-800 text-white border border-gray-700 border-b-gray-800" : "text-gray-500 hover:text-gray-300"}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Conteúdo das abas */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* ABA CLIENTE */}
              {abaForm === "cliente" && (
                <div className="space-y-4">
                  <F label="Selecionar Cliente Cadastrado">
                    <select value={form.cliente_id} onChange={e => selecionarCliente(e.target.value)} className="input-dark">
                      <option value="">— Selecione ou preencha abaixo —</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} {c.cpf_cnpj ? `(${c.cpf_cnpj})` : ""}</option>)}
                    </select>
                  </F>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="Nome / Razão Social *" className="col-span-2">
                      <input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} className="input-dark" placeholder="Nome completo ou razão social" />
                    </F>
                    <F label="CPF / CNPJ">
                      <input value={form.cliente_cpf_cnpj} onChange={e => setForm(f => ({ ...f, cliente_cpf_cnpj: e.target.value }))} className="input-dark" placeholder="000.000.000-00" />
                    </F>
                    <F label="E-mail">
                      <input type="email" value={form.cliente_email} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} className="input-dark" placeholder="email@cliente.com" />
                    </F>
                    <F label="Telefone">
                      <input value={form.cliente_telefone} onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))} className="input-dark" placeholder="(00) 00000-0000" />
                    </F>
                    <F label="CEP">
                      <input value={form.cliente_cep} onChange={e => setForm(f => ({ ...f, cliente_cep: e.target.value }))} className="input-dark" placeholder="00000-000" />
                    </F>
                    <F label="Endereço" className="col-span-2">
                      <input value={form.cliente_endereco} onChange={e => setForm(f => ({ ...f, cliente_endereco: e.target.value }))} className="input-dark" placeholder="Rua, Avenida..." />
                    </F>
                    <F label="Número">
                      <input value={form.cliente_numero} onChange={e => setForm(f => ({ ...f, cliente_numero: e.target.value }))} className="input-dark" placeholder="123" />
                    </F>
                    <F label="Bairro">
                      <input value={form.cliente_bairro} onChange={e => setForm(f => ({ ...f, cliente_bairro: e.target.value }))} className="input-dark" />
                    </F>
                    <F label="Cidade">
                      <input value={form.cliente_cidade} onChange={e => setForm(f => ({ ...f, cliente_cidade: e.target.value }))} className="input-dark" placeholder="Nome da cidade" />
                    </F>
                    <F label="Estado (UF)">
                      <input value={form.cliente_estado} maxLength={2} onChange={e => setForm(f => ({ ...f, cliente_estado: e.target.value.toUpperCase() }))} className="input-dark" placeholder="MG" />
                    </F>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => setAbaForm("itens")} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all">
                      Próximo: Itens →
                    </button>
                  </div>
                </div>
              )}

              {/* ABA ITENS */}
              {abaForm === "itens" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-gray-400 font-medium">Item {idx + 1}</span>
                          {form.items.length > 1 && (
                            <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 transition-all">
                              <MinusCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <F label="Descrição" className="col-span-2 md:col-span-4">
                            <input value={item.descricao} onChange={e => atualizarItem(idx, "descricao", e.target.value)} className="input-dark" placeholder="Ex: Troca de óleo, Alinhamento..." />
                          </F>
                          <F label="Quantidade">
                            <input type="number" min="1" step="0.01" value={item.quantidade}
                              onChange={e => atualizarItem(idx, "quantidade", e.target.value)} className="input-dark" />
                          </F>
                          <F label="Valor Unitário (R$)">
                            <input type="number" min="0" step="0.01" value={item.valor_unitario}
                              onChange={e => atualizarItem(idx, "valor_unitario", e.target.value)} className="input-dark" />
                          </F>
                          <F label="Total (R$)" className="col-span-2">
                            <input type="number" min="0" step="0.01" value={item.valor_total}
                              onChange={e => atualizarItem(idx, "valor_total", e.target.value)} className="input-dark" />
                          </F>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={addItem} className="flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm transition-all">
                    <PlusCircle className="w-4 h-4" /> Adicionar item
                  </button>
                  <div className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
                    <span className="text-gray-400 font-medium">Total da Nota</span>
                    <span className="text-2xl font-bold text-orange-400">
                      R$ {Number(form.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <F label="Discriminação / Observações">
                    <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                      className="input-dark" rows={3} placeholder="Informações adicionais sobre os serviços prestados..." />
                  </F>
                  <div className="flex justify-between">
                    <button onClick={() => setAbaForm("cliente")} className="text-gray-400 hover:text-white text-sm px-4 py-2 border border-gray-700 rounded-lg transition-all">← Voltar</button>
                    <button onClick={() => setAbaForm("pagamento")} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all">Próximo: Pagamento →</button>
                  </div>
                </div>
              )}

              {/* ABA PAGAMENTO */}
              {abaForm === "pagamento" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="Forma de Pagamento">
                      <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))} className="input-dark">
                        {FORMAS_PAGAMENTO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                      </select>
                    </F>
                    <F label="OS Vinculada (opcional)">
                      <input value={form.ordem_servico_id} onChange={e => setForm(f => ({ ...f, ordem_servico_id: e.target.value }))} className="input-dark" placeholder="ID da Ordem de Serviço" />
                    </F>
                  </div>

                  {/* Resumo */}
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                    <h3 className="text-white font-medium text-sm">Resumo da Nota</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-500">Tipo</div><div className="text-white font-medium">{form.tipo}</div>
                      <div className="text-gray-500">Cliente</div><div className="text-white font-medium">{form.cliente_nome || "—"}</div>
                      <div className="text-gray-500">CPF/CNPJ</div><div className="text-white">{form.cliente_cpf_cnpj || "—"}</div>
                      <div className="text-gray-500">Cidade</div><div className="text-white">{form.cliente_cidade ? `${form.cliente_cidade}/${form.cliente_estado}` : "—"}</div>
                      <div className="text-gray-500">Itens</div><div className="text-white">{form.items.length} item(ns)</div>
                      <div className="text-gray-500">Pagamento</div><div className="text-white">{form.forma_pagamento}</div>
                      <div className="text-gray-500 font-semibold">Total</div>
                      <div className="text-orange-400 font-bold text-lg">R$ {Number(form.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-between">
                    <button onClick={() => setAbaForm("itens")} className="text-gray-400 hover:text-white text-sm px-4 py-2 border border-gray-700 rounded-lg transition-all">← Voltar</button>
                    <div className="flex gap-3">
                      <button onClick={salvarRascunho} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Salvar Rascunho</button>
                      <button onClick={() => emitirNota()} disabled={emitindo} className="px-6 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2">
                        {emitindo && <RefreshCw className="w-4 h-4 animate-spin" />}
                        {emitindo ? "Emitindo..." : temSpedy ? "Transmitir Nota" : "Salvar como Rascunho"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`.input-dark{width:100%;background:#1f2937;border:1px solid #374151;color:#fff;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input-dark:focus{border-color:#f97316}.input-dark::placeholder{color:#6b7280}`}</style>
    </div>
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