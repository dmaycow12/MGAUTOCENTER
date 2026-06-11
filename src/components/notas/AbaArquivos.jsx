import React, { useState } from 'react';
import { FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';

export default function AbaArquivos({ notas }) {
  const [tipoFiltro, setTipoFiltro] = useState('tudo-arquivo');
  const [statusFiltro, setStatusFiltro] = useState('tudo-status');

  const arquivos = notas
    .flatMap(nota => {
      const items = [];
      
      // XML
      const isDevolucaoNota = nota.observacoes === "DEVOLUÇÃO";
      const isEntrada = !isDevolucaoNota && (nota.status === "Importada" || nota.status === "Lançada");
      const operacao = isEntrada ? 'entrada' : 'saida';
      
      if (nota.xml_original?.trim().startsWith('<')) {
       items.push({
         tipo: 'XML',
         nota_numero: nota.numero,
         nota_tipo: nota.tipo,
         nota_id: nota.id,
         url: null,
         conteudo: nota.xml_original,
         status: 'salvo',
         data_emissao: nota.data_emissao,
         cliente: nota.cliente_nome,
         operacao: operacao,
       });
      } else if (nota.xml_url?.endsWith('.xml')) {
       items.push({
         tipo: 'XML',
         nota_numero: nota.numero,
         nota_tipo: nota.tipo,
         nota_id: nota.id,
         url: nota.xml_url,
         conteudo: null,
         status: 'ausente',
         data_emissao: nota.data_emissao,
         cliente: nota.cliente_nome,
         operacao: operacao,
       });
      } else if (nota.xml_content?.trim().startsWith('<')) {
       items.push({
         tipo: 'XML',
         nota_numero: nota.numero,
         nota_tipo: nota.tipo,
         nota_id: nota.id,
         url: null,
         conteudo: nota.xml_content,
         status: 'salvo',
         data_emissao: nota.data_emissao,
         cliente: nota.cliente_nome,
         operacao: operacao,
       });
      } else {
       items.push({
         tipo: 'XML',
         nota_numero: nota.numero,
         nota_tipo: nota.tipo,
         nota_id: nota.id,
         url: null,
         conteudo: null,
         status: 'ausente',
         data_emissao: nota.data_emissao,
         cliente: nota.cliente_nome,
         operacao: operacao,
       });
      }

      // PDF
      if (nota.pdf_url && !nota.pdf_url.endsWith('.html')) {
       items.push({
         tipo: 'PDF',
         nota_numero: nota.numero,
         nota_tipo: nota.tipo,
         nota_id: nota.id,
         url: nota.pdf_url,
         conteudo: null,
         status: 'url',
         data_emissao: nota.data_emissao,
         cliente: nota.cliente_nome,
         operacao: operacao,
       });
      } else {
       items.push({
         tipo: 'PDF',
         nota_numero: nota.numero,
         nota_tipo: nota.tipo,
         nota_id: nota.id,
         url: null,
         conteudo: null,
         status: 'ausente',
         data_emissao: nota.data_emissao,
         cliente: nota.cliente_nome,
         operacao: operacao,
       });
      }

      return items;
    })
    .filter(arq => {
      const tipoOk = tipoFiltro === 'tudo-arquivo' || arq.tipo.toLowerCase() === tipoFiltro;
      const statusOk = statusFiltro === 'tudo-status' || 
        (statusFiltro === 'salvo' && arq.status === 'salvo') ||
        (statusFiltro === 'ausente' && arq.status === 'ausente');
      return tipoOk && statusOk;
    });

  const handleDownload = (arquivo) => {
    if (arquivo.url) {
      const a = document.createElement('a');
      a.href = arquivo.url;
      a.download = `${arquivo.nota_tipo}-${arquivo.nota_numero}.${arquivo.tipo.toLowerCase()}`;
      a.click();
    } else if (arquivo.conteudo) {
      const blob = new Blob([arquivo.conteudo], { type: arquivo.tipo === 'XML' ? 'application/xml' : 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${arquivo.nota_tipo}-${arquivo.nota_numero}.${arquivo.tipo.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };



  const handleTipoChange = (id) => {
    setTipoFiltro(id);
  };

  const handleStatusChange = (id) => {
    setStatusFiltro(id);
  };

  return (
    <div className="space-y-0.5">
      {/* Filtros - Tipo de Arquivo */}
      <div className="flex gap-0.5">
        {[
            { id: 'tudo-arquivo', label: 'Tudo' },
            { id: 'xml', label: 'XML' },
            { id: 'pdf', label: 'PDF' },
          ].map(f => (
          <button
            key={f.id}
            onClick={() => handleTipoChange(f.id)}
            className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
              tipoFiltro === f.id
                ? 'bg-[#062C9B] text-white'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filtros - Status */}
      <div className="flex gap-0.5">
        {[
            { id: 'tudo-status', label: 'Tudo' },
            { id: 'salvo', label: 'Salvo' },
            { id: 'ausente', label: 'Ausente' },
          ].map(f => (
          <button
            key={f.id}
            onClick={() => handleStatusChange(f.id)}
            className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
              statusFiltro === f.id
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
                  <th className="px-4 py-3">Operação</th>
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
                    <td className="px-4 py-3 text-white font-mono text-sm">{arq.nota_tipo || '—'}-{arq.nota_numero || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{arq.cliente || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell text-xs">{arq.data_emissao || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2 py-1 rounded-full font-medium ${
                        arq.operacao?.toLowerCase() === 'saida' 
                          ? 'bg-orange-500/10 text-orange-400' 
                          : 'bg-green-500/10 text-green-400'
                      }`}>
                        {arq.operacao?.toLowerCase() === 'saida' ? 'Saída' : 'Entrada'}
                      </span>
                    </td>
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
                      <div className="flex gap-1.5 justify-end">
                        {(arq.conteudo || arq.url) && (
                          <button
                            onClick={() => handleDownload(arq)}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                            title="Baixar"
                          >
                            <Download className="w-3 h-3" />
                          </button>
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