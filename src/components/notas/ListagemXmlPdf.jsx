import React, { useState } from "react";
import { Download, FileText, Code, Eye, ExternalLink } from "lucide-react";

export default function ListagemXmlPdf({ notas }) {
  const [sortBy, setSortBy] = useState("numero");
  const [filterType, setFilterType] = useState("todos");

  // Filtra notas com XML ou PDF
  const notasComArquivos = notas.filter(n => {
    if (filterType === "todos") return n.xml_url || (n.xml_original && n.xml_original.length > 10) || n.pdf_url;
    if (filterType === "xml") return n.xml_url || (n.xml_original && n.xml_original.length > 10);
    if (filterType === "pdf") return n.pdf_url;
    return true;
  });

  // Ordena
  const notasOrdenadas = [...notasComArquivos].sort((a, b) => {
    if (sortBy === "numero") return (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0);
    if (sortBy === "cliente") return (a.cliente_nome || "").localeCompare(b.cliente_nome || "");
    if (sortBy === "tipo") return (a.tipo || "").localeCompare(b.tipo || "");
    if (sortBy === "data") return (a.data_emissao || "").localeCompare(b.data_emissao || "");
    return 0;
  });

  const temXml = (nota) => {
    return (nota.xml_original && nota.xml_original.length > 10) || (nota.xml_url && nota.xml_url.endsWith('.xml'));
  };

  const temPdf = (nota) => nota.pdf_url && !nota.pdf_url.endsWith('.html');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterType("todos")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filterType === "todos"
              ? "bg-[#062C9B] text-white"
              : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
          }`}
        >
          Todos ({notasComArquivos.length})
        </button>
        <button
          onClick={() => setFilterType("xml")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
            filterType === "xml"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
          }`}
        >
          <Code className="w-3 h-3" /> XMLs ({notasComArquivos.filter(temXml).length})
        </button>
        <button
          onClick={() => setFilterType("pdf")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
            filterType === "pdf"
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
          }`}
        >
          <FileText className="w-3 h-3" /> PDFs ({notasComArquivos.filter(temPdf).length})
        </button>
      </div>

      <div className="flex gap-2">
        <label className="text-xs text-gray-400">Ordenar por:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange-500"
        >
          <option value="numero">Número</option>
          <option value="cliente">Cliente</option>
          <option value="tipo">Tipo</option>
          <option value="data">Data</option>
        </select>
      </div>

      {notasOrdenadas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhuma nota com XML ou PDF encontrada</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 hidden md:table-cell">Data</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Valor</th>
                  <th className="px-4 py-3 text-center">XML</th>
                  <th className="px-4 py-3 text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {notasOrdenadas.map((nota) => (
                  <tr key={nota.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-all">
                    <td className="px-4 py-3">
                      <span className="bg-orange-500/10 text-orange-400 text-xs px-2 py-1 rounded-full font-medium">
                        {nota.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs">{nota.numero || "—"}</td>
                    <td className="px-4 py-3 text-white truncate">{nota.cliente_nome || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">{nota.data_emissao || "—"}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs font-mono">
                      R$ {Number(nota.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {temXml(nota) ? (
                          <>
                            <span className="text-green-400 text-xs">✓</span>
                            {nota.xml_url && (
                              <a
                                href={nota.xml_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-400 hover:text-green-300 p-1 transition-all"
                                title="Abrir XML"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-red-400 text-xs">✗</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {temPdf(nota) ? (
                          <>
                            <span className="text-blue-400 text-xs">✓</span>
                            <a
                              href={nota.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 p-1 transition-all"
                              title="Abrir PDF"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={nota.pdf_url}
                              download
                              className="text-blue-400 hover:text-blue-300 p-1 transition-all"
                              title="Baixar PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </>
                        ) : (
                          <span className="text-red-400 text-xs">✗</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}