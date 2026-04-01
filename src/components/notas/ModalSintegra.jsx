import React, { useState } from "react";
import { X, FileDown, RefreshCw, AlertCircle } from "lucide-react";
import { gerarArquivoSintegra } from "./gerarSintegra";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function ModalSintegra({ notas, estoque, configs, onClose }) {
  const hoje = new Date();
  const [modo, setModo] = useState("mes"); // "mes" ou "periodo"
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const pad = n => String(n).padStart(2, "0");

  const getPeriodo = () => {
    if (modo === "mes") {
      return {
        inicio: `${ano}-${pad(mes)}-01`,
        fim: `${ano}-${pad(mes)}-31`,
        label: `${MESES[mes - 1]}/${ano}`,
      };
    }
    return { inicio: dataInicio, fim: dataFim, label: `${dataInicio} a ${dataFim}` };
  };

  const gerar = () => {
    const periodo = getPeriodo();
    if (!periodo.inicio || !periodo.fim) return alert("Informe o período.");
    setGerando(true);
    setResultado(null);

    setTimeout(() => {
      try {
        const { conteudo, totalNotas } = gerarArquivoSintegra({
          notas,
          estoque,
          configs,
          periodoInicio: periodo.inicio,
          periodoFim: periodo.fim,
        });

        const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anoLabel = periodo.inicio.substring(0, 4);
        const mesLabel = periodo.inicio.substring(5, 7);
        const a = document.createElement("a");
        a.href = url;
        a.download = modo === "mes"
          ? `SINTEGRA_${anoLabel}${mesLabel}.txt`
          : `SINTEGRA_${periodo.inicio}_${periodo.fim}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        setResultado({ sucesso: true, totalNotas, periodo: periodo.label });
      } catch (e) {
        setResultado({ sucesso: false, erro: e.message });
      }
      setGerando(false);
    }, 100);
  };

  const anos = [];
  for (let y = hoje.getFullYear(); y >= hoje.getFullYear() - 5; y--) anos.push(y);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold">Gerar SINTEGRA</h2>
            <p className="text-gray-500 text-xs mt-0.5">Arquivo fiscal estruturado para SEFAZ/MG</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Modo */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setModo("mes")}
              className="flex-1 py-2 text-sm font-medium transition-all"
              style={{ background: modo === "mes" ? "#062C9B" : "#1f2937", color: "#fff" }}
            >
              Por Mês
            </button>
            <button
              onClick={() => setModo("periodo")}
              className="flex-1 py-2 text-sm font-medium transition-all"
              style={{ background: modo === "periodo" ? "#062C9B" : "#1f2937", color: "#fff" }}
            >
              Período Livre
            </button>
          </div>

          {modo === "mes" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Mês</label>
                <select
                  value={mes}
                  onChange={e => setMes(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ano</label>
                <select
                  value={ano}
                  onChange={e => setAno(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  {anos.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300 space-y-1">
            <p className="font-semibold">Registros incluídos:</p>
            <p>• Reg. 10 — Identificação da empresa</p>
            <p>• Reg. 11 — Endereço do estabelecimento</p>
            <p>• Reg. 50 — Notas fiscais (NFe/NFCe)</p>
            <p>• Reg. 54 — Itens das notas (quando disponíveis)</p>
            <p>• Reg. 75 — Cadastro de produtos</p>
            <p>• Reg. 90 — Encerramento/totalizadores</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-300">
            <div className="flex gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Configure os dados da empresa em <strong>Configurações</strong> (CNPJ, IE, endereço) para geração correta.</span>
            </div>
          </div>

          {resultado && (
            <div className={`rounded-lg p-3 text-sm ${resultado.sucesso ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
              {resultado.sucesso
                ? `✓ Arquivo gerado com ${resultado.totalNotas} nota(s) do período ${resultado.periodo}.`
                : `Erro: ${resultado.erro}`}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">
            Fechar
          </button>
          <button
            onClick={gerar}
            disabled={gerando || (modo === "periodo" && (!dataInicio || !dataFim))}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-all"
            style={{ background: "#00ff00", color: "#000" }}
            onMouseEnter={e => { if (!gerando) e.currentTarget.style.background = "#00dd00"; }}
            onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
          >
            {gerando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {gerando ? "Gerando..." : "Baixar SINTEGRA"}
          </button>
        </div>
      </div>
    </div>
  );
}