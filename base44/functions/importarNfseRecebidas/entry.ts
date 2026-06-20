import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';

function gerarHtmlDanfseLocal(nf) {
  const fmt = (v) => (v != null && v !== '') ? String(v) : '-';
  const fmtMoeda = (v) => v ? `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
  const fmtData = (v) => { if (!v) return '-'; const d = v.substring(0, 10); const [ano, mes, dia] = d.split('-'); return `${dia}/${mes}/${ano}`; };
  const fmtDataHora = (v) => { if (!v) return '-'; const [data, hora] = v.split('T'); if (!data) return '-'; const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}${hora ? ' ' + hora.substring(0,8) : ''}`; };
  const fmtCnpj = (v) => { if (!v) return '-'; const c = v.replace(/\D/g, ''); if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); return v; };

  const prestNome = fmt(nf.razao_social_prestador || nf.razao_social_emitente);
  const prestCnpj = fmtCnpj(nf.cnpj_prestador || nf.cnpj_emitente || nf.cpf_prestador);
  const prestIm = fmt(nf.inscricao_municipal_prestador || nf.inscricao_municipal_emitente);
  const prestEmail = fmt(nf.email_prestador || nf.email_emitente);
  const prestFone = fmt(nf.telefone_prestador || nf.fone_prestador);
  const prestEnd = [nf.logradouro_prestador || nf.logradouro_emitente, nf.numero_prestador || nf.numero_emitente, nf.bairro_prestador || nf.bairro_emitente].filter(Boolean).join(', ') || '-';
  const prestMunicipio = fmt(nf.descricao_municipio_prestador || nf.descricao_municipio_emissor);
  const prestUf = fmt(nf.uf_prestador || nf.uf_emitente);
  const prestCep = fmt(nf.cep_prestador || nf.cep_emitente);
  const tomNome = fmt(nf.razao_social_tomador);
  const tomCnpj = fmtCnpj(nf.cnpj_tomador || nf.cpf_tomador);
  const tomIm = fmt(nf.inscricao_municipal_tomador);
  const tomEmail = fmt(nf.email_tomador);
  const tomFone = fmt(nf.telefone_tomador);
  const tomEnd = [nf.logradouro_tomador, nf.numero_tomador, nf.bairro_tomador].filter(Boolean).join(', ') || '-';
  const tomMunicipio = fmt(nf.descricao_municipio_tomador);
  const tomCep = fmt(nf.cep_tomador);
  const municipioEmissor = fmt(nf.descricao_municipio_emissor || nf.descricao_municipio_prestacao);
  const uf = fmt(nf.uf_emitente || nf.uf_prestador);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; background: #fff; padding: 12px 16px; }
  .cabecalho { display: flex; align-items: center; border: 1px solid #000; margin-bottom: 0; }
  .cab-logo { width: 90px; min-width: 90px; border-right: 1px solid #000; display: flex; align-items: center; justify-content: center; padding: 6px; }
  .cab-logo svg { width: 70px; height: 70px; }
  .cab-centro { flex: 1; text-align: center; border-right: 1px solid #000; padding: 6px 4px; }
  .cab-centro .doc-titulo { font-size: 12px; font-weight: bold; }
  .cab-centro .doc-sub { font-size: 10px; font-weight: bold; }
  .cab-direita { width: 180px; min-width: 180px; padding: 6px 8px; font-size: 8px; line-height: 1.5; }
  .cab-direita .mun-nome { font-weight: bold; font-size: 9px; }
  .bloco-chave { border: 1px solid #000; border-top: none; padding: 4px 8px; }
  .bloco-chave .label-chave { font-size: 7.5px; font-weight: bold; text-transform: uppercase; }
  .bloco-chave .valor-chave { font-family: monospace; font-size: 8.5px; letter-spacing: 0.5px; }
  .bloco-ids { display: flex; border: 1px solid #000; border-top: none; }
  .bloco-ids .id-item { flex: 1; padding: 4px 8px; border-right: 1px solid #000; }
  .bloco-ids .id-item:last-child { border-right: none; }
  .id-label { font-size: 7.5px; font-weight: bold; }
  .id-valor { font-size: 9px; font-weight: bold; }
  .id-valor-sm { font-size: 8.5px; }
  .secao { border: 1px solid #000; border-top: none; }
  .secao-header { background: #f0f0f0; border-bottom: 1px solid #000; padding: 2px 8px; font-size: 8px; font-weight: bold; text-transform: uppercase; }
  .linha { display: flex; border-bottom: 1px solid #ddd; }
  .linha:last-child { border-bottom: none; }
  .cel { flex: 1; padding: 3px 8px; border-right: 1px solid #ddd; }
  .cel:last-child { border-right: none; }
  .cel-label { font-size: 7px; font-weight: bold; text-transform: uppercase; color: #444; margin-bottom: 1px; }
  .cel-valor { font-size: 8.5px; }
  .cel-valor-bold { font-size: 9px; font-weight: bold; }
  .bloco-total { border: 1px solid #000; border-top: none; display: flex; align-items: center; justify-content: space-between; padding: 5px 12px; background: #f8f8f8; }
  .total-label { font-size: 10px; font-weight: bold; text-transform: uppercase; }
  .total-valor { font-size: 13px; font-weight: bold; }
  .rodape { border: 1px solid #000; border-top: 1px solid #ccc; padding: 4px 8px; font-size: 7.5px; color: #555; text-align: center; }
  @media print { body { padding: 0; } @page { margin: 10mm; size: A4; } }
</style>
</head>
<body>
  <div class="cabecalho">
    <div class="cab-logo">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" stroke="#1a3a6b" stroke-width="3"/>
        <text x="50" y="38" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="11" fill="#1a3a6b">NFS-e</text>
        <text x="50" y="52" text-anchor="middle" font-family="Arial" font-size="7" fill="#1a3a6b">Nota Fiscal de</text>
        <text x="50" y="62" text-anchor="middle" font-family="Arial" font-size="7" fill="#1a3a6b">Serviço eletrônica</text>
      </svg>
    </div>
    <div class="cab-centro">
      <div class="doc-titulo">DANFSe v1.0</div>
      <div class="doc-sub">Documento Auxiliar da NFS-e</div>
    </div>
    <div class="cab-direita">
      <div class="mun-nome">MUNICÍPIO DE ${municipioEmissor.toUpperCase()}</div>
      <div>${uf.toUpperCase()}</div>
      <div>Secretaria Municipal de Finanças</div>
    </div>
  </div>
  ${nf.id_tag ? `<div class="bloco-chave"><div class="label-chave">Chave de Acesso da NFS-e</div><div class="valor-chave">${fmt(nf.id_tag)}</div></div>` : ''}
  <div class="bloco-ids">
    <div class="id-item"><div class="id-label">Número da NFS-e</div><div class="id-valor">${fmt(nf.numero || nf.numero_dfse)}</div></div>
    <div class="id-item"><div class="id-label">Competência da NFS-e</div><div class="id-valor-sm">${fmtData(nf.data_competencia || nf.data_emissao)}</div></div>
    <div class="id-item"><div class="id-label">Data e Hora da emissão</div><div class="id-valor-sm">${fmtDataHora(nf.data_emissao_completa || nf.data_emissao)}</div></div>
    <div class="id-item"><div class="id-label">Número da DPS</div><div class="id-valor-sm">${fmt(nf.numero_dfse || nf.numero)}</div></div>
  </div>
  <div class="secao">
    <div class="secao-header">EMITENTE DA NFS-e — Prestador do Serviço</div>
    <div class="linha">
      <div class="cel" style="flex:2"><div class="cel-label">Nome / Nome Empresarial</div><div class="cel-valor-bold">${prestNome}</div></div>
      <div class="cel"><div class="cel-label">CNPJ / CPF / NIF</div><div class="cel-valor">${prestCnpj}</div></div>
      <div class="cel"><div class="cel-label">Inscrição Municipal</div><div class="cel-valor">${prestIm}</div></div>
      <div class="cel"><div class="cel-label">Telefone</div><div class="cel-valor">${prestFone}</div></div>
    </div>
    <div class="linha">
      <div class="cel" style="flex:2"><div class="cel-label">Endereço</div><div class="cel-valor">${prestEnd}</div></div>
      <div class="cel"><div class="cel-label">Município</div><div class="cel-valor">${prestMunicipio} - ${prestUf}</div></div>
      <div class="cel"><div class="cel-label">CEP</div><div class="cel-valor">${prestCep}</div></div>
      <div class="cel"><div class="cel-label">E-mail</div><div class="cel-valor">${prestEmail}</div></div>
    </div>
  </div>
  <div class="secao">
    <div class="secao-header">TOMADOR DO SERVIÇO</div>
    <div class="linha">
      <div class="cel" style="flex:2"><div class="cel-label">Nome / Nome Empresarial</div><div class="cel-valor-bold">${tomNome}</div></div>
      <div class="cel"><div class="cel-label">CNPJ / CPF / NIF</div><div class="cel-valor">${tomCnpj}</div></div>
      <div class="cel"><div class="cel-label">Inscrição Municipal</div><div class="cel-valor">${tomIm}</div></div>
      <div class="cel"><div class="cel-label">Telefone</div><div class="cel-valor">${tomFone}</div></div>
    </div>
    <div class="linha">
      <div class="cel" style="flex:2"><div class="cel-label">Endereço</div><div class="cel-valor">${tomEnd}</div></div>
      <div class="cel"><div class="cel-label">Município</div><div class="cel-valor">${tomMunicipio}</div></div>
      <div class="cel"><div class="cel-label">CEP</div><div class="cel-valor">${tomCep}</div></div>
      <div class="cel"><div class="cel-label">E-mail</div><div class="cel-valor">${tomEmail}</div></div>
    </div>
  </div>
  <div class="secao">
    <div class="secao-header">SERVIÇO PRESTADO</div>
    <div class="linha">
      <div class="cel" style="flex:2"><div class="cel-label">Código de Tributação Nacional</div><div class="cel-valor">${fmt(nf.descricao_tributacao_nacional || nf.codigo_tributacao_nacional)}</div></div>
      <div class="cel"><div class="cel-label">Código de Tributação Municipal</div><div class="cel-valor">${fmt(nf.codigo_tributacao_municipio)}</div></div>
      <div class="cel"><div class="cel-label">Local da Prestação</div><div class="cel-valor">${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</div></div>
    </div>
    <div class="linha">
      <div class="cel" style="flex:1"><div class="cel-label">Descrição do Serviço</div><div class="cel-valor">${fmt(nf.descricao_servico)}</div></div>
    </div>
  </div>
  <div class="secao">
    <div class="secao-header">TRIBUTAÇÃO MUNICIPAL</div>
    <div class="linha">
      <div class="cel"><div class="cel-label">Tributação do ISSQN</div><div class="cel-valor">${fmt(nf.tributacao_iss || nf.natureza_operacao)}</div></div>
      <div class="cel"><div class="cel-label">Município de Incidência do ISSQN</div><div class="cel-valor">${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</div></div>
      <div class="cel"><div class="cel-label">Retenção do ISSQN</div><div class="cel-valor">${nf.retencao_iss ? 'Retido' : 'Não Retido'}</div></div>
      <div class="cel"><div class="cel-label">Regime Especial de Tributação</div><div class="cel-valor">${fmt(nf.regime_especial_tributacao || 'Nenhum')}</div></div>
    </div>
    <div class="linha">
      <div class="cel"><div class="cel-label">Valor do Serviço</div><div class="cel-valor">${fmtMoeda(nf.valor_servico)}</div></div>
      <div class="cel"><div class="cel-label">Desconto Incondicionado</div><div class="cel-valor">${fmtMoeda(nf.valor_desconto_incondicionado)}</div></div>
      <div class="cel"><div class="cel-label">BC ISSQN</div><div class="cel-valor">${fmtMoeda(nf.iss_base_calculo)}</div></div>
      <div class="cel"><div class="cel-label">Alíquota Aplicada</div><div class="cel-valor">${nf.aliquota_iss ? (parseFloat(nf.aliquota_iss) * 100).toFixed(2) + '%' : '-'}</div></div>
      <div class="cel"><div class="cel-label">ISSQN Apurado</div><div class="cel-valor">${fmtMoeda(nf.valor_iss)}</div></div>
    </div>
  </div>
  <div class="secao">
    <div class="secao-header">VALOR TOTAL DA NFS-E</div>
    <div class="linha">
      <div class="cel"><div class="cel-label">Valor do Serviço</div><div class="cel-valor">${fmtMoeda(nf.valor_servico)}</div></div>
      <div class="cel"><div class="cel-label">Desconto Condicionado</div><div class="cel-valor">${fmtMoeda(nf.valor_desconto_condicionado)}</div></div>
      <div class="cel"><div class="cel-label">Desconto Incondicionado</div><div class="cel-valor">${fmtMoeda(nf.valor_desconto_incondicionado)}</div></div>
      <div class="cel"><div class="cel-label">ISSQN Retido</div><div class="cel-valor">${fmtMoeda(nf.valor_iss_retido)}</div></div>
      <div class="cel"><div class="cel-label">Total das Retenções Federais</div><div class="cel-valor">${fmtMoeda(nf.valor_total_retencao)}</div></div>
    </div>
  </div>
  <div class="bloco-total">
    <span class="total-label">Valor Líquido da NFS-e</span>
    <span class="total-valor">${fmtMoeda(nf.valor_liquido || nf.valor_servico)}</span>
  </div>
  ${nf.informacoes_complementares ? `
  <div class="secao" style="border-top: 1px solid #000;">
    <div class="secao-header">INFORMAÇÕES COMPLEMENTARES</div>
    <div class="linha"><div class="cel"><div class="cel-valor">${fmt(nf.informacoes_complementares)}</div></div></div>
  </div>` : ''}
  <div class="rodape">Nota Fiscal de Serviços Eletrônica — DANFSe gerada pelo sistema | Consulte a autenticidade em nfse.gov.br</div>
</body></html>`;
}
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
    const notasParaPdf = [];

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

      // PDF será gerado após criar a nota via gerarDanfseRecebida

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

      const novaNota = await base44.asServiceRole.entities.NotaFiscal.create({
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

      // Guarda dados da NF para gerar PDF depois
      console.log('[PDF] Adicionando nota para PDF:', novaNota.id);
      notasParaPdf.push({ nf, id: novaNota.id });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    // Gera HTML das DANFSe e salva como pdf_url (HTML renderizável pelo browser)
    let pdfsGerados = 0;
    for (const { nf, id } of notasParaPdf) {
      try {
        const htmlContent = gerarHtmlDanfseLocal(nf, id);
        const htmlBlob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
        const htmlFile = new File([htmlBlob], `danfse_${id}.html`, { type: 'text/html' });
        const { file_url: htmlUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: htmlFile });
        await base44.asServiceRole.entities.NotaFiscal.update(id, { pdf_url: htmlUrl });
        pdfsGerados++;
      } catch (pdfErr) {
        console.error('[PDF] Exceção:', pdfErr.message);
      }
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
      pdfsGerados,
      consultadas: nfses.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});