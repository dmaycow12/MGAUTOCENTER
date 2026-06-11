import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, AlertCircle, CheckCircle, RefreshCw, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const formatarDataBR = (data) => {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
};

export default function AbaArquivos({ notas, onRefresh }) {
   const [tipoAtivo, setTipoAtivo] = useState(() => {
      const saved = localStorage.getItem('filtroAbaArquivos_tipo');
      return saved ? new Set(JSON.parse(saved)) : new Set(['xml', 'pdf']);
   });
   const [statusAtivo, setStatusAtivo] = useState(() => {
      const saved = localStorage.getItem('filtroAbaArquivos_status');
      return saved ? new Set(JSON.parse(saved)) : new Set(['salvo', 'ausente']);
   });
   const [operacaoAtivo, setOperacaoAtivo] = useState(() => {
      const saved = localStorage.getItem('filtroAbaArquivos_operacao');
      return saved ? new Set(JSON.parse(saved)) : new Set(['saida', 'entrada']);
   });
   const [notaAtivo, setNotaAtivo] = useState(() => {
      const saved = localStorage.getItem('filtroAbaArquivos_nota');
      return saved ? new Set(JSON.parse(saved)) : new Set(['nfe', 'nfce', 'nfse']);
   });
   const [importando, setImportando] = useState(null);
   const [aviso, setAviso] = useState(null);
   const [uploadModal, setUploadModal] = useState(null);
   const [uploadando, setUploadando] = useState(false);

   // Persistir filtros no localStorage
   useEffect(() => {
      localStorage.setItem('filtroAbaArquivos_tipo', JSON.stringify([...tipoAtivo]));
   }, [tipoAtivo]);

   useEffect(() => {
      localStorage.setItem('filtroAbaArquivos_status', JSON.stringify([...statusAtivo]));
   }, [statusAtivo]);

   useEffect(() => {
      localStorage.setItem('filtroAbaArquivos_operacao', JSON.stringify([...operacaoAtivo]));
   }, [operacaoAtivo]);

   useEffect(() => {
      localStorage.setItem('filtroAbaArquivos_nota', JSON.stringify([...notaAtivo]));
   }, [notaAtivo]);

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
         status: 'salvo',
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
        const tipoOk = tipoAtivo.has(arq.tipo.toLowerCase());
        const statusOk = (statusAtivo.has('salvo') && (arq.status === 'salvo' || arq.status === 'url')) ||
                         (statusAtivo.has('ausente') && arq.status === 'ausente');
        const operacaoOk = operacaoAtivo.has(arq.operacao?.toLowerCase());
        const notaOk = (notaAtivo.has('nfe') && arq.nota_tipo === 'NFe') ||
                       (notaAtivo.has('nfce') && arq.nota_tipo === 'NFCe') ||
                       (notaAtivo.has('nfse') && arq.nota_tipo === 'NFSe');
        return tipoOk && statusOk && operacaoOk && notaOk;
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

  const handleVisualize = (arquivo) => {
    if (arquivo.url) {
      window.open(arquivo.url, '_blank');
    } else if (arquivo.conteudo) {
      const blob = new Blob([arquivo.conteudo], { type: arquivo.tipo === 'XML' ? 'application/xml' : 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const handleTipoChange = (id) => {
    const novo = new Set(tipoAtivo);
    if (novo.has(id)) {
      novo.delete(id);
    } else {
      novo.add(id);
    }
    if (novo.size > 0) {
      setTipoAtivo(novo);
    }
  };

  const handleStatusChange = (id) => {
    const novo = new Set(statusAtivo);
    if (novo.has(id)) {
      novo.delete(id);
    } else {
      novo.add(id);
    }
    if (novo.size > 0) {
      setStatusAtivo(novo);
    }
  };

  const handleNotaChange = (id) => {
    const novo = new Set(notaAtivo);
    if (novo.has(id)) {
      novo.delete(id);
    } else {
      novo.add(id);
    }
    if (novo.size > 0) {
      setNotaAtivo(novo);
    }
  };

  const handleOperacaoChange = (id) => {
    const novo = new Set(operacaoAtivo);
    if (novo.has(id)) {
      novo.delete(id);
    } else {
      novo.add(id);
    }
    if (novo.size > 0) {
      setOperacaoAtivo(novo);
    }
  };

  const handleRecuperar = async (arquivo) => {
    setImportando(`${arquivo.nota_id}-${arquivo.tipo}`);
    try {
      const res = await base44.functions.invoke('recuperarArquivosAusentes', { 
        nota_id: arquivo.nota_id
      });
      if (res.data?.sucesso) {
        setAviso({ tipo: 'sucesso', mensagem: res.data.mensagem });
        if (onRefresh) onRefresh();
      } else {
        setAviso({ tipo: 'erro', mensagem: res.data?.erro || 'Não foi possível recuperar os arquivos.' });
      }
    } catch (e) {
      setAviso({ tipo: 'erro', mensagem: 'Erro: ' + e.message });
    }
    setImportando(null);
  };

  const handleImportar = async (arquivo) => {
    setImportando(`${arquivo.nota_id}-${arquivo.tipo}`);
    try {
      const nota = notas.find(n => n.id === arquivo.nota_id);
      if (!nota) return;

      let sucesso = false;
      let mensagem = '';

      if (arquivo.tipo === 'XML') {
        // Tenta buscar XML da Focus NFe
        try {
          const res = await base44.functions.invoke('buscarXmlNota', { 
            chave_acesso: nota.chave_acesso, 
            nota_id: nota.id 
          });
          if (res.data?.sucesso && res.data?.xml) {
            await base44.entities.NotaFiscal.update(nota.id, { xml_original: res.data.xml });
            sucesso = true;
            mensagem = 'XML importado com sucesso!';
          } else if (res.data?.cancelada) {
            mensagem = 'Nota foi cancelada pelo fornecedor.';
          } else {
            mensagem = res.data?.erro || 'XML não disponível na SEFAZ ainda.';
          }
        } catch (e) {
          mensagem = 'Erro ao buscar XML: ' + e.message;
        }
      } else if (arquivo.tipo === 'PDF') {
        // Busca PDF na Focus NFe
        try {
          const res = await base44.functions.invoke('proxyPdfNota', { nota_id: nota.id });
          if (res.data?.pdf_url) {
            await base44.entities.NotaFiscal.update(nota.id, { pdf_url: res.data.pdf_url });
            sucesso = true;
            mensagem = 'PDF importado com sucesso!';
          } else {
            mensagem = res.data?.erro || 'PDF não disponível.';
          }
        } catch (e) {
          mensagem = 'Erro ao buscar PDF: ' + e.message;
        }
      }

      if (sucesso && onRefresh) onRefresh();
      setAviso({ tipo: sucesso ? 'sucesso' : 'erro', mensagem });
    } catch (e) {
      setAviso({ tipo: 'erro', mensagem: 'Erro: ' + e.message });
    }
    setImportando(null);
  };

  const handleUploadManual = async (arquivo, file) => {
    setUploadando(true);
    try {
      const nota = notas.find(n => n.id === arquivo.nota_id);
      if (!nota || !file) return;

      const uploadResp = await base44.integrations.Core.UploadFile({ file });
      if (!uploadResp?.file_url) throw new Error('Erro ao fazer upload');

      if (arquivo.tipo === 'XML') {
        await base44.entities.NotaFiscal.update(nota.id, { xml_url: uploadResp.file_url });
      } else if (arquivo.tipo === 'PDF') {
        await base44.entities.NotaFiscal.update(nota.id, { pdf_url: uploadResp.file_url });
      }

      setAviso({ tipo: 'sucesso', mensagem: `${arquivo.tipo} importado manualmente com sucesso!` });
      if (onRefresh) onRefresh();
      setUploadModal(null);
    } catch (e) {
      setAviso({ tipo: 'erro', mensagem: 'Erro: ' + e.message });
    }
    setUploadando(false);
  };

  return (
    <div className="space-y-0.5">
      {/* Modal Aviso */}
      {aviso && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-3">
              {aviso.tipo === 'sucesso' ? 'Importação Concluída' : 'Aviso'}
            </h3>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed">
              {aviso.mensagem}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setAviso(null)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Upload Manual */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-3">
              Importar {uploadModal.tipo} Manualmente
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {uploadModal.nota_tipo}-{uploadModal.nota_numero}
            </p>
            <input
              type="file"
              accept={uploadModal.tipo === 'XML' ? '.xml' : '.pdf'}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleUploadManual(uploadModal, e.target.files[0]);
                }
              }}
              disabled={uploadando}
              className="w-full"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setUploadModal(null)}
                disabled={uploadando}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros - Tipo e Status */}
      <div className="flex gap-0.5">
        {[
            { id: 'xml', label: 'XML', onClick: handleTipoChange, active: tipoAtivo },
            { id: 'pdf', label: 'PDF', onClick: handleTipoChange, active: tipoAtivo },
            { id: 'salvo', label: 'Salvo', onClick: handleStatusChange, active: statusAtivo },
            { id: 'ausente', label: 'Ausente', onClick: handleStatusChange, active: statusAtivo },
          ].map(f => (
          <button
            key={f.id}
            onClick={() => f.onClick(f.id)}
            className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
              f.active.has(f.id)
                ? 'bg-[#062C9B] text-white'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filtros - Operação e Tipo de Nota */}
      <div className="flex gap-0.5">
        {[
            { id: 'saida', label: 'Saída', onClick: handleOperacaoChange, active: operacaoAtivo },
            { id: 'entrada', label: 'Entrada', onClick: handleOperacaoChange, active: operacaoAtivo },
            { id: 'nfe', label: 'NFe', onClick: handleNotaChange, active: notaAtivo },
            { id: 'nfce', label: 'NFCe', onClick: handleNotaChange, active: notaAtivo },
            { id: 'nfse', label: 'NFSe', onClick: handleNotaChange, active: notaAtivo },
          ].map(f => (
          <button
            key={f.id}
            onClick={() => f.onClick(f.id)}
            className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
              f.active.has(f.id)
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
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell text-xs">{formatarDataBR(arq.data_emissao)}</td>
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
                        {arq.status === 'salvo' || arq.status === 'url' ? (
                          <>
                            <button
                              onClick={() => handleVisualize(arq)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"
                              title="Visualizar"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDownload(arq)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                              title="Baixar"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                           <>
                             <button
                               onClick={() => handleRecuperar(arq)}
                               disabled={importando === `${arq.nota_id}-${arq.tipo}`}
                               className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-50"
                               title="Recuperar da SEFAZ"
                             >
                               {importando === `${arq.nota_id}-${arq.tipo}` ? (
                                 <RefreshCw className="w-3 h-3 animate-spin" />
                               ) : (
                                 <Download className="w-3 h-3" />
                               )}
                             </button>
                             <button
                               onClick={() => setUploadModal(arq)}
                               className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                               title="Importar Manualmente"
                             >
                               <Plus className="w-3 h-3" />
                             </button>
                           </>
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