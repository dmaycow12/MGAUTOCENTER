import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, CheckCircle, AlertCircle, Loader2, ChevronRight, Package, Users, DollarSign, FileText, ShieldAlert } from "lucide-react";

const GREEN = "#00ff00";
const GREEN_DARK = "#00dd00";

function limparNamespaces(xml) {
  return xml.replace(/<(\/?)[a-zA-Z0-9_]+:([a-zA-Z0-9_]+)/g, "<$1$2");
}

function parsearXML(xmlOriginal) {
  const xml = limparNamespaces(xmlOriginal);
  const get = (tag) => { const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`)); return m ? m[1].trim() : ""; };
  const getAll = (tag) => {
    const results = []; const openTag = `<${tag}`; const closeTag = `</${tag}>`; let start = 0;
    while (true) {
      const openIdx = xml.indexOf(openTag, start); if (openIdx === -1) break;
      const tagEnd = xml.indexOf(">", openIdx); if (tagEnd === -1) break;
      const closeIdx = xml.indexOf(closeTag, tagEnd); if (closeIdx === -1) break;
      results.push(xml.substring(tagEnd + 1, closeIdx)); start = closeIdx + closeTag.length;
    }
    return results;
  };
  const chave = xml.match(/chNFe[">]*>?([0-9]{44})/)?.[1] || "";
  const numero = get("nNF"); const serie = get("serie");
  const valor = parseFloat(get("vNF") || "0");
  const dataEmissao = get("dhEmi")?.substring(0, 10) || get("dEmi") || "";
  const emitentes = [...xml.matchAll(/<xNome>([^<]*)<\/xNome>/g)];
  const emitente = emitentes[0]?.[1]?.trim() || "";
  const cnpjEmits = [...xml.matchAll(/<CNPJ>([^<]*)<\/CNPJ>/g)];
  const cnpjEmit = cnpjEmits[0]?.[1]?.trim() || "";
  const emit_logr = get("xLgr"); const emit_nro = get("nro"); const emit_bairro = get("xBairro");
  const emit_mun = get("xMun"); const emit_uf = get("UF"); const emit_cep = get("CEP");
  const emit_ie = get("IE");
  const detNodes = getAll("det");
  const itens = detNodes.map(det => {
    const xProd = det.match(/<xProd>([^<]*)<\/xProd>/)?.[1] || "";
    const qCom = parseFloat(det.match(/<qCom>([^<]*)<\/qCom>/)?.[1] || "0");
    const vUnCom = parseFloat(det.match(/<vUnCom>([^<]*)<\/vUnCom>/)?.[1] || "0");
    const vProd = parseFloat(det.match(/<vProd>([^<]*)<\/vProd>/)?.[1] || "0");
    const cProd = det.match(/<cProd>([^<]*)<\/cProd>/)?.[1] || "";
    const cEAN = det.match(/<cEAN>([^<]*)<\/cEAN>/)?.[1] || "";
    const NCM = det.match(/<NCM>([^<]*)<\/NCM>/)?.[1] || "";
    const CFOP = det.match(/<CFOP>([^<]*)<\/CFOP>/)?.[1] || "";
    const uCom = det.match(/<uCom>([^<]*)<\/uCom>/)?.[1] || "";
    const limpar = (str) => str ? str.replace(/[.\-/]/g, "") : "";
    const codigoLimpo = limpar(cProd) || ((cEAN && cEAN !== "SEM GTIN") ? limpar(cEAN) : "");
    return { descricao: xProd, quantidade: qCom, valor_unitario: vUnCom, valor_total: vProd, codigo: codigoLimpo, ncm: NCM, cfop: CFOP, unidade: uCom };
  });
  const pagamentos = [];
  for (const dp of getAll("detPag")) {
    const tPag = dp.match(/<tPag>([^<]*)<\/tPag>/)?.[1] || "";
    const vPag = parseFloat(dp.match(/<vPag>([^<]*)<\/vPag>/)?.[1] || "0");
    pagamentos.push({ tPag, vPag });
  }
  const dupNodes = getAll("dup");
  const boletos = dupNodes.map(dup => ({
    nDup: dup.match(/<nDup>([^<]*)<\/nDup>/)?.[1] || "",
    dVenc: dup.match(/<dVenc>([^<]*)<\/dVenc>/)?.[1] || "",
    vDup: parseFloat(dup.match(/<vDup>([^<]*)<\/vDup>/)?.[1] || "0"),
  }));
  const mapaForma = { "01": "Dinheiro", "02": "Cheque", "03": "Cartão de Crédito", "04": "Cartão de Débito", "15": "Boleto", "17": "PIX", "99": "Outros" };
  let forma_pagamento_detectada = boletos.length > 0 ? "Boleto" : "PIX";
  if (pagamentos.length > 0) forma_pagamento_detectada = mapaForma[pagamentos[0].tPag] || forma_pagamento_detectada;
  return { chave, numero, serie, valor, dataEmissao, emitente, cnpjEmit, emit_logr, emit_nro, emit_bairro, emit_mun, emit_uf, emit_cep, emit_ie, itens, boletos, forma_pagamento_detectada };
}

export default function ModalLancamentoMassa({ notas, onClose, onConcluido }) {
  const [selecionadas, setSelecionadas] = useState(() => new Set(notas.map(n => n.id)));
  const [cadastrarFornecedores, setCadastrarFornecedores] = useState(true);
  const [cadastrarProdutos, setCadastrarProdutos] = useState(true);
  const [statusPagamento, setStatusPagamento] = useState("Pendente");
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, label: "" });

  // Cadastros dos fornecedores das notas — para toggle de permite_lancamento_massa
  const [cadastrosDB, setCadastrosDB] = useState([]);
  const [fornecedoresNotas, setFornecedoresNotas] = useState([]); // { cnpj, nome, cadastroId, permite }
  const [loadingCadastros, setLoadingCadastros] = useState(true);

  useEffect(() => {
    base44.entities.Cadastro.list("-created_date", 500).then(cads => {
      setCadastrosDB(cads);
      // Mapear fornecedores únicos das notas (pelo nome do cliente)
      const vistos = new Set();
      const lista = [];
      for (const nota of notas) {
        const key = nota.cliente_nome || nota.numero;
        if (vistos.has(key)) continue;
        vistos.add(key);
        // Tenta achar no cadastro pelo nome
        const cad = cads.find(c => c.nome?.toLowerCase() === nota.cliente_nome?.toLowerCase() && c.categoria === "Fornecedor");
        lista.push({
          key,
          nome: nota.cliente_nome || "Fornecedor",
          cadastroId: cad?.id || null,
          permite: cad ? (cad.permite_lancamento_massa !== false) : true, // default true
        });
      }
      setFornecedoresNotas(lista);
      setLoadingCadastros(false);
    });
  }, []);

  // CNPJs dos fornecedores que NÃO permitem lançamento em massa
  const fornecedoresBloqueados = new Set(
    fornecedoresNotas.filter(f => !f.permite).map(f => f.nome?.toLowerCase())
  );

  // Notas cujo fornecedor está bloqueado (não permitir seleção)
  const notasBloqueadas = new Set(
    notas.filter(n => fornecedoresBloqueados.has(n.cliente_nome?.toLowerCase())).map(n => n.id)
  );

  const notasSelecionadas = notas.filter(n => selecionadas.has(n.id) && !notasBloqueadas.has(n.id));

  const toggleNota = (id) => {
    if (notasBloqueadas.has(id)) return;
    setSelecionadas(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleTodas = () => {
    const disponiveis = notas.filter(n => !notasBloqueadas.has(n.id)).map(n => n.id);
    if (selecionadas.size === disponiveis.length) setSelecionadas(new Set());
    else setSelecionadas(new Set(disponiveis));
  };

  const togglePermiteFornecedor = async (idx) => {
    const forn = fornecedoresNotas[idx];
    const novoPermite = !forn.permite;
    const novaLista = fornecedoresNotas.map((f, i) => i === idx ? { ...f, permite: novoPermite } : f);
    setFornecedoresNotas(novaLista);

    // Salvar no banco se o cadastro existe
    if (forn.cadastroId) {
      await base44.entities.Cadastro.update(forn.cadastroId, { permite_lancamento_massa: novoPermite });
    }

    // Se bloqueou, desmarcar as notas desse fornecedor
    if (!novoPermite) {
      setSelecionadas(prev => {
        const s = new Set(prev);
        notas.filter(n => n.cliente_nome?.toLowerCase() === forn.nome?.toLowerCase()).forEach(n => s.delete(n.id));
        return s;
      });
    }
  };

  const processarMassa = async () => {
    if (notasSelecionadas.length === 0) return;
    setProcessando(true);
    setResultados(null);

    const [estoqueAtualDB, cadsAtualDB] = await Promise.all([
      base44.entities.Estoque.list("-created_date", 1000),
      base44.entities.Cadastro.list("-created_date", 500),
    ]);

    let estoqueAtual = [...estoqueAtualDB];
    let cadastrosAtual = [...cadsAtualDB];
    const idsUsados = new Set();
    const resultadosList = [];

    for (let idx = 0; idx < notasSelecionadas.length; idx++) {
      const nota = notasSelecionadas[idx];
      setProgresso({ atual: idx + 1, total: notasSelecionadas.length, label: nota.cliente_nome || nota.numero || "..." });

      let dadosXml = null;
      const resultado = { nota, ok: false, msg: "" };

      try {
        // Parsear XML se disponível (xml_content pode ser XML completo ou JSON de itens)
        if (nota.xml_content) {
          const xmlStr = nota.xml_content.trim();
          if (xmlStr.startsWith("<") || xmlStr.includes("<nfeProc") || xmlStr.includes("<NFe") || xmlStr.includes("<det")) {
            dadosXml = parsearXML(nota.xml_content);
          }
        }

        // Forma de pagamento: 1) já salvo na nota, 2) detectado do XML, 3) fallback PIX
        const formaPagamentoNota = nota.forma_pagamento || dadosXml?.forma_pagamento_detectada || "PIX";

        // 1. Cadastrar fornecedor (verifica por CNPJ e por nome para evitar duplicatas)
        if (cadastrarFornecedores && dadosXml?.emitente) {
          const cnpjLimpo = dadosXml.cnpjEmit?.replace(/\D/g, "") || "";
          const nomeEmitente = dadosXml.emitente?.toLowerCase() || "";
          const jaExiste = cadastrosAtual.find(c =>
            (cnpjLimpo && c.cpf_cnpj?.replace(/\D/g, "") === cnpjLimpo) ||
            (nomeEmitente && c.nome?.toLowerCase() === nomeEmitente)
          );
          if (!jaExiste) {
            const criado = await base44.entities.Cadastro.create({
              categoria: "Fornecedor", nome: dadosXml.emitente || nota.cliente_nome || "Fornecedor", tipo: "Pessoa Jurídica",
              cpf_cnpj: dadosXml.cnpjEmit, rg_ie: dadosXml.emit_ie || "",
              endereco: dadosXml.emit_logr || "", numero: dadosXml.emit_nro || "", bairro: dadosXml.emit_bairro || "",
              cidade: dadosXml.emit_mun || "", estado: dadosXml.emit_uf || "", cep: dadosXml.emit_cep || "",
              observacoes: "Cadastrado automaticamente via lançamento em massa",
              permite_lancamento_massa: true,
            });
            if (criado?.id) cadastrosAtual.push(criado);
          }
        }

        // 2. Entrada no estoque
        if (cadastrarProdutos && dadosXml?.itens?.length > 0) {
          for (const item of dadosXml.itens) {
            if (!item.descricao) continue;
            let existente = null;
            if (item.codigo) existente = estoqueAtual.find(e => e.codigo === item.codigo && !idsUsados.has(e.id));
            if (existente) {
              idsUsados.add(existente.id);
              const novaQtd = (existente.quantidade || 0) + item.quantidade;
              await base44.entities.Estoque.update(existente.id, { quantidade: novaQtd, valor_custo: item.valor_unitario, ncm: item.ncm || existente.ncm, cfop: item.cfop || existente.cfop });
              estoqueAtual = estoqueAtual.map(e => e.id === existente.id ? { ...e, quantidade: novaQtd } : e);
            } else {
              const criado = await base44.entities.Estoque.create({
                descricao: item.descricao, codigo: item.codigo || "", quantidade: item.quantidade,
                valor_custo: item.valor_unitario, valor_venda: item.valor_unitario,
                unidade: item.unidade || "UN", fornecedor: dadosXml.emitente || nota.cliente_nome || "",
                ncm: item.ncm || "", cfop: item.cfop || "",
              });
              if (criado?.id) { idsUsados.add(criado.id); estoqueAtual.push(criado); }
            }
          }
        }

        // 3. Marcar nota como Lançada
        const itensParaSalvar = dadosXml?.itens?.map(i => ({ descricao: i.descricao, quantidade: i.quantidade, codigo: i.codigo })) || [];
        await base44.entities.NotaFiscal.update(nota.id, {
          status: "Lançada",
          forma_pagamento: formaPagamentoNota,
          ...(itensParaSalvar.length > 0 ? { xml_content: JSON.stringify(itensParaSalvar) } : {}),
        });

        // 4. Lançamento financeiro — SEMPRE lança, independente de ter XML ou não
        const nomeForneced = dadosXml?.emitente || nota.cliente_nome || "Fornecedor";
        const valorNota = Number(nota.valor_total || dadosXml?.valor || 0);
        const dataRef = dadosXml?.dataEmissao || nota.data_emissao || new Date().toISOString().split("T")[0];
        const isBoleto = formaPagamentoNota === "Boleto" && dadosXml?.boletos?.length > 1;

        if (isBoleto) {
          for (const bol of dadosXml.boletos) {
            await base44.entities.Financeiro.create({
              tipo: "Despesa",
              categoria: "Compra de Peças / Materiais",
              descricao: `NF ${nota.numero} — ${nomeForneced}${bol.nDup ? ` (Bol. ${bol.nDup})` : ""}`,
              valor: bol.vDup,
              forma_pagamento: "Boleto",
              data_vencimento: bol.dVenc || dataRef,
              data_pagamento: "",
              status: "Pendente",
            });
          }
        } else {
          await base44.entities.Financeiro.create({
            tipo: "Despesa",
            categoria: "Compra de Peças / Materiais",
            descricao: `NF ${nota.numero} — ${nomeForneced}`,
            valor: valorNota,
            forma_pagamento: formaPagamentoNota,
            data_vencimento: dataRef,
            data_pagamento: statusPagamento === "Pago" ? new Date().toISOString().split("T")[0] : "",
            status: statusPagamento,
          });
        }

        resultado.ok = true;
        resultado.msg = `NF ${nota.numero} — ${nomeForneced} (${formaPagamentoNota})`;
      } catch (e) {
        resultado.ok = false;
        resultado.msg = `NF ${nota.numero}: ${e.message}`;
      }

      resultadosList.push(resultado);
    }

    setResultados(resultadosList);
    setProcessando(false);
  };

  const sucessos = resultados?.filter(r => r.ok).length || 0;
  const erros = resultados?.filter(r => !r.ok).length || 0;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl flex flex-col" style={{maxHeight: "90vh"}}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Lançamento em Massa</h2>
            <p className="text-gray-500 text-xs mt-0.5">{notas.length} nota(s) disponíveis · forma de pagamento individual por XML</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* RESULTADO FINAL */}
          {resultados && (
            <div className="space-y-3">
              <div className={`rounded-xl p-4 border ${sucessos === resultados.length ? "bg-green-500/10 border-green-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
                <p className="font-semibold text-white mb-1">
                  {sucessos === resultados.length ? "✅ Lançamento concluído!" : "⚠️ Concluído com erros"}
                </p>
                <p className="text-sm text-gray-300">{sucessos} lançada(s) com sucesso · {erros} erro(s)</p>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5">
                {resultados.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${r.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {r.ok ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span>{r.msg}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { onConcluido?.(); onClose(); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-all"
                style={{ background: GREEN }}
                onMouseEnter={e => e.currentTarget.style.background = GREEN_DARK}
                onMouseLeave={e => e.currentTarget.style.background = GREEN}>
                Fechar e Atualizar
              </button>
            </div>
          )}

          {/* PROCESSANDO */}
          {processando && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: GREEN }} />
              <div className="text-center">
                <p className="text-white font-medium">Processando {progresso.atual} de {progresso.total}...</p>
                <p className="text-gray-400 text-sm mt-1 truncate max-w-xs">{progresso.label}</p>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ background: GREEN, width: `${(progresso.atual / progresso.total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* CONFIGURAÇÃO */}
          {!processando && !resultados && (
            <>
              {/* Controle por Fornecedor */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <p className="text-sm font-medium text-white">Fornecedores</p>
                  <span className="text-xs text-gray-500">— ative/desative o lançamento em massa por fornecedor</span>
                </div>
                {loadingCadastros ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 bg-gray-800/50 rounded-xl p-3">
                    {fornecedoresNotas.map((forn, idx) => (
                      <div key={forn.key} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-all">
                        <button
                          onClick={() => togglePermiteFornecedor(idx)}
                          className={`w-9 h-5 rounded-full transition-all flex-shrink-0 relative ${forn.permite ? "bg-green-500" : "bg-red-600"}`}
                          title={forn.permite ? "Clique para bloquear" : "Clique para permitir"}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${forn.permite ? "left-4" : "left-0.5"}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm truncate block ${forn.permite ? "text-white" : "text-gray-500 line-through"}`}>{forn.nome}</span>
                          {!forn.permite && <span className="text-xs text-red-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Bloqueado para lançamento em massa</span>}
                        </div>
                        <span className="text-xs text-gray-600 flex-shrink-0">
                          {notas.filter(n => n.cliente_nome?.toLowerCase() === forn.nome?.toLowerCase()).length} nota(s)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seleção de notas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Notas para Lançar</p>
                  <button onClick={toggleTodas} className="text-xs text-gray-400 hover:text-white underline transition-all">
                    {notasSelecionadas.length === notas.filter(n => !notasBloqueadas.has(n.id)).length ? "Desmarcar todas" : "Selecionar todas"}
                  </button>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 bg-gray-800/50 rounded-xl p-3">
                  {notas.map(nota => {
                    const bloqueada = notasBloqueadas.has(nota.id);
                    return (
                      <label key={nota.id} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-all ${bloqueada ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-gray-800"}`}>
                        <input type="checkbox" checked={selecionadas.has(nota.id) && !bloqueada} onChange={() => toggleNota(nota.id)} disabled={bloqueada} className="accent-green-500 w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-white text-sm truncate block">{nota.cliente_nome || "—"}</span>
                          <span className="text-gray-500 text-xs">NF {nota.numero} · {nota.data_emissao || "—"}{bloqueada ? " · 🚫 bloqueado" : ""}</span>
                        </div>
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: GREEN }}>
                          R$ {Number(nota.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">{notasSelecionadas.length} selecionada(s) · {notasBloqueadas.size} bloqueada(s)</p>
              </div>

              {/* Opções */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-white mb-1">Opções de Lançamento</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={cadastrarFornecedores} onChange={e => setCadastrarFornecedores(e.target.checked)} className="accent-green-500 w-4 h-4" />
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300">Cadastrar fornecedores novos automaticamente</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={cadastrarProdutos} onChange={e => setCadastrarProdutos(e.target.checked)} className="accent-green-500 w-4 h-4" />
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-gray-300">Dar entrada dos produtos no estoque</span>
                  </div>
                </label>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status do Pagamento</label>
                  <select value={statusPagamento} onChange={e => setStatusPagamento(e.target.value)} className="input-dark">
                    <option value="Pendente">Pendente</option>
                    <option value="Pago">Pago</option>
                    <option value="Atrasado">Atrasado</option>
                  </select>
                </div>
              </div>

              {/* Resumo */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 space-y-1.5 text-xs text-gray-400">
                <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-blue-400" /> {notasSelecionadas.length} nota(s) serão marcadas como <span className="text-white font-medium">Lançada</span></div>
                <div className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-yellow-400" /> Forma de pagamento <span className="text-white font-medium">detectada individualmente no XML</span> de cada nota</div>
                {cadastrarFornecedores && <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-blue-400" /> Fornecedores novos serão cadastrados automaticamente</div>}
                {cadastrarProdutos && <div className="flex items-center gap-2"><Package className="w-3.5 h-3.5 text-orange-400" /> Produtos entrarão no estoque (novos serão criados)</div>}
              </div>

              <button
                onClick={processarMassa}
                disabled={notasSelecionadas.length === 0}
                className="w-full py-3 rounded-xl text-sm font-bold text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: GREEN }}
                onMouseEnter={e => { if (notasSelecionadas.length > 0) e.currentTarget.style.background = GREEN_DARK; }}
                onMouseLeave={e => e.currentTarget.style.background = GREEN}
              >
                <ChevronRight className="w-4 h-4" />
                Lançar {notasSelecionadas.length} Nota(s) em Massa
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`.input-dark{width:100%;background:#1f2937;border:1px solid #374151;color:#fff;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input-dark:focus{border-color:#00ff00}.input-dark::placeholder{color:#6b7280}`}</style>
    </div>
  );
}