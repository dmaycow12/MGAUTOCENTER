import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

function fmtValor(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return parts[2] + "/" + parts[1] + "/" + String(parts[0]).slice(2);
}

export default function OrcamentoPublico() {
  const [os, setOs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setErro("Link inválido."); setLoading(false); return; }

    base44.entities.OrdemServico.filter({ id })
      .then(res => {
        if (res && res.length > 0) setOs(res[0]);
        else setErro("Orçamento não encontrado.");
        setLoading(false);
      })
      .catch(() => { setErro("Erro ao carregar orçamento."); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <p className="text-gray-400">{erro}</p>
    </div>
  );

  const totalPecas = Number(os.valor_pecas || 0);
  const totalServicos = Number(os.valor_servicos || 0);
  const desconto = Number(os.desconto || 0);
  const total = Number(os.valor_total || 0);

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "#0a0a0a" }}>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="text-center">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6997c92e6dd9fc3c5e8a6579/3fff287a0_LOGO.png"
            alt="MG Autocenter"
            className="w-28 h-28 object-contain mx-auto mb-2"
          />
          <p className="text-gray-500 text-sm">Rua Rui Barbosa, 1355 — Patos de Minas/MG</p>
          <p className="text-gray-500 text-sm">(34) 99879-1260</p>
        </div>

        {/* Título OS */}
        <div className="rounded-xl p-4 text-center" style={{ background: "#cc0000" }}>
          <p className="text-white font-bold text-lg tracking-widest">ORÇAMENTO #{os.numero || "—"}</p>
          <p className="text-red-200 text-sm mt-0.5">{fmtData(os.data_entrada)}</p>
        </div>

        {/* Cliente + Veículo */}
        <div className="rounded-xl overflow-hidden border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800" style={{ background: "#111" }}>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Cliente</p>
            <p className="text-white font-semibold">{os.cliente_nome || "—"}</p>
            {os.cliente_telefone && <p className="text-gray-400 text-sm">{os.cliente_telefone}</p>}
          </div>
          <div className="px-4 py-3 grid grid-cols-2 gap-4" style={{ background: "#111" }}>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Veículo</p>
              <p className="text-white font-semibold">{os.veiculo_modelo || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Placa</p>
              <p className="text-white font-semibold">{os.veiculo_placa?.toUpperCase() || "—"}</p>
            </div>
            {os.quilometragem && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Quilometragem</p>
                <p className="text-white font-semibold">{Number(os.quilometragem).toLocaleString("pt-BR")} km</p>
              </div>
            )}
          </div>
        </div>

        {/* Peças */}
        {os.pecas && os.pecas.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-gray-800">
            <div className="px-4 py-2.5" style={{ background: "#1a1a1a" }}>
              <p className="text-gray-300 font-semibold text-sm">🔩 Peças / Produtos</p>
            </div>
            <div style={{ background: "#111" }}>
              {os.pecas.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{p.descricao || "—"}</p>
                    <p className="text-gray-500 text-xs">Qtd: {p.quantidade || 1} × {fmtValor(p.valor_unitario)}</p>
                  </div>
                  <p className="text-white font-semibold text-sm flex-shrink-0 ml-4">{fmtValor(p.valor_total)}</p>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5" style={{ background: "#1a1a1a" }}>
                <p className="text-gray-400 text-sm">Subtotal Peças</p>
                <p className="text-white font-semibold text-sm">{fmtValor(totalPecas)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Serviços */}
        {os.servicos && os.servicos.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-gray-800">
            <div className="px-4 py-2.5" style={{ background: "#1a1a1a" }}>
              <p className="text-gray-300 font-semibold text-sm">🔧 Serviços</p>
            </div>
            <div style={{ background: "#111" }}>
              {os.servicos.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
                  <p className="text-white text-sm font-medium truncate">{s.descricao || "—"}</p>
                  <p className="text-white font-semibold text-sm flex-shrink-0 ml-4">{fmtValor(Number(s.valor || 0) * Number(s.quantidade || 1))}</p>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5" style={{ background: "#1a1a1a" }}>
                <p className="text-gray-400 text-sm">Subtotal Serviços</p>
                <p className="text-white font-semibold text-sm">{fmtValor(totalServicos)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="rounded-xl border border-gray-700 overflow-hidden">
          {desconto > 0 && (
            <div className="flex justify-between px-4 py-3 border-b border-gray-800" style={{ background: "#111" }}>
              <p className="text-gray-400 text-sm">Desconto</p>
              <p className="text-red-400 font-semibold text-sm">- {fmtValor(desconto)}</p>
            </div>
          )}
          <div className="flex justify-between px-4 py-4" style={{ background: "#1a1a1a" }}>
            <p className="text-white font-bold text-lg">💰 Total</p>
            <p className="font-bold text-xl" style={{ color: "#cc0000" }}>{fmtValor(total)}</p>
          </div>
          {os.forma_pagamento && (
            <div className="flex justify-between px-4 py-2.5 border-t border-gray-800" style={{ background: "#111" }}>
              <p className="text-gray-400 text-sm">Pagamento</p>
              <p className="text-gray-200 text-sm font-medium">{os.forma_pagamento}{os.parcelas > 1 ? ` em ${os.parcelas}x` : ""}</p>
            </div>
          )}
        </div>

        {/* Observações */}
        {os.observacoes && (
          <div className="rounded-xl border border-gray-800 px-4 py-3" style={{ background: "#111" }}>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">📋 Observações</p>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{os.observacoes}</p>
          </div>
        )}

        {/* Fotos */}
        {os.fotos && os.fotos.length > 0 && (
          <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#111" }}>
            <div className="px-4 py-2.5 border-b border-gray-800" style={{ background: "#1a1a1a" }}>
              <p className="text-gray-300 font-semibold text-sm">📸 Fotos do Veículo</p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {os.fotos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-40 object-cover rounded-lg border border-gray-700 hover:opacity-90 transition-all"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-gray-600 text-xs pb-4">MG Autocenter — CNPJ: 54.043.647/0001-20</p>
      </div>
    </div>
  );
}