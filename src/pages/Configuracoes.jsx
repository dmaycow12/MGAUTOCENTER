import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, CheckCircle } from "lucide-react";

export default function Configuracoes() {
  const [config, setConfig] = useState({
    focusnfe_api_key_homologacao: "",
    focusnfe_api_key_producao: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configIds, setConfigIds] = useState({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const todos = await base44.entities.Configuracao.list("-created_date", 200);
    const ids = {};
    
    todos.forEach(item => {
      if (item.chave === "focusnfe_api_key_homologacao" || item.chave === "focusnfe_api_key_producao") {
        config[item.chave] = item.valor || "";
        ids[item.chave] = item.id;
      }
    });
    
    setConfig({ ...config });
    setConfigIds(ids);
    setLoading(false);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      for (const chave of ["focusnfe_api_key_homologacao", "focusnfe_api_key_producao"]) {
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-t-transparent rounded-full animate-spin" style={{border:"2px solid #00ff00", borderTopColor:"transparent"}} /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {salvo && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle className="w-5 h-5" />
          Configurações salvas com sucesso!
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Chaves API Focus NFe</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-semibold">Token de Homologação</label>
            <div className="relative">
              <input 
                type="password" 
                value={config.focusnfe_api_key_homologacao} 
                onChange={e => setConfig({ ...config, focusnfe_api_key_homologacao: e.target.value })} 
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none pr-10"
                placeholder="Cole sua chave de homologação aqui"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1 font-semibold">Token de Produção</label>
            <div className="relative">
              <input 
                type="password" 
                value={config.focusnfe_api_key_producao} 
                onChange={e => setConfig({ ...config, focusnfe_api_key_producao: e.target.value })} 
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none pr-10"
                placeholder="Cole sua chave de produção aqui"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={salvar} 
          disabled={salvando} 
          className="flex items-center gap-2 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 mt-6" 
          style={{background:"#00ff00", color:"#000"}}
          onMouseEnter={e=>e.currentTarget.style.background="#00dd00"}
          onMouseLeave={e=>e.currentTarget.style.background="#00ff00"}
        >
          <Save className="w-5 h-5" />
          {salvando ? "Salvando..." : "Salvar Chaves"}
        </button>
      </div>
    </div>
  );
}