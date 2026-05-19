import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

async function buscarNFSesRecebidas() {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
    const url = `${FOCUSNFE_BASE}/nfsens_recebidas?cnpj=${CNPJ_EMITENTE}&versao=${versaoCursor}&completa=1`;
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

    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    // Usar numero_dfse como identificador único (mais estável que id_tag)
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    const { notas: nfses, erro } = await buscarNFSesRecebidas();

    if (erro && nfses.length === 0) {
      return Response.json({ sucesso: false, erro });
    }

    let importadas = 0;
    let atualizadas = 0;

    for (const nf of nfses) {
      // Usar numero_dfse como chave de acesso (identificador único da NFSe Nacional)
      const chave = nf.numero_dfse || nf.id_tag || '';
      const situacao = (nf.status_mensagem || '').toLowerCase();
      const status = situacao.includes('cancel') ? 'Cancelada' : 'Importada';
      const data_emissao = (nf.data_emissao || nf.data_competencia || '').substring(0, 10);
      const valorTotal = parseFloat(nf.valor_servico || nf.valor_liquido || '0');

      // Filtrar notas anteriores a 01/03/2026
      if (data_emissao && data_emissao < '2026-03-01') continue;

      // Prestador = fornecedor (quem emitiu). Tomador = nossa empresa (quem recebeu o serviço)
      // Verificar todos os campos de nome disponíveis
      const nomePrestador = nf.razao_social_prestador || nf.razao_social_emitente || nf.nome_fantasia_emitente || nf.emitente_dps || '';
      const docPrestador = nf.cnpj_prestador || nf.cpf_prestador || nf.cnpj_emitente || '';
      const descricaoServico = nf.descricao_servico || nf.descricao_tributacao_nacional || '';
      const municipio = nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor || '';

      // Gerar e salvar XML com os dados da nota
      let arquivosParaSalvar = {};
      try {
        const xmlText = gerarXmlNfse(nf);
        const xmlFile = new File([xmlText], `NFSe-${chave}.xml`, { type: 'text/xml' });
        const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });
        if (uploadResp?.file_url) arquivosParaSalvar.xml_url = uploadResp.file_url;
      } catch (_) {}

      // Buscar PDF via endpoint da Focus NFe usando id_tag como chave
      const idTag = nf.id_tag || '';
      if (idTag) {
        try {
          const pdfUrl = `${FOCUSNFE_BASE}/nfsens_recebidas/${idTag}.pdf`;
          const pdfResp = await fetch(pdfUrl, { headers: { 'Authorization': AUTH_HEADER, 'accept': 'application/pdf' } });
          console.log(`[PDF] id_tag=${idTag} status=${pdfResp.status} content-type=${pdfResp.headers.get('content-type')}`);
          if (!pdfResp.ok) {
            const txt = await pdfResp.text().catch(() => '');
            console.log(`[PDF] erro body: ${txt.substring(0, 300)}`);
          } else {
            const pdfBlob = await pdfResp.blob();
            console.log(`[PDF] tamanho=${pdfBlob.size}`);
            const pdfFile = new File([pdfBlob], `NFSe-${chave}.pdf`, { type: 'application/pdf' });
            const pdfUpload = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
            if (pdfUpload?.file_url) arquivosParaSalvar.pdf_url = pdfUpload.file_url;
          }
        } catch (e) {
          console.log(`[PDF] exception: ${e.message}`);
        }
      } else {
        console.log(`[PDF] sem id_tag para nota ${chave}`);
      }

      if (chave && chavesExistentes.has(chave)) {
        // Nota já existe — atualizar XML/PDF se estiver faltando
        const notaExistente = notasExistentes.find(n => n.chave_acesso === chave);
        if (notaExistente) {
          const updates = {};
          if (!notaExistente.xml_url && arquivosParaSalvar.xml_url) updates.xml_url = arquivosParaSalvar.xml_url;
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