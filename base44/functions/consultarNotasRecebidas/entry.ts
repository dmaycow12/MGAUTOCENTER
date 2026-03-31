import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Paginação correta da Focus NFe: usa 'versao' como cursor
    // Inicia do versao=0 para buscar TODAS as notas (permite reimportar deletadas)
    let todasNotas = [];
    let versaoCursor = 0;
    let tentativas = 0;
    while (tentativas < 40) {
      tentativas++;
      const url = `${FOCUSNFE_BASE}/nfes_recebidas?cnpj=${CNPJ_EMITENTE}&versao=${versaoCursor}`;
      const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
      if (!resp.ok) {
        const txt = await resp.text();
        return Response.json({ sucesso: false, erro: `Erro Focus NFe (${resp.status}): ${txt.substring(0, 200)}` });
      }
      const lote = await resp.json();
      if (!Array.isArray(lote) || lote.length === 0) break;
      todasNotas = todasNotas.concat(lote);
      // Avança cursor para a maior versão do lote
      const maxVersaoLote = Math.max(...lote.map(n => n.versao || 0));
      if (maxVersaoLote <= versaoCursor) break; // não avançou, fim
      versaoCursor = maxVersaoLote;
      if (lote.length < 50) break; // última página
    }

    const notas = todasNotas;
    if (notas.length === 0) {
      return Response.json({ sucesso: true, mensagem: 'Nenhuma nota recebida encontrada.', importadas: 0 });
    }

    // Busca notas já existentes para evitar duplicatas
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    let importadas = 0;
    let maxVersao = 0;

    for (const nf of notas) {
      const chave = nf.chave_nfe || '';

      // Pular duplicatas por chave (se tiver chave)
      if (chave && chavesExistentes.has(chave)) continue;

      // Se não tem chave, deduplica por data+valor+fornecedor
      if (!chave) {
        const jaExiste = (await base44.asServiceRole.entities.NotaFiscal.filter({
          data_emissao: (nf.data_emissao || '').substring(0, 10),
          cliente_nome: nf.nome_emitente || 'Fornecedor',
        })).some(n => Math.abs((n.valor_total || 0) - parseFloat(nf.valor_total || '0')) < 0.01);
        if (jaExiste) continue;
      }

      const data_emissao = (nf.data_emissao || '').substring(0, 10);
      const status_nf = nf.situacao === 'cancelada' ? 'Cancelada' : 'Importada';

      // Passo 1: fazer manifestação para liberar o XML completo na SEFAZ
      if (chave) {
        try {
          await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}/manifestacoes`, {
            method: 'POST',
            headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'ciencia_operacao' }),
          });
        } catch (_) {}
        // Aguarda processamento da manifestação
        await new Promise(r => setTimeout(r, 1000));
      }

      // Passo 2: buscar XML completo tentando múltiplos endpoints
      let xmlContent = '';
      let numeroNF = '';
      let serieNF = '1';
      let formasPagamento = '';
      if (chave) {
        const endpointsXml = [
          `${FOCUSNFE_BASE}/nfes_recebidas/${chave}.xml`,
          `${FOCUSNFE_BASE}/nfes_recebidas/${chave}/xml`,
          `${FOCUSNFE_BASE}/download_nfe/${chave}`,
          `${FOCUSNFE_BASE}/nfes_recebidas/${chave}`,
        ];
        for (const url of endpointsXml) {
          try {
            const xmlResp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
            if (!xmlResp.ok) continue;
            const ct = xmlResp.headers.get('content-type') || '';
            let xmlStr = '';
            if (ct.includes('xml')) {
              xmlStr = await xmlResp.text();
            } else {
              const xmlData = await xmlResp.json().catch(() => ({}));
              xmlStr = xmlData.xml || xmlData.xml_nota || xmlData.xml_nfe || '';
              if (!xmlStr && xmlData.caminho_xml_nota_fiscal) {
                const r2 = await fetch(xmlData.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
                if (r2.ok) xmlStr = await r2.text();
              }
            }
            if (xmlStr && xmlStr.includes('<det')) {
              xmlContent = xmlStr;
              const numMatch = xmlStr.match(/<nNF>(\d+)<\/nNF>/);
              const serieMatch = xmlStr.match(/<serie>(\d+)<\/serie>/);
              if (numMatch) numeroNF = numMatch[1];
              if (serieMatch) serieNF = serieMatch[1];
              const tPagMatch = xmlStr.match(/<tPag>(\d+)<\/tPag>/);
              const tPagMap = { '01':'Dinheiro','02':'Cheque','03':'Cartão de Crédito','04':'Cartão de Débito','15':'Boleto','90':'Sem Pagamento','99':'Outros' };
              if (tPagMatch) formasPagamento = tPagMap[tPagMatch[1]] || 'Boleto';
              break; // XML completo encontrado
            }
          } catch (_) {}
        }
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFe',
        numero: numeroNF,
        serie: serieNF,
        status: status_nf,
        cliente_nome: nf.nome_emitente || 'Fornecedor',
        cliente_cpf_cnpj: nf.documento_emitente || '',
        chave_acesso: chave,
        valor_total: parseFloat(nf.valor_total || '0'),
        data_emissao,
        xml_content: xmlContent,
        forma_pagamento: formasPagamento || 'Boleto',
        observacoes: `Nota recebida via SEFAZ | Manifesto: ${nf.manifestacao_destinatario || 'pendente'}`,
        mensagem_sefaz: nf.situacao || '',
      });

      importadas++;
      chavesExistentes.add(chave);
    }


    return Response.json({
      sucesso: true,
      mensagem: importadas > 0
        ? `${importadas} nota(s) recebida(s) importada(s) da SEFAZ.`
        : `Nenhuma nota nova. Total consultado: ${notas.length}.`,
      importadas,
      total_consultadas: notas.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});