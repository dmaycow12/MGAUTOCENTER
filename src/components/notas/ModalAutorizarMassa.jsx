import React, { useState, useEffect } from "react";
import { X, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ModalAutorizarMassa({ notas, onClose, onConcluido }) {
  const [resultados, setResultados] = useState(
    notas.map(nota => ({ nota, sucesso: null, mensagem: "Aguardando", processando: false }))
  );
  const [processando, setProcessando] = useState(true);
  const [atualIdx, setAtualIdx] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = notas.map(n => ({ nota: n, sucesso: null, mensagem: "Aguardando", processando: false }));
      setResultados([...res]);
      // Sequencial para garantir numeração correta em produção
      for (let i = 0; i < notas.length; i++) {
        if (cancelled) return;
        const nota = notas[i];
        setAtualIdx(i);
        res[i] = { nota, sucesso: null, mensagem: "Autorizando...", processando: true };
        setResultados([...res]);
        try {
          const items = (() => {
            try { const p = JSON.parse(nota.xml_content); if (Array.isArray(p) && p.length > 0 && p[0].descricao) return p; } catch {}
            return [{ descricao: nota.observacoes || "Produto/Serviço", quantidade: 1, valor_unitario: nota.valor_total, valor_total: nota.valor_total }];
          })();
          const resp = await base44.functions.invoke("emitirNotaFiscal", { ...nota, nota_id: nota.id, items });
          const ok = !!resp.data?.sucesso;
          const msg = ok ? "Autorizada" : (resp.data?.erro || "Erro ao autorizar");
          res[i] = { nota, sucesso: ok, mensagem: msg, processando: false };
        } catch (e) {
          res[i] = { nota, sucesso: false, mensagem: e.message, processando: false };
        }
        if (cancelled) return;
        setResultados([...res]);
      }
      setAtualIdx(-1);
      setProcessando(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const ok = resultados.filter(r => r.sucesso === true).length;
  const erro = resultados.filter(r => r.sucesso === false).length;
  const done = ok + erro;
  const total = notas.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const corTipo = { NFe: '#fb923c', NFCe: '#38bdf8', NFSe: '#a78bfa' };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">Autorização em Produção</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {processando ? `Autorizando ${atualIdx + 1 > -1 ? atualIdx + 1 : total}/${total}` : `${done}/${total} concluídas`}
            </p>
          </div>
          <button onClick={onClose} disabled={processando} className="disabled:opacity-30"><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Barra de progresso + resumo */}
        <div className="px-5 py-3 border-b border-gray-800 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Progresso</span>
            <span className="text-gray-300">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${pct}%`, background: processando ? '#062C9B' : (erro > 0 ? '#f59e0b' : '#00ff00') }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Resultado:</span>
            <span className="text-xs text-gray-500">
              ✓ {ok} sucesso · ✗ {erro} erro{processando ? ' · em andamento' : ''}
            </span>
          </div>
        </div>

        {/* Lista em tempo real */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {resultados.map((r, i) => {
            const isAtual = i === atualIdx && r.processando;
            const bg = r.sucesso === true ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : r.sucesso === false ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : isAtual ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
              : 'bg-gray-800/40 border-gray-700 text-gray-500';
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${bg}`}>
                {r.sucesso === true ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  : r.sucesso === false ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  : isAtual ? <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" />
                  : <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <span className="font-medium">Nº {r.nota.numero || r.nota.id.slice(-6)} — {r.nota.cliente_nome || '—'}</span>
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: corTipo[r.nota.tipo] || '#374151', color: '#000' }}>{r.nota.tipo}</span>
                  <p className="text-xs mt-0.5 opacity-80">{r.mensagem}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">R$ {Number(r.nota.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-800 flex justify-end flex-shrink-0">
          <button
            onClick={() => onConcluido()}
            disabled={processando}
            className="px-6 py-2 text-sm text-black rounded-lg font-medium disabled:opacity-50"
            style={{ background: '#00ff00' }}
          >
            {processando ? 'Aguarde...' : 'Concluir'}
          </button>
        </div>
      </div>
    </div>
  );
}