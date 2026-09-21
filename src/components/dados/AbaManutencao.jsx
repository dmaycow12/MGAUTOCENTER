import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle, AlertCircle, ShieldCheck } from "lucide-react";
import ModalVerificadorLancamentos from "@/components/financeiro/ModalVerificadorLancamentos";

const FERRAMENTAS = [
  {
    id: "verificador",
    label: "Verificar Lançamentos Financeiros",
    desc: "Audita notas, vendas e financeiro; cria lançamentos faltantes e remove duplicatas.",
    modal: true,
  },
  {
    id: "sincronizarDescricoesFinanceiro",
    label: "Sincronizar Descrições do Financeiro",
    desc: "Atualiza as descrições dos lançamentos financeiros a partir das vendas e notas.",
  },
  {
    id: "normalizarDescricoes",
    label: "Normalizar Descrições",
    desc: "Padroniza descrições de produtos e serviços.",
  },
  {
    id: "preencherHistoricoServicos",
    label: "Preencher Histórico de Serviços",
    desc: "Reconstrói o histórico de uso dos serviços a partir das vendas.",
  },
  {
    id: "corrigirOVMovimentacoes",
    label: "Corrigir Movimentações de Estoque",
    desc: "Vincula movimentações às ordens de venda corretas.",
  },
  {
    id: "limparMovimentacoesOrfas",
    label: "Limpar Movimentações Órfãs",
    desc: "Remove movimentações de estoque sem vínculo. Ação irreversível.",
    confirmar: "Excluir as movimentações de estoque sem vínculo? Esta ação não pode ser desfeita.",
  },
  {
    id: "renumerarVendas",
    label: "Renumerar Vendas",
    desc: "Reordena a numeração das vendas. Ação irreversível.",
    confirmar: "Renumerar todas as vendas? Esta ação não pode ser desfeita.",
  },
];

const resumir = (d) => {
  if (d == null) return "Concluído.";
  if (typeof d !== "object") return String(d);
  if (d.mensagem || d.message) return d.mensagem || d.message;
  const partes = Object.entries(d)
    .filter(([k]) => !/xml/i.test(k))
    .map(([k, v]) =>
      `${k}: ${typeof v === "number" ? v : Array.isArray(v) ? v.length : typeof v === "object" ? Object.keys(v).length : v}`
    );
  return partes.length ? partes.join(" | ").slice(0, 400) : "Concluído.";
};

export default function AbaManutencao() {
  const [executando, setExecutando] = useState("");
  const [resultado, setResultado] = useState(null);
  const [modalVerificador, setModalVerificador] = useState(false);

  const executar = async (ferramenta) => {
    if (ferramenta.modal) {
      setModalVerificador(true);
      return;
    }
    if (ferramenta.confirmar && !window.confirm(ferramenta.confirmar)) return;
    setExecutando(ferramenta.id);
    setResultado(null);
    try {
      const res = await base44.functions.invoke(ferramenta.id, {});
      setResultado({ tipo: "sucesso", texto: resumir(res.data) });
    } catch (e) {
      setResultado({ tipo: "erro", texto: e?.response?.data?.error || e?.message || String(e) });
    }
    setExecutando("");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FERRAMENTAS.map((ferramenta) => (
          <div key={ferramenta.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ferramenta.confirmar ? "text-orange-400" : "text-green-400"}`} />
              <div className="min-w-0">
                <h4 className="text-white text-sm font-semibold leading-tight">{ferramenta.label}</h4>
                <p className="text-gray-400 text-xs mt-1">{ferramenta.desc}</p>
              </div>
            </div>
            <button
              onClick={() => executar(ferramenta)}
              disabled={!!executando}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold disabled:opacity-50 transition-all"
              style={{ background: "#00ff00", color: "#000" }}
              onMouseEnter={(e) => { if (!executando) e.currentTarget.style.background = "#00dd00"; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#00ff00")}
            >
              {executando === ferramenta.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {executando === ferramenta.id ? "Executando..." : "Executar"}
            </button>
          </div>
        ))}
      </div>

      {resultado && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${resultado.tipo === "sucesso" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          {resultado.tipo === "sucesso" ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <span className="break-all">{resultado.texto}</span>
        </div>
      )}

      {modalVerificador && (
        <ModalVerificadorLancamentos onClose={() => setModalVerificador(false)} />
      )}
    </div>
  );
}