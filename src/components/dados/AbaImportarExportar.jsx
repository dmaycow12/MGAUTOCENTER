import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Download, Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const ENTIDADES = ["Vendas", "Cadastro", "Estoque", "Servico", "Ativo", "Financeiro", "NotaFiscal"];
const CAMPOS_SISTEMA = ["id", "created_date", "updated_date", "created_by_id"];

export default function AbaImportarExportar() {
  const [entidade, setEntidade] = useState("Estoque");

  // Exportar
  const [exportando, setExportando] = useState(false);
  const [msgExport, setMsgExport] = useState(null);

  // Importar
  const [registros, setRegistros] = useState(null);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [msgImport, setMsgImport] = useState(null);

  const exportar = async () => {
    setExportando(true);
    setMsgExport(null);
    try {
      let dados;
      if (entidade === "NotaFiscal") {
        const res = await base44.functions.invoke("listarNotasLeve", {});
        dados = res.data?.notas || [];
      } else {
        dados = await base44.entities[entidade].list("-created_date", 9999);
      }
      const ws = XLSX.utils.json_to_sheet(dados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, entidade);
      XLSX.writeFile(wb, `${entidade}_${new Date().toISOString().split("T")[0]}.xlsx`);
      setMsgExport({ tipo: "sucesso", texto: `${dados.length} registros exportados para ${entidade}.xlsx` });
    } catch (e) {
      setMsgExport({ tipo: "erro", texto: e?.response?.data?.error || e?.message || String(e) });
    }
    setExportando(false);
  };

  const selecionarArquivo = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const wb = XLSX.read(await file.arrayBuffer());
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        const limpos = rows.map((r) => {
          const c = { ...r };
          CAMPOS_SISTEMA.forEach((k) => delete c[k]);
          return c;
        });
        setRegistros(limpos);
        setMsgImport(null);
      } catch (e2) {
        setMsgImport({ tipo: "erro", texto: e2?.message || String(e2) });
        setRegistros(null);
      }
    };
    input.click();
  };

  const importar = async () => {
    if (!registros?.length) return;
    if (!window.confirm(`Importar ${registros.length} registro(s) para ${entidade}? Esta ação não pode ser desfeita.`)) return;
    setImportando(true);
    setMsgImport(null);
    let importados = 0;
    try {
      const LOTE = 100;
      for (let i = 0; i < registros.length; i += LOTE) {
        const lote = registros.slice(i, i + LOTE);
        await base44.entities[entidade].bulkCreate(lote);
        importados += lote.length;
        setProgresso({ atual: importados, total: registros.length });
      }
      setMsgImport({ tipo: "sucesso", texto: `${importados} registros importados para ${entidade}.` });
      setRegistros(null);
    } catch (e) {
      setMsgImport({ tipo: "erro", texto: `${e?.response?.data?.error || e?.message || String(e)} — ${importados} importados antes do erro.` });
    }
    setImportando(false);
    setProgresso(null);
  };

  return (
    <div className="space-y-4">
      {/* Seletor de módulo */}
      <div>
        <p className="text-xs text-gray-400 mb-2 text-center">Módulo selecionado: <span className="text-white font-semibold">{entidade}</span></p>
        <div className="flex flex-wrap gap-2 justify-center">
          {ENTIDADES.map((e) => (
            <button
              key={e}
              onClick={() => setEntidade(e)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: entidade === e ? "#062C9B" : "#1f2937",
                color: "#fff",
              }}
            >
              {e === "Cadastro" ? "Clientes / Fornecedores" : e}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* EXPORTAR */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Download className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-semibold">Exportar Dados</h3>
          </div>
          <p className="text-gray-400 text-xs text-center">Baixa os registros do módulo em uma planilha Excel.</p>
          <button
            onClick={exportar}
            disabled={exportando}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-all"
            style={{ background: "#00ff00", color: "#000" }}
            onMouseEnter={(e) => { if (!exportando) e.currentTarget.style.background = "#00dd00"; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#00ff00")}
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportando ? "Gerando..." : "Baixar Excel"}
          </button>
          {msgExport && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${msgExport.tipo === "sucesso" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {msgExport.tipo === "sucesso" ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{msgExport.texto}</span>
            </div>
          )}
        </div>

        {/* IMPORTAR */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Upload className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-semibold">Importar Dados</h3>
          </div>
          <p className="text-gray-400 text-xs text-center">
            Lê uma planilha (XLSX/CSV) e adiciona os registros ao módulo selecionado.
          </p>
          <button
            onClick={selecionarArquivo}
            disabled={importando}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-all"
            style={{ background: "#062C9B", color: "#fff" }}
            onMouseEnter={(e) => { if (!importando) e.currentTarget.style.background = "#041a5e"; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#062C9B")}
          >
            <Upload className="w-4 h-4" />
            Selecionar Planilha
          </button>

          {registros && (
            <div className="border border-gray-600 rounded-lg p-3 space-y-2">
              <p className="text-white text-xs text-center font-semibold">{registros.length} registro(s) encontrados na planilha</p>
              <button
                onClick={importar}
                disabled={importando}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold disabled:opacity-50 transition-all bg-red-600 hover:bg-red-700 text-white"
              >
                {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {importando ? "Importando..." : `Importar para ${entidade}`}
              </button>
            </div>
          )}

          {progresso && (
            <div className="space-y-1 border border-gray-600 rounded-lg p-3">
              <div className="flex justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Importando...</span>
                <span>{progresso.atual}/{progresso.total}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progresso.atual / progresso.total) * 100)}%`, background: "#4d7fff" }}
                />
              </div>
            </div>
          )}

          {msgImport && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${msgImport.tipo === "sucesso" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {msgImport.tipo === "sucesso" ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{msgImport.texto}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}