import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, User, Phone, Mail, ChevronDown, ChevronUp, Car, X, LayoutGrid, List } from "lucide-react";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [colunas, setColunas] = useState(() => {
    const saved = localStorage.getItem("clientes_colunas");
    return saved ? JSON.parse(saved) : {
      tipo: true, nome: true, nome_fantasia: false, cpf_cnpj: true, telefone: true,
      rg_ie: false, email: false, cep: false, endereco: false, numero: false, bairro: false, cidade: false, estado: false
    };
  });
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return { nome: "", nome_fantasia: "", tipo: "Pessoa Física", cpf_cnpj: "", rg_ie: "", telefone: "", email: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", observacoes: "" };
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

  const [avisoConsumidor, setAvisoConsumidor] = useState(false);
  const isConsumidor = (c) => c?.nome?.toUpperCase() === "CONSUMIDOR";

  const salvar = async () => {
    if (!form.nome) return alert("Informe o nome do cliente.");
    if (editando && isConsumidor(editando)) return alert("O cliente CONSUMIDOR não pode ser alterado.");
    // Validar CPF/CNPJ duplicado
    if (form.cpf_cnpj) {
      const cpfLimpo = form.cpf_cnpj.replace(/\D/g, "");
      const duplicado = clientes.find(c =>
        c.cpf_cnpj?.replace(/\D/g, "") === cpfLimpo && c.id !== editando?.id
      );
      if (duplicado) return alert(`Já existe um cadastro com este CPF/CNPJ: ${duplicado.nome}`);
    }
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

  const excluir = async (c) => {
    if (isConsumidor(c)) { setAvisoConsumidor(true); return; }
    if (!confirm("Excluir este cliente?")) return;
    await base44.entities.Cliente.delete(c.id);
    load();
  };

  const excluirVeiculo = async (veiculoId) => {
    if (!confirm("Excluir este veículo?")) return;
    await base44.entities.Veiculo.delete(veiculoId);
    load();
  };

  const editarCliente = (c) => {
    if (isConsumidor(c)) return alert("O cliente CONSUMIDOR não pode ser alterado.");
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

  const toggleColuna = (col) => {
    const updated = { ...colunas, [col]: !colunas[col] };
    setColunas(updated);
    localStorage.setItem("clientes_colunas", JSON.stringify(updated));
  };

  const colunasDisponiveis = [
    { key: "nome_fantasia", label: "NOME SOCIAL / NOME FANTASIA" },
    { key: "rg_ie", label: "INSCRIÇÃO ESTADUAL" },
    { key: "email", label: "E-MAIL" },
    { key: "cep", label: "CEP" },
    { key: "endereco", label: "ENDEREÇO" }
  ];



  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        {/* Linha 1: botão novo cadastro */}
        <button
          onClick={() => { setShowForm(true); setEditando(null); setForm(defaultForm()); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{background: "#00ff00", color: "#fff"}}
          onMouseEnter={e => e.currentTarget.style.background = "#00dd00"}
          onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
        >
          <Plus className="w-4 h-4" /> Novo Cadastro
        </button>
        {/* Linha 2: busca + filtro */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar cadastro..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => setFilterOpen(!filterOpen)}
              className="px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              ⚙️ Filtro
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 z-50 w-64 space-y-2">
                <p className="text-xs text-gray-400 font-semibold mb-3">COLUNAS ADICIONAIS</p>
                {colunasDisponiveis.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-2 rounded transition-all">
                    <input 
                      type="checkbox" 
                      checked={colunas[col.key]} 
                      onChange={() => toggleColuna(col.key)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-gray-300">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum cadastro encontrado</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-orange-400 text-sm hover:text-orange-300">
            Criar primeiro cadastro
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 border-b border-gray-700 sticky top-0">
                <tr>
                  {colunas.tipo && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">TIPO</th>}
                  {colunas.nome && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">NOME / RAZÃO SOCIAL</th>}
                  {colunas.nome_fantasia && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">NOME SOCIAL / FANTASIA</th>}
                  {colunas.cpf_cnpj && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">CPF/CNPJ</th>}
                  {colunas.telefone && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">CONTATO</th>}
                  {colunas.rg_ie && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">INSCRIÇÃO ESTADUAL</th>}
                  {colunas.email && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">E-MAIL</th>}
                  {colunas.cep && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">CEP</th>}
                  {colunas.endereco && <th className="px-4 py-1.5 text-left text-xs font-bold text-gray-300 whitespace-nowrap">ENDEREÇO</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtrados.map(c => (
                  <tr key={c.id} className="hover:bg-gray-800/50 transition-all cursor-pointer" onClick={() => editarCliente(c)}>
                    {colunas.tipo && <td className="px-4 py-1.5 text-gray-300 text-xs whitespace-nowrap">{isConsumidor(c) ? "—" : (c.tipo || "—")}</td>}
                    {colunas.nome && <td className="px-4 py-1.5 text-white font-medium text-xs whitespace-nowrap">{c.nome}</td>}
                    {colunas.nome_fantasia && <td className="px-4 py-1.5 text-gray-400 text-xs whitespace-nowrap">{c.nome_fantasia || "—"}</td>}
                    {colunas.cpf_cnpj && <td className="px-4 py-1.5 text-gray-400 text-xs whitespace-nowrap">{c.cpf_cnpj || "—"}</td>}
                    {colunas.telefone && <td className="px-4 py-1.5 text-gray-400 text-xs whitespace-nowrap">{c.telefone || "—"}</td>}
                    {colunas.rg_ie && <td className="px-4 py-1.5 text-gray-400 text-xs whitespace-nowrap">{c.rg_ie || "—"}</td>}
                    {colunas.email && <td className="px-4 py-1.5 text-gray-400 text-xs truncate">{c.email || "—"}</td>}
                    {colunas.cep && <td className="px-4 py-1.5 text-gray-400 text-xs whitespace-nowrap">{c.cep || "—"}</td>}
                    {colunas.endereco && <td className="px-4 py-1.5"><div className="text-gray-400 text-xs">{(c.endereco || "—")}</div><div className="text-gray-500 text-xs">{(c.numero || "—")}</div><div className="text-gray-500 text-xs">{(c.bairro || "—")}</div><div className="text-gray-500 text-xs">{((c.cidade || "") + (c.estado ? " - " + c.estado : "") || "—")}</div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">{editando ? "Editar Cadastro" : "Novo Cadastro"}</h2>
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
                <FormGroup label="CPF / CNPJ">
                   <input value={form.cpf_cnpj} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} className="input-dark" autoComplete="new-password" />
                 </FormGroup>
                <FormGroup label="Nome / Razão Social *">
                   <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="input-dark" autoComplete="new-password" />
                 </FormGroup>
                 <FormGroup label="Nome Social / Nome Fantasia">
                   <input value={form.nome_fantasia} onChange={e => setForm({ ...form, nome_fantasia: e.target.value })} className="input-dark" autoComplete="new-password" />
                 </FormGroup>
                <FormGroup label="Inscrição Estadual">
                  <input value={form.rg_ie} onChange={e => setForm({ ...form, rg_ie: e.target.value.replace(/[.-]/g, '') })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="Telefone Contato">
                  <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="E-mail">
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="CEP">
                  <input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="Endereço">
                  <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="Número">
                  <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="Complemento">
                  <input value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="Bairro">
                  <input value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="Cidade">
                  <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} className="input-dark" autoComplete="new-password" />
                </FormGroup>
                <FormGroup label="Estado">
                  <input value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="input-dark" maxLength={2} autoComplete="new-password" />
                </FormGroup>
              </div>
              <FormGroup label="Observações">
                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} className="input-dark" rows={2} />
              </FormGroup>
            </div>
            <div className="flex justify-between gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { if (editando && !isConsumidor(editando)) excluir(editando); }} className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${editando ? "text-white hover:opacity-90" : "text-gray-500 cursor-not-allowed opacity-50"}`} style={{background: editando ? "#cc0000" : "#666"}}>
                Excluir
              </button>
              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditando(null); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-all">
                  Cancelar
                </button>
                <button onClick={salvar} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all" style={{background: "#00ff00"}} onMouseEnter={e => e.currentTarget.style.background = "#00dd00"} onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}>
                  {editando ? "Salvar Alterações" : "Cadastrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal aviso CONSUMIDOR */}
      {avisoConsumidor && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/40 rounded-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-white font-bold text-lg">Ação não permitida</h3>
            <p className="text-gray-400 text-sm">O cliente <strong className="text-white">CONSUMIDOR</strong> é um registro padrão do sistema e não pode ser excluído.</p>
            <button onClick={() => setAvisoConsumidor(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{background:"#cc0000"}}
              onMouseEnter={e=>e.currentTarget.style.background="#aa0000"}
              onMouseLeave={e=>e.currentTarget.style.background="#cc0000"}>
              Entendido
            </button>
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