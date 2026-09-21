import React, { useState, useEffect } from "react";
import { ClipboardList, Users, Package, Box, FileText, DollarSign, Database } from "lucide-react";
import { base44 } from "@/api/base44Client";
import TabelaDados from "./TabelaDados";

const LIMITE_INICIAL = 100;

const ABAS = [
  {
    key: "vendas", label: "Vendas", icon: ClipboardList,
    load: (limite) => base44.entities.Vendas.list("-created_date", limite),
    colunas: [
      { k: "numero", l: "Nº" },
      { k: "cliente_nome", l: "Cliente" },
      { k: "status", l: "Status" },
      { k: "valor_total", l: "Total", f: "money" },
      { k: "data_entrada", l: "Data", f: "date" },
    ],
  },
  {
    key: "cadastros", label: "Cadastros", icon: Users,
    load: (limite) => base44.entities.Cadastro.list("-created_date", limite),
    colunas: [
      { k: "nome", l: "Nome / Razão Social" },
      { k: "categoria", l: "Categoria" },
      { k: "cpf_cnpj", l: "CPF/CNPJ" },
      { k: "telefone", l: "Telefone" },
      { k: "cidade", l: "Cidade" },
    ],
  },
  {
    key: "produtos", label: "Produtos", icon: Package,
    load: (limite) => base44.entities.Estoque.list("-created_date", limite),
    colunas: [
      { k: "codigo", l: "Código" },
      { k: "descricao", l: "Descrição" },
      { k: "categoria", l: "Categoria" },
      { k: "quantidade", l: "Qtd" },
      { k: "valor_venda", l: "Valor Venda", f: "money" },
    ],
  },
  {
    key: "ativos", label: "Ativos", icon: Box,
    load: (limite) => base44.entities.Ativo.list("-created_date", limite),
    colunas: [
      { k: "nome", l: "Nome" },
      { k: "categoria", l: "Categoria" },
      { k: "status", l: "Status" },
      { k: "quantidade", l: "Qtd" },
      { k: "localizacao", l: "Localização" },
    ],
  },
  {
    key: "notas", label: "Notas Fiscais", icon: FileText,
    // Carregamento leve (sem XML) — evita pesar a página com milhares de notas
    load: async () => {
      const res = await base44.functions.invoke("listarNotasLeve", {});
      const notas = res?.data?.notas || res?.notas || [];
      return { registros: notas, completo: true };
    },
    colunas: [
      { k: "numero", l: "Número" },
      { k: "tipo", l: "Tipo" },
      { k: "cliente_nome", l: "Cliente" },
      { k: "status", l: "Status" },
      { k: "valor_total", l: "Valor", f: "money" },
      { k: "data_emissao", l: "Data", f: "date" },
    ],
  },
  {
    key: "financeiro", label: "Financeiro", icon: DollarSign,
    load: (limite) => base44.entities.Financeiro.list("-created_date", limite),
    colunas: [
      { k: "descricao", l: "Descrição" },
      { k: "tipo", l: "Tipo" },
      { k: "categoria", l: "Categoria" },
      { k: "valor", l: "Valor", f: "money" },
      { k: "data_vencimento", l: "Vencimento", f: "date" },
      { k: "status", l: "Status" },
    ],
  },
];

export default function AreaDados() {
  const [aba, setAba] = useState("vendas");
  const [dados, setDados] = useState({});

  const carregar = async (key, limite = LIMITE_INICIAL) => {
    const config = ABAS.find((a) => a.key === key);
    if (!config) return;
    setDados((d) => ({ ...d, [key]: { ...d[key], carregando: true, erro: null } }));
    try {
      const res = await config.load(limite);
      // Loader que retorna objeto próprio (ex.: listarNotasLeve) ou lista direta
      const registros = Array.isArray(res) ? res : res.registros || [];
      const completo = Array.isArray(res) ? res.length < limite : res.completo !== false;
      setDados((d) => ({ ...d, [key]: { registros, completo, limite, carregando: false, erro: null } }));
    } catch (e) {
      setDados((d) => ({
        ...d,
        [key]: { ...d[key], carregando: false, erro: e?.message || "Erro ao carregar dados." },
      }));
    }
  };

  useEffect(() => {
    if (!dados[aba]) carregar(aba);
  }, [aba]);

  const atual = ABAS.find((a) => a.key === aba);
  const estado = dados[aba] || { registros: [], carregando: false, completo: false, erro: null };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-4">
        <Database className="w-5 h-5 text-green-400" />
        <h2 className="text-white font-semibold text-center w-full">Dados</h2>
      </div>

      {/* Abas — apenas ícones */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {ABAS.map(({ key, label, icon: Icon }) => {
          const isActive = key === aba;
          return (
            <button
              key={key}
              title={label}
              onClick={() => setAba(key)}
              className="flex items-center justify-center w-11 h-11 rounded-lg transition-all"
              style={{
                background: isActive ? "#062C9B" : "#1f2937",
                border: isActive ? "1px solid #4d7fff" : "1px solid #374151",
              }}
            >
              <Icon className="w-5 h-5" style={{ color: isActive ? "#fff" : "#9ca3af" }} />
            </button>
          );
        })}
      </div>

      <TabelaDados
        colunas={atual.colunas}
        registros={estado.registros}
        carregando={estado.carregando}
        erro={estado.erro}
        completo={estado.completo}
        onCarregarMais={() => carregar(aba, (estado.limite || LIMITE_INICIAL) + 100)}
      />
    </div>
  );
}