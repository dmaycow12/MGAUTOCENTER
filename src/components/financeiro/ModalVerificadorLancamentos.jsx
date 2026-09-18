import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, ShieldCheck, AlertTriangle, Loader2, FileText, Wallet, ClipboardCheck } from "lucide-react";
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
  const vendasSemFin = rel?.vendas_sem_financeiro || [];
  const ok = rel && faltantes.length === 0 && duplicatas.length === 0 && vendasSemFin.length === 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between p-5 border-b border-gray-800" style={{ background: "linear-gradient(180deg, rgba(6,44,155,0.15), transparent)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#062C9B" }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold leading-tight">Verificador de Lançamentos</h2>
              <p className="text-[11px] text-gray-500">AUDITORIA DE NOTAS DE ENTRADA, VENDAS E FINANCEIRO</p>
            </div>
          </div>
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
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                  <FileText className="w-4 h-4 mb-1.5" style={{ color: "#4d7fff" }} />
                  <p className="text-xl font-bold text-white leading-none">{rel.total_lancadas}</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Notas de entrada lançadas</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                  <Wallet className="w-4 h-4 mb-1.5" style={{ color: "#4d7fff" }} />
                  <p className="text-xl font-bold text-white leading-none">{rel.total_financeiro}</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Lançamentos no financeiro</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                  <ClipboardCheck className="w-4 h-4 mb-1.5" style={{ color: "#4d7fff" }} />
                  <p className="text-xl font-bold text-white leading-none">{rel.total_vendas_concluidas}</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Vendas concluídas</p>
                </div>
              </div>

              {ok && (
                <div className="rounded-2xl p-6 flex flex-col items-center text-center gap-2" style={{ background: "linear-gradient(135deg, #0d2b16, #14532d)", border: "1px solid rgba(22,163,74,0.5)" }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#16a34a" }}>
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-white font-bold text-base">Tudo certo!</p>
                  <p className="text-xs text-green-300/80">Notas de entrada, vendas e duplicatas verificados — nada faltando</p>
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

              {vendasSemFin.length > 0 && (
                <div className="rounded-xl border p-4 space-y-3" style={{ background: "#0a1224", borderColor: "#062C9B" }}>
                  <p className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {vendasSemFin.length} venda(s) concluída(s) sem financeiro ({fmt(rel.vendas_sem_fin_valor)})
                  </p>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {vendasSemFin.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 text-xs bg-black/30 rounded-lg px-3 py-2">
                        <span className="text-white font-semibold whitespace-nowrap">Venda {v.numero}</span>
                        <span className="text-gray-400 truncate flex-1">{v.cliente}</span>
                        <span className="text-gray-500 whitespace-nowrap">{fmtData(v.data_conclusao)}</span>
                        <span className="text-blue-400 font-bold whitespace-nowrap">{fmt(v.valor)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Abra a venda e gere as parcelas para criar o financeiro.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-5 py-2 text-sm text-white rounded-lg font-medium transition-all hover:bg-gray-700" style={{ background: "#1f2937" }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}