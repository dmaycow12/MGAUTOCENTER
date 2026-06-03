import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import JSZip from "jszip";

export default function BackupManager() {
  const [baixando, setBaixando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [msgBaixar, setMsgBaixar] = useState(null);
  const [msgRestaurar, setMsgRestaurar] = useState(null);

  // ===== BAIXAR BACKUP =====
  const baixarBackup = async () => {
    setBaixando(true);
    setMsgBaixar(null);
    setProgresso("Buscando dados...");
    try {
      const res = await base44.functions.invoke("criarBackup", {});
      const { backup } = res.data;
      if (!backup) throw new Error("Dados de backup não retornados.");

      const zip = new JSZip();
      let totalRegistros = 0;

      // ── Entidades normais (um JSON por entidade) ──
      const OUTRAS = ["Cadastro", "Estoque", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
      for (const entidade of OUTRAS) {
        const dados = backup[entidade];
        if (!Array.isArray(dados)) continue;
        zip.folder(entidade).file(`${entidade}.json`, JSON.stringify(dados, null, 2));
        totalRegistros += dados.length;
      }

      // ── NotaFiscal: processa em lotes paralelos ──
      const notas = backup["NotaFiscal"] || [];
      const pastaNotas = zip.folder("NotaFiscal");
      const indice = [];
      const LOTE = 20;

      const processarNota = async (nota) => {
        const nome = `${nota.tipo || "NF"}-${nota.numero || nota.id}`;
        const notaExport = { ...nota };
        delete notaExport.xml_url;
        delete notaExport.pdf_url;

        // 1) XML: inline primeiro, depois fetch
        let xmlContent = null;
        if (nota.xml_original?.trim().startsWith("<")) {
          xmlContent = nota.xml_original;
        } else if (nota.xml_content?.trim().startsWith("<")) {
          xmlContent = nota.xml_content;
        } else if (nota.xml_url?.startsWith("http")) {
          try {
            const r = await fetch(nota.xml_url);
            if (r.ok) {
              const txt = await r.text();
              if (txt.trim().startsWith("<")) xmlContent = txt;
            }
          } catch (_) {}
        }

        // 2) PDF: fetch paralelo junto com XML
        let pdfBlob = null;
        if (nota.pdf_url?.startsWith("http")) {
          try {
            const r = await fetch(nota.pdf_url);
            if (r.ok) {
              const ct = r.headers.get("content-type") || "";
              if (ct.includes("pdf") || ct.includes("octet")) {
                pdfBlob = await r.arrayBuffer();
              }
            }
          } catch (_) {}
        }

        pastaNotas.file(`${nome}.json`, JSON.stringify(notaExport, null, 2));
        if (xmlContent) {
          pastaNotas.file(`${nome}.xml`, xmlContent);
          notaExport._xml_arquivo = `${nome}.xml`;
        }
        if (pdfBlob) {
          pastaNotas.file(`${nome}.pdf`, pdfBlob);
          notaExport._pdf_arquivo = `${nome}.pdf`;
        }

        return {
          id: nota.id, tipo: nota.tipo, numero: nota.numero, status: nota.status,
          cliente_nome: nota.cliente_nome, valor_total: nota.valor_total,
          data_emissao: nota.data_emissao, chave_acesso: nota.chave_acesso,
          tem_xml: !!xmlContent, tem_pdf: !!pdfBlob, arquivo: `${nome}.json`
        };
      };

      // Processar em lotes paralelos de 20 notas simultâneas
      for (let i = 0; i < notas.length; i += LOTE) {
        const lote = notas.slice(i, i + LOTE);
        setProgresso(`Processando notas ${i + 1}–${Math.min(i + LOTE, notas.length)} de ${notas.length}...`);
        const resultados = await Promise.all(lote.map(processarNota));
        indice.push(...resultados);
        totalRegistros += lote.length;
      }

      pastaNotas.file("_indice.json", JSON.stringify(indice, null, 2));

      zip.file("backup_info.json", JSON.stringify({
        data_backup: new Date().toISOString(),
        versao: "2.1",
        entidades: Object.keys(backup),
        total_registros: totalRegistros,
        total_notas: notas.length,
        notas_com_xml: indice.filter((n) => n.tem_xml).length,
        notas_com_pdf: indice.filter((n) => n.tem_pdf).length
      }, null, 2));

      setProgresso("Compactando ZIP...");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dataStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `backup_completo_${dataStr}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const comXml = indice.filter((n) => n.tem_xml).length;
      const comPdf = indice.filter((n) => n.tem_pdf).length;
      setMsgBaixar({
        tipo: "sucesso",
        texto: `Backup gerado! ${totalRegistros} registros | ${notas.length} notas | ${comXml} XMLs | ${comPdf} PDFs salvos.`
      });
    } catch (e) {
      setMsgBaixar({ tipo: "erro", texto: e.message });
    }
    setProgresso("");
    setBaixando(false);
  };

  // ===== RESTAURAR BACKUP =====
  const selecionarArquivo = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm("ATENÇÃO: Restaurar o backup vai ADICIONAR os dados ao banco atual. Confirmar?")) return;
      await restaurarBackup(file);
    };
    input.click();
  };

  const restaurarBackup = async (file) => {
    setRestaurando(true);
    setMsgRestaurar(null);
    setProgresso("Lendo arquivo ZIP...");
    try {
      const zip = await JSZip.loadAsync(file);
      const backup = {};

      const OUTRAS = ["Cadastro", "Estoque", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
      for (const entidade of OUTRAS) {
        const entry = zip.file(`${entidade}/${entidade}.json`);
        if (entry) {
          try {
            backup[entidade] = JSON.parse(await entry.async("string"));
          } catch (_) {}
        }
      }

      const notasBackup = [];
      const xmlMap = {};

      zip.forEach((caminho, entry) => {
        if (caminho.startsWith("NotaFiscal/") && !entry.dir) {
          const fileName = caminho.replace("NotaFiscal/", "");
          if (fileName.endsWith(".xml")) {
            xmlMap[fileName] = entry;
          }
        }
      });

      const notaEntries = [];
      zip.forEach((caminho, entry) => {
        if (caminho.startsWith("NotaFiscal/") && !entry.dir && caminho.endsWith(".json") && !caminho.includes("_indice")) {
          notaEntries.push(entry.async("string").then((s) => {
            try { notasBackup.push(JSON.parse(s)); } catch (_) {}
          }));
        }
      });
      await Promise.all(notaEntries);

      for (const nota of notasBackup) {
        const xmlArquivo = nota._xml_arquivo;
        if (xmlArquivo && xmlMap[xmlArquivo]) {
          const xmlTexto = await xmlMap[xmlArquivo].async("string");
          if (xmlTexto.trim().startsWith("<")) {
            nota.xml_original = xmlTexto;
          }
        }
        delete nota._xml_arquivo;
      }

      if (notasBackup.length > 0) backup["NotaFiscal"] = notasBackup;

      if (Object.keys(backup).length === 0) throw new Error("Nenhuma entidade encontrada no ZIP.");

      setProgresso(`Importando ${Object.values(backup).flat().length} registros...`);
      const res = await base44.functions.invoke("restaurarBackup", { backup });
      const data = res.data;
      if (!data.sucesso) throw new Error(data.error || "Erro ao restaurar.");

      const resumo = Object.entries(data.resultados || {})
        .map(([ent, r]) => `${ent}: ${r.importados}`)
        .join(" | ");
      setMsgRestaurar({ tipo: "sucesso", texto: `${data.msg} — ${resumo}` });
    } catch (e) {
      setMsgRestaurar({ tipo: "erro", texto: e.message });
    }
    setProgresso("");
    setRestaurando(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-white font-bold text-lg">Backup de Dados</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BAIXAR */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-semibold">Baixar Backup Completo</h3>
          </div>
          {baixando && progresso && (
            <p className="text-yellow-400 text-xs flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> {progresso}
            </p>
          )}
          <button
            onClick={baixarBackup}
            disabled={baixando}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-all"
            style={{ background: "#00ff00", color: "#000" }}
            onMouseEnter={(e) => { if (!baixando) e.currentTarget.style.background = "#00dd00"; }}
            onMouseLeave={(e) => e.currentTarget.style.background = "#00ff00"}>
            {baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {baixando ? "Gerando backup..." : "Baixar Backup ZIP"}
          </button>
          {msgBaixar && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${msgBaixar.tipo === "sucesso" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {msgBaixar.tipo === "sucesso" ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{msgBaixar.texto}</span>
            </div>
          )}
        </div>

        {/* RESTAURAR */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-semibold">Restaurar Backup</h3>
          </div>
          {restaurando && progresso && (
            <p className="text-yellow-400 text-xs flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> {progresso}
            </p>
          )}
          <button
            onClick={selecionarArquivo}
            disabled={restaurando}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-all"
            style={{ background: "#062C9B", color: "#fff" }}
            onMouseEnter={(e) => { if (!restaurando) e.currentTarget.style.background = "#041a5e"; }}
            onMouseLeave={(e) => e.currentTarget.style.background = "#062C9B"}>
            {restaurando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {restaurando ? "Restaurando..." : "Selecionar Arquivo ZIP"}
          </button>
          {msgRestaurar && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${msgRestaurar.tipo === "sucesso" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {msgRestaurar.tipo === "sucesso" ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{msgRestaurar.texto}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}