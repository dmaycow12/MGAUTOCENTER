import { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { gerarDadosAdicionaisDaVenda } from '@/components/notas/gerarDadosAdicionais';

function normalizarFormaPagamento(fp) {
  if (!fp) return 'A Combinar';
  const fpUp = fp.toUpperCase();
  if (fpUp.includes('CART')) return 'Cartão';
  if (fpUp === 'PIX') return 'PIX';
  if (fpUp.includes('DINHEIRO')) return 'Dinheiro';
  if (fpUp.includes('BOLETO')) return 'Boleto';
  if (fpUp.includes('TRANSF')) return 'Transferência';
  if (fpUp.includes('CHEQUE')) return 'Cheque';
  return fp || 'A Combinar';
}

function tiposDisponiveis(venda, notasCarregadas, clientes) {
  if (venda.status !== 'Concluído') return [];

  const cadastro = clientes.find(c => c.id === venda.cliente_id)
    || clientes.find(c => c.nome?.toLowerCase().trim() === venda.cliente_nome?.toLowerCase().trim());
  const cpfCnpj = (venda.cliente_cpf_cnpj || cadastro?.cpf_cnpj || '').replace(/\D/g, '');
  const isConsumidor = venda.cliente_nome?.toUpperCase().trim() === 'CONSUMIDOR' || cpfCnpj.length === 0;
  const isPJ = cpfCnpj.length === 14 || cadastro?.tipo === 'Pessoa Jurídica';

  const notasVenda = notasCarregadas.filter(n => n.ordem_venda_id === venda.id && n.status !== 'Cancelada' && n.status !== 'Rascunho');
  const temNFe = notasVenda.some(n => n.tipo === 'NFe') || !!(venda.nfe_manual?.trim());
  const temNFCe = notasVenda.some(n => n.tipo === 'NFCe') || !!(venda.nfe_manual?.trim());
  const temNFSe = notasVenda.some(n => n.tipo === 'NFSe') || !!(venda.nfse_manual?.trim());

  const tipos = [];
  if (!isConsumidor && !temNFSe && (venda.servicos || []).length > 0) tipos.push('NFSe');
  if (!isConsumidor && !temNFe && !temNFCe && (venda.pecas || []).length > 0) tipos.push('NFe');
  if (!isPJ && !temNFCe && !temNFe && (venda.pecas || []).length > 0) tipos.push('NFCe');
  return tipos;
}

function getTipoCliente(venda, clientes) {
  const cadastro = clientes.find(c => c.id === venda.cliente_id)
    || clientes.find(c => c.nome?.toLowerCase().trim() === venda.cliente_nome?.toLowerCase().trim());
  const cpfCnpj = (venda.cliente_cpf_cnpj || cadastro?.cpf_cnpj || '').replace(/\D/g, '');
  if (venda.cliente_nome?.toUpperCase().trim() === 'CONSUMIDOR' || cpfCnpj.length === 0) return 'Consumidor';
  if (cpfCnpj.length === 14 || cadastro?.tipo === 'Pessoa Jurídica') return 'PJ';
  return 'PF';
}

const TIPO_COLORS = { NFSe: '#a78bfa', NFe: '#fb923c', NFCe: '#38bdf8' };
const CONCURRENCY = 5;

async function runParallel(tasks, concurrency) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export default function ModalEmissaoMassa({ ordens: vendas, notas = [], clientes: clientesProp = [], onClose, onConcluido }) {
  const [selecionadas, setSelecionadas] = useState({});
  const [emitindo, setEmitindo] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [concluido, setConcluido] = useState(false);
  const [clientes, setClientes] = useState(clientesProp);
  const [notasCarregadas, setNotasCarregadas] = useState(notas);
  const [notasFinais, setNotasFinais] = useState(null);
  const [servicos, setServicos] = useState([]);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('Todos'); // Todos, NFSe, NFe, NFCe
  const [filtroCliente, setFiltroCliente] = useState('Todos'); // Todos, PF, PJ, Consumidor

  useEffect(() => {
    base44.entities.Cadastro.list('-created_date', 5000).then(res => { if (res?.length > 0) setClientes(res); }).catch(() => {});
    base44.entities.NotaFiscal.list('-created_date', 2000).then(res => { if (res?.length > 0) setNotasCarregadas(res); }).catch(() => {});
    base44.entities.Servico.list('-created_date', 5000).then(res => { if (res?.length > 0) setServicos(res); }).catch(() => {});
  }, []);

  const vendasElegiveis = useMemo(() =>
    vendas.filter(v => tiposDisponiveis(v, notasCarregadas, clientes).length > 0),
    [vendas, notasCarregadas, clientes]
  );

  const vendasFiltradas = useMemo(() => {
    return vendasElegiveis.filter(v => {
      const tipos = tiposDisponiveis(v, notasCarregadas, clientes);
      const tc = getTipoCliente(v, clientes);
      const matchTipo = filtroTipo === 'Todos' || tipos.includes(filtroTipo);
      const matchCliente = filtroCliente === 'Todos' || tc === filtroCliente;
      return matchTipo && matchCliente;
    });
  }, [vendasElegiveis, filtroTipo, filtroCliente, notasCarregadas, clientes]);

  const toggleTipo = (vendaId, tipo) => {
    setSelecionadas(prev => {
      const current = prev[vendaId] || [];
      const updated = current.includes(tipo) ? current.filter(t => t !== tipo) : [...current, tipo];
      return { ...prev, [vendaId]: updated };
    });
  };

  const totalSelecionado = Object.values(selecionadas).reduce((acc, tipos) => acc + tipos.length, 0);

  // Selecionar todos da lista filtrada
  const toggleAll = () => {
    if (totalSelecionado > 0) {
      setSelecionadas({});
    } else {
      const nova = {};
      vendasFiltradas.forEach(v => { nova[v.id] = tiposDisponiveis(v, notasCarregadas, clientes); });
      setSelecionadas(nova);
    }
  };

  // Selecionar todos de um tipo específico
  const selecionarTodosTipo = (tipo) => {
    const nova = { ...selecionadas };
    const todasTipoMarcadas = vendasFiltradas.every(v => {
      const tipos = tiposDisponiveis(v, notasCarregadas, clientes);
      if (!tipos.includes(tipo)) return true; // não conta
      return (nova[v.id] || []).includes(tipo);
    });
    vendasFiltradas.forEach(v => {
      const tipos = tiposDisponiveis(v, notasCarregadas, clientes);
      if (!tipos.includes(tipo)) return;
      const current = nova[v.id] || [];
      if (todasTipoMarcadas) {
        nova[v.id] = current.filter(t => t !== tipo);
      } else {
        if (!current.includes(tipo)) nova[v.id] = [...current, tipo];
      }
    });
    setSelecionadas(nova);
  };

  const construirPayloadNota = async (venda, tipoNF) => {
    const cadastroVenda = clientes.find(c => c.id === venda.cliente_id)
      || clientes.find(c => c.nome?.toLowerCase().trim() === venda.cliente_nome?.toLowerCase().trim());
    const cpfCnpjVenda = (venda.cliente_cpf_cnpj || cadastroVenda?.cpf_cnpj || '').replace(/\D/g, '');
    const isConsumidorVenda = venda.cliente_nome?.toUpperCase().trim() === 'CONSUMIDOR' || cpfCnpjVenda.length === 0;

    if ((tipoNF === 'NFSe' || tipoNF === 'NFe') && isConsumidorVenda) {
      throw new Error(`${tipoNF} não pode ser emitida para CONSUMIDOR`);
    }

    const items = tipoNF === 'NFSe'
      ? (venda.servicos || []).map(s => {
          const srvMatch = servicos.find(sv => sv.descricao?.toLowerCase().trim() === (s.descricao || '').toLowerCase().trim());
          return { descricao: s.descricao || 'Serviço', codigo: srvMatch?.codigo || '', servico_id: srvMatch?.id || '', quantidade: Number(s.quantidade ?? 1), valor_unitario: Number(s.valor || 0), valor_total: Number(s.valor || 0) * Number(s.quantidade ?? 1) };
        })
      : (venda.pecas || []).map(p => ({ descricao: p.descricao || 'Peça', quantidade: Number(p.quantidade || 1), valor_unitario: Number(p.valor_unitario || 0), valor_total: Number(p.valor_total || 0), ncm: p.ncm || '87089990', cfop: p.cfop || '5405', unidade: p.unidade || 'UN', codigo: p.codigo || '' }));

    const valorTotal = items.reduce((s, it) => s + it.valor_total, 0) || venda.valor_total || 0;
    const itensFinal = items.length > 0 ? items : [{ descricao: tipoNF === 'NFSe' ? 'Serviços' : 'Produtos', quantidade: 1, valor_unitario: valorTotal, valor_total: valorTotal }];

    const formaPagamentoRaw = venda?.parcelas_detalhes?.[0]?.forma_pagamento || venda?.forma_pagamento || 'A Combinar';
    const formaPagamento = normalizarFormaPagamento(formaPagamentoRaw);
    const parcelasDetalhes = (venda?.parcelas_detalhes || []).map(p => ({ ...p, forma_pagamento: normalizarFormaPagamento(p.forma_pagamento) }));
    const vendaComParcelas = { ...venda, parcelas_detalhes: parcelasDetalhes, forma_pagamento: formaPagamento };
    const dadosAdicionais = gerarDadosAdicionaisDaVenda(vendaComParcelas);

    const rascunho = await base44.entities.NotaFiscal.create({
      tipo: tipoNF,
      status: 'Rascunho',
      cliente_id: venda.cliente_id || '',
      cliente_nome: venda.cliente_nome || '',
      cliente_cpf_cnpj: venda.cliente_cpf_cnpj || cadastroVenda?.cpf_cnpj || '',
      cliente_ie: cadastroVenda?.rg_ie || '',
      cliente_email: venda.cliente_email || cadastroVenda?.email || '',
      cliente_telefone: venda.cliente_telefone || cadastroVenda?.telefone || '',
      cliente_endereco: venda.cliente_endereco || cadastroVenda?.endereco || '',
      cliente_numero: cadastroVenda?.numero || '',
      cliente_bairro: venda.cliente_bairro || cadastroVenda?.bairro || '',
      cliente_cep: cadastroVenda?.cep || '',
      cliente_cidade: venda.cliente_cidade || cadastroVenda?.cidade || '',
      cliente_estado: venda.cliente_estado || cadastroVenda?.estado || '',
      ordem_venda_id: venda.id,
      valor_total: valorTotal,
      xml_content: JSON.stringify(itensFinal),
      data_emissao: new Date().toISOString().split('T')[0],
      forma_pagamento: formaPagamento,
      parcelas: venda?.parcelas || 1,
      parcelas_detalhes: parcelasDetalhes,
      dados_adicionais: dadosAdicionais,
    });

    return { venda, tipoNF, rascunho };
  };

  const emitir = async () => {
    if (totalSelecionado === 0) return;
    setEmitindo(true);

    // Monta lista de tarefas
    const tarefas = [];
    for (const venda of vendas) {
      const tipos = selecionadas[venda.id] || [];
      for (const tipoNF of tipos) {
        tarefas.push({ venda, tipoNF });
      }
    }

    setProgresso({ atual: 0, total: tarefas.length });
    const res = new Array(tarefas.length);

    // Cria rascunhos em paralelo (5 por vez)
    const rascunhosTasks = tarefas.map((t, i) => async () => {
      try {
        const r = await construirPayloadNota(t.venda, t.tipoNF);
        return { ...r, idx: i };
      } catch (e) {
        return { venda: t.venda, tipoNF: t.tipoNF, rascunho: null, erro: e.message, idx: i };
      }
    });

    const rascunhosResult = await runParallel(rascunhosTasks, CONCURRENCY);

    // Envia para homologação em paralelo (5 por vez)
    const homologTasks = rascunhosResult.map((r) => async () => {
      if (r.erro || !r.rascunho) {
        const result = { venda: r.venda, tipo: r.tipoNF, sucesso: false, mensagem: r.erro || 'Erro ao criar rascunho' };
        res[r.idx] = result;
        setProgresso(p => ({ ...p, atual: p.atual + 1 }));
        return result;
      }
      try {
        const prevRes = await base44.functions.invoke('preVisualizarNota', { nota_id: r.rascunho.id });
        const sucesso = prevRes.data?.sucesso;
        const result = { venda: r.venda, tipo: r.tipoNF, sucesso, mensagem: sucesso ? 'Enviado para homologação' : (prevRes.data?.erro || 'Erro na homologação') };
        res[r.idx] = result;
        setProgresso(p => ({ ...p, atual: p.atual + 1 }));
        return result;
      } catch (e) {
        const result = { venda: r.venda, tipo: r.tipoNF, sucesso: false, mensagem: e.message };
        res[r.idx] = result;
        setProgresso(p => ({ ...p, atual: p.atual + 1 }));
        return result;
      }
    });

    await runParallel(homologTasks, CONCURRENCY);

    setResultados(res);
    setEmitindo(false);
    setConcluido(true);

    try {
      const notasFrescas = await base44.entities.NotaFiscal.list('-created_date', 1000);
      setNotasFinais(notasFrescas);
    } catch (_) {}
  };

  const tiposParaFiltro = ['NFSe', 'NFe', 'NFCe'];
  const clientesParaFiltro = ['PF', 'PJ', 'Consumidor'];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold">Emissão de NF em Massa</h2>
            <p className="text-gray-500 text-xs mt-0.5">{vendasFiltradas.length} de {vendasElegiveis.length} vendas · selecione os tipos por venda</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {!concluido ? (
          <>
            {/* Filtros */}
            <div className="px-5 py-3 border-b border-gray-800 flex-shrink-0 space-y-2">
              {/* Filtro por tipo de NF */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 flex-shrink-0">Tipo NF:</span>
                <div className="flex gap-1">
                  {['Todos', ...tiposParaFiltro].map(t => (
                    <button key={t} onClick={() => setFiltroTipo(t)}
                      className="px-3 py-1 rounded text-xs font-bold border transition-all"
                      style={{
                        background: filtroTipo === t ? (TIPO_COLORS[t] || '#062C9B') : 'transparent',
                        borderColor: filtroTipo === t ? (TIPO_COLORS[t] || '#062C9B') : '#374151',
                        color: filtroTipo === t ? '#000' : '#9ca3af'
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* Filtro por tipo de cliente */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 flex-shrink-0">Cliente:</span>
                <div className="flex gap-1">
                  {['Todos', ...clientesParaFiltro].map(t => (
                    <button key={t} onClick={() => setFiltroCliente(t)}
                      className="px-3 py-1 rounded text-xs font-bold border transition-all"
                      style={{
                        background: filtroCliente === t ? '#062C9B' : 'transparent',
                        borderColor: filtroCliente === t ? '#062C9B' : '#374151',
                        color: '#9ca3af'
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 sticky top-0 bg-gray-900 z-10">
                    <th className="px-4 py-3 text-left w-10">
                      <input type="checkbox"
                        checked={totalSelecionado > 0 && totalSelecionado === vendasFiltradas.reduce((a, v) => a + tiposDisponiveis(v, notasCarregadas, clientes).length, 0)}
                        onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-left">Nº</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {tiposParaFiltro.map(tipo => (
                          <button key={tipo} onClick={() => selecionarTodosTipo(tipo)}
                            title={`Selecionar todos ${tipo}`}
                            className="px-2 py-0.5 rounded text-xs font-bold border transition-all hover:opacity-80"
                            style={{ background: TIPO_COLORS[tipo], borderColor: TIPO_COLORS[tipo], color: '#000' }}>
                            {tipo}
                          </button>
                        ))}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasFiltradas.map(venda => {
                    const disponíveis = tiposDisponiveis(venda, notasCarregadas, clientes);
                    const selecionadosVenda = selecionadas[venda.id] || [];
                    const valorServicos = Number(venda.valor_servicos || 0);
                    const valorPecas = Number(venda.valor_pecas || 0);
                    const tcLabel = getTipoCliente(venda, clientes);
                    return (
                      <tr key={venda.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <input type="checkbox"
                            checked={selecionadosVenda.length > 0}
                            onChange={() => {
                              if (selecionadosVenda.length > 0) {
                                setSelecionadas(prev => ({ ...prev, [venda.id]: [] }));
                              } else {
                                setSelecionadas(prev => ({ ...prev, [venda.id]: [...disponíveis] }));
                              }
                            }}
                            className="rounded" />
                        </td>
                        <td className="px-4 py-3 text-white font-mono text-xs">Nº {venda.numero || venda.id.slice(-6)}</td>
                        <td className="px-4 py-3 text-white text-xs">
                          <div>{venda.cliente_nome || '—'}</div>
                          <div className="text-gray-500" style={{fontSize:10}}>{tcLabel}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {tiposParaFiltro.map(tipo => {
                              const disponivel = disponíveis.includes(tipo);
                              const marcado = selecionadosVenda.includes(tipo);
                              return (
                                <button key={tipo}
                                  disabled={!disponivel}
                                  onClick={() => disponivel && toggleTipo(venda.id, tipo)}
                                  className="px-2 py-1 rounded text-xs font-bold border transition-all"
                                  style={{
                                    opacity: !disponivel ? 0.2 : 1,
                                    cursor: !disponivel ? 'not-allowed' : 'pointer',
                                    background: marcado && disponivel ? TIPO_COLORS[tipo] : 'transparent',
                                    borderColor: marcado && disponivel ? TIPO_COLORS[tipo] : disponivel ? '#6b7280' : '#374151',
                                    color: marcado && disponivel ? '#000' : '#9ca3af',
                                  }}>
                                  {tipo}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          {valorServicos > 0 && <div style={{color:'#a78bfa'}}>S: R$ {valorServicos.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>}
                          {valorPecas > 0 && <div style={{color:'#00ff00'}}>P: R$ {valorPecas.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>}
                        </td>
                      </tr>
                    );
                  })}
                  {vendasFiltradas.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">Nenhuma venda disponível com os filtros selecionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-gray-800 flex-shrink-0 flex items-center justify-between">
              <div>
                <span className="text-gray-400 text-sm">{totalSelecionado} nota(s) selecionada(s)</span>
                {emitindo && progresso.total > 0 && (
                  <span className="text-gray-500 text-xs ml-3">{progresso.atual}/{progresso.total} enviadas</span>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white">Cancelar</button>
                <button onClick={emitir} disabled={emitindo || totalSelecionado === 0}
                  className="px-6 py-2 text-sm text-black rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                  style={{background:'#00ff00'}}>
                  {emitindo && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {emitindo ? `Homologando... (${progresso.atual}/${progresso.total})` : `Homologar ${totalSelecionado} nota(s)`}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-medium">Resultado da emissão:</p>
                <span className="text-xs text-gray-500">
                  ✓ {resultados.filter(r => r.sucesso).length} sucesso · ✗ {resultados.filter(r => !r.sucesso).length} erro
                </span>
              </div>
              {resultados.map((r, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${r.sucesso ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {r.sucesso ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-medium">Nº {r.venda.numero || r.venda.id.slice(-6)} — {r.venda.cliente_nome}</span>
                    <span className="ml-2 text-xs opacity-70">[{r.tipo}]</span>
                    {r.mensagem && <p className="text-xs mt-0.5 opacity-80">{r.mensagem}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-800 flex justify-end">
              <button onClick={() => onConcluido(notasFinais)}
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