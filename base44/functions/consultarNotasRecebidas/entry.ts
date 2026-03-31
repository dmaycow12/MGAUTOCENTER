import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Busca todas as páginas para permitir reimportar notas deletadas
    let todasNotas = [];
    let pagina = 1;
    while (true) {
      const url = `${FOCUSNFE_BASE}/nfes_recebidas?cnpj=${CNPJ_EMITENTE}&pagina=${pagina}`;
      const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
      if (!resp.ok) {
        const txt = await resp.text();
        return Response.json({ sucesso: false, erro: `Erro Focus NFe (${resp.status}): ${txt.substring(0, 200)}` });
      }
      const lote = await resp.json();
      if (!Array.isArray(lote) || lote.length === 0) break;
      todasNotas = todasNotas.concat(lote);
      if (lote.length < 50) break; // última página
      pagina++;
      if (pagina > 20) break; // limite de segurança
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

      // Buscar XML completo da nota para extrair itens e pagamento
      let xmlContent = '';
      let numeroNF = '';
      let serieNF = '1';
      let formasPagamento = '';
      try {
        const xmlResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (xmlResp.ok) {
          const contentType = xmlResp.headers.get('content-type') || '';
          let xmlStr = '';
          if (contentType.includes('xml')) {
            xmlStr = await xmlResp.text();
          } else {
            const xmlData = await xmlResp.json().catch(() => ({}));
            xmlStr = xmlData.xml || xmlData.xml_nota || xmlData.xml_nfe || '';
          }
          if (xmlStr) {
            xmlContent = xmlStr;
            // Extrair número e série do XML
            const numMatch = xmlStr.match(/<nNF>(\d+)<\/nNF>/);
            const serieMatch = xmlStr.match(/<serie>(\d+)<\/serie>/);
            if (numMatch) numeroNF = numMatch[1];
            if (serieMatch) serieNF = serieMatch[1];
            // Extrair forma de pagamento
            const tPagMatch = xmlStr.match(/<tPag>(\d+)<\/tPag>/);
            const tPagMap = { '01':'Dinheiro','02':'Cheque','03':'Cart\u00e3o de Cr\u00e9dito','04':'Cart\u00e3o de D\u00e9bito','15':'Boleto','90':'Sem Pagamento','99':'Outros' };
            if (tPagMatch) formasPagamento = tPagMap[tPagMatch[1]] || 'Boleto';
          }
        }
      } catch (_) {}

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