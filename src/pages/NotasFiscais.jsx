import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Plus, Upload, Download, Search, Trash2, Eye, X, CheckCircle, AlertCircle } from "lucide-react";

export default function NotasFiscais() {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [xmlTexto, setXmlTexto] = useState("");
  const [importando, setImportando] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(defaultForm());
  const [emitindo, setEmitindo] = useState(false);
  const [transmitindo, setTransmitindo] = useState(null);
  const [msgFeedback, setMsgFeedback] = useState(null);
  const [temSpedy, setTemSpedy] = useState(false);

  function defaultForm() {
    return { tipo: "NFe", cliente_id: "", cliente_nome: "", ordem_servico_id: "", valor_total: 0, observacoes: "", data_emissao: new Date().toISOString().split("T")[0] };
  }

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

  const excluir = async (id) => {
    if (!confirm("Excluir esta nota fiscal?")) return;
    await base44.entities.NotaFiscal.delete(id);
    load();
  };

  // Importação XML
  const importarXML = async () => {
    if (!xmlTexto.trim()) return alert("Cole o conteúdo do XML.");
    setImportando(true);
    try {
      // Extrai dados básicos do XML via regex simples
      const chave = xmlTexto.match(/chNFe[">]*>?([0-9]{44})/)?.[1] || "";
      const numero = xmlTexto.match(/nNF[">]*>(\d+)/)?.[1] || "";
      const serie = xmlTexto.match(/serie[">]*>(\d+)/)?.[1] || "";
      const valor = parseFloat(xmlTexto.match(/vNF[">]*>([\d.]+)/)?.[1] || "0");
      const cnpjDest = xmlTexto.match(/CNPJ[">]*>([\d]+)/g)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const nomeDest = xmlTexto.match(/<xNome>(.*?)<\/xNome>/)?.[1] || "";

      await base44.entities.NotaFiscal.create({
        tipo: "NFe",
        numero,
        serie,
        status: "Importada",
        cliente_nome: nomeDest,
        valor_total: valor,
        chave_acesso: chave,
        xml_content: xmlTexto.substring(0, 5000),
        data_emissao: new Date().toISOString().split("T")[0],
      });

      setXmlTexto("");
      setShowImport(false);
      setMsgFeedback({ tipo: "sucesso", msg: "XML importado com sucesso!" });
      setTimeout(() => setMsgFeedback(null), 4000);
      load();
    } catch (e) {
      alert("Erro ao importar XML: " + e.message);
    }
    setImportando(false);
  };

  // Emissão via Spedy
  const emitirNota = async () => {
    if (!form.cliente_nome) return alert("Informe o cliente.");
    if (!form.valor_total) return alert("Informe o valor total.");
    setEmitindo(true);
    try {
      const response = await base44.functions.invoke("emitirNotaFiscal", {
        tipo: form.tipo,
        cliente_id: form.cliente_id,
        cliente_nome: form.cliente_nome,
        ordem_servico_id: form.ordem_servico_id,
        valor_total: form.valor_total,
        observacoes: form.observacoes,
        data_emissao: form.data_emissao,
      });

      if (response.data?.sucesso) {
        setMsgFeedback({ tipo: "sucesso", msg: `Nota ${form.tipo} emitida com sucesso!` });
      } else {
        // Salva como rascunho se não houver função configurada
        await base44.entities.NotaFiscal.create({ ...form, status: "Rascunho" });
        setMsgFeedback({ tipo: "aviso", msg: "Salvo como rascunho. Configure a integração Spedy nas Configurações." });
      }

      setShowForm(false);
      setForm(defaultForm());
      setTimeout(() => setMsgFeedback(null), 5000);
      load();
    } catch (e) {
      await base44.entities.NotaFiscal.create({ ...form, status: "Rascunho" });
      setMsgFeedback({ tipo: "aviso", msg: "Salvo como rascunho. Configure a API Spedy nas Configurações para emissão automática." });
      setShowForm(false);
      setForm(defaultForm());
      setTimeout(() => setMsgFeedback(null), 5000);
      load();
    }
    setEmitindo(false);
  };

  const filtradas = notas.filter(n =>
    !search ||
    n.numero?.includes(search) ||
    n.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
    n.chave_acesso?.includes(search)
  );

  const statusColor = {
    "Rascunho": "bg-gray-500/10 text-gray-400",
    "Emitida": "bg-green-500/10 text-green-400",
    "Cancelada": "bg-red-500/10 text-red-400",
    "Importada": "bg-blue-500/10 text-blue-400",
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Feedback */}
      {msgFeedback && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${msgFeedback.tipo === "sucesso" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"}`}>
          {msgFeedback.tipo === "sucesso" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm">{msgFeedback.msg}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[["Total", notas.length, "white"], ["Emitidas", notas.filter(n => n.status === "Emitida").length, "green"], ["Rascunhos", notas.filter(n => n.status === "Rascunho").length, "yellow"], ["Importadas", notas.filter(n => n.status === "Importada").length, "blue"]].map(([label, val, c]) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs">{label}</p>
            <p className={`text-2xl font-bold mt-1 text-${c}-400`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Buscar nota..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all">
            <Upload className="w-4 h-4" /> Importar XML
          </button>
          <button onClick={() => { setForm(defaultForm()); setShowForm(true); }} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
            <Plus className="w-4 h-4" /> Emitir Nota
          </button>
        </div>
      </div>

      {/* Table */}
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
                    <td className="px-4 py-3 text-white font-mono">{nota.numero || "—"}{nota.serie ? `/${nota.serie}` : ""}</td>
                    <td className="px-4 py-3 text-white">{nota.cliente_nome || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{nota.data_emissao || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColor[nota.status] || "bg-gray-500/10 text-gray-400"}`}>
                        {nota.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-orange-400 font-bold">
                      R$ {Number(nota.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
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
              <h2 className="text-white font-semibold">Importar XML de Nota Fiscal</h2>
              <button onClick={() => setShowImport(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-gray-400 text-sm">Cole o conteúdo do XML da nota fiscal abaixo:</p>
              <textarea
                value={xmlTexto}
                onChange={e => setXmlTexto(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-green-400 font-mono rounded-lg p-3 text-xs focus:outline-none focus:border-orange-500 resize-none"
                rows={12}
                placeholder="<?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?>&#10;<nfeProc>...</nfeProc>"
              />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={importarXML} disabled={importando} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all disabled:opacity-50">
                {importando ? "Importando..." : "Importar XML"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Emitir */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">Emitir Nota Fiscal</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-sm text-yellow-400">
                ⚠️ Para emissão via Spedy, configure a chave API em Configurações primeiro.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <F label="Tipo NF">
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="input-dark">
                    <option>NFe</option>
                    <option>NFSe</option>
                    <option>NFCe</option>
                  </select>
                </F>
                <F label="Data Emissão">
                  <input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })} className="input-dark" />
                </F>
                <F label="Selecionar Cliente" className="col-span-2">
                  <select value={form.cliente_id} onChange={e => {
                    const c = clientes.find(c => c.id === e.target.value);
                    setForm({ ...form, cliente_id: e.target.value, cliente_nome: c?.nome || "" });
                  }} className="input-dark">
                    <option value="">— Selecione —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </F>
                <F label="Nome Cliente" className="col-span-2">
                  <input value={form.cliente_nome} onChange={e => setForm({ ...form, cliente_nome: e.target.value })} className="input-dark" />
                </F>
                <F label="Valor Total (R$)" className="col-span-2">
                  <input type="number" step="0.01" value={form.valor_total} onChange={e => setForm({ ...form, valor_total: Number(e.target.value) })} className="input-dark" />
                </F>
              </div>
              <F label="Observações / Discriminação">
                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input-dark" rows={3} />
              </F>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={emitirNota} disabled={emitindo} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all disabled:opacity-50">
                {emitindo ? "Emitindo..." : "Emitir Nota"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; }`}</style>
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