import React, { useState } from 'react';
import { FileText, Download, Eye, AlertCircle, CheckCircle } from 'lucide-react';

export default function AbaArquivos({ notas }) {
  const [filtro, setFiltro] = useState('todos');

  const arquivos = notas
    .flatMap(nota => {
      const items = [];
      
      // XML
      if (nota.xml_original?.trim().startsWith('<')) {
        items.push({
          tipo: 'XML',
          nota_numero: nota.numero,
          nota_id: nota.id,
          url: null,
          conteudo: nota.xml_original,
          status: 'salvo',
          data_emissao: nota.data_emissao,
          cliente: nota.cliente_nome,
        });
      } else if (nota.xml_url?.endsWith('.xml')) {
        items.push({
          tipo: 'XML',
          nota_numero: nota.numero,
          nota_id: nota.id,
          url: nota.xml_url,
          conteudo: null,
          status: 'url',
          data_emissao: nota.data_emissao,
          cliente: nota.cliente_nome,
        });
      } else if (nota.xml_content?.trim().startsWith('<')) {
        items.push({
          tipo: 'XML',
          nota_numero: nota.numero,
          nota_id: nota.id,
          url: null,
          conteudo: nota.xml_content,
          status: 'salvo',
          data_emissao: nota.data_emissao,
          cliente: nota.cliente_nome,
        });
      } else {
        items.push({
          tipo: 'XML',
          nota_numero: nota.numero,
          nota_id: nota.id,
          url: null,
          conteudo: null,
          status: 'ausente',
          data_emissao: nota.data_emissao,
          cliente: nota.cliente_nome,
        });
      }

      // PDF
      if (nota.pdf_url && !nota.pdf_url.endsWith('.html')) {
        items.push({
          tipo: 'PDF',
          nota_numero: nota.numero,
          nota_id: nota.id,
          url: nota.pdf_url,
          conteudo: null,
          status: 'salvo',
          data_emissao: nota.data_emissao,
          cliente: nota.cliente_nome,
        });
      } else {
        items.push({
          tipo: 'PDF',
          nota_numero: nota.numero,
          nota_id: nota.id,
          url: null,
          conteudo: null,
          status: 'ausente',
          data_emissao: nota.data_emissao,
          cliente: nota.cliente_nome,
        });
      }

      return items;
    })
    .filter(arq => {
      if (filtro === 'xml') return arq.tipo === 'XML';
      if (filtro === 'pdf') return arq.tipo === 'PDF';
      if (filtro === 'salvos') return arq.status !== 'ausente';
      if (filtro === 'ausentes') return arq.status === 'ausente';
      return true;
    });

  const handleDownload = (arquivo) => {
    if (arquivo.url) {
      window.open(arquivo.url, '_blank');
    } else if (arquivo.conteudo) {
      const blob = new Blob([arquivo.conteudo], { type: arquivo.tipo === 'XML' ? 'application/xml' : 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NF-${arquivo.nota_numero}.${arquivo.tipo.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'xml', label: 'XMLs' },
          { id: 'pdf', label: 'PDFs' },
          { id: 'salvos', label: 'Salvos' },
          { id: 'ausentes', label: 'Ausentes' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filtro === f.id
                ? 'bg-[#062C9B] text-white'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Resultado */}
      {arquivos.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <FileText className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhum arquivo encontrado</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">NF nº</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Data Emissão</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {arquivos.map((arq, idx) => (
                  <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30 transition-all">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                        arq.tipo === 'XML'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-orange-500/10 text-orange-400'
                      }`}>
                        <FileText className="w-3 h-3" />
                        {arq.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-sm">{arq.nota_numero || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{arq.cliente || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell text-xs">{arq.data_emissao || '—'}</td>
                    <td className="px-4 py-3">
                      {arq.status === 'ausente' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          Ausente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Salvo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {arq.status !== 'ausente' && (
                        <button
                          onClick={() => handleDownload(arq)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                        >
                          <Download className="w-3 h-3" />
                          Baixar
                        </button>
                      )}
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