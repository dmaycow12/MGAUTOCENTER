import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Download, Save, AlertCircle, Loader2 } from "lucide-react";

export default function ModalXML({ nota, onClose, onSalvo }) {
  const [xmlCarregado, setXmlCarregado] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [xmlManual, setXmlManual] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Verifica se já tem XML inline (sem precisar buscar da URL)
  const xmlInline = nota.xml_original?.trim().startsWith("<")
    ? nota.xml_original
    : nota.xml_content?.trim().startsWith("<")
    ? nota.xml_content
    : "";

  useEffect(() => {
    if (xmlInline) {
      setXmlCarregado(xmlInline);
      return;
    }
    // Se tem xml_url, buscar o arquivo
    if (nota.xml_url) {
      setCarregando(true);
      fetch(nota.xml_url)
        .then(r => r.text())
        .then(text => {
          if (text && text.trim().startsWith("<")) {
            setXmlCarregado(text);
          } else {
            setXmlCarregado("");
          }
        })
        .catch(() => setXmlCarregado(""))
        .finally(() => setCarregando(false));
    }
  }, [nota.id]);

  const temXml = !!xmlCarregado;

  const baixarXml = () => {
    // Se tem xml_url e não tem inline, abrir direto
    if (!xmlInline && nota.xml_url) {
      const a = document.createElement("a");
      a.href = nota.xml_url;
      a.download = `NF-${nota.numero || nota.id}.xml`;
      a.click();
      return;
    }
    const blob = new Blob([xmlCarregado], { type: "text/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NF-${nota.numero || nota.id}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const salvarXmlManual = async () => {
    if (!xmlManual.trim().startsWith("<")) {
      setErro("O conteúdo não parece ser um XML válido. Deve começar com '<'.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      // Salvar como arquivo para não estourar limite do campo
      const xmlFile = new File([xmlManual.trim()], `NF-${nota.numero || nota.id}.xml`, { type: "text/xml" });
      const uploadResp = await base44.integrations.Core.UploadFile({ file: xmlFile });
      if (uploadResp?.file_url) {
        await base44.entities.NotaFiscal.update(nota.id, {
          xml_url: uploadResp.file_url,
          xml_original: null,
        });
        setXmlCarregado(xmlManual.trim());
        onSalvo(xmlManual.trim());
      } else {
        // Fallback: salvar direto no campo
        await base44.entities.NotaFiscal.update(nota.id, { xml_original: xmlManual.trim() });
        setXmlCarregado(xmlManual.trim());
        onSalvo(xmlManual.trim());
      }
    } catch (e) {
      setErro("Erro ao salvar: " + e.message);
    }
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">XML da Nota — NF {nota.numero || "—"}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{nota.cliente_nome} · {nota.data_emissao}</p>
          </div>
          <div className="flex items-center gap-2">
            {temXml && (
              <button onClick={baixarXml}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium text-white"
                style={{ background: "#062C9B" }}>
                <Download className="w-3.5 h-3.5" /> Baixar XML
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {carregando ? (
            <div className="flex items-center justify-center gap-3 py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando XML...</span>
            </div>
          ) : temXml ? (
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all bg-gray-950 rounded-lg p-4 border border-gray-800">
              {xmlCarregado}
            </pre>
          ) : (
            <>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Esta nota não possui XML completo. Cole o conteúdo do XML abaixo para salvá-lo permanentemente.</span>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Colar XML manualmente</label>
                <textarea
                  value={xmlManual}
                  onChange={e => { setXmlManual(e.target.value); setErro(""); }}
                  rows={10}
                  className="w-full bg-gray-950 border border-gray-700 text-green-400 font-mono rounded-lg p-3 text-xs focus:outline-none focus:border-green-500 resize-none"
                  placeholder={'<?xml version="1.0" encoding="UTF-8"?>\n<nfeProc>...</nfeProc>'}
                />
              </div>

              {erro && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {erro}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  onClick={salvarXmlManual}
                  disabled={salvando || !xmlManual.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-all"
                  style={{ background: "#00ff00", color: "#000" }}
                  onMouseEnter={e => { if (!salvando) e.currentTarget.style.background = "#00dd00"; }}
                  onMouseLeave={e => e.currentTarget.style.background = "#00ff00"}
                >
                  <Save className="w-4 h-4" />
                  {salvando ? "Salvando..." : "Salvar XML"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}