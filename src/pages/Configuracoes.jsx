import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, Save, CheckCircle, Plus, X, UserPlus, LogOut, AlertCircle, User } from "lucide-react";

export default function Configuracoes() {
  const [config, setConfig] = useState({
    nome_oficina: "", cnpj: "", telefone: "", email: "", endereco: "", cidade: "", estado: "", cep: "",
    spedy_api_key: "", spedy_ambiente: "homologacao",
    logo_url: "", observacoes_padrao: "", proximo_numero_os: "1",
  });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [loading, setLoading] = useState(true);

  // Usuários
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", usuario: "", senha: "", confirmarSenha: "" });
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [feedbackUsuario, setFeedbackUsuario] = useState(null);

  // Usuários salvos no banco local
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [configs, users] = await Promise.all([
      base44.entities.Configuracao.list("-created_date", 100),
      base44.entities.Configuracao.filter({ chave: "usuario_extra" }, "-created_date", 50),
    ]);

    const c = { ...config };
    configs.forEach(item => {
      if (c.hasOwnProperty(item.chave)) c[item.chave] = item.valor;
    });
    setConfig(c);

    // Usuários extras cadastrados
    const usersExtras = configs.filter(i => i.chave === "usuario_extra").map(i => {
      try { return JSON.parse(i.valor); } catch { return null; }
    }).filter(Boolean);
    setUsuarios(usersExtras);

    setLoading(false);
  };

  const salvar = async () => {
    setSalvando(true);
    const existentes = await base44.entities.Configuracao.list("-created_date", 200);

    for (const [chave, valor] of Object.entries(config)) {
      const existente = existentes.find(e => e.chave === chave);
      if (existente) {
        await base44.entities.Configuracao.update(existente.id, { chave, valor: String(valor) });
      } else {
        await base44.entities.Configuracao.create({ chave, valor: String(valor) });
      }
    }

    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  const criarUsuario = async () => {
    setFeedbackUsuario(null);
    if (!novoUsuario.nome || !novoUsuario.usuario || !novoUsuario.senha)
      return setFeedbackUsuario({ tipo: "erro", msg: "Preencha todos os campos obrigatórios." });
    if (novoUsuario.senha !== novoUsuario.confirmarSenha)
      return setFeedbackUsuario({ tipo: "erro", msg: "As senhas não coincidem." });
    if (novoUsuario.usuario === "admin")
      return setFeedbackUsuario({ tipo: "erro", msg: "Nome de usuário 'admin' já existe." });

    setSalvandoUsuario(true);
    await base44.entities.Configuracao.create({
      chave: "usuario_extra",
      valor: JSON.stringify({ nome: novoUsuario.nome, usuario: novoUsuario.usuario, senha: novoUsuario.senha }),
      descricao: `Usuário extra: ${novoUsuario.nome}`,
    });
    setNovoUsuario({ nome: "", usuario: "", senha: "", confirmarSenha: "" });
    setFeedbackUsuario({ tipo: "sucesso", msg: `Usuário "${novoUsuario.usuario}" criado com sucesso!` });
    setSalvandoUsuario(false);
    loadAll();
  };

  const excluirUsuario = async (usuario) => {
    if (!confirm(`Excluir o usuário "${usuario.usuario}"?`)) return;
    const registros = await base44.entities.Configuracao.filter({ chave: "usuario_extra" }, "-created_date", 50);
    const reg = registros.find(r => { try { return JSON.parse(r.valor).usuario === usuario.usuario; } catch { return false; } });
    if (reg) { await base44.entities.Configuracao.delete(reg.id); loadAll(); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("oficina_auth");
    window.location.reload();
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6 max-w-4xl">
      {salvo && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle className="w-5 h-5" />
          Configurações salvas com sucesso!
        </div>
      )}

      {/* Dados da Oficina */}
      <Section title="Dados da Oficina" icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Nome da Oficina">
            <input value={config.nome_oficina} onChange={e => setConfig({ ...config, nome_oficina: e.target.value })} className="input-dark" placeholder="Ex: Auto Mecânica Silva" />
          </F>
          <F label="CNPJ">
            <input value={config.cnpj} onChange={e => setConfig({ ...config, cnpj: e.target.value })} className="input-dark" placeholder="00.000.000/0001-00" />
          </F>
          <F label="Telefone">
            <input value={config.telefone} onChange={e => setConfig({ ...config, telefone: e.target.value })} className="input-dark" placeholder="(00) 00000-0000" />
          </F>
          <F label="E-mail">
            <input value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} className="input-dark" />
          </F>
          <F label="Endereço" className="col-span-1 md:col-span-2">
            <input value={config.endereco} onChange={e => setConfig({ ...config, endereco: e.target.value })} className="input-dark" />
          </F>
          <F label="CEP">
            <input value={config.cep} onChange={e => setConfig({ ...config, cep: e.target.value })} className="input-dark" />
          </F>
          <F label="Cidade">
            <input value={config.cidade} onChange={e => setConfig({ ...config, cidade: e.target.value })} className="input-dark" />
          </F>
          <F label="Estado">
            <input value={config.estado} onChange={e => setConfig({ ...config, estado: e.target.value })} className="input-dark" maxLength={2} />
          </F>
          <F label="Próximo Número OS">
            <input type="number" value={config.proximo_numero_os} onChange={e => setConfig({ ...config, proximo_numero_os: e.target.value })} className="input-dark" />
          </F>
        </div>
        <F label="Observações Padrão OS">
          <textarea value={config.observacoes_padrao} onChange={e => setConfig({ ...config, observacoes_padrao: e.target.value })} className="input-dark" rows={2} placeholder="Texto que aparece automaticamente em novas OS" />
        </F>
      </Section>

      {/* Spedy */}
      <Section title="Integração Spedy — Notas Fiscais" icon={null}>
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 mb-4 text-sm text-orange-300">
          🔑 Configure sua chave API da Spedy para emissão automática de NFe, NFSe e NFCe. Consulte: <a href="https://docs.spedy.com.br" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">docs.spedy.com.br</a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Chave API Spedy" className="col-span-1 md:col-span-2">
            <input
              type="password"
              value={config.spedy_api_key}
              onChange={e => setConfig({ ...config, spedy_api_key: e.target.value })}
              className="input-dark"
              placeholder="Insira sua chave API Spedy"
            />
          </F>
          <F label="Ambiente">
            <select value={config.spedy_ambiente} onChange={e => setConfig({ ...config, spedy_ambiente: e.target.value })} className="input-dark">
              <option value="homologacao">Homologação (Teste)</option>
              <option value="producao">Produção</option>
            </select>
          </F>
        </div>
      </Section>

      <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50">
        <Save className="w-5 h-5" />
        {salvando ? "Salvando..." : "Salvar Configurações"}
      </button>

      {/* Veículos */}
      <Section title="Gerenciar Veículos" icon={Car}>
        <div className="flex justify-between items-center mb-4">
          <p className="text-gray-400 text-sm">{veiculos.length} veículos cadastrados</p>
          <button
            onClick={() => { setVeiculoForm(defaultVeiculo()); setEditandoVeiculo(null); setShowVeiculo(true); }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" /> Novo Veículo
          </button>
        </div>
        {veiculos.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">Nenhum veículo cadastrado. Cadastre veículos para vincular às OS.</p>
        ) : (
          <div className="space-y-2">
            {veiculos.map(v => {
              const cliente = clientes.find(c => c.id === v.cliente_id);
              return (
                <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white font-medium text-sm">{v.placa} — {v.marca} {v.modelo} {v.ano}</p>
                    <p className="text-gray-500 text-xs">{cliente?.nome || "Cliente não encontrado"} • {v.combustivel || ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setVeiculoForm({ ...defaultVeiculo(), ...v }); setEditandoVeiculo(v); setShowVeiculo(true); }} className="p-1.5 text-gray-500 hover:text-blue-400 transition-all">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => excluirVeiculo(v.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Modal Veículo */}
      {showVeiculo && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">{editandoVeiculo ? "Editar Veículo" : "Novo Veículo"}</h2>
              <button onClick={() => { setShowVeiculo(false); setEditandoVeiculo(null); }}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <F label="Cliente *" className="col-span-2">
                  <select value={veiculoForm.cliente_id} onChange={e => setVeiculoForm({ ...veiculoForm, cliente_id: e.target.value })} className="input-dark">
                    <option value="">— Selecione o Cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </F>
                <F label="Placa *">
                  <input value={veiculoForm.placa} onChange={e => setVeiculoForm({ ...veiculoForm, placa: e.target.value })} className="input-dark" placeholder="AAA-0000" />
                </F>
                <F label="Combustível">
                  <select value={veiculoForm.combustivel} onChange={e => setVeiculoForm({ ...veiculoForm, combustivel: e.target.value })} className="input-dark">
                    {["Gasolina","Etanol","Flex","Diesel","Elétrico","Híbrido","GNV"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Marca">
                  <input value={veiculoForm.marca} onChange={e => setVeiculoForm({ ...veiculoForm, marca: e.target.value })} className="input-dark" />
                </F>
                <F label="Modelo">
                  <input value={veiculoForm.modelo} onChange={e => setVeiculoForm({ ...veiculoForm, modelo: e.target.value })} className="input-dark" />
                </F>
                <F label="Ano">
                  <input value={veiculoForm.ano} onChange={e => setVeiculoForm({ ...veiculoForm, ano: e.target.value })} className="input-dark" />
                </F>
                <F label="Cor">
                  <input value={veiculoForm.cor} onChange={e => setVeiculoForm({ ...veiculoForm, cor: e.target.value })} className="input-dark" />
                </F>
                <F label="Chassi" className="col-span-2">
                  <input value={veiculoForm.chassis} onChange={e => setVeiculoForm({ ...veiculoForm, chassis: e.target.value })} className="input-dark" />
                </F>
              </div>
              <F label="Observações">
                <textarea value={veiculoForm.observacoes} onChange={e => setVeiculoForm({ ...veiculoForm, observacoes: e.target.value })} className="input-dark" rows={2} />
              </F>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => { setShowVeiculo(false); setEditandoVeiculo(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
              <button onClick={salvarVeiculo} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all">
                {editandoVeiculo ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#f97316; } .input-dark::placeholder { color:#6b7280; }`}</style>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        {Icon && <Icon className="w-5 h-5 text-orange-400" />}
        <h2 className="text-white font-semibold">{title}</h2>
      </div>
      {children}
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