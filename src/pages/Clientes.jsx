import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, User, Phone, Mail, ChevronDown, ChevronUp, Car, X } from "lucide-react";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return { nome: "", tipo: "Pessoa Física", cpf_cnpj: "", rg_ie: "", telefone: "", email: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", observacoes: "" };
  }

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [c, v] = await Promise.all([
      base44.entities.Cliente.list("-created_date", 200),
      base44.entities.Veiculo.list("-created_date", 500),
    ]);
    setClientes(c);
    setVeiculos(v);
    setLoading(false);
  };

  const salvar = async () => {
    if (!form.nome) return alert("Informe o nome do cliente.");
    if (editando) {
      await base44.entities.Cliente.update(editando.id, form);
    } else {
      await base44.entities.Cliente.create(form);
    }
    setShowForm(false);
    setEditando(null);
    setForm(defaultForm());
    load();
  };

  const excluir = async (id) => {
    if (!confirm("Excluir este cliente?")) return;
    await base44.entities.Cliente.delete(id);
    load();
  };

  const editarCliente = (c) => {
    setForm({ ...defaultForm(), ...c });
    setEditando(c);
    setShowForm(true);
  };

  const filtrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf_cnpj?.includes(search) ||
    c.telefone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const veiculosDoCliente = (id) => veiculos.filter(v => v.cliente_id === id);

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        <button
          onClick={() => { setShowForm(true); setEditando(null); setForm(defaultForm()); }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum cliente encontrado</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-orange-400 text-sm hover:text-orange-300">
            Cadastrar primeiro cliente
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl">
              <div
                className="flex items-center justify-between p-4 cursor-pointer select-none"
                onClick={() => setExpandido(expandido === c.id ? null : c.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm break-words leading-snug">{c.nome}</p>
                    {(c.telefone || c.email) && (
                      <p className="text-gray-400 text-xs">{c.telefone || c.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => editarCliente(c)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-800 transition-all">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => excluir(c.id)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandido === c.id && (
                <div className="border-t border-gray-800 p-4 bg-gray-900/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                    {c.endereco && <Info label="Endereço" value={`${c.endereco}, ${c.numero}`} />}
                    {c.bairro && <Info label="Bairro" value={c.bairro} />}
                    {c.cidade && <Info label="Cidade" value={`${c.cidade}/${c.estado}`} />}
                    {c.tipo && <Info label="Tipo" value={c.tipo} />}
                    {c.email && <Info label="E-mail" value={c.email} />}
                    {c.observacoes && <Info label="Observações" value={c.observacoes} />}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
                      <Car className="w-3 h-3" /> Veículos
                    </p>
                    {veiculosDoCliente(c.id).length === 0 ? (
                      <p className="text-gray-600 text-xs">Nenhum veículo cadastrado</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {veiculosDoCliente(c.id).map(v => (
                          <span key={v.id} className="bg-gray-800 border border-gray-700 text-xs text-gray-300 px-3 py-1 rounded-full">
                            {v.placa} • {v.marca} {v.modelo} {v.ano}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">{editando ? "Editar Cliente" : "Novo Cliente"}</h2>
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormGroup label="Tipo">
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="input-dark">
                    <option>Pessoa Física</option>
                    <option>Pessoa Jurídica</option>
                  </select>
                </FormGroup>
                <FormGroup label="Nome / Razão Social *">
                  <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="input-dark" placeholder="Nome completo" />
                </FormGroup>
                <FormGroup label="CPF / CNPJ">
                  <input value={form.cpf_cnpj} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} className="input-dark" placeholder="000.000.000-00" />
                </FormGroup>
                <FormGroup label="RG / IE">
                  <input value={form.rg_ie} onChange={e => setForm({ ...form, rg_ie: e.target.value })} className="input-dark" />
                </FormGroup>
                <FormGroup label="Telefone / WhatsApp">
                  <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} className="input-dark" placeholder="(00) 00000-0000" />
                </FormGroup>
                <FormGroup label="E-mail">
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-dark" placeholder="email@exemplo.com" />
                </FormGroup>
                <FormGroup label="CEP">
                  <input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} className="input-dark" placeholder="00000-000" />
                </FormGroup>
                <FormGroup label="Endereço">
                  <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} className="input-dark" />
                </FormGroup>
                <FormGroup label="Número">
                  <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} className="input-dark" />
                </FormGroup>
                <FormGroup label="Complemento">
                  <input value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })} className="input-dark" />
                </FormGroup>
                <FormGroup label="Bairro">
                  <input value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} className="input-dark" />
                </FormGroup>
                <FormGroup label="Cidade">
                  <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} className="input-dark" />
                </FormGroup>
                <FormGroup label="Estado">
                  <input value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="input-dark" maxLength={2} placeholder="SP" />
                </FormGroup>
              </div>
              <FormGroup label="Observações">
                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input-dark" rows={2} />
              </FormGroup>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-all">
                Cancelar
              </button>
              <button onClick={salvar} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all">
                {editando ? "Salvar Alterações" : "Cadastrar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; }`}</style>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white text-sm">{value}</p>
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
}