import React, { useState, useEffect } from "react";
import { X, FileText, Copy, ExternalLink, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// Extrai dados de boleto já salvo nas observações
function extrairBoletoExistente(item) {
  const obs = item?.observacoes || "";
  if (!obs.includes("Boleto Asaas ID:")) return null;
  const idMatch = obs.match(/Boleto Asaas ID: (\S+)/);
  const linkMatch = obs.match(/Link: (https?:\/\/\S+)/);
  const linhaMatch = obs.match(/Linha: (\S+)/);
  return {
    asaas_id: idMatch?.[1] || null,
    boleto_url: linkMatch?.[1] || null,
    linha_digitavel: linhaMatch?.[1] || null,
    vencimento: item?.data_vencimento || "",
    valor: item?.valor || 0,
  };
}

export default function ModalGerarBoleto({ item, onClose, onSuccess }) {
  const boletoExistente = extrairBoletoExistente(item);

  const [tela, setTela] = useState(boletoExistente ? "existente" : "form"); // "existente" | "form" | "gerado"
  const [form, setForm] = useState({
    nome: "",
    cpf_cnpj: "",
    email: "",
    valor: item?.valor || "",
    vencimento: item?.data_vencimento || new Date().toISOString().split("T")[0],
    descricao: item?.descricao || "",
  });
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Pré-preenche com dados do cadastro se disponível
  useEffect(() => {
    if (item?.cliente_id) {
      base44.entities.Cadastro.filter({ id: item.cliente_id }, "-created_date", 1)
        .then(res => {
          if (res[0]) {
            setForm(f => ({
              ...f,
              nome: res[0].nome || "",
              cpf_cnpj: res[0].cpf_cnpj || "",
              email: res[0].email || "",
            }));
          }
        }).catch(() => {});
    }
  }, [item?.cliente_id]);

  const gerar = async () => {
    if (!form.nome || !form.cpf_cnpj || !form.valor || !form.vencimento) {
      toast.error("Preencha Nome, CPF/CNPJ, Valor e Vencimento.");
      return;
    }
    setLoading(true);
    try {
      // Não passa financeiro_id — o modal cuida de atualizar todos os lançamentos
      const res = await base44.functions.invoke("gerarBoleto", {
        financeiro_id: null,
        nome: form.nome,
        cpf_cnpj: form.cpf_cnpj,
        email: form.email,
        valor: Number(form.valor),
        vencimento: form.vencimento,
        descricao: form.descricao,
      });
      if (res.data?.sucesso) {
        // Salva referência do boleto em TODOS os lançamentos (único ou múltiplos)
        const obsTexto = [
          `Boleto Asaas ID: ${res.data.asaas_id}`,
          res.data.boleto_url ? `Link: ${res.data.boleto_url}` : null,
          res.data.linha_digitavel ? `Linha: ${res.data.linha_digitavel}` : null,
        ].filter(Boolean).join('\n');

        const todos = item?._multiplos || (item?.id ? [item] : []);
        for (const lancamento of todos) {
          try {
            await base44.entities.Financeiro.update(lancamento.id, {
              forma_pagamento: 'Boleto',
              observacoes: obsTexto,
            });
          } catch (_) {}
        }

        setResultado(res.data);
        setTela("gerado");
        toast.success("Boleto gerado com sucesso!");
        onSuccess?.();
      } else {
        toast.error(res.data?.erro || "Erro ao gerar boleto");
      }
    } catch (err) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

  const dadosExibir = tela === "gerado" ? resultado : boletoExistente;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-white font-semibold">Gerar Boleto — Asaas</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Tela: boleto existente */}
        {(tela === "existente" || tela === "gerado") && dadosExibir && (
          <div className="p-5 space-y-4">
            <div className={`border rounded-xl p-4 text-center ${tela === "existente" ? "bg-yellow-500/10 border-yellow-500/30" : "bg-green-500/10 border-green-500/30"}`}>
              <p className={`font-semibold text-sm ${tela === "existente" ? "text-yellow-400" : "text-green-400"}`}>
                {tela === "existente" ? "Boleto já gerado anteriormente" : "Boleto gerado com sucesso!"}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Vencimento: {dadosExibir.vencimento?.split("-").reverse().join("/")} · R$ {Number(dadosExibir.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>

            {dadosExibir.linha_digitavel && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Linha Digitável</label>
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                  <span className="flex-1 text-white text-xs font-mono break-all">{dadosExibir.linha_digitavel}</span>
                  <button onClick={() => copiar(dadosExibir.linha_digitavel)} className="text-gray-400 hover:text-white flex-shrink-0">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {dadosExibir.boleto_url && (
              <a href={dadosExibir.boleto_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold text-white rounded-xl transition-all"
                style={{ background: "#062C9B" }}>
                <ExternalLink className="w-4 h-4" />
                Abrir / Imprimir Boleto
              </a>
            )}

            {tela === "existente" && (
              <button onClick={() => setTela("form")} className="w-full py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-gray-700 transition-all">
                Gerar Novo Boleto
              </button>
            )}
            <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-gray-700 transition-all">
              Fechar
            </button>
          </div>
        )}

        {/* Tela: formulário */}
        {tela === "form" && (
          <>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome / Razão Social *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">CPF / CNPJ *</label>
                  <input value={form.cpf_cnpj} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">E-mail</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vencimento *</label>
                  <input type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-800">
              <button onClick={boletoExistente ? () => setTela("existente") : onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-gray-700 hover:border-gray-500 transition-all">Cancelar</button>
              <button onClick={gerar} disabled={loading}
                className="px-5 py-2 text-sm text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                style={{ background: "#062C9B" }}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : "Gerar Boleto"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}