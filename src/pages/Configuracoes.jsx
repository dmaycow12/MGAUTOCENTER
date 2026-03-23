import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, Save, CheckCircle, Plus, X, UserPlus, LogOut, AlertCircle, User, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

export default function Configuracoes() {
  const CHAVES = ["nome_oficina", "cnpj", "telefone", "email", "endereco", "numero", "bairro", "cidade", "estado", "cep",
    "focusnfe_ambiente", "codigo_municipio", "codigo_servico", "aliquota_iss", "logo_url", "observacoes_padrao", "proximo_numero_os",
    "nfce_token", "nfce_csc", "nfce_serie", "nfce_versao", "nfce_ultimo_numero",
    "nfe_serie", "nfe_ultimo_numero",
    "focusnfe_api_key_homologacao", "focusnfe_api_key_producao"];

  const [aba, setAba] = useState("identificacao");
  const [config, setConfig] = useState({
    nome_oficina: "", cnpj: "", telefone: "", email: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
    focusnfe_ambiente: "producao", codigo_municipio: "", codigo_servico: "07498", aliquota_iss: "2.0",
    logo_url: "", observacoes_padrao: "", proximo_numero_os: "1",
    nfce_token: "", nfce_csc: "", nfce_serie: "1", nfce_versao: "4.00", nfce_ultimo_numero: "0",
    nfe_serie: "1", nfe_ultimo_numero: "0",
    focusnfe_api_key_homologacao: "", focusnfe_api_key_producao: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configIds, setConfigIds] = useState({});
  const [mostraTokensHomolog, setMostraTokensHomolog] = useState(false);
  const [mostraTokensProd, setMostraTokensProd] = useState(false);

  // Usuários
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
      nome_oficina: "", cnpj: "", telefone: "", email: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
      focusnfe_ambiente: "producao", codigo_municipio: "", codigo_servico: "07498", aliquota_iss: "2.0",
      logo_url: "", observacoes_padrao: "", proximo_numero_os: "1",
      nfce_token: "", nfce_csc: "", nfce_serie: "1", nfce_versao: "4.00", nfce_ultimo_numero: "0",
      nfe_serie: "1", nfe_ultimo_numero: "0",
      focusnfe_api_key_homologacao: "", focusnfe_api_key_producao: "",
    };
    const ids = {};
    const extras = [];

    todos.forEach(item => {
      if (CHAVES.includes(item.chave)) {
        c[item.chave] = item.valor || "";
        ids[item.chave] = item.id;
      } else if (item.chave === "usuario_extra") {
        try {
          const parsed = JSON.parse(item.valor);
          extras.push({ ...parsed, _id: item.id });
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
      action: "update",
      _id: editandoUsuario._id,
      nome: dados.nome,
      usuario: dados.usuario,
      senha: dados.senha || "",
      tipo: dados.tipo,
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
      action: "create",
      nome: novoUsuario.nome,
      usuario: novoUsuario.usuario,
      senha: novoUsuario.senha,
      tipo: novoUsuario.tipo,
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
      await base44.functions.invoke("authSaveUser", {
        action: "delete",
        _id: usuario._id,
      });
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

  const abas = [
    { id: "identificacao", label: "IDENTIFICAÇÃO" },
    { id: "contato", label: "CONTATO" },
    { id: "endereco", label: "ENDEREÇO" },
    { id: "responsavel", label: "RESPONSÁVEL" },
    { id: "contabilidade", label: "CONTABILIDADE" },
    { id: "tokens", label: "TOKENS" },
    { id: "documentos", label: "DOCUMENTOS FISCAIS" },
    { id: "configuracoes", label: "CONFIGURAÇÕES" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {salvo && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle className="w-5 h-5" />
          Configurações salvas com sucesso!
        </div>
      )}

      {/* Abas */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="border-b border-gray-800 flex gap-1 overflow-x-auto p-2">
          {abas.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${aba === a.id ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-300"}`}>
              {a.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {/* ABA IDENTIFICAÇÃO */}
          {aba === "identificacao" && (
            <div className="space-y-4">
              <F label="Nome da Oficina *">
                <input value={config.nome_oficina} onChange={e => setConfig({ ...config, nome_oficina: e.target.value })} className="input-dark" />
              </F>
              <F label="CNPJ *">
                <input value={config.cnpj} onChange={e => setConfig({ ...config, cnpj: e.target.value })} className="input-dark" />
              </F>
              <F label="Logo (URL)">
                <input value={config.logo_url} onChange={e => setConfig({ ...config, logo_url: e.target.value })} className="input-dark" />
              </F>
            </div>
          )}

          {/* ABA CONTATO */}
          {aba === "contato" && (
            <div className="space-y-4">
              <F label="Telefone">
                <input value={config.telefone} onChange={e => setConfig({ ...config, telefone: e.target.value })} className="input-dark" />
              </F>
              <F label="E-mail">
                <input value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} className="input-dark" />
              </F>
            </div>
          )}

          {/* ABA ENDEREÇO */}
          {aba === "endereco" && (
            <div className="space-y-4">
              <F label="Endereço">
                <input value={config.endereco} onChange={e => setConfig({ ...config, endereco: e.target.value })} className="input-dark" />
              </F>
              <F label="Número">
                <input value={config.numero} onChange={e => setConfig({ ...config, numero: e.target.value })} className="input-dark" />
              </F>
              <F label="Bairro">
                <input value={config.bairro} onChange={e => setConfig({ ...config, bairro: e.target.value })} className="input-dark" />
              </F>
              <F label="CEP">
                <input value={config.cep} onChange={e => setConfig({ ...config, cep: e.target.value })} className="input-dark" />
              </F>
              <F label="Cidade">
                <input value={config.cidade} onChange={e => setConfig({ ...config, cidade: e.target.value })} className="input-dark" />
              </F>
              <F label="Estado (UF)">
                <input value={config.estado} onChange={e => setConfig({ ...config, estado: e.target.value.toUpperCase() })} className="input-dark" maxLength={2} />
              </F>
            </div>
          )}

          {/* ABA RESPONSÁVEL */}
          {aba === "responsavel" && (
            <div className="space-y-4 text-gray-400 text-sm">
              <p>Gerenciamento de usuários está na aba <strong>CONFIGURAÇÕES</strong>.</p>
            </div>
          )}

          {/* ABA CONTABILIDADE */}
          {aba === "contabilidade" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Configurações fiscais para notas fiscais.</p>
              <F label="Código do Município (IBGE)">
                <input value={config.codigo_municipio} onChange={e => setConfig({ ...config, codigo_municipio: e.target.value })} className="input-dark" placeholder="Ex: 3147907" />
              </F>
              <F label="Código do Serviço (LC116) — NFSe">
                <input value={config.codigo_servico} onChange={e => setConfig({ ...config, codigo_servico: e.target.value })} className="input-dark" placeholder="07498" />
              </F>
              <F label="Alíquota ISS (%)">
                <input value={config.aliquota_iss} onChange={e => setConfig({ ...config, aliquota_iss: e.target.value })} className="input-dark" placeholder="2.0" />
              </F>
              <F label="Próximo Número OS">
                <input type="number" value={config.proximo_numero_os} onChange={e => setConfig({ ...config, proximo_numero_os: e.target.value })} className="input-dark" />
              </F>
              <F label="Observações Padrão OS">
                <textarea value={config.observacoes_padrao} onChange={e => setConfig({ ...config, observacoes_padrao: e.target.value })} className="input-dark" rows={3} />
              </F>
            </div>
          )}

          {/* ABA TOKENS */}
          {aba === "tokens" && (
            <div className="space-y-6">
              <p className="text-xs text-gray-400">Chaves API da Focus NFe — uma para cada ambiente.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <F label="Token de Homologação">
                  <div className="relative">
                    <input
                      type={mostraTokensHomolog ? "text" : "password"}
                      value={config.focusnfe_api_key_homologacao}
                      onChange={e => setConfig({ ...config, focusnfe_api_key_homologacao: e.target.value })}
                      className="input-dark pr-10"
                    />
                    <button onClick={() => setMostraTokensHomolog(!mostraTokensHomolog)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {mostraTokensHomolog ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </F>
                <F label="Token de Produção">
                  <div className="relative">
                    <input
                      type={mostraTokensProd ? "text" : "password"}
                      value={config.focusnfe_api_key_producao}
                      onChange={e => setConfig({ ...config, focusnfe_api_key_producao: e.target.value })}
                      className="input-dark pr-10"
                    />
                    <button onClick={() => setMostraTokensProd(!mostraTokensProd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {mostraTokensProd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </F>
              </div>
            </div>
          )}

          {/* ABA DOCUMENTOS FISCAIS */}
          {aba === "documentos" && (
            <div className="space-y-6">
              {/* NF-e */}
              <div className="border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>🏦</span> NF-e
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <F label="Última NF-e">
                    <input type="number" value={config.nfe_ultimo_numero} onChange={e => setConfig({ ...config, nfe_ultimo_numero: e.target.value })} className="input-dark" />
                  </F>
                  <F label="Série NF-e">
                    <input value={config.nfe_serie} onChange={e => setConfig({ ...config, nfe_serie: e.target.value })} className="input-dark" />
                  </F>
                  <F label="Ambiente">
                    <select value={config.focusnfe_ambiente} onChange={e => setConfig({ ...config, focusnfe_ambiente: e.target.value })} className="input-dark">
                      <option value="producao">Produção</option>
                      <option value="homologacao">Homologação</option>
                    </select>
                  </F>
                  <F label="Versão NF-e">
                    <input value={config.nfce_versao} onChange={e => setConfig({ ...config, nfce_versao: e.target.value })} className="input-dark" />
                  </F>
                </div>
              </div>

              {/* NF-e (homologação) */}
              <div className="border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>🏦</span> NF-e — Homologação (Teste)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <F label="Última NF-e">
                    <input type="number" value={config.nfe_ultimo_numero} onChange={e => setConfig({ ...config, nfe_ultimo_numero: e.target.value })} className="input-dark" />
                  </F>
                  <F label="Série NF-e">
                    <input value={config.nfe_serie} onChange={e => setConfig({ ...config, nfe_serie: e.target.value })} className="input-dark" />
                  </F>
                </div>
              </div>

              {/* NFCe */}
              <div className="border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>🛒</span> NFC-e
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <F label="Última NFC-e">
                    <input type="number" value={config.nfce_ultimo_numero} onChange={e => setConfig({ ...config, nfce_ultimo_numero: e.target.value })} className="input-dark" />
                  </F>
                  <F label="Série NFC-e">
                    <input value={config.nfce_serie} onChange={e => setConfig({ ...config, nfce_serie: e.target.value })} className="input-dark" />
                  </F>
                  <F label="Token">
                    <input value={config.nfce_token} onChange={e => setConfig({ ...config, nfce_token: e.target.value })} className="input-dark" />
                  </F>
                  <F label="CSC">
                    <input value={config.nfce_csc} onChange={e => setConfig({ ...config, nfce_csc: e.target.value })} className="input-dark" />
                  </F>
                  <F label="Ambiente" className="md:col-span-2">
                    <select value={config.focusnfe_ambiente} onChange={e => setConfig({ ...config, focusnfe_ambiente: e.target.value })} className="input-dark">
                      <option value="producao">Produção</option>
                      <option value="homologacao">Homologação</option>
                    </select>
                  </F>
                  <F label="Versão NFC-e">
                    <input value={config.nfce_versao} onChange={e => setConfig({ ...config, nfce_versao: e.target.value })} className="input-dark" />
                  </F>
                </div>
              </div>
            </div>
          )}

          {/* ABA CONFIGURAÇÕES (Usuários) */}
          {aba === "configuracoes" && (
            <div className="space-y-6">
              {avisoUltimoGerente && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                  <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto" />
                    <h3 className="text-white font-semibold text-lg">Ação não permitida</h3>
                    <p className="text-gray-400 text-sm">Não é possível excluir o último gerente. Deve existir ao menos um.</p>
                    <button onClick={() => setAvisoUltimoGerente(false)} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{background:"#00ff00", color:"#000"}}>
                      Entendido
                    </button>
                  </div>
                </div>
              )}

              {editandoUsuario && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
                    <h3 className="text-white font-semibold">Editar Usuário</h3>
                    <F label="Nome *">
                      <input value={editandoUsuario.dados.nome} onChange={e => setEditandoUsuario(ed => ({ ...ed, dados: { ...ed.dados, nome: e.target.value } }))} className="input-dark" />
                    </F>
                    <F label="Usuário *">
                      <input value={editandoUsuario.dados.usuario} onChange={e => setEditandoUsuario(ed => ({ ...ed, dados: { ...ed.dados, usuario: e.target.value } }))} className="input-dark" />
                    </F>
                    <F label="Senha">
                      <input type="password" value={editandoUsuario.dados.senha} onChange={e => setEditandoUsuario(ed => ({ ...ed, dados: { ...ed.dados, senha: e.target.value } }))} className="input-dark" autoComplete="new-password" />
                    </F>
                    <F label="Tipo">
                      <div className="flex gap-2">
                        {["gerente", "contador", "vendedor"].map(t => (
                          <button key={t} type="button"
                            onClick={() => setEditandoUsuario(ed => ({ ...ed, dados: { ...ed.dados, tipo: t } }))}
                            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold border-2 transition-all ${editandoUsuario.dados.tipo === t ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 bg-gray-800 text-gray-400"}`}>
                            {t === "gerente" ? "Gerente" : t === "contador" ? "Contador" : "Vendedor"}
                          </button>
                        ))}
                      </div>
                    </F>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setEditandoUsuario(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-400 border border-gray-700">Cancelar</button>
                      <button onClick={salvarEdicaoUsuario} disabled={salvandoUsuario} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{background:"#00ff00", color:"#000"}}>
                        {salvandoUsuario ? "..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {usuarios.map((u, i) => (
                  <div key={i} className="flex items-center bg-gray-800 rounded-lg px-4 py-3 gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500/10">
                      <User className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">{u.nome}</p>
                      <p className="text-gray-500 text-xs">Usuário: {u.usuario}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400">
                      {u.tipo === "contador" ? "Contador" : u.tipo === "vendedor" ? "Vendedor" : "Gerente"}
                    </span>
                    <button onClick={() => setEditandoUsuario({ _id: u._id, dados: { ...u, tipo: u.tipo || "gerente" } })} className="p-1 text-gray-400 hover:text-green-400">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => excluirUsuario(u)} className="p-1 text-gray-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-800 pt-4 space-y-3">
                <p className="text-white text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Criar Novo Usuário</p>
                {feedbackUsuario && (
                  <div className={`text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${feedbackUsuario.tipo === "sucesso" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {feedbackUsuario.msg}
                  </div>
                )}
                <F label="Nome *">
                  <input value={novoUsuario.nome} onChange={e => setNovoUsuario(u => ({ ...u, nome: e.target.value }))} className="input-dark" />
                </F>
                <F label="Usuário *">
                  <input value={novoUsuario.usuario} onChange={e => setNovoUsuario(u => ({ ...u, usuario: e.target.value }))} className="input-dark" />
                </F>
                <F label="Senha *">
                  <input type="password" value={novoUsuario.senha} onChange={e => setNovoUsuario(u => ({ ...u, senha: e.target.value }))} className="input-dark" autoComplete="new-password" />
                </F>
                <F label="Confirmar Senha *">
                  <input type="password" value={novoUsuario.confirmarSenha} onChange={e => setNovoUsuario(u => ({ ...u, confirmarSenha: e.target.value }))} className="input-dark" autoComplete="new-password" />
                </F>
                <F label="Tipo *">
                  <div className="grid grid-cols-3 gap-2">
                    {["gerente", "contador", "vendedor"].map(t => (
                      <button key={t} type="button"
                        onClick={() => setNovoUsuario(u => ({ ...u, tipo: t }))}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold border-2 transition-all ${novoUsuario.tipo === t ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 bg-gray-800 text-gray-400"}`}>
                        {t === "gerente" ? "Gerente" : t === "contador" ? "Contador" : "Vendedor"}
                      </button>
                    ))}
                  </div>
                </F>
                <button onClick={criarUsuario} disabled={salvandoUsuario} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold" style={{background:"#00ff00", color:"#000"}}>
                  <UserPlus className="w-4 h-4" />
                  {salvandoUsuario ? "..." : "Criar Usuário"}
                </button>
              </div>

              <div className="border-t border-gray-800 pt-4 space-y-3">
                <p className="text-white text-sm font-semibold flex items-center gap-2"><LogOut className="w-4 h-4" /> Sessão</p>
                <button onClick={handleLogout} className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-500/20">
                  <LogOut className="w-4 h-4" /> Sair do Sistema
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-3 justify-end">
        <button onClick={() => window.history.back()} className="px-6 py-2 rounded-lg text-sm font-semibold border border-gray-700 text-gray-400 hover:text-white">
          Voltar
        </button>
        <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e=>e.currentTarget.style.background="#00dd00"} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
          <Save className="w-4 h-4" />
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#22c55e; } .input-dark::placeholder { color:#6b7280; }`}</style>
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
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-t-transparent rounded-full animate-spin" style={{border:"2px solid #00ff00", borderTopColor:"transparent"}} /></div>;
}