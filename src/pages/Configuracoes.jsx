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
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", usuario: "", senha: "", confirmarSenha: "", tipo: "gerente" });
  const [editandoUsuario, setEditandoUsuario] = useState(null); // {index, dados}
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

  const salvarEdicaoUsuario = async () => {
    if (!editandoUsuario) return;
    const { dados } = editandoUsuario;
    if (!dados.nome || !dados.usuario) return alert("Preencha nome e usuário.");
    setSalvandoUsuario(true);

    if (editandoUsuario.isAdmin) {
      // Salvar senha do admin se preenchida
      if (dados.senha) {
        const configs = await base44.entities.Configuracao.list("-created_date", 200);
        const existente = configs.find(c => c.chave === "admin_senha");
        if (existente) {
          await base44.entities.Configuracao.update(existente.id, { chave: "admin_senha", valor: dados.senha });
        } else {
          await base44.entities.Configuracao.create({ chave: "admin_senha", valor: dados.senha, descricao: "Senha do admin" });
        }
      }
    } else {
      const registros = await base44.entities.Configuracao.filter({ chave: "usuario_extra" }, "-created_date", 50);
      const reg = registros.find(r => { try { return JSON.parse(r.valor).usuario === editandoUsuario.usuarioOriginal; } catch { return false; } });
      const novoValor = { nome: dados.nome, usuario: dados.usuario, senha: dados.senha, tipo: dados.tipo };
      if (reg) {
        await base44.entities.Configuracao.update(reg.id, { chave: "usuario_extra", valor: JSON.stringify(novoValor) });
      } else {
        await base44.entities.Configuracao.create({ chave: "usuario_extra", valor: JSON.stringify(novoValor), descricao: `Usuário extra: ${dados.nome}` });
      }
    }

    setEditandoUsuario(null);
    setSalvandoUsuario(false);
    loadAll();
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

      <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50" style={{background:"#00ff00"}} onMouseEnter={e=>e.currentTarget.style.background="#00dd00"} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
        <Save className="w-5 h-5" />
        {salvando ? "Salvando..." : "Salvar Configurações"}
      </button>

      {/* Usuários */}
      <Section title="Gerenciar Usuários" icon={UserPlus}>
        {/* Modal de edição */}
        {editandoUsuario && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h3 className="text-white font-semibold text-lg">Editar Usuário</h3>
              <F label="Nome *">
                <input value={editandoUsuario.dados.nome} onChange={e => setEditandoUsuario(ed => ({ ...ed, dados: { ...ed.dados, nome: e.target.value } }))} className="input-dark" />
              </F>
              <F label="Nome de usuário *">
                <input value={editandoUsuario.dados.usuario} onChange={e => setEditandoUsuario(ed => ({ ...ed, dados: { ...ed.dados, usuario: e.target.value } }))} className="input-dark" />
              </F>
              <F label="Senha">
                <input type="password" value={editandoUsuario.dados.senha} onChange={e => setEditandoUsuario(ed => ({ ...ed, dados: { ...ed.dados, senha: e.target.value } }))} className="input-dark" autoComplete="new-password" />
              </F>
              <F label="Tipo">
                <div className="flex gap-2 mt-1">
                  {[
                    { value: "gerente", label: "Gerente", desc: "Acesso completo" },
                    { value: "contador", label: "Contador", desc: "Apenas Notas Fiscais" },
                    { value: "vendedor", label: "Vendedor", desc: "Apenas Vendas" },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setEditandoUsuario(ed => ({ ...ed, dados: { ...ed.dados, tipo: opt.value } }))}
                      className={`flex-1 flex flex-col items-center py-2 px-2 rounded-xl border-2 transition-all text-center ${editandoUsuario.dados.tipo === opt.value ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"}`}>
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </F>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditandoUsuario(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-400 border border-gray-700 hover:border-gray-500 transition-all">Cancelar</button>
                <button onClick={salvarEdicaoUsuario} disabled={salvandoUsuario} className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e=>e.currentTarget.style.background="#00dd00"} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
                  {salvandoUsuario ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 space-y-2">
          {/* Gerente fixo (admin) */}
          <UserRow
            nome="Administrador"
            usuario="admin"
            tipo="Gerente"
            canDelete={false}
            onEdit={() => setEditandoUsuario({ isAdmin: true, usuarioOriginal: "admin", dados: { nome: "Administrador", usuario: "admin", senha: "", tipo: "gerente" } })}
          />
          {/* Usuários extras */}
          {usuarios.map((u, i) => {
            const tipoLabel = u.tipo === "contador" ? "Contador" : u.tipo === "vendedor" ? "Vendedor" : "Gerente";
            const isGerente = u.tipo === "gerente" || (!u.tipo || u.tipo === "usuario");
            return (
              <UserRow
                key={i}
                nome={u.nome}
                usuario={u.usuario}
                tipo={tipoLabel}
                canDelete={!isGerente}
                onEdit={() => setEditandoUsuario({ isAdmin: false, usuarioOriginal: u.usuario, dados: { ...u, tipo: u.tipo || "gerente" } })}
                onDelete={() => excluirUsuario(u)}
              />
            );
          })}
        </div>

        <div className="border-t border-gray-800 pt-5">
          <p className="text-white text-sm font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-green-400" /> Criar Novo Usuário</p>
          {feedbackUsuario && (
            <div className={`mb-4 text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${feedbackUsuario.tipo === "sucesso" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {feedbackUsuario.tipo === "sucesso" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedbackUsuario.msg}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Nome *">
              <input value={novoUsuario.nome} onChange={e => setNovoUsuario(u => ({ ...u, nome: e.target.value }))} className="input-dark" />
            </F>
            <F label="Nome de usuário *">
              <input value={novoUsuario.usuario} onChange={e => setNovoUsuario(u => ({ ...u, usuario: e.target.value }))} className="input-dark" />
            </F>
            <F label="Senha *">
              <input type="password" value={novoUsuario.senha} onChange={e => setNovoUsuario(u => ({ ...u, senha: e.target.value }))} className="input-dark" autoComplete="new-password" />
            </F>
            <F label="Confirmar senha *">
              <input type="password" value={novoUsuario.confirmarSenha} onChange={e => setNovoUsuario(u => ({ ...u, confirmarSenha: e.target.value }))} className="input-dark" autoComplete="new-password" />
            </F>
          </div>
          <div className="mt-4">
            <label className="block text-xs text-gray-400 mb-2">Tipo de Usuário *</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "gerente", label: "Gerente", desc: "Acesso completo" },
                { value: "contador", label: "Contador", desc: "Apenas Notas Fiscais" },
                { value: "vendedor", label: "Vendedor", desc: "Apenas Vendas" },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setNovoUsuario(u => ({ ...u, tipo: opt.value }))}
                  className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all text-center ${novoUsuario.tipo === opt.value ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"}`}>
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-xs mt-1 opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <button onClick={criarUsuario} disabled={salvandoUsuario} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e=>e.currentTarget.style.background="#00dd00"} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
              <UserPlus className="w-4 h-4" />
              {salvandoUsuario ? "Criando..." : "Criar Usuário"}
            </button>
          </div>
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
        {Icon && <Icon className="w-5 h-5 text-green-400" />}
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

function UserRow({ nome, usuario, tipo, canDelete, onEdit, onDelete }) {
  return (
    <div className="flex items-center bg-gray-800 rounded-xl px-4 py-3 gap-3">
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{background:"rgba(0,255,0,0.15)"}}>
        <User className="w-4 h-4 text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{nome}</p>
        <p className="text-gray-500 text-xs truncate">Usuário: {usuario}</p>
      </div>
      <span className="text-xs px-3 py-1 rounded-full font-medium flex-shrink-0" style={{background:"rgba(0,255,0,0.1)", color:"#00ff00"}}>{tipo}</span>
      <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-white transition-all flex-shrink-0" title="Editar">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.768-6.768a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16.414V19h2.586a2 2 0 001.414-.586L20 12.414" /></svg>
      </button>
      {canDelete ? (
        <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-400 transition-all flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      ) : (
        <div className="w-7 flex-shrink-0" />
      )}
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-t-transparent rounded-full animate-spin" style={{border:"2px solid #00ff00", borderTopColor:"transparent"}} /></div>;
}