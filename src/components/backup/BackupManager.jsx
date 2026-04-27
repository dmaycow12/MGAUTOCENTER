import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import JSZip from "jszip";

export default function BackupManager() {
  const [baixando, setBaixando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [msgBaixar, setMsgBaixar] = useState(null);
  const [msgRestaurar, setMsgRestaurar] = useState(null);

  // ===== BAIXAR BACKUP =====
  const baixarBackup = async () => {
    setBaixando(true);
    setMsgBaixar(null);
    try {
      const res = await base44.functions.invoke("criarBackup", {});
      const { backup } = res.data;

      if (!backup) throw new Error("Dados de backup não retornados.");

      const zip = new JSZip();
      let totalRegistros = 0;

      for (const [entidade, dados] of Object.entries(backup)) {
        if (!Array.isArray(dados)) continue;
        const pasta = zip.folder(entidade);
        // Um arquivo JSON por entidade com todos os registros
        pasta.file(`${entidade}.json`, JSON.stringify(dados, null, 2));
        totalRegistros += dados.length;
      }

      // Arquivo de manifesto
      zip.file("backup_info.json", JSON.stringify({
        data_backup: new Date().toISOString(),
        entidades: Object.keys(backup),
        total_registros: totalRegistros,
      }, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dataStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `backup_${dataStr}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setMsgBaixar({ tipo: "sucesso", texto: `Backup gerado com ${totalRegistros} registros em ${Object.keys(backup).length} entidades.` });
    } catch (e) {
      setMsgBaixar({ tipo: "erro", texto: e.message });
    }
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
      if (!confirm("ATENÇÃO: Restaurar o backup vai ADICIONAR os dados salvos ao banco atual. Confirmar?")) return;
      await restaurarBackup(file);
    };
    input.click();
  };

  const restaurarBackup = async (file) => {
    setRestaurando(true);
    setMsgRestaurar(null);
    try {
      const zip = await JSZip.loadAsync(file);
      const backup = {};

      // Ler cada pasta/entidade do ZIP
      const promises = [];
      zip.forEach((caminho, entry) => {
        if (!entry.dir && caminho.endsWith(".json") && caminho !== "backup_info.json") {
          promises.push(
            entry.async("string").then(conteudo => {
              const entidade = caminho.split("/")[0]; // pasta = nome entidade
              try {
                backup[entidade] = JSON.parse(conteudo);
              } catch (_) {}
            })
          );
        }
      });
      await Promise.all(promises);

      if (Object.keys(backup).length === 0) throw new Error("Nenhuma entidade encontrada no arquivo ZIP.");

      const res = await base44.functions.invoke("restaurarBackup", { backup });
      const data = res.data;

      if (!data.sucesso) throw new Error(data.error || "Erro ao restaurar.");

      // Montar resumo
      const resumo = Object.entries(data.resultados || {})
        .map(([ent, r]) => `${ent}: ${r.importados} importados`)
        .join(" | ");

      setMsgRestaurar({ tipo: "sucesso", texto: `${data.msg} — ${resumo}` });
    } catch (e) {
      setMsgRestaurar({ tipo: "erro", texto: e.message });
    }
    setRestaurando(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-white font-bold text-lg">Backup de Dados</h2>
        <p className="text-gray-500 text-sm mt-1">Baixe um ZIP com todos os dados ou restaure a partir de um backup anterior.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BAIXAR */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-semibold">Baixar Backup</h3>
          </div>
          <p className="text-gray-400 text-sm">Gera um arquivo <code className="text-green-400">.zip</code> com uma pasta por entidade contendo todos os registros em JSON.</p>
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
          <p className="text-gray-400 text-sm">Selecione um arquivo <code className="text-blue-400">.zip</code> de backup anterior para importar os dados. Os registros serão <span className="text-yellow-400 font-medium">adicionados</span> ao banco atual.</p>
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