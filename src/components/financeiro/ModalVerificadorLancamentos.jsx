import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, ShieldCheck, AlertTriangle, Loader2, FileText, Wallet, ClipboardCheck, Check, RefreshCw } from "lucide-react";
import { mostrarConfirm } from "@/lib/modalAviso";

const fmtValor = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d) => (d ? d.split("-").reverse().join("/") : "—");

const AZUL = "#062C9B";
const AZUL_CLARO = "#4d7fff";
const VERDE = "#16a34a";
const VERMELHO = "#cc0000";
const AMARELO = "#eab308";

function LinhaCheck({ icone: Icon, titulo, detalhe, status }) {
  const cor = status === "ok" ? VERDE : status === "erro" ? VERMELHO : AMARELO;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#111" }}>
        <Icon className="w-4 h-4" style={{ color: AZUL_CLARO }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">{titulo}</p>
        <p className="text-xs text-gray-500 truncate">{detalhe}</p>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: `${cor}1a`, border: `1px solid ${cor}55` }}>
        {status === "ok" ? <Check className="w-3 h-3" style={{ color: VERDE }} /> : <AlertTriangle className="w-3 h-3" style={{ color: cor }} />}
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cor }}>
          {status === "ok" ? "OK" : "Verificar"}
        </span>
      </div>
    </div>
  );
}

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
  const totalProblemas = faltantes.length + duplicatas.length + vendasSemFin.length;
  const ok = rel && totalProblemas === 0;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden">

        {/* Faixa superior */}
        <div className="h-1 flex-shrink-0" style={{ background: `linear-gradient(90deg, ${AZUL}, ${AZUL_CLARO})` }} />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: AZUL }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold leading-tight">Verificador de Lançamentos</h2>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Auditoria do Financeiro</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rel && (
              <button onClick={verificar} title="Verificar novamente" className="text-gray-500 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose}><X className="w-5 h-5 text-gray-500 hover:text-white transition-colors" /></button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {erro && (
            <div className="rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2" style={{ background: "#1a0d0d", border: `1px solid ${VERMELHO}55`, color: "#f87171" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {erro}
            </div>
          )}
          {msg && (
            <div className="rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2" style={{ background: "#0d2216", border: `1px solid ${VERDE}55`, color: "#4ade80" }}>
              <Check className="w-4 h-4 flex-shrink-0" /> {msg}
            </div>
          )}

          {!rel && !erro && (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-500 text-sm">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: AZUL_CLARO }} />
              Verificando lançamentos...
            </div>
          )}

          {rel && (
            <>
              {/* Status geral */}
              {ok ? (
                <div className="rounded-xl p-5 flex flex-col items-center text-center gap-2" style={{ background: "linear-gradient(180deg, #0d2216, #0a1a11)", border: `1px solid ${VERDE}44` }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: VERDE }}>
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-white font-bold">Tudo certo</p>
                  <p className="text-xs text-gray-400">Nenhuma pendência encontrada nas notas, vendas e lançamentos</p>
                </div>
              ) : (
                <div className="rounded-xl p-5 flex flex-col items-center text-center gap-2" style={{ background: "linear-gradient(180deg, #1a0d0d, #140a0a)", border: `1px solid ${VERMELHO}44` }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: VERMELHO }}>
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-white font-bold">{totalProblemas} pendência(s) encontrada(s)</p>
                  <p className="text-xs text-gray-400">Revise as pendências abaixo e use os botões de correção</p>
                </div>
              )}

              {/* Checklist */}
              <div className="rounded-xl border border-gray-800 divide-y divide-gray-800/70 overflow-hidden">
                <LinhaCheck
                  icone={FileText}
                  titulo="Notas de entrada"
                  detalhe={faltantes.length === 0
                    ? `${rel.total_lancadas} lançada(s) — todas com financeiro`
                    : `${faltantes.length} de ${rel.total_lancadas} sem financeiro (${fmtValor(rel.faltantes_valor)})`}
                  status={faltantes.length === 0 ? "ok" : "erro"}
                />
                <LinhaCheck
                  icone={ClipboardCheck}
                  titulo="Vendas concluídas"
                  detalhe={vendasSemFin.length === 0
                    ? `${rel.total_vendas_concluidas} venda(s) — todas com financeiro`
                    : `${vendasSemFin.length} de ${rel.total_vendas_concluidas} sem financeiro (${fmtValor(rel.vendas_sem_fin_valor)})`}
                  status={vendasSemFin.length === 0 ? "ok" : "erro"}
                />
                <LinhaCheck
                  icone={Wallet}
                  titulo="Lançamentos duplicados"
                  detalhe={duplicatas.length === 0
                    ? `Nenhuma duplicata entre ${rel.total_financeiro} lançamento(s)`
                    : `${duplicatas.length} duplicata(s) (${fmtValor(rel.duplicatas_valor)})`}
                  status={duplicatas.length === 0 ? "ok" : "erro"}
                />
              </div>

              {/* Pendências: notas sem financeiro */}
              {faltantes.length > 0 && (
                <div className="rounded-xl border p-4 space-y-3" style={{ background: "#140a0a", borderColor: `${VERMELHO}55` }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#f87171" }}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Notas lançadas sem financeiro
                    </p>
                    <button onClick={lancarFaltantes} disabled={!!processando}
                      className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50 hover:opacity-90"
                      style={{ background: VERDE }}>
                      {processando === "lancar" ? "Lançando..." : `Lançar agora (${faltantes.length})`}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {faltantes.map((n) => (
                      <div key={n.id} className="flex items-center gap-2 text-xs bg-black/40 rounded-lg px-3 py-2">
                        <span className="text-white font-semibold whitespace-nowrap">NF {n.numero}</span>
                        <span className="text-gray-400 truncate flex-1">{n.cliente}</span>
                        <span className="text-gray-600 whitespace-nowrap">{fmtData(n.data_emissao)}</span>
                        <span className="font-bold whitespace-nowrap" style={{ color: "#f87171" }}>{fmtValor(n.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pendências: duplicatas */}
              {duplicatas.length > 0 && (
                <div className="rounded-xl border p-4 space-y-3" style={{ background: "#141005", borderColor: `${AMARELO}44` }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#facc15" }}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Lançamentos duplicados
                    </p>
                    <button onClick={excluirDuplicatas} disabled={!!processando}
                      className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-50 hover:opacity-90"
                      style={{ background: VERMELHO }}>
                      {processando === "excluir" ? "Excluindo..." : `Excluir duplicatas (${duplicatas.length})`}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {duplicatas.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs bg-black/40 rounded-lg px-3 py-2">
                        <span className="font-bold w-14 text-center rounded-full flex-shrink-0" style={{ background: d.tipo === "Receita" ? "rgba(22,163,74,0.15)" : "rgba(204,0,0,0.15)", color: d.tipo === "Receita" ? "#4ade80" : "#f87171" }}>
                          {d.tipo === "Despesa" ? "Saída" : d.tipo}
                        </span>
                        <span className="text-gray-300 truncate flex-1">{d.descricao}</span>
                        <span className="text-gray-600 whitespace-nowrap">{fmtData(d.data_vencimento)}</span>
                        <span className="font-bold whitespace-nowrap" style={{ color: "#facc15" }}>{fmtValor(d.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pendências: vendas sem financeiro */}
              {vendasSemFin.length > 0 && (
                <div className="rounded-xl border p-4 space-y-3" style={{ background: "#0a1224", borderColor: `${AZUL}66` }}>
                  <p className="text-sm font-semibold flex items-center gap-2" style={{ color: AZUL_CLARO }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Vendas concluídas sem financeiro
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {vendasSemFin.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 text-xs bg-black/40 rounded-lg px-3 py-2">
                        <span className="text-white font-semibold whitespace-nowrap">Venda {v.numero}</span>
                        <span className="text-gray-400 truncate flex-1">{v.cliente}</span>
                        <span className="text-gray-600 whitespace-nowrap">{fmtData(v.data_conclusao)}</span>
                        <span className="font-bold whitespace-nowrap" style={{ color: AZUL_CLARO }}>{fmtValor(v.valor)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Abra a venda e gere as parcelas para criar o financeiro.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-800/80">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide truncate">
            {rel ? `${rel.total_lancadas} notas · ${rel.total_vendas_concluidas} vendas · ${rel.total_financeiro} lançamentos analisados` : ""}
          </p>
          <button onClick={onClose} className="px-5 py-2 text-sm text-white rounded-lg font-medium transition-all flex-shrink-0 hover:opacity-90" style={{ background: "#1f2937" }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}