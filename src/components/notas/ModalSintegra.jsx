import React, { useState } from "react";
import { X, FileDown, RefreshCw, AlertCircle } from "lucide-react";
import { gerarArquivoSintegra } from "./gerarSintegra";
import JSZip from "jszip";
import * as XLSX from "xlsx";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function ModalSintegra({ notas, estoque, configs, onClose }) {
  const hoje = new Date();
  const [modo, setModo] = useState("mes");
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const pad = n => String(n).padStart(2, "0");

  const formatarNome = (dataStr) => {
    const [ano, mes] = dataStr.split("-");
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return `${meses[Number(mes) - 1]}-${ano}`;
  };

  const getPeriodo = () => {
    if (modo === "mes") {
      const ultimoDia = new Date(ano, mes, 0).getDate();
      return {
        inicio: `${ano}-${pad(mes)}-01`,
        fim: `${ano}-${pad(mes)}-${pad(ultimoDia)}`,
        label: `${MESES[mes - 1]}/${ano}`,
      };
    }
    return { inicio: dataInicio, fim: dataFim, label: `${dataInicio} a ${dataFim}` };
  };

  const getXml = async (nota) => {
    if (nota.xml_original?.trim().startsWith("<")) return nota.xml_original;
    if (nota.xml_content?.trim().startsWith("<")) return nota.xml_content;
    if (nota.xml_url) {
      try { const r = await fetch(nota.xml_url); const t = await r.text(); if (t?.trim().startsWith("<")) return t; } catch (_) {}
    }
    return null;
  };

  const gerarXlsx = (notasPeriodo) => {
    const isEntrada = (n) => n.status === "Importada" || n.status === "Lançada";

    const abas = [
      { nome: "NFe Entrada",  filtro: n => isEntrada(n) && n.tipo === "NFe"  },
      { nome: "NFSe Entrada", filtro: n => isEntrada(n) && n.tipo === "NFSe" },
      { nome: "NFe Saida",    filtro: n => !isEntrada(n) && n.tipo === "NFe"  },
      { nome: "NFSe Saida",   filtro: n => !isEntrada(n) && n.tipo === "NFSe" },
      { nome: "NFCe Saida",   filtro: n => !isEntrada(n) && n.tipo === "NFCe" },
    ];

    const wb = XLSX.utils.book_new();

    for (const aba of abas) {
      const notasAba = notasPeriodo.filter(aba.filtro);
      const rows = [["Número", "Data", "Valor"]];
      let totalValor = 0;
      for (const n of notasAba) {
        const valor = Number(n.valor_total || 0);
        totalValor += valor;
        rows.push([n.numero || "", n.data_emissao || "", valor]);
      }
      rows.push(["", "TOTAL", totalValor]);

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Largura das colunas
      ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }];

      XLSX.utils.book_append_sheet(wb, ws, aba.nome);
    }

    return XLSX.write(wb, { bookType: "xlsx", type: "array" });
  };

  const gerar = async () => {
    const periodo = getPeriodo();
    if (!periodo.inicio || !periodo.fim) return alert("Informe o período.");
    setGerando(true);
    setResultado(null);

    try {
      const { conteudo, totalNotas } = gerarArquivoSintegra({
        notas,
        estoque,
        configs,
        periodoInicio: periodo.inicio,
        periodoFim: periodo.fim,
      });

      const nomeBase = formatarNome(periodo.inicio);

      const notasPeriodo = notas.filter(n => {
        const d = n.data_emissao || "";
        return d >= periodo.inicio && d <= periodo.fim;
      });

      const isEntrada = (n) => n.status === "Importada" || n.status === "Lançada";

      const zip = new JSZip();

      // Arquivo SINTEGRA
      zip.file(`SINTEGRA-${nomeBase}.txt`, new Blob([conteudo], { type: "text/plain;charset=utf-8" }));

      // XMLs e PDFs organizados em pastas
      const pastas = {
        "Notas de Entrada/NFe":  notasPeriodo.filter(n => isEntrada(n) && n.tipo === "NFe"),
        "Notas de Entrada/NFSe": notasPeriodo.filter(n => isEntrada(n) && n.tipo === "NFSe"),
        "Notas de Saida/NFe":    notasPeriodo.filter(n => !isEntrada(n) && n.tipo === "NFe"),
        "Notas de Saida/NFSe":   notasPeriodo.filter(n => !isEntrada(n) && n.tipo === "NFSe"),
        "Notas de Saida/NFCe":   notasPeriodo.filter(n => !isEntrada(n) && n.tipo === "NFCe"),
      };

      const promises = [];
      for (const [pasta, notasPasta] of Object.entries(pastas)) {
        for (const nota of notasPasta) {
          const base = `${nota.tipo}-${nota.numero || nota.id}`;
          promises.push((async () => {
            const xml = await getXml(nota);
            if (xml) zip.file(`notas/${pasta}/${base}.xml`, xml);
            if (nota.pdf_url) {
              try {
                const r = await fetch(nota.pdf_url);
                if (r.ok) { const b = await r.blob(); zip.file(`notas/${pasta}/${base}.pdf`, b); }
              } catch (_) {}
            }
          })());
        }
      }
      await Promise.all(promises);

      // Relatório XLSX com 5 abas
      const xlsxData = gerarXlsx(notasPeriodo);
      zip.file(`Relatorio-${nomeBase}.xlsx`, xlsxData);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SINTEGRA-${nomeBase}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setResultado({ sucesso: true, totalNotas, periodo: periodo.label });
    } catch (e) {
      setResultado({ sucesso: false, erro: e.message });
    }
    setGerando(false);
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
            {gerando ? "Gerando..." : "Baixar"}
          </button>
        </div>
      </div>
    </div>
  );
}