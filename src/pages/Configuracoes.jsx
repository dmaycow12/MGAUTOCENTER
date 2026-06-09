import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, Save, CheckCircle, ChevronDown, DollarSign, RefreshCw, Download } from "lucide-react";
import BackupManager from "../components/backup/BackupManager";

export default function Configuracoes() {
  const CHAVES = ["nome_oficina", "cnpj", "telefone", "email", "endereco", "cidade", "estado", "cep",
    "logo_url", "observacoes_padrao", "proximo_numero_os",
    "inscricao_municipal", "inscricao_estadual", "opcao_simples_nacional", "regime_tributario", "regime_especial",
    "focusnfe_api_key_homologacao", "focusnfe_api_key_producao",
    "nfe_serie", "nfe_ultimo_numero", "nfe_versao", "nfe_ambiente",
    "nfce_serie", "nfce_ultimo_numero", "nfce_versao", "nfce_token", "nfce_csc", "nfce_ambiente",
    "nfse_serie_dps", "nfse_ultimo_dps", "nfse_ultimo_numero", "nfse_versao", "nfse_natureza_operacao", "nfse_layout", "nfse_apuracao", "nfse_imunidade", "nfse_tipo_operacao", "nfse_ambiente"];

  const [config, setConfig] = useState({
    nome_oficina: "", cnpj: "", telefone: "", email: "", endereco: "", cidade: "", estado: "", cep: "",
    logo_url: "", observacoes_padrao: "", proximo_numero_os: "1",
    inscricao_municipal: "", inscricao_estadual: "", opcao_simples_nacional: "", regime_tributario: "", regime_especial: "",
    focusnfe_api_key_homologacao: "", focusnfe_api_key_producao: "",
    nfe_serie: "1", nfe_ultimo_numero: "0", nfe_versao: "4.00", nfe_ambiente: "producao",
    nfce_serie: "1", nfce_ultimo_numero: "0", nfce_versao: "4.00", nfce_token: "", nfce_csc: "", nfce_ambiente: "producao",
    nfse_serie_dps: "900", nfse_ultimo_dps: "0", nfse_ultimo_numero: "0", nfse_versao: "1.00", nfse_natureza_operacao: "", nfse_layout: "Nacional", nfse_apuracao: "", nfse_imunidade: "", nfse_tipo_operacao: "", nfse_ambiente: "producao",
  });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configIds, setConfigIds] = useState({});
  const [openSelect, setOpenSelect] = useState({});



  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [todos] = await Promise.all([
      base44.entities.Configuracao.list("-created_date", 200),
    ]);

    const c = {
     nome_oficina: "", cnpj: "", telefone: "", email: "", endereco: "", cidade: "", estado: "", cep: "",
     logo_url: "", observacoes_padrao: "", proximo_numero_os: "1",
     inscricao_municipal: "", inscricao_estadual: "", opcao_simples_nacional: "", regime_tributario: "", regime_especial: "",
     focusnfe_api_key_homologacao: "", focusnfe_api_key_producao: "",
     nfe_serie: "1", nfe_ultimo_numero: "0", nfe_versao: "4.00", nfe_ambiente: "producao",
     nfce_serie: "1", nfce_ultimo_numero: "0", nfce_versao: "4.00", nfce_token: "", nfce_csc: "", nfce_ambiente: "producao",
     nfse_serie_dps: "900", nfse_ultimo_dps: "0", nfse_ultimo_numero: "0", nfse_versao: "1.00", nfse_natureza_operacao: "", nfse_layout: "Nacional", nfse_apuracao: "", nfse_imunidade: "", nfse_tipo_operacao: "", nfse_ambiente: "producao",
    };
    const ids = {};
    todos.forEach(item => {
      if (CHAVES.includes(item.chave)) {
        c[item.chave] = item.valor || "";
        ids[item.chave] = item.id;
      }
    });

    setConfig(c);
    setConfigIds(ids);
    setLoading(false);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const novosIds = { ...configIds };
      await Promise.all(CHAVES.map(async (chave) => {
        const valor = String(config[chave] ?? "");
        if (configIds[chave]) {
          await base44.entities.Configuracao.update(configIds[chave], { chave, valor });
        } else {
          const novo = await base44.entities.Configuracao.create({ chave, valor });
          novosIds[chave] = novo.id;
        }
      }));
      setConfigIds(novosIds);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } finally {
      setSalvando(false);
    }
  };


  if (loading) return null;

  return (
    <form autoComplete="off" onSubmit={e => e.preventDefault()} className="space-y-6 max-w-5xl mx-auto">
    {/* Trick to prevent Chrome autocomplete */}
    <input type="text" name="prevent_autofill" style={{display:"none"}} autoComplete="new-password" readOnly />
      {salvo && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle className="w-5 h-5" />
          Configurações salvas com sucesso!
        </div>
      )}

      <Section title="Dados da Oficina" icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="Nome da Oficina">
            <input autoComplete="new-password" value={config.nome_oficina} onChange={e => setConfig({ ...config, nome_oficina: e.target.value })} className="input-dark" placeholder="Ex: Auto Mecânica Silva" />
          </F>
          <F label="CNPJ">
            <input autoComplete="new-password" value={config.cnpj} onChange={e => setConfig({ ...config, cnpj: e.target.value })} className="input-dark" placeholder="00.000.000/0001-00" />
          </F>
          <F label="Telefone">
            <input autoComplete="new-password" value={config.telefone} onChange={e => setConfig({ ...config, telefone: e.target.value })} className="input-dark" />
          </F>
          <F label="E-mail">
            <input autoComplete="new-password" value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} className="input-dark" />
          </F>
          <F label="Endereço" className="col-span-1 md:col-span-2">
            <input autoComplete="new-password" value={config.endereco} onChange={e => setConfig({ ...config, endereco: e.target.value })} className="input-dark" />
          </F>
          <F label="CEP">
            <input autoComplete="new-password" value={config.cep} onChange={e => setConfig({ ...config, cep: e.target.value })} className="input-dark" />
          </F>
          <F label="Cidade">
            <input autoComplete="new-password" value={config.cidade} onChange={e => setConfig({ ...config, cidade: e.target.value })} className="input-dark" />
          </F>
          <F label="Estado">
            <input autoComplete="new-password" value={config.estado} onChange={e => setConfig({ ...config, estado: e.target.value })} className="input-dark" maxLength={2} />
          </F>
          <F label="Inscrição Municipal">
            <input autoComplete="new-password" value={config.inscricao_municipal} onChange={e => setConfig({ ...config, inscricao_municipal: e.target.value })} className="input-dark" />
          </F>
          <F label="Inscrição Estadual">
            <input autoComplete="new-password" value={config.inscricao_estadual} onChange={e => setConfig({ ...config, inscricao_estadual: e.target.value })} className="input-dark" />
          </F>
          <RadioAccordion
            id="opcao_simples"
            label="Opção Simples Nacional"
            value={config.opcao_simples_nacional}
            open={!!openSelect.opcao_simples}
            onToggle={() => setOpenSelect(s => ({ ...s, opcao_simples: !s.opcao_simples }))}
            options={[
              { v: "1", label: "1 — Não optante" },
              { v: "2", label: "2 — Optante (SIMEI/MEI)" },
              { v: "3", label: "3 — Optante (Simples Nacional)" },
            ]}
            onChange={v => setConfig({ ...config, opcao_simples_nacional: v })}
          />
          <RadioAccordion
            id="regime_tributario"
            label="Regime Tributário"
            value={config.regime_tributario}
            open={!!openSelect.regime_tributario}
            onToggle={() => setOpenSelect(s => ({ ...s, regime_tributario: !s.regime_tributario }))}
            options={[
              { v: "1", label: "1 — Simples Nacional" },
              { v: "2", label: "2 — Simples Nacional — excesso sublimite" },
              { v: "3", label: "3 — Regime Normal (Lucro Presumido/Real)" },
            ]}
            onChange={v => setConfig({ ...config, regime_tributario: v })}
          />
          <RadioAccordion
            id="regime_especial"
            label="Regime Especial de Tributação (NFS-e)"
            value={config.regime_especial}
            open={!!openSelect.regime_especial}
            onToggle={() => setOpenSelect(s => ({ ...s, regime_especial: !s.regime_especial }))}
            options={[
              { v: "0", label: "0 — Nenhum / Não aplicável" },
              { v: "1", label: "1 — Microempresa Municipal" },
              { v: "2", label: "2 — Estimativa" },
              { v: "3", label: "3 — Sociedade de Profissionais" },
              { v: "4", label: "4 — Cooperativa" },
              { v: "5", label: "5 — Microempresário Individual (MEI)" },
              { v: "6", label: "6 — ME/EPP" },
            ]}
            onChange={v => setConfig({ ...config, regime_especial: v })}
          />
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
            <input type="text" inputMode="numeric" autoComplete="off" value={config.nfe_ultimo_numero} onChange={e => setConfig({ ...config, nfe_ultimo_numero: e.target.value })} className="input-dark" />
          </F>
          <F label="Série NF-e">
            <input value={config.nfe_serie} onChange={e => setConfig({ ...config, nfe_serie: e.target.value })} className="input-dark" />
          </F>
          <F label="Ambiente">
            <select value={config.nfe_ambiente} onChange={e => setConfig({ ...config, nfe_ambiente: e.target.value })} className="input-dark">
              <option value="producao">Produção</option>
              <option value="homologacao">Homologação</option>
            </select>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <F label="Última NFC-e">
            <input type="text" inputMode="numeric" autoComplete="off" value={config.nfce_ultimo_numero} onChange={e => setConfig({ ...config, nfce_ultimo_numero: e.target.value })} className="input-dark" />
          </F>
          <F label="Série NFC-e">
            <input value={config.nfce_serie} onChange={e => setConfig({ ...config, nfce_serie: e.target.value })} className="input-dark" />
          </F>
          <F label="Ambiente">
            <select value={config.nfce_ambiente} onChange={e => setConfig({ ...config, nfce_ambiente: e.target.value })} className="input-dark">
              <option value="producao">Produção</option>
              <option value="homologacao">Homologação</option>
            </select>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <F label="Série do DPS">
            <input value={config.nfse_serie_dps} onChange={e => setConfig({ ...config, nfse_serie_dps: e.target.value })} className="input-dark" />
          </F>
          <F label="Última DPS / Número da Nota">
            <input type="text" inputMode="numeric" autoComplete="off" value={config.nfse_ultimo_dps} onChange={e => {
              const v = e.target.value;
              setConfig({ ...config, nfse_ultimo_dps: v, nfse_ultimo_numero: v });
            }} className="input-dark" />
          </F>
          <F label="Ambiente">
            <select value={config.nfse_ambiente} onChange={e => setConfig({ ...config, nfse_ambiente: e.target.value })} className="input-dark">
              <option value="producao">Produção</option>
              <option value="homologacao">Homologação</option>
            </select>
          </F>
          <F label="Versão da NFS-e">
            <select value={config.nfse_versao || "1.00"} onChange={e => setConfig({ ...config, nfse_versao: e.target.value })} className="input-dark">
              <option value="1.00">1.00</option>
              <option value="1.10">1.10</option>
            </select>
          </F>
        </div>
      </Section>

      <button onClick={salvar} disabled={salvando} className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 mx-auto" style={{background:"#00ff00", color:"#000"}} onMouseEnter={e=>e.currentTarget.style.background="#00dd00"} onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}>
        <Save className="w-5 h-5" />
        {salvando ? "Salvando..." : "Salvar Configurações"}
      </button>

      <BackupManager />

      <Section title="Ferramentas de Dados" icon={DollarSign}>
        <CriarFinanceiroVendasBtn />
        <DownloadXmlNfseBtn />
      </Section>

      <style>{`.input-dark { width:100%; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; } .input-dark:focus { border-color:#22c55e; } .input-dark::placeholder { color:#6b7280; }`}</style>
    </form>
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


function RadioAccordion({ id, label, value, open, onToggle, options, onChange }) {
  const selected = options.find(o => o.v === value);
  return (
    <div className="col-span-1 md:col-span-2">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:border-gray-500 transition-all"
      >
        <span className="text-white text-sm">{selected ? selected.label : "— Selecione —"}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 border border-gray-700 rounded-lg overflow-hidden">
          {options.map(({ v, label: optLabel }) => (
            <label
              key={v}
              onClick={() => { onChange(v); onToggle(); }}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-all ${value === v ? "bg-green-500/15 text-green-400" : "bg-gray-800 text-white hover:bg-gray-700"}`}
            >
              <input type="radio" name={id} value={v} checked={value === v} onChange={() => {}} className="accent-green-500" />
              <span className="text-sm">{optLabel}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function CriarFinanceiroVendasBtn() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const pollingRef = React.useRef(null);

  const iniciarPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const rows = await base44.entities.Configuracao.filter({ chave: 'financeiro_progress' }, '-updated_date', 1);
        if (rows.length > 0) {
          const p = JSON.parse(rows[0].valor || '{}');
          setProgresso(p);
          if (p.done) pararPolling();
        }
      } catch (_) {}
    }, 1500);
  };

  const pararPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const executar = async () => {
    if (!confirm('Isso vai criar lançamentos financeiros PENDENTES para todas as vendas que ainda não têm. Continuar?')) return;
    setLoading(true);
    setResultado(null);
    setProgresso(null);
    iniciarPolling();
    try {
      const res = await base44.functions.invoke('criarFinanceiroVendas', {});
      setResultado(res.data);
    } finally {
      pararPolling();
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-400">Cria lançamentos financeiros (Pendente) para todas as vendas que ainda não possuem lançamento nas parcelas.</p>
      <button
        type="button"
        onClick={executar}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 w-fit"
        style={{background:'#062C9B'}}
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Processando...' : 'Criar Lançamentos Financeiros de Todas as Vendas'}
      </button>
      {loading && progresso && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400">{progresso.msg}</p>
          {progresso.total > 0 && (
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((progresso.current / progresso.total) * 100)}%`, background: '#062C9B' }}
              />
            </div>
          )}
          {progresso.total > 0 && (
            <p className="text-xs text-gray-500">{progresso.current} / {progresso.total} vendas ({Math.round((progresso.current / progresso.total) * 100)}%)</p>
          )}
        </div>
      )}
      {resultado && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          ✓ Financeiros criados: <strong>{resultado.financeiros_criados}</strong> — Vendas atualizadas: <strong>{resultado.vendas_atualizadas}</strong> (de {resultado.total_vendas} vendas)
        </div>
      )}
    </div>
  );
}

function TokenField({ label, value, onChange }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input type={visible ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} className="input-dark pr-10" placeholder="" />
        <button type="button" onClick={() => setVisible(!visible)} className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300">
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}

function DownloadXmlNfseBtn() {
  const [loading, setLoading] = useState(false);

  const baixar = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('downloadXmlNfse63a74', {});
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'NFSes_63_74.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-gray-700 pt-4 mt-4">
      <p className="text-sm text-gray-400">Baixa os XMLs originais das NFSes 63-74 em um arquivo ZIP.</p>
      <button
        type="button"
        onClick={baixar}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 w-fit"
        style={{background:'#062C9B'}}
      >
        <Download className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Preparando download...' : 'Baixar XMLs NFSe 63-74 (ZIP)'}
      </button>
    </div>
  );
}