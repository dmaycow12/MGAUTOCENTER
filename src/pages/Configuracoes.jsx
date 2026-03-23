import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, Save, CheckCircle, UserPlus, LogOut, User, Pencil, Trash2 } from "lucide-react";

export default function Configuracoes() {
  const CHAVES = ["nome_oficina", "cnpj", "telefone", "email", "endereco", "cidade", "estado", "cep",
    "logo_url", "observacoes_padrao", "proximo_numero_os",
    "focusnfe_api_key_homologacao", "focusnfe_api_key_producao",
    "nfe_serie", "nfe_ultimo_numero", "nfe_versao",
    "nfce_serie", "nfce_ultimo_numero", "nfce_versao", "nfce_token", "nfce_csc",
    "nfse_serie_rps", "nfse_ultimo_rps", "nfse_natureza_operacao", "nfse_layout", "nfse_apuracao", "nfse_imunidade", "nfse_tipo_operacao"];

  const [config, setConfig] = useState({
    nome_oficina: "", cnpj: "", telefone: "", email: "", endereco: "", cidade: "", estado: "", cep: "",
    logo_url: "", observacoes_padrao: "", proximo_numero_os: "1",
    focusnfe_api_key_homologacao: "", focusnfe_api_key_producao: "",
    nfe_serie: "1", nfe_ultimo_numero: "0", nfe_versao: "4.00",
    nfce_serie: "1", nfce_ultimo_numero: "0", nfce_versao: "4.00", nfce_token: "", nfce_csc: "",
    nfse_serie_rps: "1", nfse_ultimo_rps: "0", nfse_natureza_operacao: "", nfse_layout: "Nacional", nfse_apuracao: "", nfse_imunidade: "", nfse_tipo_operacao: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configIds, setConfigIds] = useState({});
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", usuario: "", senha: "", confirmarSenha: "", tipo: "gerente" });
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [feedbackUsuario, setFeedbackUsuario] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [avisoUltimoGerente, setAvisoUltimoGerente] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const todos = await base44.entities.Configuracao.list("-created_date", 200);
    const c = {
      nome_oficina: "", cnpj: "", telefone: "", email: "", endereco: "", cidade: "", estado: "", cep: "",
      logo_url: "", observacoes_padrao: "", proximo_numero_os: "1",
      focusnfe_api_key_homologacao: "", focusnfe_api_key_producao: "",
      nfe_serie: "1", nfe_ultimo_numero: "0", nfe_versao: "4.00",
      nfce_serie: "1", nfce_ultimo_numero: "0", nfce_versao: "4.00", nfce_token: "", nfce_csc: "",
      nfse_serie_rps: "1", nfse_ultimo_rps: "0", nfse_natureza_operacao: "", nfse_layout: "Nacional", nfse_apuracao: "", nfse_imunidade: "", nfse_tipo_operacao: "",
    };
    const ids = {};
    const extras = [];
    todos.forEach(item => {
      if (CHAVES.includes(item.chave)) {
        c[item.chave] = item.valor || "";
        ids[item.chave] = item.id;
      } else if (item.chave === "usuario_extra") {
        try {
          extras.push({ ...JSON.parse(item.valor), _id: item.id });
        } catch {}
      }
    });
    setConfig(c);
    setConfigIds(ids);
    setUsuarios(extras);
    setLoading(false);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      for (const chave of CHAVES) {
        const valor = String(config[chave] ?? "");
        if (configIds[chave]) {
          await base44.entities.Configuracao.update(configIds[chave], { chave, valor });
        } else {
          const novo = await base44.entities.Configuracao.create({ chave, valor });
          setConfigIds(prev => ({ ...prev, [chave]: novo.id }));
        }
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } finally {
      setSalvando(false);
    }
  };

  const salvarEdicaoUsuario = async () => {
    if (!editandoUsuario) return;
    const { dados } = editandoUsuario;
    if (!dados.nome || !dados.usuario) return alert("Preencha nome e usuário.");
    setSalvandoUsuario(true);
    const res = await base44.functions.invoke("authSaveUser", {
      action: "update", _id: editandoUsuario._id, nome: dados.nome, usuario: dados.usuario,
      senha: dados.senha || "", tipo: dados.tipo,
    });
    if (res.data?.sucesso) {
      setEditandoUsuario(null);
      await loadAll();
    } else {
      alert(res.data?.erro || "Erro ao salvar.");
    }
    setSalvandoUsuario(false);
  };

  const criarUsuario = async () => {
    setFeedbackUsuario(null);
    if (!novoUsuario.nome || !novoUsuario.usuario || !novoUsuario.senha)
      return setFeedbackUsuario({ tipo: "erro", msg: "Preencha todos os campos obrigatórios." });
    if (novoUsuario.senha !== novoUsuario.confirmarSenha)
      return setFeedbackUsuario({ tipo: "erro", msg: "As senhas não coincidem." });
    setSalvandoUsuario(true);
    const res = await base44.functions.invoke("authSaveUser", {
      action: "create", nome: novoUsuario.nome, usuario: novoUsuario.usuario,
      senha: novoUsuario.senha, tipo: novoUsuario.tipo,
    });
    if (res.data?.sucesso) {
      setNovoUsuario({ nome: "", usuario: "", senha: "", confirmarSenha: "", tipo: "gerente" });
      setFeedbackUsuario({ tipo: "sucesso", msg: `Usuário "${novoUsuario.usuario}" criado com sucesso!` });
      await loadAll();
    } else {
      setFeedbackUsuario({ tipo: "erro", msg: res.data?.erro || "Erro ao criar usuário." });
    }
    setSalvandoUsuario(false);
  };

  const excluirUsuario = async (usuario) => {
    const isGerente = !usuario.tipo || usuario.tipo === "gerente";
    if (isGerente) {
      const totalGerentes = usuarios.filter(u => !u.tipo || u.tipo === "gerente").length;
      if (totalGerentes <= 1) { setAvisoUltimoGerente(true); return; }
    }
    if (!confirm(`Excluir o usuário "${usuario.usuario}"?`)) return;
    if (usuario._id) {
      await base44.functions.invoke("authSaveUser", { action: "delete", _id: usuario._id });
      await loadAll();
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("oficina_ui");
    sessionStorage.removeItem("oficina_token");
    await base44.functions.invoke("authLogout", {});
    window.location.reload();
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {salvo && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle className="w-5 h-5" />
          Configurações salvas com sucesso!
        </div>
      )}

      <Section title="Dados da Oficina" icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Nome da Oficina">
            <input value={config.nome_oficina} onChange={e => setConfig({ ...config, nome_oficina: e.target.value })} className="input-dark" placeholder="Ex: Auto Mecânica Silva" />
          </F>
          <F label="CNPJ">
            <input value={config.cnpj} onChange={e => setConfig({ ...config, cnpj: e.target.value })} className="input-dark" placeholder="00.000.000/0001-00" />
          </F>
          <F label="Telefone">
            <input value={config.telefone} onChange={e => setConfig({ ...config, telefone: e.target.value })} className="input-dark" />
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
        </div>
      </Section>

      <Section title="Integração Focus NFe — Chaves API" icon={null}>
        <div className="bg-gray-800 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TokenField label="Token de Homologação" value={config.focusnfe_api_key_homologacao} onChange={val => setConfig({ ...config, focusnfe_api_key_homologacao: val })} />
            <TokenField label="Token de Produção" value={config.focusnfe_api_key_producao} onChange={val => setConfig({ ...config, focusnfe_api_key_producao: val })} />
          </div>
        </div>
      </Section>

      <Section title="NF-e — Nota Fiscal de Produto" icon={null}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <F label="Última NF-e">
            <input type="number" value={config.nfe_ultimo_numero} onChange={e => setConfig({ ...config, nfe_ultimo_numero: e.target.value })} className="input-dark" />
          </F>
          <F label="Série NF-e">
            <input value={config.nfe_serie} onChange={e => setConfig({ ...config, nfe_serie: e.target.value })} className="input-dark" />
          </F>
          <F label="Versão da NF-e">
            <select value={config.nfe_versao} onChange={e => setConfig({ ...config, nfe_versao: e.target.value })} className="input-dark">
              <option value="4.00">4.00</option>
              <option value="3.10">3.10</option>
            </select>
          </F>
        </div>
      </Section>

      <Section title="NFC-e — Nota Fiscal do Consumidor" icon={null}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Última NFC-e">
            <input type="number" value={config.nfce_ultimo_numero} onChange={e => setConfig({ ...config, nfce_ultimo_numero: e.target.value })} className="input-dark" />
          </F>
          <F label="Série NFC-e">
            <input value={config.nfce_serie} onChange={e => setConfig({ ...config, nfce_serie: e.target.value })} className="input-dark" />
          </F>
          <F label="Token (CSC Token)">
            <input value={config.nfce_token} onChange={e => setConfig({ ...config, nfce_token: e.target.value })} className="input-dark" placeholder="Ex: 000001" />
          </F>
          <F label="CSC (Código de Segurança)">
            <input value={config.nfce_csc} onChange={e => setConfig({ ...config, nfce_csc: e.target.value })} className="input-dark" />
          </F>
          <F label="Versão da NFC-e">
            <select value={config.nfce_versao} onChange={e => setConfig({ ...config, nfce_versao: e.target.value })} className="input-dark">
              <option value="4.00">4.00</option>
              <option value="3.10">3.10</option>
            </select>
          </F>
        </div>
      </Section>

      <Section title="NFS-e — Nota Fiscal de Serviço" icon={null}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Último RPS NFS-e">
            <input type="number" value={config.nfse_ultimo_rps} onChange={e => setConfig({ ...config, nfse_ultimo_rps: e.target.value })} className="input-dark" />
          </F>
          <F label="Série do RPS">
            <input value={config.nfse_serie_rps} onChange={e => setConfig({ ...config, nfse_serie_rps: e.target.value })} className="input-dark" />
          </F>
          <F label="Natureza de operação">
            <input value={config.nfse_natureza_operacao} onChange={e => setConfig({ ...config, nfse_natureza_operacao: e.target.value })} className="input-dark" />
          </F>
          <F label="Layout da NFS-e">
            <select value={config.nfse_layout} onChange={e => setConfig({ ...config, nfse_layout: e.target.value })} className="input-dark">
              <option value="Nacional">Nacional</option>
            </select>
          </F>
          <F label="Apuração dos tributos">
            <input value={config.nfse_apuracao} onChange={e => setConfig({ ...config, nfse_apuracao: e.target.value })} className="input-dark" />
          </F>
          <F label="Tipo imunidade">
            <input value={config.nfse_imunidade} onChange={e => setConfig({ ...config, nfse_imunidade: e.target.value })} className="input-dark" />
          </F>
          <F label="Tipo operação">
            <input value={config.nfse_tipo_operacao} onChange={e => setConfig({ ...config, nfse_tipo_operacao: e.target.value })} className="input-dark" />
          </F>
        </div>
      </Section>

      <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50" style={{background:"#00ff00"}} onMouseEnter={e=>e.currentTarget.style.background="#00dd00"} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
        <Save className="w-5 h-5" />
        {salvando ? "Salvando..." : "Salvar Configurações"}
      </button>

      <Section title="Gerenciar Usuários" icon={UserPlus}>
        {avisoUltimoGerente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
              <h3 className="text-white font-semibold text-lg">Ação não permitida</h3>
              <p className="text-gray-400 text-sm">Não é possível excluir o último gerente do sistema.</p>
              <button onClick={() => setAvisoUltimoGerente(false)} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{background:"#00ff00", color:"#000"}}>Entendido</button>
            </div>
          </div>
        )}

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
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditandoUsuario(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-400 border border-gray-700">Cancelar</button>
                <button onClick={salvarEdicaoUsuario} disabled={salvandoUsuario} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{background:"#00ff00", color:"#000"}}>
                  {salvandoUsuario ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 space-y-2">
          {usuarios.map((u, i) => (
            <UserRow key={i} nome={u.nome} usuario={u.usuario} tipo={u.tipo === "contador" ? "Contador" : u.tipo === "vendedor" ? "Vendedor" : "Gerente"}
              onEdit={() => setEditandoUsuario({ _id: u._id, dados: { ...u, tipo: u.tipo || "gerente" } })}
              onDelete={() => excluirUsuario(u)}
            />
          ))}
        </div>

        <div className="border-t border-gray-800 pt-5">
          <p className="text-white text-sm font-semibold mb-4">Criar Novo Usuário</p>
          {feedbackUsuario && (
            <div className={`mb-4 text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${feedbackUsuario.tipo === "sucesso" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
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
          <div className="mt-5">
            <button onClick={criarUsuario} disabled={salvandoUsuario} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{background:"#00ff00", color:"#000"}}>
              <UserPlus className="w-4 h-4" />
              {salvandoUsuario ? "Criando..." : "Criar Usuário"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Sessão" icon={LogOut}>
        <button onClick={handleLogout} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl text-sm font-medium">
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

function UserRow({ nome, usuario, tipo, onEdit, onDelete }) {
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
      <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-green-400 transition-all flex-shrink-0">
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-400 transition-all flex-shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-t-transparent rounded-full animate-spin" style={{border:"2px solid #00ff00", borderTopColor:"transparent"}} /></div>;
}

function TokenField({ label, value, onChange }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input type={visible ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} className="input-dark pr-10" placeholder="Cole seu token aqui" />
        <button type="button" onClick={() => setVisible(!visible)} className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300">
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}