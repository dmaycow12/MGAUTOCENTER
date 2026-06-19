import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE_PROD = 'https://api.focusnfe.com.br/v2';
const FOCUSNFE_BASE_HOM = 'https://homologacao.focusnfe.com.br/v2';

const normalizarUrl = (url, useHom = false) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseHost = useHom ? 'homologacao.focusnfe.com.br' : 'api.focusnfe.com.br';
  return `https://${baseHost}${url}`;
};

const converterHtmlParaPdf = async (htmlContent) => {
  try {
    const formData = new FormData();
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    formData.append('files', htmlBlob, 'index.html');

    const resp = await fetch('https://demo.gotenberg.dev/forms/chromium/convert/html', {
      method: 'POST',
      body: formData,
    });
    if (resp.ok) {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('pdf') || ct.includes('octet')) {
        const blob = await resp.blob();
        if (blob.size > 1000) {
          console.log('[PREVIEW] PDF gerado via gotenberg, tamanho:', blob.size);
          return blob;
        }
      }
    }
    console.log('[PREVIEW] gotenberg falhou:', resp.status);
  } catch (e) {
    console.log('[PREVIEW] gotenberg erro:', e.message);
  }
  return null;
};

const salvarPdfPermanente = async (base44, pdfUrl, label, authHeader) => {
  if (!pdfUrl) return null;
  try {
    const resp = await fetch(pdfUrl, { headers: { 'Authorization': authHeader } });
    if (!resp.ok) {
      console.log('[PREVIEW] PDF fetch falhou:', resp.status);
      return null;
    }
    const blob = await resp.blob();
    const buffer = await blob.arrayBuffer();
    const header = new Uint8Array(buffer, 0, 4);
    const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
    if (isPdf) {
      const file = new File([blob], `preview_${label}.pdf`, { type: 'application/pdf' });
      const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      return file_url;
    }
  } catch (e) {
    console.error('[PREVIEW PDF ERRO]', e.message);
  }
  return null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { nota_id } = body;

    if (!nota_id) return Response.json({ sucesso: false, erro: 'nota_id obrigatório' });

    // Carrega a nota e as configs
    const [notaArr, todasConfigs] = await Promise.all([
      base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id }),
      base44.asServiceRole.entities.Configuracao.list('-created_date', 200),
    ]);

    const nota = notaArr[0];
    if (!nota) return Response.json({ sucesso: false, erro: 'Nota não encontrada' });

    const getConf = (chave, padrao = '') => todasConfigs.find(c => c.chave === chave)?.valor || padrao;

    // Token de homologação (URL separada da produção)
    const apiKeyHom = getConf('focusnfe_api_key_homologacao', '');
    if (!apiKeyHom) {
      return Response.json({ sucesso: false, erro: 'Token de homologação FocusNFe não configurado. Acesse Configurações e preencha "Token API Homologação".' });
    }

    const FOCUSNFE_BASE = FOCUSNFE_BASE_HOM; // preview sempre em homologação
    const AUTH_HOM = 'Basic ' + btoa(apiKeyHom + ':');

    const CNPJ_EMITENTE = getConf('cnpj', '').replace(/\D/g, '');
    const INSCRICAO_ESTADUAL = getConf('inscricao_estadual', '');
    const INSCRICAO_MUNICIPAL = getConf('inscricao_municipal', '');
    const OPCAO_SIMPLES = parseInt(getConf('opcao_simples_nacional', '3'), 10);
    const REGIME_TRIBUTARIO = parseInt(getConf('regime_tributario', '1'), 10);
    const REGIME_ESPECIAL = parseInt(getConf('regime_especial', '0'), 10);
    const COD_MUNICIPIO = getConf('cod_municipio', '') || getConf('codigo_municipio', '');
    const SERIE_NFE = getConf('nfe_serie', '1');
    const SERIE_NFCE = getConf('nfce_serie', '1');
    const SERIE_NFSE = getConf('nfse_serie_dps', '900');

    const tipo = nota.tipo;
    const tsPreview = Date.now();
    const ref = `preview-${nota_id}-${tsPreview}`;
    // Número único para preview: últimos 9 dígitos do timestamp (evita duplicidade na homologação)
    const numeroPreview = parseInt(String(tsPreview).slice(-9), 10);

    const pad = (n) => String(n).padStart(2, '0');
    const agora = new Date();
    const brasiliaMs = agora.getTime() - (3 * 60 * 60 * 1000);
    const brasiliaDate = new Date(brasiliaMs);
    const hojeStr = `${brasiliaDate.getUTCFullYear()}-${pad(brasiliaDate.getUTCMonth() + 1)}-${pad(brasiliaDate.getUTCDate())}`;
    const h = pad(brasiliaDate.getUTCHours());
    const m = pad(brasiliaDate.getUTCMinutes());
    const s = pad(brasiliaDate.getUTCSeconds());
    const dataEmissaoISO = `${hojeStr}T${h}:${m}:${s}-03:00`;

    const NCM_PADRAO = '87089990';
    const validarNcm = (ncm) => /^[0-9]{8}$/.test((ncm || '').replace(/\D/g, '')) ? (ncm || '').replace(/\D/g, '') : NCM_PADRAO;
    const validarCest = (cest) => { if (!cest) return null; const sc = (cest || '').replace(/\D/g, ''); return sc.length > 0 ? sc.padStart(7, '0') : null; };

    let cpfCnpjLimpo = (nota.cliente_cpf_cnpj || '').replace(/\D/g, '');
    let cepLimpo = (nota.cliente_cep || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) cepLimpo = '38700327';

    let items = [];
    try { items = nota.xml_content ? JSON.parse(nota.xml_content) : []; } catch {}
    if (!Array.isArray(items) || items.length === 0) {
      items = [{ descricao: nota.observacoes || 'Serviço/Produto', quantidade: 1, valor_unitario: nota.valor_total, valor_total: nota.valor_total, ncm: '87089990', cfop: '5102' }];
    }

    const PAYMENT_MAP = { 'Dinheiro': '01', 'Cheque': '02', 'Cartão de Crédito': '03', 'Cartão de Débito': '04', 'PIX': '17', 'Boleto': '15', 'Transferência': '03', 'A Prazo': '99', 'A Combinar': '99', 'Cartão': '03' };
    const infoAdicional = [nota.observacoes, nota.dados_adicionais].filter(Boolean).join(' | ');

    let endpoint = '';
    let payload = {};

    if (tipo === 'NFSe') {
      endpoint = `/nfsen?ref=${ref}`;
      const valorServico = Number(nota.valor_total) || 1.0;
      const valorIss = parseFloat((valorServico * 0.025).toFixed(2));
      const discriminacao = items.map(it => `${it.descricao} - Qtd: ${it.quantidade} - Valor: R$ ${Number(it.valor_total).toFixed(2)}`).join('; ');

      // Busca código município
      let codigoMunicipioTomador = COD_MUNICIPIO;
      if (nota.cliente_cidade && nota.cliente_estado) {
        try {
          const ibgeResp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${nota.cliente_estado.trim().toUpperCase()}/municipios`);
          if (ibgeResp.ok) {
            const municipios = await ibgeResp.json();
            const normalizar = (str) => str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const match = municipios.find(mn => normalizar(mn.nome) === normalizar(nota.cliente_cidade));
            if (match) codigoMunicipioTomador = String(match.id);
          }
        } catch {}
      }

      payload = {
        data_emissao: dataEmissaoISO,
        data_competencia: hojeStr,
        serie_dps: SERIE_NFSE,
        numero_dps: String(numeroPreview), // número único por timestamp para evitar duplicidade
        codigo_municipio_emissora: COD_MUNICIPIO,
        cnpj_prestador: CNPJ_EMITENTE,
        codigo_opcao_simples_nacional: OPCAO_SIMPLES,
        regime_tributario_simples_nacional: REGIME_TRIBUTARIO,
        regime_especial_tributacao: REGIME_ESPECIAL,
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_tomador: cpfCnpjLimpo } : (cpfCnpjLimpo.length === 11 ? { cpf_tomador: cpfCnpjLimpo } : {})),
        razao_social_tomador: (nota.cliente_nome || 'Consumidor Final').substring(0, 100),
        ...(nota.cliente_email ? { email_tomador: nota.cliente_email } : {}),
        codigo_municipio_tomador: codigoMunicipioTomador || COD_MUNICIPIO,
        cep_tomador: cepLimpo,
        logradouro_tomador: nota.cliente_endereco || 'Rua Rui Barbosa',
        numero_tomador: nota.cliente_numero || 'S/N',
        bairro_tomador: nota.cliente_bairro || 'Santa Terezinha',
        codigo_municipio_prestacao: COD_MUNICIPIO,
        codigo_tributacao_nacional_iss: '140101',
        descricao_servico: discriminacao.substring(0, 1000),
        valor_servico: valorServico,
        valor_iss: valorIss,
        tributacao_iss: 1,
        tipo_retencao_iss: 1,
        situacao_tributaria_pis_cofins: '00',
        percentual_total_tributos_federais: '10.38',
        percentual_total_tributos_estaduais: '0.00',
        percentual_total_tributos_municipais: '2.50',
        indicador_total_tributacao: null,
        ...(infoAdicional ? { observacoes: infoAdicional.substring(0, 2000) } : {}),
      };
    } else if (tipo === 'NFCe') {
      endpoint = `/nfce?ref=${ref}`;
      const prodItems = items.length > 0 ? items : [{ descricao: 'Produto', quantidade: 1, valor_unitario: nota.valor_total, valor_total: nota.valor_total, ncm: '87089990' }];
      payload = {
        cnpj_emitente: CNPJ_EMITENTE,
        ...(INSCRICAO_ESTADUAL ? { inscricao_estadual_emitente: INSCRICAO_ESTADUAL } : {}),
        data_emissao: dataEmissaoISO,
        natureza_operacao: 'VENDA AO CONSUMIDOR',
        modalidade_frete: '9',
        local_destino: '1',
        presenca_comprador: '1',
        numero: numeroPreview,
        serie: SERIE_NFCE,
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `REF${idx + 1}`,
          descricao: (it.descricao || 'Produto').substring(0, 120),
          codigo_ncm: validarNcm(it.ncm),
          cfop: '5102',
          unidade_comercial: it.unidade || 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(nota.valor_total) || 1.0,
          valor_bruto: Number(it.valor_total) || Number(nota.valor_total) || 1.0,
          icms_origem: '0',
          icms_situacao_tributaria: '102',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
          ...(validarCest(it.cest) ? { cest: validarCest(it.cest) } : {}),
        })),
        formas_pagamento: [{ forma_pagamento: PAYMENT_MAP[nota.forma_pagamento] || '17', valor_pagamento: Number(nota.valor_total) || 1.0 }],
        ...(infoAdicional ? { informacoes_adicionais_contribuinte: infoAdicional.substring(0, 500) } : {}),
      };
    } else {
      // NFe
      endpoint = `/nfe?ref=${ref}`; // nfe (singular) para preview/homologação
      const prodItems = items.length > 0 ? items : [{ descricao: 'Peças', quantidade: 1, valor_unitario: nota.valor_total, valor_total: nota.valor_total, ncm: '87089990', cfop: '5102' }];

      let codigoMunicipioDestinatario = null;
      if (nota.cliente_cidade && nota.cliente_estado) {
        try {
          const ibgeResp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${nota.cliente_estado.trim().toUpperCase()}/municipios`);
          if (ibgeResp.ok) {
            const municipios = await ibgeResp.json();
            const normalizar = (str) => str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const match = municipios.find(mn => normalizar(mn.nome) === normalizar(nota.cliente_cidade));
            if (match) codigoMunicipioDestinatario = String(match.id);
          }
        } catch {}
      }

      payload = {
        cnpj_emitente: CNPJ_EMITENTE,
        ...(INSCRICAO_ESTADUAL ? { inscricao_estadual_emitente: INSCRICAO_ESTADUAL } : {}),
        data_emissao: dataEmissaoISO,
        data_saida_entrada: dataEmissaoISO,
        natureza_operacao: 'Venda de mercadoria',
        finalidade_emissao: '1',
        tipo_documento: '1',
        presenca_comprador: '1',
        local_destino: '1',
        nome_destinatario: (nota.cliente_nome || 'Consumidor Final').substring(0, 60),
        numero: numeroPreview,
        serie: SERIE_NFE,
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        logradouro_destinatario: nota.cliente_endereco || 'Rua Rui Barbosa',
        numero_destinatario: nota.cliente_numero || 'S/N',
        bairro_destinatario: nota.cliente_bairro || 'Santa Terezinha',
        municipio_destinatario: nota.cliente_cidade || 'Patos de Minas',
        ...(codigoMunicipioDestinatario ? { codigo_municipio_destinatario: codigoMunicipioDestinatario } : {}),
        uf_destinatario: nota.cliente_estado || 'MG',
        cep_destinatario: cepLimpo,
        // Preview é SEMPRE homologação: conforme orientação da Focus NFe:
        // - indicador 9 (não contribuinte) + consumidor_final 1
        // - Para PJ: enviar inscricao_estadual_destinatario: 'ISENTO' para evitar rejeição 232
        // - Para PF/Consumidor: omitir IE
        indicador_inscricao_estadual_destinatario: '9',
        consumidor_final: '1',
        ...(cpfCnpjLimpo.length === 14 ? { inscricao_estadual_destinatario: 'ISENTO' } : {}),
        modalidade_frete: '9',
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `REF${idx + 1}`,
          descricao: (it.descricao || 'Produto').substring(0, 120),
          codigo_ncm: validarNcm(it.ncm),
          cfop: it.cfop || '5102',
          unidade_comercial: it.unidade || 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(nota.valor_total) || 1.0,
          valor_bruto: Number(it.valor_total) || Number(nota.valor_total) || 1.0,
          icms_origem: '0',
          icms_situacao_tributaria: '102',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
          ...(validarCest(it.cest) ? { cest: validarCest(it.cest) } : {}),
        })),
        formas_pagamento: [{ forma_pagamento: PAYMENT_MAP[nota.forma_pagamento] || '17', valor_pagamento: Number(nota.valor_total) || 1.0 }],
        ...(infoAdicional ? { informacoes_adicionais_contribuinte: infoAdicional.substring(0, 500) } : {}),
      };
    }

    // Envia para homologação
    const urlCompleta = `${FOCUSNFE_BASE}${endpoint}`;
    console.log('[PREVIEW HOM URL]', urlCompleta);
    const resp = await fetch(urlCompleta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_HOM },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const msgErro = errBody.erros ? errBody.erros.map(e => e.mensagem).join('; ') : (errBody.mensagem || `HTTP ${resp.status}`);
      return Response.json({ sucesso: false, erro: msgErro });
    }

     const epConsulta = tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe';
    // Limite reduzido para garantir execução < 55s (evita timeout 500):
    // NFSe: 10 × 4s = 40s | NFe/NFCe: 10 × 2.5s = 25s
    const maxTentativas = 10;
    const intervaloMs = tipo === 'NFSe' ? 4000 : 2500;
    let resultFinal = await resp.json();
    console.log('[PREVIEW HOM RESP]', JSON.stringify(resultFinal).substring(0, 300));

    for (let i = 0; i < maxTentativas; i++) {
      const st = resultFinal.status || '';
      if (st === 'autorizado') break;
      if (st === 'erro_autorizacao' || st === 'rejeitado' || st === 'erro') {
        const msgErro = resultFinal.erros ? resultFinal.erros.map(e => e.mensagem).join('; ') : (resultFinal.mensagem || st);
        return Response.json({ sucesso: false, erro: `Erro na pré-visualização: ${msgErro}` });
      }
      await new Promise(r => setTimeout(r, intervaloMs));
      const consultaResp = await fetch(`${FOCUSNFE_BASE}/${epConsulta}/${ref}?completo=1`, { headers: { 'Authorization': AUTH_HOM } });
      if (consultaResp.ok) resultFinal = await consultaResp.json();
    }

    if ((resultFinal.status || '') !== 'autorizado') {
      // SEFAZ demorou — retornar sem 500, permitindo nova tentativa
      return Response.json({ 
        sucesso: false, 
        pode_tentar_novamente: true,
        erro: 'A SEFAZ está demorando para responder. Aguarde 30 segundos e clique em "Homologar" novamente.' 
      });
    }

    // Obtém HTML/PDF da homologação
    const caminhoHtml = resultFinal.caminho_danfe || resultFinal.url_danfse || resultFinal.caminho_pdf_nfse || resultFinal.caminho_pdf_nfsen || resultFinal.caminho_pdf_nfce || '';
    const htmlUrl = normalizarUrl(caminhoHtml, true); // true = usar homologação
    console.log('[PREVIEW] caminhoHtml:', caminhoHtml, ', htmlUrl:', htmlUrl);

    // Tenta buscar como PDF primeiro
    let pdfUrlSalvo = null;
    const pdfResp = await fetch(htmlUrl, { headers: { 'Authorization': AUTH_HOM } });
    if (pdfResp.ok) {
      const ct = pdfResp.headers.get('content-type') || '';
      if (ct.includes('pdf')) {
        // É PDF — salva direto
        const blob = await pdfResp.blob();
        const pdfFile = new File([blob], `preview_${nota_id}.pdf`, { type: 'application/pdf' });
        const upload = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
        pdfUrlSalvo = upload.file_url;
        console.log('[PREVIEW] PDF salvo diretamente:', pdfUrlSalvo);
      } else if (ct.includes('html') || caminhoHtml.endsWith('.html')) {
        // É HTML — busca novamente (nova requisição) e converte
        const htmlResp = await fetch(htmlUrl, { headers: { 'Authorization': AUTH_HOM } });
        if (htmlResp.ok) {
          const htmlContent = await htmlResp.text();
          const pdfBlob = await converterHtmlParaPdf(htmlContent);
          if (pdfBlob) {
            const pdfFile = new File([pdfBlob], `preview_${nota_id}.pdf`, { type: 'application/pdf' });
            const upload = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
            pdfUrlSalvo = upload.file_url;
            console.log('[PREVIEW] PDF convertido de HTML:', pdfUrlSalvo);
          }
        }
      }
    }
    if (!pdfUrlSalvo) {
      console.log('[PREVIEW] Fallback: retornando URL da homologação');
      pdfUrlSalvo = htmlUrl;
    }

    // Atualiza nota com PDF de homologação e status Homologada
    await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
      status: 'Homologada',
      pdf_url: pdfUrlSalvo || htmlUrl,
    });

    return Response.json({
      sucesso: true,
      pdf_url: pdfUrlSalvo || htmlUrl,
      mensagem: 'Pré-visualização gerada com sucesso! Revise a DANFE e clique em "Autorizar e Emitir" para transmitir para produção.',
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});