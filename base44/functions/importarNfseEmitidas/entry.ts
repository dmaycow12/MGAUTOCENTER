import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

function normalizarUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return 'https://api.focusnfe.com.br' + url;
  return url;
}

async function buscarNfseEmitidas(cnpjPrestador) {
  // Tenta múltiplos endpoints pois Focus NFe tem versões diferentes de NFSe
  const endpoints = [
    `${FOCUSNFE_BASE}/nfsen?cnpj_prestador=${cnpjPrestador}&versao=0&completo=1`,
    `${FOCUSNFE_BASE}/nfse?cnpj=${cnpjPrestador}&versao=0&completo=1`,
    `${FOCUSNFE_BASE}/nfse?cnpj_emitente=${cnpjPrestador}&versao=0&completo=1`,
  ];

  for (const urlBase of endpoints) {
    let todas = [];
    let versaoCursor = 0;
    let funcionou = false;
    for (let i = 0; i < 50; i++) {
      const url = urlBase.replace('versao=0', `versao=${versaoCursor}`);
      const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
      if (!resp.ok) {
        console.log(`[NFSEN LIST] Endpoint ${url.split('?')[0]} retornou ${resp.status}`);
        break;
      }
      const lote = await resp.json().catch(() => []);
      console.log(`[NFSEN LIST] Endpoint OK, versao=${versaoCursor}, ${Array.isArray(lote) ? lote.length : 0} registros`);
      funcionou = true;
      if (!Array.isArray(lote) || lote.length === 0) break;
      todas = todas.concat(lote);
      const maxVersionHeader = resp.headers.get('X-Max-Version');
      if (!maxVersionHeader) break;
      const maxVersao = parseInt(maxVersionHeader, 10);
      if (isNaN(maxVersao) || maxVersao <= versaoCursor) break;
      versaoCursor = maxVersao;
      if (lote.length < 100) break;
    }
    if (funcionou) return { notas: todas, erro: null };
  }
  return { notas: [], erro: 'Nenhum endpoint de listagem disponível' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });

    const allConfigs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const getConf = (chave, padrao = '') => allConfigs.find(c => c.chave === chave)?.valor || padrao;
    const CNPJ_EMITENTE = getConf('cnpj', '').replace(/\D/g, '');
    if (!CNPJ_EMITENTE) return Response.json({ sucesso: false, erro: 'CNPJ da empresa não configurado' }, { status: 400 });

    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const speudyIdsExistentes = new Set(notasExistentes.map(n => n.spedy_id).filter(Boolean));
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    const { notas, erro } = await buscarNfseEmitidas(CNPJ_EMITENTE);

    if (erro && notas.length === 0) {
      return Response.json({ sucesso: false, erro: `Erro ao buscar NFSe emitidas: ${erro}` });
    }

    let importadas = 0;
    let ignoradas = 0;

    for (const nf of notas) {
      const ref = nf.ref || '';
      const chave = nf.chave_nfse || nf.chave_nfe || nf.id_tag || '';
      const situacao = (nf.status || '').toLowerCase();

      // Pula notas que não são autorizadas ou canceladas
      if (!['autorizado', 'cancelado'].includes(situacao)) {
        ignoradas++;
        continue;
      }

      // Pula se já existe por ref ou chave
      if ((ref && speudyIdsExistentes.has(ref)) || (chave && chavesExistentes.has(chave))) {
        ignoradas++;
        continue;
      }

      const statusNota = situacao === 'cancelado' ? 'Cancelada' : 'Emitida';
      const data_emissao = (nf.data_emissao || nf.data_competencia || '').substring(0, 10);
      const valorTotal = parseFloat(nf.valor_servico || nf.valor_liquido || nf.valor_total || '0');
      const clienteNome = nf.razao_social_tomador || nf.nome_tomador || '';
      const clienteDoc = nf.cnpj_tomador || nf.cpf_tomador || '';
      const numero = nf.numero || nf.numero_dfse || nf.numero_dps || '';
      const descricao = nf.descricao_servico || nf.discriminacao || '';

      let pdfUrlFinal = '';
      let xmlUrlFinal = '';

      // Tentar salvar PDF
      const rawPdf = nf.caminho_pdf_nfsen || nf.url_danfse || nf.caminho_pdf_nfse || '';
      if (rawPdf) {
        const pdfUrl = normalizarUrl(rawPdf);
        try {
          const pdfResp = await fetch(pdfUrl, { headers: { 'Authorization': AUTH_HEADER } });
          if (pdfResp.ok) {
            const pdfBlob = await pdfResp.blob();
            const pdfFile = new File([pdfBlob], `NFSe-${numero || ref}.pdf`, { type: 'application/pdf' });
            const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
            if (uploadResp?.file_url) pdfUrlFinal = uploadResp.file_url;
          }
        } catch (_) {}
      }

      // Tentar salvar XML
      const rawXml = nf.caminho_xml_nota_fiscal || nf.caminho_xml || '';
      if (rawXml) {
        const xmlUrl = normalizarUrl(rawXml);
        try {
          const xmlResp = await fetch(xmlUrl, { headers: { 'Authorization': AUTH_HEADER } });
          if (xmlResp.ok) {
            const xmlText = await xmlResp.text();
            if (xmlText.trim().startsWith('<')) {
              const xmlFile = new File([xmlText], `NFSe-${numero || ref}.xml`, { type: 'text/xml' });
              const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });
              if (uploadResp?.file_url) xmlUrlFinal = uploadResp.file_url;
            }
          }
        } catch (_) {}
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFSe',
        numero: String(numero),
        serie: nf.serie_dps || '900',
        status: statusNota,
        spedy_id: ref,
        chave_acesso: chave,
        cliente_nome: clienteNome,
        cliente_cpf_cnpj: clienteDoc,
        valor_total: valorTotal,
        data_emissao,
        observacoes: descricao ? descricao.substring(0, 500) : '',
        mensagem_sefaz: nf.mensagem_sefaz || '',
        pdf_url: pdfUrlFinal,
        xml_url: xmlUrlFinal || undefined,
      });

      importadas++;
      if (ref) speudyIdsExistentes.add(ref);
      if (chave) chavesExistentes.add(chave);
    }

    return Response.json({
      sucesso: true,
      mensagem: importadas > 0
        ? `${importadas} NFSe(s) emitida(s) importada(s) com sucesso!`
        : `Nenhuma NFSe nova encontrada. (${notas.length} consultadas, ${ignoradas} já existiam/processando)`,
      importadas,
      consultadas: notas.length,
      ignoradas,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});