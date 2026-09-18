import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { mostrarConfirm } from "@/lib/modalAviso";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d) => (d ? d.split("-").reverse().join("/") : "—");

export default function ModalVerificadorLancamentos({ onClose, onCorrigido }) {
  const [rel, setRel] = useState(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [processando, setProcessando] = useState("");

  const verificar = useCallback(async () => {
    setErro(""); setMsg("");
    try {
      const res = await base44.functions.invoke("verificarLancamentosFinanceiros", { acao: "verificar" });
      setRel(res.data);
    } catch (e) {
      setErro("Erro ao verificar: " + (e.message || e));
    }
  }, []);

  useEffect(() => { verificar(); }, [verificar]);

  const lancarFaltantes = async () => {
    setProcessando("lancar"); setErro(""); setMsg("");
    try {
      const res = await base44.functions.invoke("verificarLancamentosFinanceiros", { acao: "lancar_faltantes" });
      setRel(res.data);
      setMsg(res.data?.mensagem || "Lançamentos criados.");
      if (onCorrigido) onCorrigido();
    } catch (e) {
      setErro(e.message || String(e));
    }
    setProcessando("");
  };

  const excluirDuplicatas = () => {
    if (!rel?.duplicatas?.length) return;
    mostrarConfirm(
      `Excluir ${rel.duplicatas.length} duplicata(s)? A cópia mais antiga de cada lançamento será mantida.`,
      async () => {
        setProcessando("excluir"); setErro(""); setMsg("");
        try {
          const res = await base44.functions.invoke("verificarLancamentosFinanceiros", { acao: "excluir_duplicatas" });
          setRel(res.data);
          setMsg(res.data?.mensagem || "Duplicatas removidas.");
          if (onCorrigido) onCorrigido();
        } catch (e) {
          setErro(e.message || String(e));
        }
        setProcessando("");
      },
      "Excluir Duplicatas"
    );
  };

  const faltantes = rel?.faltantes || [];
  const duplicatas = rel?.duplicatas || [];
  const ok = rel && faltantes.length === 0 && duplicatas.length === 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" style={{ color: "#4d7fff" }} /> Verificador de Lançamentos
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {erro && <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "#7f1d1d", color: "#fff" }}>{erro}</div>}
          {msg && <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "#14532d", color: "#fff" }}>{msg}</div>}

          {!rel && !erro && (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> Verificando lançamentos...
            </div>
          )}

          {rel && (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{rel.total_lancadas} nota(s) de entrada lançada(s) verificadas</span>
                <span>·</span>
                <span>{rel.total_financeiro} lançamento(s) no financeiro</span>
              </div>

              {ok && (
                <div className="rounded-xl px-4 py-6 flex items-center justify-center gap-2 font-semibold" style={{ background: "#14532d", color: "#fff" }}>
                  <ShieldCheck className="w-5 h-5" /> Tudo certo — nenhum lançamento faltando ou duplicado
                </div>
              )}

              {faltantes.length > 0 && (
                <div className="rounded-xl border p-4 space-y-3" style={{ background: "#1a0d0d", borderColor: "#7f1d1d" }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-red-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {faltantes.length} nota(s) lançada(s) sem financeiro ({fmt(rel.faltantes_valor)})
                    </p>
                    <button onClick={lancarFaltantes} disabled={!!processando}
                      className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50"
                      style={{ background: "#16a34a" }}>
                      {processando === "lancar" ? "Lançando..." : `Lançar agora (${faltantes.length})`}
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {faltantes.map((n) => (
                      <div key={n.id} className="flex items-center gap-2 text-xs bg-black/30 rounded-lg px-3 py-2">
                        <span className="text-white font-semibold whitespace-nowrap">NF {n.numero}</span>
                        <span className="text-gray-400 truncate flex-1">{n.cliente}</span>
                        <span className="text-gray-500 whitespace-nowrap">{fmtData(n.data_emissao)}</span>
                        <span className="text-red-400 font-bold whitespace-nowrap">{fmt(n.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {duplicatas.length > 0 && (
                <div className="rounded-xl border p-4 space-y-3" style={{ background: "#1a1500", borderColor: "#713f12" }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-yellow-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {duplicatas.length} lançamento(s) duplicado(s) ({fmt(rel.duplicatas_valor)})
                    </p>
                    <button onClick={excluirDuplicatas} disabled={!!processando}
                      className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50"
                      style={{ background: "#cc0000" }}>
                      {processando === "excluir" ? "Excluindo..." : `Excluir duplicatas (${duplicatas.length})`}
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {duplicatas.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs bg-black/30 rounded-lg px-3 py-2">
                        <span className={`font-bold w-16 text-center rounded-full ${d.tipo === "Receita" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {d.tipo === "Despesa" ? "Saída" : d.tipo}
                        </span>
                        <span className="text-gray-300 truncate flex-1">{d.descricao}</span>
                        <span className="text-gray-500 whitespace-nowrap">{fmtData(d.data_vencimento)}</span>
                        <span className="text-yellow-400 font-bold whitespace-nowrap">{fmt(d.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-0.5 p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all"
            style={{ background: "#cc0000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#aa0000")} onMouseLeave={(e) => (e.currentTarget.style.background = "#cc0000")}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}