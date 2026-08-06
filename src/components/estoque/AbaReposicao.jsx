import React, { useState, useEffect } from "react";
import { AlertTriangle, Download, Plus, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ModalEstoqueForm from "./ModalEstoqueForm";
import { mostrarAlerta } from "@/lib/modalAviso";

const defaultForm = () => ({
  codigo: "", codigos: [], descricao: "", marca: "",
  quantidade: 0, estoque_minimo: 1, valor_custo: 0, valor_venda: 0,
  ncm: "87089990", cfop: "5405", cest: "", observacoes: "", historico: []
});

export default function AbaReposicao({ items, onReload }) {
  const [excluded, setExcluded] = useState(new Set());
  const [configId, setConfigId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [editandoMin, setEditandoMin] = useState(null);
  const [valorMin, setValorMin] = useState("");

  useEffect(() => {
    base44.entities.Configuracao.list("-created_date", 100).then(configs => {
      const cfg = configs.find(c => c.chave === "reposicao_excluded_ids");
      if (cfg) {
        setConfigId(cfg.id);
        try { setExcluded(new Set(JSON.parse(cfg.valor || "[]"))); } catch {}
      }
    });
  }, []);

  const salvarExcluded = async (novoSet) => {
    const valor = JSON.stringify([...novoSet]);
    if (configId) {
      await base44.entities.Configuracao.update(configId, { valor });
    } else {
      const novo = await base44.entities.Configuracao.create({ chave: "reposicao_excluded_ids", valor, descricao: "IDs excluidos da reposicao" });
      setConfigId(novo.id);
    }
  };

  const excluirDaLista = (id) => {
    const novoSet = new Set(excluded);
    novoSet.add(id);
    setExcluded(novoSet);
    salvarExcluded(novoSet);
  };

  const gerarLista = () => {
    setExcluded(new Set());
    salvarExcluded(new Set());
    if (onReload) onReload();
  };

  const salvar = async () => {
    if (!form.descricao) return mostrarAlerta("Informe a descricao.");
    await base44.entities.Estoque.create(form);
    setShowForm(false);
    setForm(defaultForm());
    if (onReload) onReload();
  };

  const exportar = () => {
    if (baixo.length === 0) return mostrarAlerta("Nenhum produto com estoque baixo.");
    const rows = [["Quantidade Faltante", "Codigo do Produto"]];
    for (const i of baixo) {
      const falta = (Number(i.estoque_minimo || 0)) - (Number(i.quantidade || 0));
      rows.push([falta, i.codigo || ""]);
    }
    const escapeXml = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cellRef = (r, c) => `${String.fromCharCode(64 + c)}${r}`;
    const cells = rows.map((row, ri) =>
      row.map((val, ci) => {
        const ref = cellRef(ri + 1, ci + 1);
        const isNum = typeof val === "number";
        return isNum
          ? `<c r="${ref}" s="0" t="n"><v>${val}</v></c>`
          : `<c r="${ref}" s="0" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
      }).join("")
    ).map((c, ri) => `<row r="${ri + 1}">${c}</row>`).join("");

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="2" width="20" customWidth="1"/></cols><sheetData>${cells}</sheetData></worksheet>`;
    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Reposicao" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

    import("jszip").then(async JSZip => {
      const zip = new JSZip.default();
      zip.file("[Content_Types].xml", contentTypesXml);
      zip.folder("_rels").file(".rels", rootRelsXml);
      zip.folder("xl").file("workbook.xml", wbXml);
      zip.folder("xl").folder("_rels").file("workbook.xml.rels", relsXml);
      zip.folder("xl").folder("worksheets").file("sheet1.xml", sheetXml);
      zip.folder("xl").file("styles.xml", stylesXml);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "reposicao_estoque.xlsx"; a.click();
      URL.revokeObjectURL(url);
    }).catch(() => {
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "reposicao_estoque.csv"; a.click();
      URL.revokeObjectURL(url);
    });
  };

  const baixo = items.filter(i =>
    Number(i.quantidade || 0) < Number(i.estoque_minimo || 0) && !excluded.has(i.id) && !i.arquivado
  );

  const iniciarEdicaoMin = (item) => {
    setEditandoMin(item.id);
    setValorMin(String(item.estoque_minimo || 0));
  };

  const salvarMin = async (item) => {
    const novoValor = Number(valorMin) || 0;
    setEditandoMin(null);
    if (novoValor === Number(item.estoque_minimo || 0)) return;
    item.estoque_minimo = novoValor;
    if (onReload) onReload();
    await base44.entities.Estoque.update(item.id, { estoque_minimo: novoValor });
  };

  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center justify-between gap-0.5">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <span className="text-white text-sm font-semibold">
            {baixo.length} produto(s) com estoque baixo
            {excluded.size > 0 && <span className="text-gray-500"> ({excluded.size} oculto(s))</span>}
          </span>
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={() => { setForm(defaultForm()); setShowForm(true); }}
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "#00ff00", color: "#000" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#00dd00")}
            onMouseLeave={e => (e.currentTarget.style.background = "#00ff00")}
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
          <button
            onClick={gerarLista}
            title="Restaura a lista completa de produtos com estoque baixo"
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "#00ff00", color: "#000" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#00dd00")}
            onMouseLeave={e => (e.currentTarget.style.background = "#00ff00")}
          >
            <AlertTriangle className="w-4 h-4" /> Gerar Lista de Produtos Faltantes
          </button>
          <button
            onClick={() => window.open("/ReposicaoPrint", "_blank")}
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "#00ff00", color: "#000" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#00dd00")}
            onMouseLeave={e => (e.currentTarget.style.background = "#00ff00")}
          >
            <Download className="w-4 h-4" /> Reposição
          </button>
        </div>
      </div>

      {baixo.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum produto com estoque baixo</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800 bg-gray-900/80">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3 text-center">Qtd Atual</th>
                  <th className="px-4 py-3 text-center">Estoque Mín.</th>
                  <th className="px-4 py-3 text-center">Faltante</th>
                  <th className="px-4 py-3 text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {baixo.map(item => {
                  const falta = Number(item.estoque_minimo || 0) - Number(item.quantidade || 0);
                  return (
                    <tr key={item.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-all">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.codigo || "—"}</td>
                      <td className="px-4 py-3 text-white font-medium">{item.descricao}</td>
                      <td className="px-4 py-3 text-gray-400">{item.marca || "—"}</td>
                      <td className="px-4 py-3 text-center font-bold text-red-400">{item.quantidade}</td>
                      <td className="px-4 py-3 text-center text-gray-400">
                        {editandoMin === item.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={valorMin}
                            onChange={e => setValorMin(e.target.value)}
                            onBlur={() => salvarMin(item)}
                            onKeyDown={e => { if (e.key === "Enter") salvarMin(item); if (e.key === "Escape") setEditandoMin(null); }}
                            className="w-16 bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-white text-center text-sm outline-none"
                          />
                        ) : (
                          <button onClick={() => iniciarEdicaoMin(item)} className="hover:text-blue-400 transition-all cursor-text">
                            {item.estoque_minimo}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-yellow-400">{falta}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => excluirDaLista(item.id)} title="Remover da lista" className="text-gray-500 hover:text-red-400 transition-all p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <ModalEstoqueForm
          editando={null}
          form={form}
          setForm={setForm}
          onSalvar={salvar}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}