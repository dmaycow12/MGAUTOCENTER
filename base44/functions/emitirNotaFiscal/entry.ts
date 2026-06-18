import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAYMENT_MAP = {
  'Dinheiro': '01', 'Cheque': '02', 'Cartão de Crédito': '03',
  'Cartão de Débito': '04', 'PIX': '17', 'Boleto': '15',
  'Transferência': '03', 'A Prazo': '99',
};

const FOCUSNFE_BASE_PROD = 'https://api.focusnfe.com.br/v2';
const FOCUSNFE_BASE_HOM = 'https://homologacao.focusnfe.com.br/v2';

// Valores padrão — serão sobrescritos pelas configs do banco
const CNPJ_EMITENTE_PADRAO = '';
const COD_MUNICIPIO_PATOS = '';
const INSCRICAO_MUNICIPAL_PADRAO = '';

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

// Converte HTML em PDF usando gotenberg (mesmo do preVisualizarNota)
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
          console.log('[EMISSAO] PDF gerado via gotenberg, tamanho:', blob.size);
          return blob;
        }
      }
    }
    console.log('[EMISSAO] gotenberg falhou:', resp.status);
  } catch (e) {
    console.log('[EMISSAO] gotenberg erro:', e.message);
  }
  return null;
};

// Baixa o XML da Focus NFe e retorna o conteúdo como texto
const baixarXmlTexto = async (xmlUrl, authHeader) => {
  if (!xmlUrl) return null;
  try {
    const isS3 = xmlUrl.includes('amazonaws.com') || xmlUrl.includes('s3.');
    const resp = await fetch(xmlUrl, isS3 ? {} : { headers: { 'Authorization': authHeader } });
    if (!resp.ok) { console.error('[XML ERRO] fetch status:', resp.status, xmlUrl); return null; }
    const text = await resp.text();
    if (!text || !text.includes('<')) { console.error('[XML ERRO] conteúdo inválido'); return null; }
    console.log('[XML BAIXADO] tamanho:', text.length);
    return text;
  } catch (e) {
    console.error('[XML ERRO]', e.message);
    return null;
  }
};

// Faz upload do PDF para armazenamento permanente no Base44
const salvarPdfPermanente = async (base44, pdfUrl, nota_id, authHeader) => {
   if (!pdfUrl) return null;
   const MAX_RETRIES = 4;
   const RETRY_DELAY = 3000;
   
   for (let tentativa = 0; tentativa < MAX_RETRIES; tentativa++) {
     try {
       if (tentativa > 0) {
         console.log('[PDF-RETRY] Tentativa', tentativa + 1, 'de', MAX_RETRIES, '- aguardando', RETRY_DELAY/1000, 's...');
         await new Promise(r => setTimeout(r, RETRY_DELAY));
       }
       console.log('[PDF BAIXANDO]', pdfUrl);
       const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
       let resp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': authHeader } });
       // Se 403 com auth, tenta sem auth (Focus NFe S3 às vezes rejeita o header)
       if (!resp.ok && resp.status === 403 && !isS3) {
         console.log('[PDF RETRY] 403 com auth, tentando sem auth...');
         resp = await fetch(pdfUrl, {});
       }
       if (!resp.ok) {
         console.error('[PDF ERRO] Status:', resp.status, 'tentativa:', tentativa + 1);
         continue;
       }
       const blob = await resp.blob();
       const buf = await blob.arrayBuffer();
       const h = new Uint8Array(buf, 0, 4);
       if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) {
         const pdfFile = new File([blob], `nota-${nota_id || 'nova'}.pdf`, { type: 'application/pdf' });
         const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
         const fileUrl = uploadResp?.file_url || '';
         console.log('[PDF SALVO] tentativa', tentativa + 1, '|', fileUrl);
         return fileUrl;
       }
       console.error('[PDF ERRO] Não é PDF válido (HTML/NFCe?), tentativa:', tentativa + 1);
     } catch (e) {
       console.error('[PDF ERRO]', e.message, 'tentativa:', tentativa + 1);
     }
   }
   console.error('[PDF ESGOTADO] Todas as', MAX_RETRIES, 'tentativas falharam');
   return null;
};

// Consulta status na Focus NFe
const consultarFocusNFe = async (ref, tipo, baseUrl, authHeader) => {
  const epConsulta = tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe';
  const url = `${baseUrl}/${epConsulta}/${ref}?completo=1`;
  console.log('[CONSULTA FOCUS]', url);
  const resp = await fetch(url, {
    headers: { 'Authorization': authHeader },
  });
  console.log('[CONSULTA FOCUS STATUS]', resp.status);
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
      forma_pagamento, observacoes, dados_adicionais, nota_id, cliente_id,
      data_emissao, serie_manual, ordem_venda_id, codigo_municipio_tomador,
    } = body;

    // Combina observacoes + dados_adicionais para informacoes_adicionais_contribuinte
    const infoAdicional = [observacoes, dados_adicionais].filter(Boolean).join(' | ');

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
    // CARREGA CONFIGS DO EMITENTE DO BANCO
    // ============================================================
    const todasConfigs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const getConf = (chave, padrao = '') => todasConfigs.find(c => c.chave === chave)?.valor || padrao;

    // Chaves API por ambiente
    const apiKeyProd = getConf('focusnfe_api_key_producao', '') || getConf('focusnfe_api_key', '');
    const apiKeyHom = getConf('focusnfe_api_key_homologacao', '');
    const AUTH_HEADER_PROD = 'Basic ' + btoa(apiKeyProd + ':');
    const AUTH_HEADER_HOM = 'Basic ' + btoa(apiKeyHom + ':');

    const CNPJ_EMITENTE = getConf('cnpj', CNPJ_EMITENTE_PADRAO).replace(/\D/g, '');
    const INSCRICAO_MUNICIPAL = getConf('inscricao_municipal', INSCRICAO_MUNICIPAL_PADRAO);
    const INSCRICAO_ESTADUAL = getConf('inscricao_estadual', '');
    const OPCAO_SIMPLES = parseInt(getConf('opcao_simples_nacional', '3'), 10);
    const REGIME_TRIBUTARIO = parseInt(getConf('regime_tributario', '1'), 10);
    const REGIME_ESPECIAL = parseInt(getConf('regime_especial', '0'), 10);
    const COD_MUNICIPIO = getConf('cod_municipio', '') || getConf('codigo_municipio', '');
    const SERIE_NFE = getConf('nfe_serie', '1');
    const SERIE_NFCE = getConf('nfce_serie', '1');
    const SERIE_NFSE = getConf('nfse_serie_dps', '900');

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
      let statusExistente = null;
      try {
        statusExistente = await consultarFocusNFe(notaExistente.spedy_id, tipo, FOCUSNFE_BASE_PROD, AUTH_HEADER_PROD);
        console.log('[ANTI-DUPLICATA] Resposta Focus NFe:', JSON.stringify(statusExistente)?.substring(0, 200));
      } catch (e) {
        console.error('[ANTI-DUPLICATA ERROR]', e.message);
      }
      
      if (!statusExistente) {
        // 404 — nota nunca chegou na Focus NFe, limpa o spedy_id para reenviar normalmente
        console.log('[ANTI-DUPLICATA] 404 na Focus NFe - nota não existe lá, vai reenviar com novo ref');
        if (nota_id) {
          await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { spedy_id: null, status: 'Rascunho' });
          notaExistente = { ...notaExistente, spedy_id: null };
        }
      }

      if (statusExistente) {
        const st = (statusExistente.status || '').toLowerCase();
        console.log('[ANTI-DUPLICATA] Status na Focus NFe:', st);
        
        if (st === 'autorizado') {
          // Já emitida! Só atualiza o banco e retorna
          const rawPdf = statusExistente.caminho_pdf_nfsen || statusExistente.caminho_pdf_nfse || statusExistente.caminho_danfe || '';
          const pdfUrlFocus = normalizarUrl(rawPdf);
          let pdfUrlFinal = notaExistente.pdf_url || '';
          
          if (!pdfUrlFinal && pdfUrlFocus) {
            const salvo = await salvarPdfPermanente(base44, pdfUrlFocus, nota_id, AUTH_HEADER_PROD);
            pdfUrlFinal = salvo || ''; // NUNCA usar URL da Focus como fallback — elas expiram
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

    // Determina qual ambiente/chave usar
    // isPreview=true SOMENTE quando chamado pela função preVisualizarNota (body.homologacao === true)
    // O botão "Autorizar" SEMPRE envia para PRODUÇÃO, independente do status da nota
    const isHomologacao = body.homologacao === true;
    const baseUrlCompleta = isHomologacao ? FOCUSNFE_BASE_HOM : FOCUSNFE_BASE_PROD;
    const authHeaderAtivo = isHomologacao ? AUTH_HEADER_HOM : AUTH_HEADER_PROD;

    let endpoint = '';
    let payload = null;
    let proximoRps = null;
    let proximoNfseNumero = null;
    let proximoNfce = null;
    let proximoNfe = null;

    if (tipo === 'NFSe') {
      endpoint = `/nfsen?ref=${ref}`;

      // Reutiliza o número do rascunho SE for um número válido (1-5 dígitos, sem timestamp)
      const numeroRascunho = notaExistente?.numero;
      const numeroValido = numeroRascunho && /^\d{1,5}$/.test(String(numeroRascunho).trim()) && parseInt(numeroRascunho, 10) < 99999;
      if (!numeroValido && numeroRascunho && nota_id) {
        // Limpa número inválido do rascunho para forçar recálculo
        await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { numero: null });
        if (notaExistente) notaExistente = { ...notaExistente, numero: null };
      }
      if (numeroValido) {
        proximoRps = parseInt(notaExistente.numero, 10);
        proximoNfseNumero = proximoRps;
      } else {
        // Busca DIRETA por chave para garantir valor atual (sem cache de todasConfigs)
        const [configsDpsArr, configsNfseNumArr] = await Promise.all([
          base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfse_ultimo_dps' }),
          base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfse_ultimo_numero' }),
        ]);

        // Pega o registro com o valor mais recente (ordenado por updated_date desc se houver duplicatas)
        const configsDps = configsDpsArr.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
        const configsNfseNum = configsNfseNumArr.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));

        const ultimoDpsConfig = parseInt(configsDps[0]?.valor || '0', 10);
        proximoRps = ultimoDpsConfig + 1;
        console.log(`[NFSe-DEBUG] nfse_ultimo_dps encontrado: ${configsDpsArr.length} registros, valor mais recente: ${ultimoDpsConfig}, próximo: ${proximoRps}`);
        
        if (configsDps.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsDps[0].id, { valor: String(proximoRps) });
          // Remove duplicatas se existirem
          for (let i = 1; i < configsDps.length; i++) {
            await base44.asServiceRole.entities.Configuracao.delete(configsDps[i].id);
          }
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfse_ultimo_dps', valor: String(proximoRps), descricao: 'Ultimo numero DPS autorizado' });
        }

        // Número da nota sempre igual ao DPS — nunca diverge
        proximoNfseNumero = proximoRps;
        if (configsNfseNum.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfseNum[0].id, { valor: String(proximoNfseNumero) });
          for (let i = 1; i < configsNfseNum.length; i++) {
            await base44.asServiceRole.entities.Configuracao.delete(configsNfseNum[i].id);
          }
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfse_ultimo_numero', valor: String(proximoNfseNumero), descricao: 'Ultimo numero NFS-e autorizado (igual ao DPS)' });
        }

        console.log(`[NFSe] Próximo DPS = Próximo NFS-e: ${proximoRps} (era: ${ultimoDpsConfig})`);
      }

      console.log('[NFSe-CONFIG] CNPJ_EMITENTE:', CNPJ_EMITENTE, '| IM:', INSCRICAO_MUNICIPAL, '| COD_MUN:', COD_MUNICIPIO);

      const valorServico = Number(valor_total) || 1.0;
      const valorIss = parseFloat((valorServico * 0.025).toFixed(2));
      const discriminacao = (items && items.length > 0)
        ? items.map(it => `${it.descricao} - Qtd: ${it.quantidade} - Valor: R$ ${Number(it.valor_total).toFixed(2)}`).join('; ')
        : (infoAdicional || 'Serviços prestados');

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
        serie_dps: SERIE_NFSE,
        numero_dps: String(proximoRps),
        codigo_municipio_emissora: COD_MUNICIPIO,
        cnpj_prestador: CNPJ_EMITENTE,
        ...(INSCRICAO_MUNICIPAL ? { inscricao_municipal_prestador: INSCRICAO_MUNICIPAL } : {}),
        codigo_opcao_simples_nacional: OPCAO_SIMPLES,
        regime_tributario_simples_nacional: REGIME_TRIBUTARIO,
        regime_especial_tributacao: REGIME_ESPECIAL,
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_tomador: cpfCnpjLimpo } : (cpfCnpjLimpo.length === 11 ? { cpf_tomador: cpfCnpjLimpo } : {})),
        razao_social_tomador: (cliente_nome || 'Consumidor Final').substring(0, 100),
        ...(cliente_email ? { email_tomador: cliente_email } : {}),
        codigo_municipio_tomador: codigoMunicipioTomador || COD_MUNICIPIO,
        cep_tomador: cepLimpo,
        logradouro_tomador: cliente_endereco || 'Rua Rui Barbosa',
        numero_tomador: cliente_numero || 'S/N',
        bairro_tomador: cliente_bairro || 'Santa Terezinha',
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

      if (notaExistente?.numero) {
        proximoNfce = parseInt(notaExistente.numero, 10);
      } else {
        const configsNfce = await base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfce_ultimo_numero' });
        const ultimoNfceConfig = parseInt(configsNfce[0]?.valor || '0', 10);
        proximoNfce = ultimoNfceConfig + 1;
        if (configsNfce.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfce[0].id, { valor: String(proximoNfce) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfce_ultimo_numero', valor: String(proximoNfce), descricao: 'Ultimo numero NFCe autorizado' });
        }
        console.log(`[NFCe] Próximo número: ${proximoNfce} (era: ${ultimoNfceConfig})`);
      }

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: 'Peças e serviços', quantidade: 1, valor_unitario: Number(valor_total) || 1.0, valor_total: Number(valor_total) || 1.0, ncm: '87089990', cfop: '5102' }
      ];
      payload = {
        cnpj_emitente: CNPJ_EMITENTE,
        ...(INSCRICAO_ESTADUAL ? { inscricao_estadual_emitente: INSCRICAO_ESTADUAL } : {}),
        data_emissao: dataEmissaoISO,
        natureza_operacao: 'VENDA AO CONSUMIDOR',
        modalidade_frete: '9',
        local_destino: '1',
        presenca_comprador: '1',
        numero: proximoNfce,
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        serie: SERIE_NFCE,
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
        ...(infoAdicional ? { informacoes_adicionais_contribuinte: infoAdicional.substring(0, 500) } : {}),
      };
    } else {
      // NFe
      endpoint = `/nfe?ref=${ref}`;

      if (notaExistente?.numero) {
        proximoNfe = parseInt(notaExistente.numero, 10);
      } else {
        const configsNfe = await base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfe_ultimo_numero' });
        const ultimoNfeConfig = parseInt(configsNfe[0]?.valor || '0', 10);
        proximoNfe = ultimoNfeConfig + 1;
        if (configsNfe.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfe[0].id, { valor: String(proximoNfe) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfe_ultimo_numero', valor: String(proximoNfe), descricao: 'Ultimo numero NFe autorizado' });
        }
        console.log(`[NFe] Próximo número: ${proximoNfe} (era: ${ultimoNfeConfig})`);
      }

      // Busca código IBGE do município destinatário
      let codigoMunicipioDestinatario = null;
      if (cliente_cidade && cliente_estado) {
        try {
          const cidadeNorm = cliente_cidade.trim().toUpperCase();
          const estadoNorm = cliente_estado.trim().toUpperCase();
          const ibgeResp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoNorm}/municipios`);
          if (ibgeResp.ok) {
            const municipios = await ibgeResp.json();
            const normalizar = (str) => str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const match = municipios.find(m => normalizar(m.nome) === normalizar(cidadeNorm));
            if (match) codigoMunicipioDestinatario = String(match.id);
          }
        } catch (e) {
          console.error('[MUNICIPIO NFe ERROR]', e.message);
        }
      }

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: 'Peças de Automóveis', quantidade: 1, valor_unitario: Number(valor_total) || 1.0, valor_total: Number(valor_total) || 1.0, ncm: '87089990', cfop: '5102' }
      ];
      payload = {
        cnpj_emitente: CNPJ_EMITENTE,
        ...(INSCRICAO_ESTADUAL ? { inscricao_estadual_emitente: INSCRICAO_ESTADUAL } : {}),
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
        numero_destinatario: cliente_numero || 'S/N',
        bairro_destinatario: cliente_bairro || 'Santa Terezinha',
        municipio_destinatario: cliente_cidade || 'Patos de Minas',
        ...(codigoMunicipioDestinatario ? { codigo_municipio_destinatario: codigoMunicipioDestinatario } : {}),
        uf_destinatario: cliente_estado || 'MG',
        cep_destinatario: cepLimpo,
        // Regra: sem IE => indicador 1 | com IE => indicador 9. IE só é enviada em produção.
        indicador_inscricao_estadual_destinatario: (cliente_ie && cliente_ie.trim()) ? '9' : '1',
        ...(!isHomologacao && cliente_ie && cliente_ie.trim() ? { inscricao_estadual_destinatario: cliente_ie.replace(/\D/g, '') } : {}),
        consumidor_final: (cliente_ie && cliente_ie.trim()) ? '0' : '1',
        modalidade_frete: '9',
        serie: SERIE_NFE,
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
        ...(infoAdicional ? { informacoes_adicionais_contribuinte: infoAdicional.substring(0, 500) } : {}),
      };
    }

    // ============================================================
    // SALVA spedy_id NO RASCUNHO ANTES DE ENVIAR (anti-duplicata)
    // ============================================================
    let numeroFinal = tipo === 'NFSe' ? String(proximoNfseNumero ?? proximoRps) : tipo === 'NFCe' ? String(proximoNfce) : String(proximoNfe);

    if (nota_id) {
      // Atualiza o rascunho com o ref ANTES de enviar — se a página cair, saberemos que já foi enviado
      // Se é homologação, não salva número ainda (só salva ao Emitir)
      const isHom = isHomologacao;
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        spedy_id: ref,
        ...(isHom ? {} : { numero: numeroFinal }),  // Só salva número em produção
        status: 'Processando',
      });
    }

    // ============================================================
    // ENVIA PARA A FOCUS NFE
    // ============================================================
    const urlCompleta = `${baseUrlCompleta}${endpoint}`;
    console.log('[FOCUS URL]', urlCompleta);
    console.log('[FOCUS PAYLOAD]', JSON.stringify(payload).substring(0, 1000));
    const resp = await fetch(urlCompleta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeaderAtivo },
      body: JSON.stringify(payload),
    });
    const respStatusCode = resp.status;
    console.log('[FOCUS RESPONSE STATUS]', respStatusCode);

    const responseText = await resp.text();
    let result;
    try { result = JSON.parse(responseText); } catch {
      return Response.json({ sucesso: false, erro: `Resposta invalida: ${responseText.substring(0, 200)}` });
    }

    if (!resp.ok) {
      console.log('[FOCUS ERROR BODY]', JSON.stringify(result));
      const msgErro = result.erros
        ? result.erros.map(e => e.mensagem).join('; ')
        : (result.mensagem || JSON.stringify(result));
      
      // Marca como Rascunho de volta se falhou antes de chegar na SEFAZ — remove número
      if (nota_id) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Rascunho', numero: null, mensagem_sefaz: msgErro });
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

    const epConsultaFinal = tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe';
    // NFSe pode demorar mais — até 25 tentativas (~2 minutos)
    const maxTentativas = tipo === 'NFSe' ? 25 : 10;
    for (let i = 0; i < maxTentativas; i++) {
      const st = resultFinal.status || '';
      if (st === 'autorizado') {
        statusNota = 'Emitida';
        // Se ainda não temos os caminhos (resposta inicial sem completo=1), faz uma consulta extra
        const temCaminhos = resultFinal.caminho_danfe_nfce || resultFinal.caminho_xml_nfce ||
          resultFinal.caminho_danfe || resultFinal.caminho_xml_nota_fiscal ||
          resultFinal.url_danfse || resultFinal.caminho_pdf_nfsen;
        if (!temCaminhos) {
          await new Promise(r => setTimeout(r, 1500));
          const consultaCompleta = await fetch(`${baseUrlCompleta}/${epConsultaFinal}/${ref}?completo=1`, {
            headers: { 'Authorization': authHeaderAtivo },
          });
          if (consultaCompleta.ok) resultFinal = await consultaCompleta.json();
        }
        const rawPdf = resultFinal.url_danfse || resultFinal.caminho_pdf_nfsen || resultFinal.caminho_pdf_nfse ||
              resultFinal.caminho_pdf_nfce || resultFinal.caminho_danfe_nfce ||
              resultFinal.caminho_danfe || resultFinal.url_danfe || resultFinal.caminho_pdf ||
              resultFinal.caminho_xml_nota_fiscal_pdf || resultFinal.url_pdf || resultFinal.arquivo_pdf || '';
            pdfUrl = normalizarUrl(rawPdf);
            console.log('[POLLING-PDF] rawPdf encontrado:', !!rawPdf, '| normalizado:', pdfUrl);
        chaveAcesso = resultFinal.chave_nfe || resultFinal.chave_nfse || chaveAcesso;
        mensagemSefaz = resultFinal.mensagem_sefaz || resultFinal.mensagem || '';
        break;
      } else if (st === 'erro_autorizacao' || st === 'rejeitado' || st === 'erro') {
        mensagemSefaz = resultFinal.erros ? resultFinal.erros.map(e => e.mensagem).join('; ') : (resultFinal.mensagem || st);
        statusNota = mensagemSefaz.includes('E0160') ? 'Erro de Sincronia Governamental' : 'Erro';
        break;
      }
      if (i < maxTentativas - 1) {
        // NFSe: intervalo progressivo mais longo (3s, 3s, 4s, 4s, 5s, 5s... até 8s)
        // NFe/NFCe: intervalo curto (1s, 1s, 1.5s, 1.5s, 2s...)
        let intervalo;
        if (tipo === 'NFSe') {
          intervalo = i < 4 ? 3000 : i < 8 ? 4000 : i < 14 ? 5000 : 8000;
        } else {
          intervalo = i < 2 ? 1000 : i < 4 ? 1500 : 2000;
        }
        await new Promise(r => setTimeout(r, intervalo));
        const consultaResp = await fetch(`${baseUrlCompleta}/${epConsultaFinal}/${ref}?completo=1`, {
          headers: { 'Authorization': authHeaderAtivo },
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
     let xmlOriginalTexto = '';
     let xmlUrlSalva = '';
     if (statusNota === 'Emitida') {
       if (pdfUrl) {
           console.log('[PDF-SALVAR] Baixando PDF/HTML da Focus:', pdfUrl);
           // Tenta baixar com retry (mesmo que preVisualizarNota — verifica content-type, não magic bytes)
           let pdfUrlFinalLocal = '';
           for (let t = 0; t < 4; t++) {
             if (t > 0) { console.log('[PDF-SALVAR] Retry', t + 1); await new Promise(r => setTimeout(r, 3000)); }
             try {
               const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
               let pdfResp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': authHeaderAtivo } });
               if (!pdfResp.ok && pdfResp.status === 403 && !isS3) {
                 pdfResp = await fetch(pdfUrl, {});
               }
               if (!pdfResp.ok) { console.error('[PDF-SALVAR] Erro HTTP:', pdfResp.status); continue; }

               const ct = pdfResp.headers.get('content-type') || '';
               console.log('[PDF-SALVAR] Content-Type:', ct);

               if (ct.includes('pdf') || ct.includes('octet')) {
                 // É PDF real — salva direto
                 const blob = await pdfResp.blob();
                 const pdfFile = new File([blob], `nota-${nota_id || 'nova'}.pdf`, { type: 'application/pdf' });
                 const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
                 pdfUrlFinalLocal = uploadResp?.file_url || '';
                 console.log('[PDF-SALVAR] PDF salvo:', pdfUrlFinalLocal);
                 break;
               } else if (ct.includes('html') || pdfUrl.endsWith('.html') || pdfUrl.includes('danfe_nfce')) {
                 // É HTML (NFCe) — baixa conteúdo e converte pra PDF via gotenberg
                 console.log('[PDF-SALVAR] HTML detectado, convertendo via gotenberg...');
                 const htmlResp = await fetch(pdfUrl, { headers: { 'Authorization': authHeaderAtivo } });
                 if (htmlResp.ok) {
                   const htmlContent = await htmlResp.text();
                   const pdfBlob = await converterHtmlParaPdf(htmlContent);
                   if (pdfBlob) {
                     const pdfFile = new File([pdfBlob], `nota-${nota_id || 'nova'}.pdf`, { type: 'application/pdf' });
                     const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
                     pdfUrlFinalLocal = uploadResp?.file_url || '';
                     console.log('[PDF-SALVAR] PDF convertido salvo:', pdfUrlFinalLocal);
                     break;
                   }
                   console.log('[PDF-SALVAR] gotenberg retornou null, tentando próximo retry');
                 }
               } else {
                 // Tenta verificar magic bytes como fallback
                 const blob = await pdfResp.blob();
                 const buf = await blob.arrayBuffer();
                 const h = new Uint8Array(buf, 0, 4);
                 if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) {
                   const pdfFile = new File([blob], `nota-${nota_id || 'nova'}.pdf`, { type: 'application/pdf' });
                   const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
                   pdfUrlFinalLocal = uploadResp?.file_url || '';
                   console.log('[PDF-SALVAR] PDF (magic bytes) salvo:', pdfUrlFinalLocal);
                   break;
                 }
                 console.error('[PDF-SALVAR] Content-Type desconhecido e não é PDF:', ct);
               }
             } catch (e) {
               console.error('[PDF-SALVAR] Erro:', e.message);
             }
           }
           pdfUrlFinal = pdfUrlFinalLocal;
           if (!pdfUrlFinalLocal) {
             console.log('[PDF-FALHA] Nenhuma tentativa salvou o PDF — botão ficará vermelho');
           }
       } else {
          console.log('[PDF-AUSENTE] Nenhuma URL de PDF retornada pela Focus NFe');
       }
       // Salvar XML como texto direto no campo xml_original
       console.log('[XML-DEBUG] resultFinal keys:', Object.keys(resultFinal).join(', '));
       const caminhoXml = resultFinal.caminho_xml_nfce || resultFinal.caminho_xml_nota_fiscal || resultFinal.caminho_xml_nfe || resultFinal.caminho_xml || '';
       console.log('[XML-DEBUG] caminhoXml:', caminhoXml);
       if (caminhoXml) {
         const xmlUrl = normalizarUrl(caminhoXml);
         const xmlTexto = await baixarXmlTexto(xmlUrl, authHeaderAtivo);
         if (xmlTexto) {
           xmlOriginalTexto = xmlTexto;
         } else {
           // Se não conseguir baixar o texto, salva a URL
           xmlUrlSalva = xmlUrl;
         }
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
      ...(statusNota === 'Emitida' ? { numero: numeroFinal } : {}),  // Só salva número quando Emitida
      serie: tipo === 'NFSe' ? SERIE_NFSE : tipo === 'NFCe' ? SERIE_NFCE : SERIE_NFE,
      status: statusNota,
      spedy_id: ref,
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      data_emissao: data_emissao || new Date().toISOString().split('T')[0],
      valor_total: Number(valor_total) || 0,
      pdf_url: pdfUrlFinal,
      ...(xmlOriginalTexto ? { xml_original: xmlOriginalTexto } : {}),
      ...(xmlUrlSalva ? { xml_url: xmlUrlSalva } : {}),
      chave_acesso: chaveAcesso,
      ordem_venda_id: body.ordem_venda_id || '',
      observacoes: observacoes || '',
      dados_adicionais: body.dados_adicionais || '',
      mensagem_sefaz: mensagemSefaz,
    };

    // Reverter números reservados se erro em nova emissão
    const erroE0014 = mensagemSefaz?.includes('E0014') || mensagemSefaz?.includes('já existe');
    if (statusNota === 'Erro' && !nota_id && tipo === 'NFSe' && !erroE0014) {
      try {
        const [configsDpsRev, configsNfseNumRev] = await Promise.all([
          base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfse_ultimo_dps' }),
          base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfse_ultimo_numero' }),
        ]);
        // Reverte DPS e número da nota juntos (são sempre iguais)
        if (configsDpsRev.length > 0 && parseInt(configsDpsRev[0].valor) === proximoRps) {
          await base44.asServiceRole.entities.Configuracao.update(configsDpsRev[0].id, { valor: String(proximoRps - 1) });
        }
        if (configsNfseNumRev.length > 0 && parseInt(configsNfseNumRev[0].valor) === proximoNfseNumero) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfseNumRev[0].id, { valor: String(proximoRps - 1) });
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