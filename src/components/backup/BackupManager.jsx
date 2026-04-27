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

      // ── NotaFiscal: uma pasta por nota com JSON + XML real ──
      const notas = backup["NotaFiscal"] || [];
      setProgresso(`Exportando ${notas.length} notas fiscais com XMLs...`);
      const pastaNotas = zip.folder("NotaFiscal");

      // índice de todas as notas (sem campos de URL interna)
      const indice = [];

      for (let i = 0; i < notas.length; i++) {
        const nota = notas[i];
        const nome = `${nota.tipo || "NF"}-${nota.numero || nota.id}`;

        // Clonar nota removendo campos de URL interna do banco (serão substituídos pelos arquivos físicos)
        const notaExport = { ...nota };
        // Manter xml_content inline se já existir (texto XML diretamente no campo)
        // mas apagar xml_url (é link do banco, não tem valor fora dele)
        delete notaExport.xml_url;
        delete notaExport.pdf_url;

        // 1) Tentar obter o XML real
        let xmlContent = null;

        // Prioridade A: xml_original inline
        if (nota.xml_original?.trim().startsWith("<")) {
          xmlContent = nota.xml_original;
        }
        // Prioridade B: xml_content inline (se for XML, não JSON de itens)
        else if (nota.xml_content?.trim().startsWith("<")) {
          xmlContent = nota.xml_content;
        }
        // Prioridade C: baixar de xml_url (arquivo salvo no banco)
        else if (nota.xml_url?.startsWith("http")) {
          try {
            setProgresso(`Baixando XML ${i + 1}/${notas.length}: ${nome}`);
            const r = await fetch(nota.xml_url);
            if (r.ok) {
              const txt = await r.text();
              if (txt.trim().startsWith("<")) xmlContent = txt;
            }
          } catch (_) {}
        }

        // Salvar JSON da nota
        pastaNotas.file(`${nome}.json`, JSON.stringify(notaExport, null, 2));

        // Salvar XML como arquivo separado se tiver
        if (xmlContent) {
          pastaNotas.file(`${nome}.xml`, xmlContent);
          notaExport._xml_arquivo = `${nome}.xml`; // referência no JSON
        }

        indice.push({
          id: nota.id,
          tipo: nota.tipo,
          numero: nota.numero,
          status: nota.status,
          cliente_nome: nota.cliente_nome,
          valor_total: nota.valor_total,
          data_emissao: nota.data_emissao,
          chave_acesso: nota.chave_acesso,
          tem_xml: !!xmlContent,
          arquivo: `${nome}.json`,
        });

        totalRegistros++;
      }

      // Salvar índice das notas
      pastaNotas.file("_indice.json", JSON.stringify(indice, null, 2));

      // Manifesto geral
      zip.file("backup_info.json", JSON.stringify({
        data_backup: new Date().toISOString(),
        versao: "2.0",
        entidades: Object.keys(backup),
        total_registros: totalRegistros,
        total_notas: notas.length,
        notas_com_xml: indice.filter(n => n.tem_xml).length,
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

      const comXml = indice.filter(n => n.tem_xml).length;
      setMsgBaixar({
        tipo: "sucesso",
        texto: `Backup gerado! ${totalRegistros} registros | ${notas.length} notas fiscais | ${comXml} XMLs salvos como arquivo físico.`,
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

      // Ler entidades normais (pasta/Entidade.json)
      const OUTRAS = ["Cadastro", "Estoque", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
      for (const entidade of OUTRAS) {
        const entry = zip.file(`${entidade}/${entidade}.json`);
        if (entry) {
          try {
            backup[entidade] = JSON.parse(await entry.async("string"));
          } catch (_) {}
        }
      }

      // Ler notas fiscais — cada arquivo JSON individual na pasta NotaFiscal
      const notasBackup = [];
      const xmlMap = {}; // nome_arquivo -> conteudo xml

      zip.forEach((caminho, entry) => {
        if (caminho.startsWith("NotaFiscal/") && !entry.dir) {
          const fileName = caminho.replace("NotaFiscal/", "");
          if (fileName.endsWith(".xml")) {
            // Guardar XMLs para associar depois
            xmlMap[fileName] = entry;
          }
        }
      });

      // Ler JSONs das notas
      const notaEntries = [];
      zip.forEach((caminho, entry) => {
        if (caminho.startsWith("NotaFiscal/") && !entry.dir && caminho.endsWith(".json") && !caminho.includes("_indice")) {
          notaEntries.push(entry.async("string").then(s => {
            try { notasBackup.push(JSON.parse(s)); } catch (_) {}
          }));
        }
      });
      await Promise.all(notaEntries);

      // Para cada nota, reintegrar o XML inline se tiver arquivo correspondente
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
        <p className="text-gray-500 text-sm mt-1">
          Exporta <strong className="text-white">cada nota fiscal em arquivo separado</strong> com seu XML físico real — sem depender de links do banco.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BAIXAR */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-semibold">Baixar Backup Completo</h3>
          </div>
          <ul className="text-gray-400 text-xs space-y-1 list-disc list-inside">
            <li>Cada nota fiscal salva em <code className="text-green-300">NF-xxx.json</code> individual</li>
            <li>XML de cada nota salvo em <code className="text-green-300">NF-xxx.xml</code> físico</li>
            <li>Demais entidades em JSON por categoria</li>
          </ul>
          {baixando && progresso && (
            <p className="text-yellow-400 text-xs flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> {progresso}
            </p>
          )}
          <button
            onClick={baixarBackup}
            disabled={baixando}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-all"
            style={{ background: "#00cc44", color: "#000" }}
            onMouseEnter={e => { if (!baixando) e.currentTarget.style.background = "#00aa33"; }}
            onMouseLeave={e => e.currentTarget.style.background = "#00cc44"}
          >
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
          <p className="text-gray-400 text-xs">
            Selecione um <code className="text-blue-400">.zip</code> gerado por este sistema. Os XMLs físicos serão restaurados junto com os dados de cada nota. Registros serão <span className="text-yellow-400 font-medium">adicionados</span> ao banco atual.
          </p>
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
            onMouseEnter={e => { if (!restaurando) e.currentTarget.style.background = "#041a5e"; }}
            onMouseLeave={e => e.currentTarget.style.background = "#062C9B"}
          >
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