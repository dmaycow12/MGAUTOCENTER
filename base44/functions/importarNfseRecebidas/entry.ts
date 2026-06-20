import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
let API_KEY = '';
let AUTH_HEADER = '';

async function buscarNFSesRecebidas(cnpjEmitente) {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
    const url = `${FOCUSNFE_BASE}/nfsens_recebidas?cnpj=${cnpjEmitente}&versao=${versaoCursor}&completa=1`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { notas: todas, erro: `Erro ${resp.status}: ${txt}` };
    }
    const lote = await resp.json().catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas = todas.concat(lote);
    const maxVersionHeader = resp.headers.get('X-Max-Version');
    if (!maxVersionHeader) break;
    const maxVersao = parseInt(maxVersionHeader, 10);
    if (isNaN(maxVersao) || maxVersao <= versaoCursor) break;
    versaoCursor = maxVersao;
    if (lote.length < 100) break;
  }
  return { notas: todas, erro: null };
}

// Gera um XML simples com os dados da NFSe Nacional
function gerarXmlNfse(nf) {
  const esc = (v) => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSeNacional>
  <IdentificacaoNFSe>
    <Numero>${esc(nf.numero_dfse || nf.numero)}</Numero>
    <ChaveAcesso>${esc(nf.id_tag)}</ChaveAcesso>
    <DataEmissao>${esc(nf.data_emissao)}</DataEmissao>
    <DataCompetencia>${esc(nf.data_competencia)}</DataCompetencia>
  </IdentificacaoNFSe>
  <Prestador>
    <CNPJ>${esc(nf.cnpj_prestador)}</CNPJ>
    <RazaoSocial>${esc(nf.razao_social_prestador)}</RazaoSocial>
    <NomeFantasia>${esc(nf.nome_fantasia_emitente)}</NomeFantasia>
    <Municipio>${esc(nf.descricao_municipio_emissor)}</Municipio>
    <UF>${esc(nf.uf_emitente)}</UF>
    <Email>${esc(nf.email_prestador)}</Email>
  </Prestador>
  <Tomador>
    <CNPJ>${esc(nf.cnpj_tomador)}</CNPJ>
    <CPF>${esc(nf.cpf_tomador)}</CPF>
    <RazaoSocial>${esc(nf.razao_social_tomador)}</RazaoSocial>
    <Municipio>${esc(nf.codigo_municipio_tomador)}</Municipio>
  </Tomador>
  <Servico>
    <Descricao>${esc(nf.descricao_servico)}</Descricao>
    <DescricaoTributacaoNacional>${esc(nf.descricao_tributacao_nacional)}</DescricaoTributacaoNacional>
    <InformacoesComplementares>${esc(nf.informacoes_complementares)}</InformacoesComplementares>
    <ValorServico>${esc(nf.valor_servico)}</ValorServico>
    <ValorLiquido>${esc(nf.valor_liquido)}</ValorLiquido>
    <BaseCalculoISS>${esc(nf.iss_base_calculo)}</BaseCalculoISS>
  </Servico>
</NFSeNacional>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Carrega CNPJ e API KEY das configurações
    const allConfigs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const getConf = (chave, padrao = '') => allConfigs.find(c => c.chave === chave)?.valor || padrao;
    API_KEY = getConf('focusnfe_api_key_producao', '');
    AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
    const CNPJ_EMITENTE = getConf('cnpj', '').replace(/\D/g, '');
    if (!CNPJ_EMITENTE) return Response.json({ sucesso: false, erro: 'CNPJ da empresa não configurado' }, { status: 400 });

    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    const { notas: nfses, erro } = await buscarNFSesRecebidas(CNPJ_EMITENTE);

    if (erro && nfses.length === 0) {
      return Response.json({ sucesso: false, erro });
    }

    let importadas = 0;
    let atualizadas = 0;

    for (const nf of nfses) {
      const chave = nf.numero_dfse || nf.id_tag || '';
      const situacao = (nf.status_mensagem || '').toLowerCase();
      const status = situacao.includes('cancel') ? 'Cancelada' : 'Importada';
      const data_emissao = (nf.data_emissao || nf.data_competencia || '').substring(0, 10);
      const valorTotal = parseFloat(nf.valor_servico || nf.valor_liquido || '0');

      if (data_emissao && data_emissao < '2026-04-01') continue;

      const nomePrestador = nf.razao_social_prestador || nf.razao_social_emitente || nf.nome_fantasia_emitente || nf.emitente_dps || '';
      const docPrestador = nf.cnpj_prestador || nf.cpf_prestador || nf.cnpj_emitente || '';
      const descricaoServico = nf.descricao_servico || nf.descricao_tributacao_nacional || '';
      const municipio = nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor || '';

      let arquivosParaSalvar = {};
      try {
        const xmlText = gerarXmlNfse(nf);
        arquivosParaSalvar.xml_original = xmlText;
      } catch (_) {}

      // Tenta buscar DANFSe HTML e converter para PDF via Gotenberg
      const idTag = nf.id_tag || chave;
      if (idTag && idTag.startsWith('NFS')) {
        try {
          // Tenta PDF direto primeiro
          const pdfResp = await fetch(`${FOCUSNFE_BASE}/nfsens_recebidas/${encodeURIComponent(idTag)}.pdf`, {
            headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/pdf' },
            redirect: 'follow',
          });
          if (pdfResp.ok) {
            const buf = await pdfResp.arrayBuffer();
            const h = new Uint8Array(buf, 0, 4);
            if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) {
              const pdfFile = new File([buf], `nfse_${idTag}.pdf`, { type: 'application/pdf' });
              const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
              arquivosParaSalvar.pdf_url = file_url;
            }
          }

          // Se não conseguiu PDF direto, tenta via HTML + Gotenberg
          if (!arquivosParaSalvar.pdf_url) {
            const htmlResp = await fetch(`${FOCUSNFE_BASE}/nfsens_recebidas/${encodeURIComponent(idTag)}.html`, {
              headers: { 'Authorization': AUTH_HEADER, 'Accept': 'text/html' },
              redirect: 'follow',
            });
            if (htmlResp.ok) {
              const htmlContent = await htmlResp.text();
              const formData = new FormData();
              const htmlBlob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
              formData.append('files', htmlBlob, 'index.html');
              formData.append('paperWidth', '8.5');
              formData.append('paperHeight', '11');
              formData.append('marginTop', '0.3');
              formData.append('marginBottom', '0.3');
              formData.append('marginLeft', '0.3');
              formData.append('marginRight', '0.3');
              const gotResp = await fetch('https://gotenberg.spedy.com.br/forms/chromium/convert/html', {
                method: 'POST',
                body: formData,
              });
              if (gotResp.ok) {
                const pdfBuf = await gotResp.arrayBuffer();
                const h = new Uint8Array(pdfBuf, 0, 4);
                if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) {
                  const pdfFile = new File([pdfBuf], `nfse_${idTag}.pdf`, { type: 'application/pdf' });
                  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
                  arquivosParaSalvar.pdf_url = file_url;
                }
              }
            }
          }
        } catch (_) {}
      }

      if (chave && chavesExistentes.has(chave)) {
        const notaExistente = notasExistentes.find(n => n.chave_acesso === chave);
        if (notaExistente) {
          const updates = {};
          if (!notaExistente.xml_original && arquivosParaSalvar.xml_original) updates.xml_original = arquivosParaSalvar.xml_original;
          if (!notaExistente.pdf_url && arquivosParaSalvar.pdf_url) updates.pdf_url = arquivosParaSalvar.pdf_url;
          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.NotaFiscal.update(notaExistente.id, updates);
            atualizadas++;
          }
        }
        continue;
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFSe',
        numero: nf.numero_dfse || nf.numero || '',
        serie: nf.serie_dps || '1',
        status,
        chave_acesso: chave,
        spedy_id: chave,
        cliente_nome: nomePrestador,
        cliente_cpf_cnpj: docPrestador,
        valor_total: valorTotal,
        data_emissao,
        observacoes: [
          descricaoServico ? `Serviço: ${descricaoServico}` : null,
          municipio ? `Município: ${municipio}` : null,
        ].filter(Boolean).join(' | '),
        mensagem_sefaz: nf.status_mensagem || '',
        ...arquivosParaSalvar,
      });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    return Response.json({
      sucesso: true,
      mensagem: [
        importadas > 0 ? `${importadas} NFSe(s) importada(s).` : null,
        atualizadas > 0 ? `${atualizadas} NFSe(s) atualizada(s) com XML.` : null,
        importadas === 0 && atualizadas === 0 ? `Nenhuma NFSe nova. ${nfses.length} nota(s) consultada(s).` : null,
        erro ? `Aviso: ${erro}` : null,
      ].filter(Boolean).join(' '),
      importadas,
      atualizadas,
      consultadas: nfses.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});