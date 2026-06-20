import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';

function gerarHtmlDanfseLocal(nf) {
  const fmt = (v) => (v != null && v !== '') ? String(v) : '-';
  const fmtMoeda = (v) => v ? `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
  const fmtData = (v) => { if (!v) return '-'; const d = v.substring(0, 10); const [ano, mes, dia] = d.split('-'); return `${dia}/${mes}/${ano}`; };
  const fmtDataHora = (v) => { if (!v) return '-'; const [data, hora] = v.split('T'); if (!data) return '-'; const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}${hora ? ' ' + hora.substring(0, 8) : ''}`; };
  const fmtCnpj = (v) => { if (!v) return '-'; const c = v.replace(/\D/g, ''); if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); return v; };
  const fmtCep = (v) => { if (!v) return '-'; const c = v.replace(/\D/g, ''); if (c.length === 8) return c.replace(/(\d{5})(\d{3})/, '$1-$2'); return v; };

  const prestNome = fmt(nf.razao_social_prestador || nf.razao_social_emitente);
  const prestCnpj = fmtCnpj(nf.cnpj_prestador || nf.cnpj_emitente || nf.cpf_prestador);
  const prestIm = fmt(nf.inscricao_municipal_prestador || nf.inscricao_municipal_emitente);
  const prestEmail = fmt(nf.email_prestador || nf.email_emitente);
  const prestFone = fmt(nf.telefone_prestador || nf.fone_prestador);
  const prestEnd = [nf.logradouro_prestador || nf.logradouro_emitente, nf.numero_prestador || nf.numero_emitente, nf.bairro_prestador || nf.bairro_emitente].filter(Boolean).join(', ') || '-';
  const prestMunicipio = fmt(nf.descricao_municipio_prestador || nf.descricao_municipio_emissor);
  const prestUf = fmt(nf.uf_prestador || nf.uf_emitente);
  const prestCep = fmtCep(nf.cep_prestador || nf.cep_emitente);
  const tomNome = fmt(nf.razao_social_tomador);
  const tomCnpj = fmtCnpj(nf.cnpj_tomador || nf.cpf_tomador);
  const tomIm = fmt(nf.inscricao_municipal_tomador);
  const tomEmail = fmt(nf.email_tomador);
  const tomFone = fmt(nf.telefone_tomador);
  const tomEnd = [nf.logradouro_tomador, nf.numero_tomador, nf.bairro_tomador].filter(Boolean).join(', ') || '-';
  const tomMunicipio = fmt(nf.descricao_municipio_tomador);
  const tomCep = fmtCep(nf.cep_tomador);
  const municipioEmissor = fmt(nf.descricao_municipio_emissor || nf.descricao_municipio_prestacao);
  const uf = fmt(nf.uf_emitente || nf.uf_prestador);
  const aliquota = nf.aliquota_iss ? (parseFloat(nf.aliquota_iss) * 100).toFixed(2) + '%' : '-';
  const tributacaoIss = fmt(nf.tributacao_iss || nf.natureza_operacao);
  const retencao = nf.retencao_iss ? 'Retido' : 'Não Retido';
  const regimeEsp = fmt(nf.regime_especial_tributacao != null ? nf.regime_especial_tributacao : '0');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; color: #000; background: #fff; padding: 10mm 10mm; }
  table { width: 100%; border-collapse: collapse; }
  td, th { font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; color: #000; vertical-align: top; }
  .sec-hdr { background: #e8e8e8; border: 1px solid #000; border-bottom: 1px solid #000; padding: 2px 4px; font-size: 7.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
  .lbl { font-size: 7px; font-weight: bold; color: #000; padding: 2px 4px 0 4px; text-transform: uppercase; white-space: nowrap; }
  .val { font-size: 8.5px; padding: 0 4px 3px 4px; }
  .val-bold { font-size: 8.5px; font-weight: bold; padding: 0 4px 3px 4px; }
  .bd { border: 1px solid #000; }
  .bd-r { border-right: 1px solid #000; }
  .bd-b { border-bottom: 1px solid #000; }
  .bd-t { border-top: 1px solid #000; }
  .chave-val { font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: 0.8px; padding: 2px 4px; word-break: break-all; }
  .total-row td { background: #f0f0f0; border: 1px solid #000; }
  .total-lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 4px 8px; }
  .total-val { font-size: 11px; font-weight: bold; text-align: right; padding: 4px 8px; }
  .rodape-cell { font-size: 7.5px; color: #333; text-align: center; padding: 3px 4px; border: 1px solid #000; border-top: none; }
  @media print { body { padding: 0; } @page { margin: 10mm; size: A4 portrait; } }
</style>
</head>
<body>
<table style="border: 1px solid #000; margin-bottom: 0;">
  <tr>
    <td style="width: 80px; min-width:80px; border-right: 1px solid #000; text-align:center; padding: 6px; vertical-align: middle;">
      <svg viewBox="0 0 100 100" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="47" stroke="#1a3a6b" stroke-width="3" fill="white"/>
        <text x="50" y="37" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="#1a3a6b">NFS-e</text>
        <text x="50" y="51" text-anchor="middle" font-family="Arial" font-size="7.5" fill="#1a3a6b">Nota Fiscal de</text>
        <text x="50" y="62" text-anchor="middle" font-family="Arial" font-size="7.5" fill="#1a3a6b">Serviço eletrônica</text>
      </svg>
    </td>
    <td style="text-align:center; border-right: 1px solid #000; vertical-align: middle; padding: 8px 4px;">
      <div style="font-size:13px; font-weight:bold;">DANFSe v1.0</div>
      <div style="font-size:10px; font-weight:bold;">Documento Auxiliar da NFS-e</div>
    </td>
    <td style="width: 190px; min-width:190px; padding: 6px 8px; vertical-align: middle;">
      <div style="font-weight:bold; font-size:9px;">MUNICÍPIO DE ${municipioEmissor.toUpperCase()}</div>
      <div style="font-size:8.5px;">${uf.toUpperCase()}</div>
      <div style="font-size:8px;">Secretaria Municipal de Finanças</div>
    </td>
  </tr>
</table>
${nf.id_tag ? `
<table style="border: 1px solid #000; border-top: none;">
  <tr>
    <td>
      <div class="lbl" style="padding: 2px 4px;">CHAVE DE ACESSO DA NFS-E</div>
      <div class="chave-val">${fmt(nf.id_tag)}</div>
    </td>
  </tr>
</table>` : ''}
<table style="border: 1px solid #000; border-top: none;">
  <tr>
    <td class="bd-r" style="width:25%"><div class="lbl">Número da NFS-e</div><div class="val-bold">${fmt(nf.numero || nf.numero_dfse)}</div></td>
    <td class="bd-r" style="width:25%"><div class="lbl">Competência da NFS-e</div><div class="val">${fmtData(nf.data_competencia || nf.data_emissao)}</div></td>
    <td class="bd-r" style="width:30%"><div class="lbl">Data e Hora da emissão</div><div class="val">${fmtDataHora(nf.data_emissao_completa || nf.data_emissao)}</div></td>
    <td style="width:20%"><div class="lbl">Número da DPS</div><div class="val">${fmt(nf.numero_dfse || nf.numero)}</div></td>
  </tr>
</table>
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="4" class="sec-hdr">EMITENTE DA NFS-E — PRESTADOR DO SERVIÇO</td></tr>
  <tr>
    <td class="bd-r bd-b" style="width:40%; padding:0"><div class="lbl">NOME / NOME EMPRESARIAL</div><div class="val-bold">${prestNome}</div></td>
    <td class="bd-r bd-b" style="width:20%; padding:0"><div class="lbl">CNPJ / CPF / NIF</div><div class="val">${prestCnpj}</div></td>
    <td class="bd-r bd-b" style="width:20%; padding:0"><div class="lbl">INSCRIÇÃO MUNICIPAL</div><div class="val">${prestIm}</div></td>
    <td class="bd-b" style="width:20%; padding:0"><div class="lbl">TELEFONE</div><div class="val">${prestFone}</div></td>
  </tr>
  <tr>
    <td class="bd-r" style="width:40%; padding:0"><div class="lbl">ENDEREÇO</div><div class="val">${prestEnd}</div></td>
    <td class="bd-r" style="width:20%; padding:0"><div class="lbl">MUNICÍPIO</div><div class="val">${prestMunicipio} - ${prestUf}</div></td>
    <td class="bd-r" style="width:20%; padding:0"><div class="lbl">CEP</div><div class="val">${prestCep}</div></td>
    <td style="width:20%; padding:0"><div class="lbl">E-MAIL</div><div class="val">${prestEmail}</div></td>
  </tr>
</table>
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="4" class="sec-hdr">TOMADOR DO SERVIÇO</td></tr>
  <tr>
    <td class="bd-r bd-b" style="width:40%; padding:0"><div class="lbl">NOME / NOME EMPRESARIAL</div><div class="val-bold">${tomNome}</div></td>
    <td class="bd-r bd-b" style="width:20%; padding:0"><div class="lbl">CNPJ / CPF / NIF</div><div class="val">${tomCnpj}</div></td>
    <td class="bd-r bd-b" style="width:20%; padding:0"><div class="lbl">INSCRIÇÃO MUNICIPAL</div><div class="val">${tomIm}</div></td>
    <td class="bd-b" style="width:20%; padding:0"><div class="lbl">TELEFONE</div><div class="val">${tomFone}</div></td>
  </tr>
  <tr>
    <td class="bd-r" style="width:40%; padding:0"><div class="lbl">ENDEREÇO</div><div class="val">${tomEnd}</div></td>
    <td class="bd-r" style="width:20%; padding:0"><div class="lbl">MUNICÍPIO</div><div class="val">${tomMunicipio}</div></td>
    <td class="bd-r" style="width:20%; padding:0"><div class="lbl">CEP</div><div class="val">${tomCep}</div></td>
    <td style="width:20%; padding:0"><div class="lbl">E-MAIL</div><div class="val">${tomEmail}</div></td>
  </tr>
</table>
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="3" class="sec-hdr">SERVIÇO PRESTADO</td></tr>
  <tr>
    <td class="bd-r bd-b" style="width:50%; padding:0"><div class="lbl">CÓDIGO DE TRIBUTAÇÃO NACIONAL</div><div class="val">${fmt(nf.descricao_tributacao_nacional || nf.codigo_tributacao_nacional)}</div></td>
    <td class="bd-r bd-b" style="width:25%; padding:0"><div class="lbl">CÓDIGO DE TRIBUTAÇÃO MUNICIPAL</div><div class="val">${fmt(nf.codigo_tributacao_municipio)}</div></td>
    <td class="bd-b" style="width:25%; padding:0"><div class="lbl">LOCAL DA PRESTAÇÃO</div><div class="val">${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</div></td>
  </tr>
  <tr>
    <td colspan="3" style="padding:0"><div class="lbl">DESCRIÇÃO DO SERVIÇO</div><div class="val">${fmt(nf.descricao_servico)}</div></td>
  </tr>
</table>
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="4" class="sec-hdr">TRIBUTAÇÃO MUNICIPAL</td></tr>
  <tr>
    <td class="bd-r bd-b" style="width:15%; padding:0"><div class="lbl">TRIBUTAÇÃO DO ISSQN</div><div class="val">${tributacaoIss}</div></td>
    <td class="bd-r bd-b" style="width:30%; padding:0"><div class="lbl">MUNICÍPIO DE INCIDÊNCIA DO ISSQN</div><div class="val">${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</div></td>
    <td class="bd-r bd-b" style="width:25%; padding:0"><div class="lbl">RETENÇÃO DO ISSQN</div><div class="val">${retencao}</div></td>
    <td class="bd-b" style="width:30%; padding:0"><div class="lbl">REGIME ESPECIAL DE TRIBUTAÇÃO</div><div class="val">${regimeEsp}</div></td>
  </tr>
  <tr>
    <td class="bd-r" style="padding:0"><div class="lbl">VALOR DO SERVIÇO</div><div class="val">${fmtMoeda(nf.valor_servico)}</div></td>
    <td class="bd-r" style="padding:0"><div class="lbl">DESCONTO INCONDICIONADO</div><div class="val">${fmtMoeda(nf.valor_desconto_incondicionado)}</div></td>
    <td class="bd-r" style="padding:0"><div class="lbl">BC ISSQN</div><div class="val">${fmtMoeda(nf.iss_base_calculo || nf.valor_servico)}</div></td>
    <td style="padding:0"><table style="width:100%; border-collapse:collapse;"><tr>
      <td class="bd-r" style="padding:0; width:50%"><div class="lbl">ALÍQUOTA APLICADA</div><div class="val">${aliquota}</div></td>
      <td style="padding:0; width:50%"><div class="lbl">ISSQN APURADO</div><div class="val">${fmtMoeda(nf.valor_iss)}</div></td>
    </tr></table></td>
  </tr>
</table>
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="5" class="sec-hdr">VALOR TOTAL DA NFS-E</td></tr>
  <tr>
    <td class="bd-r" style="width:20%; padding:0"><div class="lbl">VALOR DO SERVIÇO</div><div class="val">${fmtMoeda(nf.valor_servico)}</div></td>
    <td class="bd-r" style="width:20%; padding:0"><div class="lbl">DESCONTO CONDICIONADO</div><div class="val">${fmtMoeda(nf.valor_desconto_condicionado)}</div></td>
    <td class="bd-r" style="width:20%; padding:0"><div class="lbl">DESCONTO INCONDICIONADO</div><div class="val">${fmtMoeda(nf.valor_desconto_incondicionado)}</div></td>
    <td class="bd-r" style="width:20%; padding:0"><div class="lbl">ISSQN RETIDO</div><div class="val">${fmtMoeda(nf.valor_iss_retido)}</div></td>
    <td style="width:20%; padding:0"><div class="lbl">TOTAL DAS RETENÇÕES FEDERAIS</div><div class="val">${fmtMoeda(nf.valor_total_retencao)}</div></td>
  </tr>
</table>
<table style="border: 1px solid #000; border-top: none;">
  <tr class="total-row">
    <td class="total-lbl bd-r" style="width:50%">VALOR LÍQUIDO DA NFS-E</td>
    <td class="total-val" style="width:50%">${fmtMoeda(nf.valor_liquido || nf.valor_servico)}</td>
  </tr>
</table>
${nf.informacoes_complementares ? `
<table style="border: 1px solid #000; border-top: none;">
  <tr><td class="sec-hdr">INFORMAÇÕES COMPLEMENTARES</td></tr>
  <tr><td class="val" style="padding: 3px 4px;">${fmt(nf.informacoes_complementares)}</td></tr>
</table>` : ''}
<div class="rodape-cell">Nota Fiscal de Serviços Eletrônica — DANFSe v1.0 | Consulte a autenticidade em nfse.gov.br</div>
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
          // Sempre regenera o HTML da DANFSe para garantir o layout atualizado
          notasParaPdf.push({ nf, id: notaExistente.id });
          atualizadas++;
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