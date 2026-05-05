import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAYMENT_MAP = {
  'Dinheiro': '01', 'Cheque': '02', 'Cartão de Crédito': '03',
  'Cartão de Débito': '04', 'PIX': '17', 'Boleto': '15',
  'Transferência': '03', 'A Prazo': '99',
};

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const CNPJ_EMITENTE = '54043647000120';
const COD_MUNICIPIO_PATOS = '3148004';
const INSCRICAO_MUNICIPAL = '2024000738';

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

// Faz upload do XML para armazenamento permanente no Base44
const salvarXmlPermanente = async (base44, xmlUrl, ref, numero) => {
  if (!xmlUrl) return null;
  try {
    const isS3 = xmlUrl.includes('amazonaws.com') || xmlUrl.includes('s3.');
    const resp = await fetch(xmlUrl, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || !text.includes('<')) return null;
    const xmlFile = new File([text], `NF-${numero || ref}.xml`, { type: 'text/xml' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });
    console.log('[XML SALVO]', file_url);
    return file_url;
  } catch (e) {
    console.error('[XML ERRO]', e.message);
    return null;
  }
};

// Faz upload do PDF para armazenamento permanente no Base44
const salvarPdfPermanente = async (base44, pdfUrl, nota_id) => {
  if (!pdfUrl) return null;
  try {
    // URLs do S3 (amazonaws.com) são públicas — sem auth header
    const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
    const resp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const file = new File([blob], `nota_${nota_id}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    console.log('[PDF SALVO]', file_url);
    return file_url;
  } catch (e) {
    console.error('[PDF ERRO]', e.message);
    return null;
  }
};

// Consulta status na Focus NFe
const consultarFocusNFe = async (ref, tipo) => {
  const epConsulta = tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe';
  const resp = await fetch(`${FOCUSNFE_BASE}/${epConsulta}/${ref}?completo=1`, {
    headers: { 'Authorization': AUTH_HEADER },
  });
  if (!resp.ok) return null;
  return await resp.json();
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const {
      tipo, cliente_nome, cliente_cpf_cnpj, cliente_ie, cliente_email,
      cliente_numero, cliente_endereco, cliente_bairro, cliente_cep,
      cliente_cidade, cliente_estado, items, valor_total,
      forma_pagamento, observacoes, nota_id, cliente_id,
      data_emissao, serie_manual, ordem_venda_id, codigo_municipio_tomador,
    } = body;

    const pad = (n) => String(n).padStart(2, '0');
    const agora = new Date();
    const brasiliaMs = agora.getTime() - (3 * 60 * 60 * 1000);
    const brasiliaDate = new Date(brasiliaMs);
    const hojeStr = `${brasiliaDate.getUTCFullYear()}-${pad(brasiliaDate.getUTCMonth() + 1)}-${pad(brasiliaDate.getUTCDate())}`;
    const dataBase = data_emissao || hojeStr;

    let dataEmissaoISO;
    if (dataBase >= hojeStr) {
      const h = pad(brasiliaDate.getUTCHours());
      const m = pad(brasiliaDate.getUTCMinutes());
      const s = pad(brasiliaDate.getUTCSeconds());
      dataEmissaoISO = `${hojeStr}T${h}:${m}:${s}-03:00`;
    } else {
      dataEmissaoISO = `${dataBase}T12:00:00-03:00`;
    }

    const NCM_PADRAO = '87089990';
    const validarNcm = (ncm) => /^[0-9]{8}$/.test((ncm || '').replace(/\D/g, '')) ? (ncm || '').replace(/\D/g, '') : NCM_PADRAO;
    const validarCest = (cest) => { if (!cest) return null; const s = (cest || '').replace(/\D/g, ''); return s.length > 0 ? s.padStart(7, '0') : null; };

    let cpfCnpjLimpo = (cliente_cpf_cnpj || '').replace(/\D/g, '');
    let cepLimpo = (cliente_cep || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) cepLimpo = '38700327';

    // ============================================================
    // PROTEÇÃO ANTI-DUPLICATA: Verifica nota existente
    // ============================================================
    let notaExistente = null;
    if (nota_id) {
      try {
        const lista = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
        notaExistente = lista[0] || null;
      } catch {}
    }

    // SE JÁ TEM spedy_id salvo, consulta na Focus NFe ANTES de enviar novamente
    if (notaExistente?.spedy_id) {
      console.log('[ANTI-DUPLICATA] Nota tem spedy_id:', notaExistente.spedy_id, '- consultando Focus NFe...');
      const statusExistente = await consultarFocusNFe(notaExistente.spedy_id, tipo);
      
      if (statusExistente) {
        const st = statusExistente.status || '';
        console.log('[ANTI-DUPLICATA] Status na Focus NFe:', st);
        
        if (st === 'autorizado') {
          // Já emitida! Só atualiza o banco e retorna
          const rawPdf = statusExistente.caminho_pdf_nfsen || statusExistente.caminho_pdf_nfse || statusExistente.caminho_danfe || '';
          const pdfUrlFocus = normalizarUrl(rawPdf);
          let pdfUrlFinal = notaExistente.pdf_url || '';
          
          if (!pdfUrlFinal && pdfUrlFocus) {
            pdfUrlFinal = await salvarPdfPermanente(base44, pdfUrlFocus, nota_id) || pdfUrlFocus;
          }
          
          await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
            status: 'Emitida',
            pdf_url: pdfUrlFinal,
            chave_acesso: statusExistente.chave_nfe || statusExistente.chave_nfse || notaExistente.chave_acesso || '',
            mensagem_sefaz: statusExistente.mensagem_sefaz || 'Autorizado',
          });
          return Response.json({ sucesso: true, mensagem: 'Nota já estava autorizada na SEFAZ! Status atualizado.', status: 'Emitida', pdf: pdfUrlFinal });
        }
        
        if (st === 'processando_autorizacao' || st === 'recebido') {
          // Ainda processando - não reenvia, retorna para fazer polling
          await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Processando' });
          return Response.json({ sucesso: true, mensagem: 'Nota ainda em processamento na SEFAZ.', status: 'Processando' });
        }
        
        if (st === 'erro_autorizacao' || st === 'rejeitado' || st === 'erro') {
          const msgErro = statusExistente.erros ? statusExistente.erros.map(e => e.mensagem).join('; ') : (statusExistente.mensagem || st);
          // Se erro permanente (não duplicata), reusa o número e reenvia com novo ref
          console.log('[ANTI-DUPLICATA] Erro anterior:', msgErro, '- pode reenviar');
          // Cai no fluxo normal abaixo mas reusa o número já reservado
        }
      }
    }

    // ============================================================
    // MONTA PAYLOAD E GERA REF ÚNICO
    // ============================================================
    const ref = `${(tipo || 'nfe').toLowerCase()}-${Date.now()}`;

    let endpoint = '';
    let payload = null;
    let proximoRps = null;
    let proximoNfce = null;
    let proximoNfe = null;

    if (tipo === 'NFSe') {
      endpoint = `/nfsen?ref=${ref}`;

      if (notaExistente?.numero) {
        proximoRps = parseInt(notaExistente.numero, 10);
      } else {
        // Busca config nfse_ultimo_dps (editável na tela de Configurações) E maior número no banco
        const [configsNfse, todasNfse] = await Promise.all([
          base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfse_ultimo_dps' }),
          base44.asServiceRole.entities.NotaFiscal.list('-created_date', 1000),
        ]);
        // A config salva pelo usuário em Configurações é a fonte de verdade principal
        const ultimoDpsConfig = parseInt(configsNfse[0]?.valor || '0', 10);
        // Também verifica o maior número já emitido no banco para evitar colisão
        const ultimoDpsNota = todasNfse
          .filter(n => n.tipo === 'NFSe' && n.numero && n.status !== 'Cancelada' && n.status !== 'Rascunho' && n.status !== 'Erro')
          .map(n => parseInt(n.numero, 10))
          .filter(n => !isNaN(n))
          .reduce((max, n) => Math.max(max, n), 0);
        // Usa o maior entre config e banco, +1
        proximoRps = Math.max(ultimoDpsConfig, ultimoDpsNota) + 1;
        // Salva o número reservado de volta na config para a próxima emissão
        if (configsNfse.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfse[0].id, { valor: String(proximoRps) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfse_ultimo_dps', valor: String(proximoRps), descricao: 'Ultimo numero DPS/NFSe Nacional autorizado' });
        }
        console.log(`[NFSe] Próximo RPS: ${proximoRps} (config: ${ultimoDpsConfig}, maior no banco: ${ultimoDpsNota})`);
      }

      const valorServico = Number(valor_total) || 1.0;
      const valorIss = parseFloat((valorServico * 0.025).toFixed(2));
      const discriminacao = (items && items.length > 0)
        ? items.map(it => `${it.descricao} - Qtd: ${it.quantidade} - Valor: R$ ${Number(it.valor_total).toFixed(2)}`).join('; ')
        : (observacoes || 'Serviços prestados');

      let codigoMunicipioTomador = codigo_municipio_tomador;
      if (!codigoMunicipioTomador && cliente_cidade && cliente_estado) {
        try {
          const cidadeNorm = cliente_cidade.trim().toUpperCase();
          const estadoNorm = cliente_estado.trim().toUpperCase();
          const ibgeResp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoNorm}/municipios`);
          if (ibgeResp.ok) {
            const municipios = await ibgeResp.json();
            const normalizar = (str) => str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const match = municipios.find(m => normalizar(m.nome) === normalizar(cidadeNorm));
            if (match) codigoMunicipioTomador = String(match.id);
          }
        } catch (e) {
          console.error('[MUNICIPIO ERROR]', e.message);
        }
      }

      payload = {
        data_emissao: dataEmissaoISO,
        data_competencia: dataBase,
        serie_dps: '900',
        numero_dps: String(proximoRps),
        codigo_municipio_emissora: COD_MUNICIPIO_PATOS,
        cnpj_prestador: CNPJ_EMITENTE,
        inscricao_municipal_prestador: INSCRICAO_MUNICIPAL,
        codigo_opcao_simples_nacional: 3,
        regime_tributario_simples_nacional: 1,
        regime_especial_tributacao: 0,
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_tomador: cpfCnpjLimpo } : (cpfCnpjLimpo.length === 11 ? { cpf_tomador: cpfCnpjLimpo } : {})),
        razao_social_tomador: (cliente_nome || 'Consumidor Final').substring(0, 100),
        ...(cliente_email ? { email_tomador: cliente_email } : {}),
        codigo_municipio_tomador: codigoMunicipioTomador || COD_MUNICIPIO_PATOS,
        cep_tomador: cepLimpo,
        logradouro_tomador: cliente_endereco || 'Rua Rui Barbosa',
        numero_tomador: cliente_numero || '1355',
        bairro_tomador: cliente_bairro || 'Santa Terezinha',
        codigo_municipio_prestacao: COD_MUNICIPIO_PATOS,
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
      };
    } else if (tipo === 'NFCe') {
      endpoint = `/nfce?ref=${ref}`;

      if (notaExistente?.numero) {
        proximoNfce = parseInt(notaExistente.numero, 10);
      } else {
        const [configsNfce, todasNfce] = await Promise.all([
          base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfce_ultimo_numero' }),
          base44.asServiceRole.entities.NotaFiscal.list('-created_date', 1000),
        ]);
        const ultimoNfceConfig = parseInt(configsNfce[0]?.valor || '0', 10);
        const ultimoNfceNota = todasNfce
          .filter(n => n.tipo === 'NFCe' && n.numero && n.status !== 'Cancelada' && n.status !== 'Rascunho' && n.status !== 'Erro')
          .map(n => parseInt(n.numero, 10))
          .filter(n => !isNaN(n))
          .reduce((max, n) => Math.max(max, n), 0);
        proximoNfce = Math.max(ultimoNfceConfig, ultimoNfceNota) + 1;
        if (configsNfce.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfce[0].id, { valor: String(proximoNfce) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfce_ultimo_numero', valor: String(proximoNfce), descricao: 'Ultimo numero NFCe autorizado' });
        }
        console.log(`[NFCe] Próximo número: ${proximoNfce} (config: ${ultimoNfceConfig}, maior no banco: ${ultimoNfceNota})`);
      }

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: 'Peças e serviços', quantidade: 1, valor_unitario: Number(valor_total) || 1.0, valor_total: Number(valor_total) || 1.0, ncm: '87089990', cfop: '5102' }
      ];
      payload = {
        cnpj_emitente: CNPJ_EMITENTE,
        data_emissao: dataEmissaoISO,
        natureza_operacao: 'VENDA AO CONSUMIDOR',
        modalidade_frete: '9',
        local_destino: '1',
        presenca_comprador: '1',
        numero: proximoNfce,
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        ...(serie_manual ? { serie: serie_manual } : { serie: '1' }),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `REF${idx + 1}`,
          descricao: (it.descricao || 'Produto').substring(0, 120),
          codigo_ncm: validarNcm(it.ncm),
          cfop: '5102',
          unidade_comercial: it.unidade || 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(valor_total) || 1.0,
          valor_bruto: Number(it.valor_total) || Number(valor_total) || 1.0,
          icms_origem: '0',
          icms_situacao_tributaria: '102',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
          ...(validarCest(it.cest) ? { cest: validarCest(it.cest) } : {}),
        })),
        formas_pagamento: [{
          forma_pagamento: PAYMENT_MAP[forma_pagamento] || '17',
          valor_pagamento: Number(valor_total) || 1.0,
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes.substring(0, 500) } : {}),
      };
    } else {
      // NFe
      endpoint = `/nfe?ref=${ref}`;

      if (notaExistente?.numero) {
        proximoNfe = parseInt(notaExistente.numero, 10);
      } else {
        const [configsNfe, todasNfe] = await Promise.all([
          base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfe_ultimo_numero' }),
          base44.asServiceRole.entities.NotaFiscal.list('-created_date', 1000),
        ]);
        const ultimoNfeConfig = parseInt(configsNfe[0]?.valor || '0', 10);
        const ultimoNfeNota = todasNfe
          .filter(n => n.tipo === 'NFe' && n.numero && n.status !== 'Cancelada' && n.status !== 'Rascunho' && n.status !== 'Erro')
          .map(n => parseInt(n.numero, 10))
          .filter(n => !isNaN(n))
          .reduce((max, n) => Math.max(max, n), 0);
        proximoNfe = Math.max(ultimoNfeConfig, ultimoNfeNota) + 1;
        if (configsNfe.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfe[0].id, { valor: String(proximoNfe) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfe_ultimo_numero', valor: String(proximoNfe), descricao: 'Ultimo numero NFe autorizado' });
        }
        console.log(`[NFe] Próximo número: ${proximoNfe} (config: ${ultimoNfeConfig}, maior no banco: ${ultimoNfeNota})`);
      }

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: 'Peças de Automóveis', quantidade: 1, valor_unitario: Number(valor_total) || 1.0, valor_total: Number(valor_total) || 1.0, ncm: '87089990', cfop: '5102' }
      ];
      payload = {
        cnpj_emitente: CNPJ_EMITENTE,
        data_emissao: dataEmissaoISO,
        data_saida_entrada: dataEmissaoISO,
        natureza_operacao: body.natureza_operacao || 'Venda de mercadoria',
        finalidade_emissao: '1',
        tipo_documento: body.tipo_documento || '1',
        presenca_comprador: '1',
        local_destino: '1',
        nome_destinatario: (cliente_nome || 'Consumidor Final').substring(0, 60),
        numero: proximoNfe,
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        logradouro_destinatario: cliente_endereco || 'Rua Rui Barbosa',
        numero_destinatario: cliente_numero || '1355',
        bairro_destinatario: cliente_bairro || 'Santa Terezinha',
        municipio_destinatario: cliente_cidade || 'Patos de Minas',
        uf_destinatario: cliente_estado || 'MG',
        cep_destinatario: cepLimpo,
        indicador_inscricao_estadual_destinatario: cpfCnpjLimpo.length === 14
          ? ((cliente_ie && cliente_ie.trim()) ? '1' : '9')
          : '9',
        ...(cpfCnpjLimpo.length === 14 && cliente_ie && cliente_ie.trim() ? { inscricao_estadual_destinatario: cliente_ie.replace(/\D/g, '') } : {}),
        consumidor_final: cpfCnpjLimpo.length === 11 || !(cliente_ie && cliente_ie.trim()) ? '1' : '0',
        modalidade_frete: '9',
        ...(serie_manual ? { serie: serie_manual } : { serie: '1' }),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `REF${idx + 1}`,
          descricao: (it.descricao || 'Produto').substring(0, 120),
          codigo_ncm: validarNcm(it.ncm),
          cfop: it.cfop || '5102',
          unidade_comercial: it.unidade || 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(valor_total) || 1.0,
          valor_bruto: Number(it.valor_total) || Number(valor_total) || 1.0,
          icms_origem: '0',
          icms_situacao_tributaria: '102',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
          ...(validarCest(it.cest) ? { cest: validarCest(it.cest) } : {}),
        })),
        formas_pagamento: [{
          forma_pagamento: PAYMENT_MAP[forma_pagamento] || '17',
          valor_pagamento: Number(valor_total) || 1.0,
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes.substring(0, 500) } : {}),
      };
    }

    // ============================================================
    // SALVA spedy_id NO RASCUNHO ANTES DE ENVIAR (anti-duplicata)
    // ============================================================
    let numeroFinal = tipo === 'NFSe' ? String(proximoRps) : tipo === 'NFCe' ? String(proximoNfce) : String(proximoNfe);

    if (nota_id) {
      // Atualiza o rascunho com o ref ANTES de enviar — se a página cair, saberemos que já foi enviado
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        spedy_id: ref,
        numero: numeroFinal,
        status: 'Processando',
      });
    }

    // ============================================================
    // ENVIA PARA A FOCUS NFE
    // ============================================================
    const resp = await fetch(`${FOCUSNFE_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_HEADER },
      body: JSON.stringify(payload),
    });

    const responseText = await resp.text();
    let result;
    try { result = JSON.parse(responseText); } catch {
      return Response.json({ sucesso: false, erro: `Resposta invalida: ${responseText.substring(0, 200)}` });
    }

    if (!resp.ok) {
      const msgErro = result.erros
        ? result.erros.map(e => e.mensagem).join('; ')
        : (result.mensagem || JSON.stringify(result));
      
      // Marca como Rascunho de volta se falhou antes de chegar na SEFAZ
      if (nota_id) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Rascunho', mensagem_sefaz: msgErro });
      }
      return Response.json({ sucesso: false, erro: msgErro });
    }

    // ============================================================
    // POLLING ATÉ STATUS DEFINITIVO (até 10 tentativas × 3s = 30s)
    // ============================================================
    let statusNota = 'Processando';
    let pdfUrl = '';
    let chaveAcesso = result.chave_nfe || '';
    let mensagemSefaz = result.erros?.[0]?.mensagem || result.mensagem_sefaz || result.mensagem || '';
    let resultFinal = result;

    for (let i = 0; i < 10; i++) {
      const st = resultFinal.status || '';
      if (st === 'autorizado') {
        statusNota = 'Emitida';
        const rawPdf = resultFinal.url_danfse || resultFinal.caminho_pdf_nfsen || resultFinal.caminho_pdf_nfse || resultFinal.caminho_danfe || '';
        pdfUrl = normalizarUrl(rawPdf);
        chaveAcesso = resultFinal.chave_nfe || resultFinal.chave_nfse || chaveAcesso;
        mensagemSefaz = resultFinal.mensagem_sefaz || resultFinal.mensagem || '';
        break;
      } else if (st === 'erro_autorizacao' || st === 'rejeitado' || st === 'erro') {
        mensagemSefaz = resultFinal.erros ? resultFinal.erros.map(e => e.mensagem).join('; ') : (resultFinal.mensagem || st);
        statusNota = mensagemSefaz.includes('E0160') ? 'Erro de Sincronia Governamental' : 'Erro';
        break;
      }
      if (i < 9) {
        await new Promise(r => setTimeout(r, 3000));
        const consultaResp = await fetch(`${FOCUSNFE_BASE}/${tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe'}/${ref}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (consultaResp.ok) {
          resultFinal = await consultaResp.json();
        }
      }
    }

    // ============================================================
    // SE EMITIDA: SALVA PDF E XML PERMANENTEMENTE
    // ============================================================
    let pdfUrlFinal = pdfUrl;
    let xmlUrlFinal = '';
    if (statusNota === 'Emitida') {
      if (pdfUrl) {
        const pdfSalvo = await salvarPdfPermanente(base44, pdfUrl, nota_id || 'nova');
        if (pdfSalvo) pdfUrlFinal = pdfSalvo;
      }
      // Salvar XML
      const caminhoXml = resultFinal.caminho_xml_nota_fiscal || resultFinal.caminho_xml || '';
      if (caminhoXml) {
        const xmlUrl = normalizarUrl(caminhoXml);
        const xmlSalvo = await salvarXmlPermanente(base44, xmlUrl, ref, numeroFinal);
        if (xmlSalvo) xmlUrlFinal = xmlSalvo;
      }
    }

    // Baixar estoque se NFe/NFCe e emitida sem OS vinculada
    const vinculadaAOS = !!(body.ordem_venda_id);
    if (statusNota === 'Emitida' && (tipo === 'NFe' || tipo === 'NFCe') && !vinculadaAOS) {
      for (const it of (items || [])) {
        const qtd = Number(it.quantidade) || 1;
        let estoqueItem = null;
        if (it.estoque_id) {
          const found = await base44.asServiceRole.entities.Estoque.filter({ id: it.estoque_id });
          estoqueItem = found[0] || null;
        }
        if (!estoqueItem && it.codigo) {
          const found = await base44.asServiceRole.entities.Estoque.filter({ codigo: it.codigo });
          estoqueItem = found[0] || null;
        }
        if (estoqueItem) {
          const atual = Number(estoqueItem.quantidade || 0);
          await base44.asServiceRole.entities.Estoque.update(estoqueItem.id, { quantidade: Math.max(0, atual - qtd) });
        }
      }
    }

    const notaData = {
      tipo,
      xml_content: JSON.stringify(items || []),
      cliente_cpf_cnpj: cliente_cpf_cnpj || '',
      cliente_ie: cliente_ie || '',
      cliente_email: cliente_email || '',
      cliente_telefone: body.cliente_telefone || '',
      cliente_endereco: cliente_endereco || '',
      cliente_numero: cliente_numero || '',
      cliente_bairro: cliente_bairro || '',
      cliente_cep: body.cliente_cep || '',
      cliente_cidade: cliente_cidade || '',
      cliente_estado: cliente_estado || '',
      forma_pagamento: forma_pagamento || '',
      numero: numeroFinal,
      serie: tipo === 'NFSe' ? '900' : (serie_manual || '1'),
      status: statusNota,
      spedy_id: ref,
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      data_emissao: data_emissao || new Date().toISOString().split('T')[0],
      valor_total: Number(valor_total) || 0,
      pdf_url: pdfUrlFinal,
      xml_url: xmlUrlFinal || undefined,
      chave_acesso: chaveAcesso,
      ordem_venda_id: body.ordem_venda_id || '',
      observacoes: observacoes || '',
      mensagem_sefaz: mensagemSefaz,
    };

    // Reverter número reservado se erro em nova emissão
    const erroE0014 = mensagemSefaz?.includes('E0014') || mensagemSefaz?.includes('já existe');
    if (statusNota === 'Erro' && !nota_id && tipo === 'NFSe' && !erroE0014) {
      try {
        const configsNfse = await base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfse_ultimo_dps' });
        if (configsNfse.length > 0) {
          const ultimoDps = parseInt(configsNfse[0].valor || '0', 10);
          if (ultimoDps === proximoRps) {
            await base44.asServiceRole.entities.Configuracao.update(configsNfse[0].id, { valor: String(ultimoDps - 1) });
          }
        }
      } catch (revertError) {
        console.error('[DPS REVERT ERROR]', revertError);
      }
    }

    try {
      if (nota_id) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota_id, notaData);
      } else {
        await base44.asServiceRole.entities.NotaFiscal.create(notaData);
      }
    } catch (updateError) {
      console.error('[NOTA ERROR]', updateError);
      return Response.json({ sucesso: statusNota !== 'Erro', mensagem: `${statusNota} na SEFAZ, erro ao salvar: ${updateError.message}`, status: statusNota });
    }

    const mensagem = statusNota === 'Emitida'
      ? 'Nota fiscal autorizada com sucesso!'
      : statusNota === 'Processando'
        ? 'Nota enviada para processamento. O status será atualizado automaticamente.'
        : `Erro na emissão: ${mensagemSefaz}`;

    return Response.json({ sucesso: statusNota !== 'Erro', mensagem, pdf: pdfUrlFinal, status: statusNota, mensagem_sefaz: mensagemSefaz });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message });
  }
});