import { useState } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ModalEmissaoMassa({ ordens, notas = [], onClose, onConcluido }) {
  const [selecionadas, setSelecionadas] = useState([]);
  const [tipoNF, setTipoNF] = useState('NFSe');
  const [emitindo, setEmitindo] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [concluido, setConcluido] = useState(false);

  // Filtra ordens elegíveis para o tipo de NF selecionado
  const ordensElegiveis = ordens.filter(os => {
    // Verifica notas já emitidas para esta OS
    const notasOS = notas.filter(n => n.ordem_servico_id === os.id && n.status === 'Emitida');
    const temNFe = notasOS.some(n => n.tipo === 'NFe');
    const temNFCe = notasOS.some(n => n.tipo === 'NFCe');
    const temNFSe = notasOS.some(n => n.tipo === 'NFSe');
    if (tipoNF === 'NFSe') {
      if (temNFSe) return false; // já emitiu NFSe
      return (os.servicos || []).length > 0; // só mostra se tem serviços
    }
    if (tipoNF === 'NFe') {
      if (temNFe || temNFCe) return false; // já emitiu NFe ou NFCe
      return (os.pecas || []).length > 0; // só mostra se tem produtos
    }
    if (tipoNF === 'NFCe') {
      if (temNFCe || temNFe) return false; // já emitiu NFCe ou NFe
      return (os.pecas || []).length > 0; // só mostra se tem produtos
    }
    return true;
  });

  const toggle = (id) => setSelecionadas(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSelecionadas(selecionadas.length === ordensElegiveis.length ? [] : ordensElegiveis.map(o => o.id));

  const emitir = async () => {
    if (selecionadas.length === 0) return;
    setEmitindo(true);
    const res = [];
    for (const osId of selecionadas) {
      const os = ordens.find(o => o.id === osId);
      if (!os) continue;
      try {
        const items = tipoNF === 'NFSe'
          ? (os.servicos || []).map(s => ({ descricao: s.descricao || 'Serviço', quantidade: Number(s.quantidade ?? 1), valor_unitario: Number(s.valor || 0), valor_total: Number(s.valor || 0) * Number(s.quantidade ?? 1) }))
          : (os.pecas || []).map(p => ({ descricao: p.descricao || 'Peça', quantidade: Number(p.quantidade || 1), valor_unitario: Number(p.valor_unitario || 0), valor_total: Number(p.valor_total || 0), ncm: p.ncm || '87089990', cfop: p.cfop || '5405', unidade: p.unidade || 'UN', codigo: p.codigo || '' }));
        
        const valorTotal = items.reduce((s, it) => s + it.valor_total, 0) || os.valor_total || 0;
        const itensFinal = items.length > 0 ? items : [{ descricao: tipoNF === 'NFSe' ? 'Serviços' : 'Produtos', quantidade: 1, valor_unitario: valorTotal, valor_total: valorTotal }];

        const payload = {
          tipo: tipoNF,
          cliente_nome: os.cliente_nome || '',
          cliente_cpf_cnpj: os.cliente_cpf_cnpj || '',
          cliente_email: os.cliente_email || '',
          cliente_telefone: os.cliente_telefone || '',
          cliente_endereco: os.cliente_endereco || '',
          cliente_numero: '',
          cliente_bairro: os.cliente_bairro || '',
          cliente_cep: '',
          cliente_cidade: os.cliente_cidade || '',
          cliente_estado: os.cliente_estado || '',
          ordem_servico_id: osId,
          valor_total: valorTotal,
          items: itensFinal,
          data_emissao: new Date().toISOString().split('T')[0],
          serie: '1',
        };

        const resp = await base44.functions.invoke('emitirNotaFiscal', payload);
        res.push({ os, sucesso: resp.data?.sucesso, mensagem: resp.data?.mensagem || resp.data?.erro || '' });
      } catch (e) {
        res.push({ os, sucesso: false, mensagem: e.message });
      }
    }
    setResultados(res);
    setEmitindo(false);
    setConcluido(true);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">Emissão de NF em Massa</h2>
            <p className="text-gray-500 text-xs mt-0.5">{ordens.length} ordens com notas emitidas disponíveis</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {!concluido ? (
          <>
            <div className="p-5 flex-shrink-0 flex items-center gap-4 border-b border-gray-800">
              <span className="text-xs text-gray-400">Tipo de NF:</span>
              {['NFSe', 'NFe', 'NFCe'].map(t => (
                <button key={t} onClick={() => setTipoNF(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tipoNF === t ? 'bg-[#062C9B] text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500">
                    <th className="px-4 py-3 text-left w-10">
                      <input type="checkbox" checked={selecionadas.length === ordensElegiveis.length && ordensElegiveis.length > 0}
                        onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-left">Nº</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {ordensElegiveis.map(os => (
                    <tr key={os.id} className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer" onClick={() => toggle(os.id)}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selecionadas.includes(os.id)} onChange={() => toggle(os.id)} onClick={e => e.stopPropagation()} className="rounded" />
                      </td>
                      <td className="px-4 py-3 text-white font-mono text-xs">Nº {os.numero || os.id.slice(-6)}</td>
                      <td className="px-4 py-3 text-white">{os.cliente_nome || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{color:'#00ff00'}}>R$ {Number(os.valor_total||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                    </tr>
                 ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-gray-800 flex-shrink-0 flex items-center justify-between">
              <span className="text-gray-400 text-sm">{selecionadas.length} selecionada(s)</span>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white">Cancelar</button>
                <button onClick={emitir} disabled={emitindo || selecionadas.length === 0}
                  className="px-6 py-2 text-sm text-black rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                  style={{background:'#00ff00'}}
                  onMouseEnter={e => !emitindo && (e.currentTarget.style.background='#00dd00')}
                  onMouseLeave={e => e.currentTarget.style.background='#00ff00'}>
                  {emitindo && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {emitindo ? 'Emitindo...' : `Emitir ${selecionadas.length} ${tipoNF}`}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <p className="text-white font-medium mb-4">Resultado da emissão:</p>
              {resultados.map((r, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${r.sucesso ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {r.sucesso ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-medium">Nº {r.os.numero || r.os.id.slice(-6)} — {r.os.cliente_nome}</span>
                    {r.mensagem && <p className="text-xs mt-0.5 opacity-80">{r.mensagem}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-800 flex justify-end">
              <button onClick={() => { onConcluido(); onClose(); }}
                className="px-6 py-2 text-sm text-black rounded-lg font-medium"
                style={{background:'#00ff00'}}>
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}