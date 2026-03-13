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

  // Alterar senha admin
  const [senhaAdmin, setSenhaAdmin] = useState({ atual: "", nova: "", confirmar: "" });
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [feedbackSenha, setFeedbackSenha] = useState(null);

  // Usuários
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", usuario: "", senha: "", confirmarSenha: "", tipo: "usuario" });
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [feedbackUsuario, setFeedbackUsuario] = useState(null);

  // Usuários salvos no banco local
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const configs = await base44.entities.Configuracao.list("-created_date", 200);

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

  const alterarSenhaAdmin = async () => {
    setFeedbackSenha(null);
    if (!senhaAdmin.atual || !senhaAdmin.nova || !senhaAdmin.confirmar)
      return setFeedbackSenha({ tipo: "erro", msg: "Preencha todos os campos." });
    if (senhaAdmin.nova !== senhaAdmin.confirmar)
      return setFeedbackSenha({ tipo: "erro", msg: "A nova senha e a confirmação não coincidem." });
    if (senhaAdmin.nova.length < 4)
      return setFeedbackSenha({ tipo: "erro", msg: "A senha deve ter no mínimo 4 caracteres." });

    // Verifica senha atual
    const configs = await base44.entities.Configuracao.list("-created_date", 200);
    const senhaAtualConfig = configs.find(c => c.chave === "admin_senha")?.valor || "admin123";
    if (senhaAdmin.atual !== senhaAtualConfig)
      return setFeedbackSenha({ tipo: "erro", msg: "Senha atual incorreta." });

    setSalvandoSenha(true);
    const existente = configs.find(c => c.chave === "admin_senha");
    if (existente) {
      await base44.entities.Configuracao.update(existente.id, { chave: "admin_senha", valor: senhaAdmin.nova });
    } else {
      await base44.entities.Configuracao.create({ chave: "admin_senha", valor: senhaAdmin.nova, descricao: "Senha do admin" });
    }
    setSenhaAdmin({ atual: "", nova: "", confirmar: "" });
    setFeedbackSenha({ tipo: "sucesso", msg: "Senha alterada com sucesso!" });
    setSalvandoSenha(false);
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
      valor: JSON.stringify({ nome: novoUsuario.nome, usuario: novoUsuario.usuario, senha: novoUsuario.senha, tipo: novoUsuario.tipo }),
      descricao: `Usuário extra: ${novoUsuario.nome}`,
    });
    setNovoUsuario({ nome: "", usuario: "", senha: "", confirmarSenha: "", tipo: "usuario" });
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
    <div className="space-y-6 max-w-4xl mx-auto">
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
        {!config.spedy_api_key && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-4 text-sm text-yellow-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Chave API da Spedy não configurada. Insira abaixo para habilitar a emissão de notas fiscais. Consulte: <a href="https://docs.spedy.com.br" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-200">docs.spedy.com.br</a></span>
          </div>
        )}
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

      <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50">
        <Save className="w-5 h-5" />
        {salvando ? "Salvando..." : "Salvar Configurações"}
      </button>

      {/* Alterar senha do Admin */}
      <Section title="Alterar Senha do Administrador" icon={User}>
        {feedbackSenha && (
          <div className={`mb-3 text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${feedbackSenha.tipo === "sucesso" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {feedbackSenha.tipo === "sucesso" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {feedbackSenha.msg}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <F label="Senha atual *">
            <input type="password" value={senhaAdmin.atual} onChange={e => setSenhaAdmin(s => ({ ...s, atual: e.target.value }))} className="input-dark" placeholder="••••••••" />
          </F>
          <F label="Nova senha *">
            <input type="password" value={senhaAdmin.nova} onChange={e => setSenhaAdmin(s => ({ ...s, nova: e.target.value }))} className="input-dark" placeholder="••••••••" />
          </F>
          <F label="Confirmar nova senha *">
            <input type="password" value={senhaAdmin.confirmar} onChange={e => setSenhaAdmin(s => ({ ...s, confirmar: e.target.value }))} className="input-dark" placeholder="••••••••" />
          </F>
        </div>
        <button onClick={alterarSenhaAdmin} disabled={salvandoSenha} className="mt-3 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
          <Save className="w-4 h-4" />
          {salvandoSenha ? "Salvando..." : "Alterar Senha"}
        </button>
      </Section>

      {/* Usuários */}
      <Section title="Gerenciar Usuários" icon={UserPlus}>
        <div className="mb-4 space-y-3">
          {/* Admin fixo */}
          <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Administrador</p>
                <p className="text-gray-500 text-xs">Usuário: admin • Senha: ••••••••</p>
              </div>
            </div>
            <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-1 rounded-full">Admin</span>
          </div>

          {/* Usuários extras */}
          {usuarios.map((u, i) => {
            const tipoLabel = u.tipo === "contador" ? "Contador" : u.tipo === "vendedor" ? "Vendedor" : "Usuário";
            const tipoColor = u.tipo === "contador" ? "text-green-400 bg-green-500/10" : u.tipo === "vendedor" ? "text-green-400 bg-green-500/10" : "text-gray-400 bg-gray-700/30";
            return (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{u.nome}</p>
                    <p className="text-gray-500 text-xs">Usuário: {u.usuario}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${tipoColor}`}>{tipoLabel}</span>
                  <button onClick={() => excluirUsuario(u)} className="p-1.5 text-gray-500 hover:text-red-400 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-800 pt-4">
          <p className="text-gray-400 text-sm font-medium mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Criar Novo Usuário</p>
          {feedbackUsuario && (
            <div className={`mb-3 text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${feedbackUsuario.tipo === "sucesso" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {feedbackUsuario.tipo === "sucesso" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedbackUsuario.msg}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <F label="Nome completo *">
              <input value={novoUsuario.nome} onChange={e => setNovoUsuario(u => ({ ...u, nome: e.target.value }))} className="input-dark" placeholder="Ex: João Silva" />
            </F>
            <F label="Nome de usuário *">
              <input value={novoUsuario.usuario} onChange={e => setNovoUsuario(u => ({ ...u, usuario: e.target.value }))} className="input-dark" placeholder="Ex: joao123" />
            </F>
            <F label="Senha *">
              <input type="password" value={novoUsuario.senha} onChange={e => setNovoUsuario(u => ({ ...u, senha: e.target.value }))} className="input-dark" placeholder="••••••••" />
            </F>
            <F label="Confirmar senha *">
              <input type="password" value={novoUsuario.confirmarSenha} onChange={e => setNovoUsuario(u => ({ ...u, confirmarSenha: e.target.value }))} className="input-dark" placeholder="••••••••" />
            </F>
            <F label="Tipo de Usuário *" className="col-span-1 md:col-span-2">
              <div className="flex gap-2 mt-1">
                {[
                  { value: "usuario", label: "Usuário Padrão", desc: "Acesso completo" },
                  { value: "contador", label: "Contador", desc: "Apenas Notas Fiscais" },
                  { value: "vendedor", label: "Vendedor", desc: "Apenas Vendas" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setNovoUsuario(u => ({ ...u, tipo: opt.value }))}
                    className={`flex-1 flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all text-center ${novoUsuario.tipo === opt.value ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"}`}>
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs mt-0.5 opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </F>
          </div>
          <button onClick={criarUsuario} disabled={salvandoUsuario} className="mt-3 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
            <UserPlus className="w-4 h-4" />
            {salvandoUsuario ? "Criando..." : "Criar Usuário"}
          </button>
        </div>
      </Section>

      {/* Sair */}
      <Section title="Sessão" icon={LogOut}>
        <p className="text-gray-400 text-sm mb-3">Clique abaixo para encerrar sua sessão e voltar à tela de login.</p>
        <button onClick={handleLogout} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
          <LogOut className="w-4 h-4" /> Sair do Sistema
        </button>
      </Section>

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#22c55e; } .input-dark::placeholder { color:#6b7280; }`}</style>
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