import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { ENTITY_NAMES } from '../config/entities.js';

const ASAAS_BASE = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';
const FOCUSNFE_BASE_PROD = process.env.FOCUSNFE_BASE_URL || 'https://api.focusnfe.com.br/v2';
const FOCUSNFE_BASE_HOM = process.env.FOCUSNFE_HOMOLOGACAO_BASE_URL || 'https://homologacao.focusnfe.com.br/v2';
const PAYMENT_MAP = {
  Dinheiro: '01',
  Cheque: '02',
  'Cartão de Crédito': '03',
  'Cartão de Débito': '04',
  PIX: '17',
  Boleto: '15',
  Transferência: '03',
  'A Prazo': '99',
  'A Combinar': '99',
  Cartão: '03',
};

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const normalizeBrasilApiCnpj = (data) => ({
  nome: data.razao_social || data.nome_fantasia || '',
  nome_fantasia: data.nome_fantasia || '',
  cpf_cnpj: data.cnpj || '',
  telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || '',
  email: data.email || '',
  cep: data.cep || '',
  endereco: data.logradouro || '',
  numero: data.numero || '',
  complemento: data.complemento || '',
  bairro: data.bairro || '',
  cidade: data.municipio || '',
  estado: data.uf || '',
});

const integrationPending = (name) => ({
  sucesso: false,
  success: false,
  pending_configuration: true,
  message: `A função "${name}" depende de integração externa e será portada quando as credenciais forem configuradas no backend novo.`,
});

const parseWorksheet = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });
};

const normalizeZipNotaFiscalRecords = async ({ zip, fileStore }) => {
  const folderPrefix = 'NotaFiscal/';
  const jsonFiles = Object.values(zip.files).filter((file) => (
    !file.dir &&
    file.name.startsWith(folderPrefix) &&
    file.name.endsWith('.json') &&
    !file.name.endsWith('_indice.json') &&
    file.name !== `${folderPrefix}NotaFiscal.json`
  ));
  const records = [];
  const restoredFiles = { xml: 0, pdf: 0 };

  const readSidecar = async (jsonFile, extension) => {
    const sameBaseName = jsonFile.name.replace(/\.json$/i, extension);
    const sidecar = zip.file(sameBaseName);
    if (sidecar) return sidecar;

    const parsed = JSON.parse(await jsonFile.async('string'));
    const referencedName = extension === '.xml' ? parsed._xml_arquivo : parsed._pdf_arquivo;
    if (referencedName) {
      return zip.file(`${folderPrefix}${referencedName}`) || zip.file(referencedName);
    }

    return null;
  };

  for (const file of jsonFiles) {
    const parsed = JSON.parse(await file.async('string'));
    const noteRecords = Array.isArray(parsed) ? parsed : [parsed];

    for (const record of noteRecords) {
      if (!record || typeof record !== 'object') continue;

      const enrichedRecord = { ...record };
      const xmlFile = await readSidecar(file, '.xml');
      if (xmlFile) {
        const xmlText = await xmlFile.async('string');
        if (xmlText.trim().startsWith('<')) {
          enrichedRecord.xml_original = xmlText;
          restoredFiles.xml += 1;
        }
      }

      const pdfFile = await readSidecar(file, '.pdf');
      if (pdfFile) {
        const pdfBuffer = Buffer.from(await pdfFile.async('uint8array'));
        enrichedRecord.pdf_url = await fileStore.saveBuffer({
          filename: `${enrichedRecord.tipo || 'nota'}-${enrichedRecord.numero || enrichedRecord.id || Date.now()}.pdf`,
          buffer: pdfBuffer,
        });
        restoredFiles.pdf += 1;
      }

      delete enrichedRecord._xml_arquivo;
      delete enrichedRecord._pdf_arquivo;
      records.push(enrichedRecord);
    }
  }

  return { records, restoredFiles };
};

const normalizeRestorePayload = async ({ payload, fileStore }) => {
  if (payload?.backup && typeof payload.backup === 'object') {
    return { backup: payload.backup, restoredFiles: { xml: 0, pdf: 0 } };
  }

  if (!payload?.zip_url) {
    throw Object.assign(new Error('Informe backup ou zip_url para restaurar.'), { status: 400 });
  }

  const zipBuffer = await fileStore.readFromUrl(payload.zip_url);
  const zip = await JSZip.loadAsync(zipBuffer);
  const backup = {};
  const restoredFiles = { xml: 0, pdf: 0 };

  for (const entityName of ENTITY_NAMES) {
    const directJson = zip.file(`${entityName}/${entityName}.json`) || zip.file(`${entityName}.json`);
    if (directJson) {
      backup[entityName] = JSON.parse(await directJson.async('string'));
      continue;
    }

    if (entityName === 'NotaFiscal') {
      const notas = await normalizeZipNotaFiscalRecords({ zip, fileStore });
      backup[entityName] = notas.records;
      restoredFiles.xml += notas.restoredFiles.xml;
      restoredFiles.pdf += notas.restoredFiles.pdf;
      continue;
    }

    const folderPrefix = `${entityName}/`;
    const records = [];
    const files = Object.values(zip.files).filter((file) => (
      !file.dir &&
      file.name.startsWith(folderPrefix) &&
      file.name.endsWith('.json') &&
      !file.name.endsWith('_indice.json')
    ));

    for (const file of files) {
      const parsed = JSON.parse(await file.async('string'));
      if (Array.isArray(parsed)) records.push(...parsed);
      else records.push(parsed);
    }
    if (records.length) backup[entityName] = records;
  }

  return { backup, restoredFiles };
};

const restoreBackup = async ({ store, fileStore, payload }) => {
  const { backup, restoredFiles } = await normalizeRestorePayload({ payload, fileStore });
  const resultados = {};
  let totalImportados = 0;
  let totalPulados = 0;
  let totalAtualizados = 0;

  for (const entityName of ENTITY_NAMES) {
    const records = Array.isArray(backup[entityName]) ? backup[entityName] : [];
    if (!records.length) {
      resultados[entityName] = { importados: 0, pulados: 0 };
      continue;
    }

    const current = await store.list(entityName);
    const currentById = new Map(current.map((item) => [String(item.id), item]));
    let importados = 0;
    let pulados = 0;
    let atualizados = 0;

    for (const record of records) {
      if (!record || typeof record !== 'object') {
        pulados += 1;
        continue;
      }

      const existing = record.id ? currentById.get(String(record.id)) : null;
      if (existing) {
        const merged = {
          ...existing,
          ...record,
          id: existing.id,
          created_date: existing.created_date || record.created_date,
        };
        if (JSON.stringify(existing) === JSON.stringify(merged)) {
          pulados += 1;
          continue;
        }
        const updated = await store.update(entityName, existing.id, merged);
        currentById.set(String(existing.id), updated);
        atualizados += 1;
        continue;
      }

      const created = await store.create(entityName, record);
      if (created?.id) currentById.set(String(created.id), created);
      importados += 1;
    }

    resultados[entityName] = { importados, atualizados, pulados };
    totalImportados += importados;
    totalAtualizados += atualizados;
    totalPulados += pulados;
  }

  return {
    sucesso: true,
    msg: `${totalImportados} registros importados, ${totalAtualizados} atualizados, ${totalPulados} pulados. Arquivos restaurados: ${restoredFiles.xml} XML e ${restoredFiles.pdf} PDF.`,
    totalImportados,
    totalAtualizados,
    totalPulados,
    arquivosRestaurados: restoredFiles,
    resultados,
  };
};

const findNota = async (store, payload) => {
  if (payload?.nota_id) {
    const [nota] = await store.filter('NotaFiscal', { id: payload.nota_id }, { limit: 1 });
    if (nota) return nota;
  }
  if (payload?.chave_acesso) {
    const [nota] = await store.filter('NotaFiscal', { chave_acesso: payload.chave_acesso }, { limit: 1 });
    if (nota) return nota;
  }
  return null;
};

const requireConfig = (value, message) => {
  if (!value) {
    throw Object.assign(new Error(message), { status: 400 });
  }
  return value;
};

const getConfiguracoes = async (store) => {
  const configs = await store.list('Configuracao', { sort: '-updated_date', limit: 500 });
  return new Map(configs.map((config) => [config.chave, config.valor]));
};

const getConfigValue = (configs, keys, fallback = '') => {
  for (const key of keys) {
    const value = configs.get(key) || process.env[key.toUpperCase()];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return fallback;
};

const buildBasicAuth = (apiKey) => `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

const getFocusConfig = async (store, { homologacao = false } = {}) => {
  const configs = await getConfiguracoes(store);
  const apiKey = homologacao
    ? getConfigValue(configs, ['focusnfe_api_key_homologacao', 'FOCUSNFE_API_KEY_HOMOLOGACAO', 'FOCUSNFE_HOMOLOGACAO_API_KEY'])
    : getConfigValue(configs, ['focusnfe_api_key_producao', 'focusnfe_api_key', 'FOCUSNFE_API_KEY']);

  return {
    configs,
    apiKey,
    baseUrl: homologacao ? FOCUSNFE_BASE_HOM : FOCUSNFE_BASE_PROD,
    authHeader: apiKey ? buildBasicAuth(apiKey) : '',
  };
};

const getEmitterConfig = (configs) => ({
  cnpj: onlyDigits(getConfigValue(configs, ['cnpj', 'CNPJ_EMITENTE'])),
  inscricaoEstadual: getConfigValue(configs, ['inscricao_estadual', 'INSCRICAO_ESTADUAL']),
  inscricaoMunicipal: getConfigValue(configs, ['inscricao_municipal', 'INSCRICAO_MUNICIPAL']),
  codMunicipio: getConfigValue(configs, ['cod_municipio', 'codigo_municipio', 'COD_MUNICIPIO']),
  opcaoSimples: Number(getConfigValue(configs, ['opcao_simples_nacional', 'OPCAO_SIMPLES_NACIONAL'], '3')),
  regimeTributario: Number(getConfigValue(configs, ['regime_tributario', 'REGIME_TRIBUTARIO'], '1')),
  regimeEspecial: Number(getConfigValue(configs, ['regime_especial', 'REGIME_ESPECIAL'], '0')),
  serieNfe: getConfigValue(configs, ['nfe_serie', 'NFE_SERIE'], '1'),
  serieNfce: getConfigValue(configs, ['nfce_serie', 'NFCE_SERIE'], '1'),
  serieNfse: getConfigValue(configs, ['nfse_serie_dps', 'NFSE_SERIE_DPS'], '900'),
});

const normalizarFocusUrl = (url, homologacao = false) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = homologacao ? FOCUSNFE_BASE_HOM : FOCUSNFE_BASE_PROD;
  return `${base.replace(/\/v2$/, '')}${url}`;
};

const endpointFromTipo = (tipo) => (tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe');

const mapFocusStatus = (statusFocus, currentStatus = 'Processando') => {
  if (statusFocus === 'autorizado') return 'Emitida';
  if (statusFocus === 'cancelado') return 'Cancelada';
  if (['erro_autorizacao', 'rejeitado', 'denegado', 'erro'].includes(statusFocus)) return 'Erro';
  return currentStatus;
};

const extractFocusMessage = (result) => (
  result?.erros?.map((error) => error.mensagem).filter(Boolean).join('; ') ||
  result?.mensagem_sefaz ||
  result?.mensagem ||
  ''
);

const extractFocusPdfUrl = (result, homologacao = false) => normalizarFocusUrl(
  result?.url_danfse ||
  result?.caminho_pdf_nfsen ||
  result?.caminho_pdf_nfse ||
  result?.caminho_pdf_nfce ||
  result?.caminho_danfe_nfce ||
  result?.caminho_danfe ||
  result?.url_danfe ||
  result?.caminho_pdf ||
  result?.url_pdf ||
  '',
  homologacao
);

const extractFocusXmlUrl = (result, homologacao = false) => normalizarFocusUrl(
  result?.caminho_xml_nfce ||
  result?.caminho_xml_nota_fiscal ||
  result?.caminho_xml_nfe ||
  result?.caminho_xml ||
  '',
  homologacao
);

const fetchAndStoreFile = async ({ fileStore, url, authHeader, filename }) => {
  if (!url) return '';
  const isS3 = url.includes('amazonaws.com') || url.includes('s3.');
  let response = await fetch(url, isS3 ? {} : { headers: { Authorization: authHeader } });
  if (!response.ok && response.status === 403 && !isS3) {
    response = await fetch(url);
  }
  if (!response.ok) return '';
  const buffer = Buffer.from(await response.arrayBuffer());
  return fileStore.saveBuffer({ filename, buffer });
};

const getNextNumber = async (store, chave, descricao) => {
  const configs = await store.filter('Configuracao', { chave }, { sort: '-updated_date', limit: 10 });
  const sorted = configs.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
  const current = Number.parseInt(sorted[0]?.valor || '0', 10) || 0;
  const next = current + 1;

  if (sorted[0]?.id) {
    await store.update('Configuracao', sorted[0].id, { valor: String(next), descricao });
  } else {
    await store.create('Configuracao', { chave, valor: String(next), descricao });
  }

  return next;
};

const getMunicipioCodigo = async (cidade, estado) => {
  if (!cidade || !estado) return '';
  const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${String(estado).trim().toUpperCase()}/municipios`);
  if (!response.ok) return '';
  const municipios = await response.json();
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const match = municipios.find((municipio) => normalize(municipio.nome) === normalize(cidade));
  return match?.id ? String(match.id) : '';
};

const buildFocusPayload = async ({ store, body, configs, homologacao = false }) => {
  const tipo = body.tipo || 'NFe';
  const emitter = getEmitterConfig(configs);
  requireConfig(emitter.cnpj, 'CNPJ do emitente não configurado.');
  requireConfig(emitter.codMunicipio, 'Código IBGE do município do emitente não configurado.');

  const cpfCnpj = onlyDigits(body.cliente_cpf_cnpj);
  const cep = onlyDigits(body.cliente_cep).length === 8 ? onlyDigits(body.cliente_cep) : '38700327';
  const valorTotal = Number(body.valor_total) || 1;
  const items = Array.isArray(body.items) && body.items.length
    ? body.items
    : [{ descricao: 'Peças e serviços', quantidade: 1, valor_unitario: valorTotal, valor_total: valorTotal, ncm: '87089990', cfop: '5102' }];
  const infoAdicional = [body.observacoes, body.dados_adicionais].filter(Boolean).join(' | ');
  const dataEmissao = `${body.data_emissao || new Date().toISOString().slice(0, 10)}T12:00:00-03:00`;
  const validarNcm = (ncm) => (/^[0-9]{8}$/.test(onlyDigits(ncm)) ? onlyDigits(ncm) : '87089990');
  const validarCest = (cest) => (onlyDigits(cest) ? onlyDigits(cest).padStart(7, '0') : undefined);
  const ref = `${tipo.toLowerCase()}-${Date.now()}`;

  if (tipo === 'NFSe') {
    const numeroDps = body.numero || await getNextNumber(store, 'nfse_ultimo_dps', 'Ultimo numero DPS autorizado');
    const codigoMunicipioTomador = body.codigo_municipio_tomador || await getMunicipioCodigo(body.cliente_cidade, body.cliente_estado) || emitter.codMunicipio;
    return {
      ref,
      numeroFinal: String(numeroDps),
      serie: emitter.serieNfse,
      endpoint: `/nfsen?ref=${ref}`,
      payload: {
        data_emissao: dataEmissao,
        data_competencia: body.data_emissao || new Date().toISOString().slice(0, 10),
        serie_dps: emitter.serieNfse,
        numero_dps: String(numeroDps),
        codigo_municipio_emissora: emitter.codMunicipio,
        cnpj_prestador: emitter.cnpj,
        ...(emitter.inscricaoMunicipal ? { inscricao_municipal_prestador: emitter.inscricaoMunicipal } : {}),
        codigo_opcao_simples_nacional: emitter.opcaoSimples,
        regime_tributario_simples_nacional: emitter.regimeTributario,
        regime_especial_tributacao: emitter.regimeEspecial,
        ...(cpfCnpj.length === 14 ? { cnpj_tomador: cpfCnpj } : cpfCnpj.length === 11 ? { cpf_tomador: cpfCnpj } : {}),
        razao_social_tomador: (body.cliente_nome || 'Consumidor Final').substring(0, 100),
        ...(body.cliente_email ? { email_tomador: body.cliente_email } : {}),
        codigo_municipio_tomador: codigoMunicipioTomador,
        cep_tomador: cep,
        logradouro_tomador: body.cliente_endereco || 'Rua Rui Barbosa',
        numero_tomador: body.cliente_numero || 'S/N',
        bairro_tomador: body.cliente_bairro || 'Centro',
        codigo_municipio_prestacao: emitter.codMunicipio,
        codigo_tributacao_nacional_iss: process.env.NFSE_CODIGO_TRIBUTACAO || '140101',
        descricao_servico: items.map((item) => `${item.descricao} - Qtd: ${item.quantidade} - Valor: R$ ${Number(item.valor_total || item.valor_unitario || 0).toFixed(2)}`).join('; ').substring(0, 1000),
        valor_servico: valorTotal,
        valor_iss: Number((valorTotal * Number(process.env.NFSE_ALIQUOTA_ISS || 0.025)).toFixed(2)),
        tributacao_iss: 1,
        tipo_retencao_iss: 1,
        situacao_tributaria_pis_cofins: '00',
        ...(infoAdicional ? { observacoes: infoAdicional.substring(0, 2000) } : {}),
      },
    };
  }

  const numero = body.numero || await getNextNumber(
    store,
    tipo === 'NFCe' ? 'nfce_ultimo_numero' : 'nfe_ultimo_numero',
    `Ultimo numero ${tipo} autorizado`
  );
  const codigoMunicipioDestinatario = await getMunicipioCodigo(body.cliente_cidade, body.cliente_estado);
  const commonItems = items.map((item, index) => ({
    numero_item: index + 1,
    codigo_produto: item.codigo || `REF${index + 1}`,
    descricao: (item.descricao || 'Produto').substring(0, 120),
    codigo_ncm: validarNcm(item.ncm),
    cfop: item.cfop || '5102',
    unidade_comercial: item.unidade || 'UN',
    quantidade_comercial: Number(item.quantidade) || 1,
    valor_unitario_comercial: Number(item.valor_unitario) || Number(item.valor_total) || valorTotal,
    valor_bruto: Number(item.valor_total) || Number(item.valor_unitario) || valorTotal,
    icms_origem: '0',
    icms_situacao_tributaria: '102',
    pis_situacao_tributaria: '07',
    cofins_situacao_tributaria: '07',
    ...(validarCest(item.cest) ? { cest: validarCest(item.cest) } : {}),
  }));

  return {
    ref,
    numeroFinal: String(numero),
    serie: tipo === 'NFCe' ? emitter.serieNfce : emitter.serieNfe,
    endpoint: `/${tipo === 'NFCe' ? 'nfce' : 'nfe'}?ref=${ref}`,
    payload: {
      cnpj_emitente: emitter.cnpj,
      ...(emitter.inscricaoEstadual ? { inscricao_estadual_emitente: emitter.inscricaoEstadual } : {}),
      data_emissao: dataEmissao,
      natureza_operacao: tipo === 'NFCe' ? 'VENDA AO CONSUMIDOR' : body.natureza_operacao || 'Venda de mercadoria',
      numero,
      serie: tipo === 'NFCe' ? emitter.serieNfce : emitter.serieNfe,
      modalidade_frete: '9',
      local_destino: '1',
      presenca_comprador: '1',
      ...(tipo === 'NFe' ? {
        data_saida_entrada: dataEmissao,
        finalidade_emissao: '1',
        tipo_documento: body.tipo_documento || '1',
        nome_destinatario: (body.cliente_nome || 'Consumidor Final').substring(0, 60),
        logradouro_destinatario: body.cliente_endereco || 'Rua Rui Barbosa',
        numero_destinatario: body.cliente_numero || 'S/N',
        bairro_destinatario: body.cliente_bairro || 'Centro',
        municipio_destinatario: body.cliente_cidade || 'Patos de Minas',
        ...(codigoMunicipioDestinatario ? { codigo_municipio_destinatario: codigoMunicipioDestinatario } : {}),
        uf_destinatario: body.cliente_estado || 'MG',
        cep_destinatario: cep,
        indicador_inscricao_estadual_destinatario: (!homologacao && body.cliente_ie) ? '1' : '9',
        ...(!homologacao && body.cliente_ie ? { inscricao_estadual_destinatario: onlyDigits(body.cliente_ie) } : {}),
        consumidor_final: (!homologacao && body.cliente_ie) ? '0' : '1',
      } : {}),
      ...(cpfCnpj.length === 14 ? { cnpj_destinatario: cpfCnpj } : cpfCnpj.length === 11 ? { cpf_destinatario: cpfCnpj } : {}),
      items: commonItems,
      formas_pagamento: [{
        forma_pagamento: PAYMENT_MAP[body.forma_pagamento] || '17',
        valor_pagamento: valorTotal,
      }],
      ...(infoAdicional ? { informacoes_adicionais_contribuinte: infoAdicional.substring(0, 500) } : {}),
    },
  };
};

export const createFunctionHandlers = ({ store, fileStore }) => ({
  async criarBackup() {
    return {
      sucesso: true,
      backup: await store.exportBackup(),
      generated_at: new Date().toISOString(),
    };
  },

  async restaurarBackup(payload) {
    return restoreBackup({ store, fileStore, payload });
  },

  async buscarCnpj(payload) {
    const cnpj = onlyDigits(payload?.cnpj);
    if (cnpj.length !== 14) {
      throw Object.assign(new Error('CNPJ inválido.'), { status: 400 });
    }

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!response.ok) {
      throw Object.assign(new Error(`CNPJ não encontrado (${response.status}).`), { status: response.status });
    }
    return normalizeBrasilApiCnpj(await response.json());
  },

  async buscarCodigoMunicipio(payload) {
    const cidade = String(payload?.cidade || '').trim().toLocaleLowerCase('pt-BR');
    const estado = String(payload?.estado || '').trim().toUpperCase();
    if (!cidade || !estado) {
      throw Object.assign(new Error('Informe cidade e estado.'), { status: 400 });
    }

    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`);
    if (!response.ok) {
      throw Object.assign(new Error(`Não foi possível consultar municípios (${response.status}).`), { status: response.status });
    }

    const municipios = await response.json();
    const match = municipios.find((municipio) => municipio.nome.toLocaleLowerCase('pt-BR') === cidade);
    return {
      codigo: match?.id ? String(match.id) : '',
      codigo_municipio: match?.id ? String(match.id) : '',
      nome: match?.nome || payload.cidade,
      uf: estado,
      encontrado: Boolean(match),
    };
  },

  async buscarXmlNota(payload) {
    const nota = await findNota(store, payload);
    const xml = nota?.xml_original || nota?.xml_content || '';
    return {
      sucesso: Boolean(xml),
      xml,
      xml_original: xml,
      nota_id: nota?.id || payload?.nota_id || null,
    };
  },

  async baixarXmlConteudo(payload) {
    const nota = await findNota(store, payload);
    const xml = nota?.xml_original || nota?.xml_content || '';
    return {
      sucesso: Boolean(xml),
      xml,
      conteudo: xml,
      nota_id: nota?.id || payload?.nota_id || null,
    };
  },

  async proxyPdfNota(payload) {
    const nota = await findNota(store, payload);
    return {
      sucesso: Boolean(nota?.pdf_url),
      pdf_url: nota?.pdf_url || '',
      nota_id: nota?.id || payload?.nota_id || null,
      message: nota?.pdf_url ? undefined : 'PDF ainda não está salvo para esta nota.',
    };
  },

  async reajustarEstoqueStream(payload) {
    const reajusteTipo = payload?.reajusteTipo || 'percentual';
    const reajusteValor = Number(payload?.reajusteValor || 0);
    const reajusteGrupo = payload?.reajusteGrupo || 'Todos';
    const skip = Number(payload?.skip || 0);
    const limit = Number(payload?.limit || 30);

    const allItems = await store.list('Estoque');
    const items = reajusteGrupo === 'Todos'
      ? allItems
      : allItems.filter((item) => item.categoria === reajusteGrupo);
    const page = items.slice(skip, skip + limit);
    let sucesso = 0;
    let falhas = 0;

    for (const item of page) {
      try {
        const valorAtual = Number(item.valor_venda || 0);
        const valorNovo = reajusteTipo === 'fixo'
          ? valorAtual + reajusteValor
          : valorAtual * (1 + reajusteValor / 100);
        await store.update('Estoque', item.id, { valor_venda: Number(valorNovo.toFixed(2)) });
        sucesso += 1;
      } catch (_) {
        falhas += 1;
      }
    }

    const processados = Math.min(skip + page.length, items.length);
    return {
      sucesso,
      falhas,
      total: items.length,
      processados,
      hasMore: processados < items.length,
    };
  },

  async reajustarEstoque(payload) {
    const handlers = createFunctionHandlers({ store, fileStore });
    return handlers.reajustarEstoqueStream({ ...payload, skip: 0, limit: Number.MAX_SAFE_INTEGER });
  },

  async consultarStatusNotas(payload = {}) {
    const focus = await getFocusConfig(store);
    requireConfig(focus.apiKey, 'Token Focus NFe de produção não configurado.');

    let notasParaConsultar = [];
    if (payload.nota_id && payload.ref) {
      const nota = await findNota(store, payload);
      if (nota) notasParaConsultar = [nota];
    } else {
      const processando = await store.filter('NotaFiscal', { status: 'Processando' }, { sort: '-created_date', limit: 500 });
      const aguardando = await store.filter('NotaFiscal', { status: 'Aguardando Sefin Nacional' }, { sort: '-created_date', limit: 500 });
      notasParaConsultar = [...processando, ...aguardando];
    }

    if (!notasParaConsultar.length) {
      return { sucesso: true, mensagem: 'Nenhuma nota pendente.', processadas: 0 };
    }

    const detalhes = [];
    for (const nota of notasParaConsultar) {
      const ref = nota.spedy_id || payload.ref;
      if (!ref) continue;

      const tipo = nota.tipo || payload.tipo || 'NFe';
      const endpoint = endpointFromTipo(tipo);
      const response = await fetch(`${focus.baseUrl}/${endpoint}/${ref}?completo=1`, {
        headers: { Authorization: focus.authHeader },
      });
      if (!response.ok) {
        detalhes.push({ nota_id: nota.id, ref, sucesso: false, status_http: response.status });
        continue;
      }

      const result = await response.json();
      const statusFocus = result.status || '';
      const statusInterno = mapFocusStatus(statusFocus, nota.status);
      let pdfUrlFinal = nota.pdf_url || '';
      let xmlUrlFinal = nota.xml_url || '';
      let xmlOriginal = nota.xml_original || '';

      if (statusInterno === 'Emitida') {
        const pdfUrlFocus = extractFocusPdfUrl(result);
        const xmlUrlFocus = extractFocusXmlUrl(result);
        if (!pdfUrlFinal && pdfUrlFocus) {
          pdfUrlFinal = await fetchAndStoreFile({
            fileStore,
            url: pdfUrlFocus,
            authHeader: focus.authHeader,
            filename: `nota-${nota.id || ref}.pdf`,
          }) || pdfUrlFocus;
        }
        if (!xmlOriginal && xmlUrlFocus) {
          try {
            const xmlResponse = await fetch(xmlUrlFocus, { headers: { Authorization: focus.authHeader } });
            if (xmlResponse.ok) xmlOriginal = await xmlResponse.text();
            else xmlUrlFinal = xmlUrlFocus;
          } catch (_) {
            xmlUrlFinal = xmlUrlFocus;
          }
        }
      }

      if (statusInterno !== nota.status || pdfUrlFinal || xmlOriginal || xmlUrlFinal) {
        await store.update('NotaFiscal', nota.id, {
          status: statusInterno,
          status_sefaz: statusFocus,
          mensagem_sefaz: extractFocusMessage(result),
          chave_acesso: result.chave_nfe || result.chave_nfce || result.chave_nfse || nota.chave_acesso || '',
          pdf_url: pdfUrlFinal,
          xml_url: xmlUrlFinal,
          ...(xmlOriginal ? { xml_original: xmlOriginal } : {}),
        });
      }

      detalhes.push({ nota_id: nota.id, ref, statusAnterior: nota.status, statusNovo: statusInterno, statusFocus });
    }

    return {
      sucesso: true,
      processadas: detalhes.length,
      status: detalhes[0]?.statusNovo || notasParaConsultar[0]?.status || 'Processando',
      detalhes,
    };
  },

  async cancelarNota(payload = {}) {
    const focus = await getFocusConfig(store);
    requireConfig(focus.apiKey, 'Token Focus NFe de produção não configurado.');
    requireConfig(payload.nota_id, 'nota_id é obrigatório.');

    const nota = await findNota(store, payload);
    if (!nota) {
      throw Object.assign(new Error('Nota fiscal não encontrada.'), { status: 404 });
    }

    const referencia = nota.spedy_id || payload.ref;
    requireConfig(referencia, 'Referência (spedy_id) não encontrada para esta nota.');

    const tipo = payload.tipo || nota.tipo || 'NFCe';
    const endpoint = endpointFromTipo(tipo);
    const response = await fetch(`${focus.baseUrl}/${endpoint}/${referencia}`, {
      method: 'DELETE',
      headers: {
        Authorization: focus.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ justificativa: payload.justificativa || 'Cancelamento solicitado pelo emitente.' }),
    });

    const text = await response.text();
    let result = {};
    try {
      result = text ? JSON.parse(text) : {};
    } catch (_) {
      throw Object.assign(new Error(`Resposta inválida da Focus NFe: ${text.substring(0, 200)}`), { status: 400 });
    }

    if (result.status === 'cancelado') {
      await store.update('NotaFiscal', nota.id, {
        status: 'Cancelada',
        status_sefaz: result.status_sefaz || 'cancelado',
        mensagem_sefaz: result.mensagem_sefaz || 'Cancelada com sucesso',
      });
      return {
        sucesso: true,
        mensagem: 'Nota cancelada com sucesso',
        numero_protocolo: result.numero_protocolo,
        mensagem_sefaz: result.mensagem_sefaz,
      };
    }

    const processingStatuses = [
      'cancelamento_aguardando_autorizacao',
      'cancelamento_em_homologacao',
      'cancelamento_em_processamento',
    ];
    if (processingStatuses.includes(result.status)) {
      await store.update('NotaFiscal', nota.id, {
        status: 'Processando',
        status_sefaz: result.status,
        mensagem_sefaz: result.mensagem_sefaz || 'Cancelamento enviado, aguardando autorização SEFAZ',
      });
      return {
        sucesso: true,
        mensagem: 'Cancelamento enviado — aguardando autorização da SEFAZ',
        status: result.status,
        mensagem_sefaz: result.mensagem_sefaz,
      };
    }

    const message = extractFocusMessage(result) || `Erro ${response.status}: ${text}`;
    return { sucesso: false, erro: message, debug: result };
  },

  async emitirNotaFiscal(payload = {}) {
    const homologacao = payload.homologacao === true;
    const focus = await getFocusConfig(store, { homologacao });
    requireConfig(focus.apiKey, homologacao
      ? 'Token Focus NFe de homologação não configurado.'
      : 'Token Focus NFe de produção não configurado.');

    const notaExistente = payload.nota_id ? await findNota(store, payload) : null;
    if (notaExistente?.spedy_id) {
      const endpoint = endpointFromTipo(notaExistente.tipo || payload.tipo || 'NFe');
      const existingResponse = await fetch(`${focus.baseUrl}/${endpoint}/${notaExistente.spedy_id}?completo=1`, {
        headers: { Authorization: focus.authHeader },
      });
      if (existingResponse.ok) {
        const existing = await existingResponse.json();
        const statusInterno = mapFocusStatus(existing.status, notaExistente.status);
        if (['Emitida', 'Processando'].includes(statusInterno)) {
          await store.update('NotaFiscal', notaExistente.id, {
            status: statusInterno,
            status_sefaz: existing.status || '',
            mensagem_sefaz: extractFocusMessage(existing),
          });
          return {
            sucesso: true,
            mensagem: statusInterno === 'Emitida'
              ? 'Nota já estava autorizada na SEFAZ. Status atualizado.'
              : 'Nota ainda em processamento na SEFAZ.',
            status: statusInterno,
          };
        }
      }
    }

    const built = await buildFocusPayload({ store, body: payload, configs: focus.configs, homologacao });
    if (payload.nota_id) {
      await store.update('NotaFiscal', payload.nota_id, {
        spedy_id: built.ref,
        status: 'Processando',
        ...(!homologacao ? { numero: built.numeroFinal } : {}),
      });
    }

    const response = await fetch(`${focus.baseUrl}${built.endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: focus.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(built.payload),
    });
    const text = await response.text();
    let result = {};
    try {
      result = text ? JSON.parse(text) : {};
    } catch (_) {
      throw Object.assign(new Error(`Resposta inválida da Focus NFe: ${text.substring(0, 200)}`), { status: 400 });
    }

    if (!response.ok) {
      const erro = extractFocusMessage(result) || JSON.stringify(result);
      if (payload.nota_id) {
        await store.update('NotaFiscal', payload.nota_id, { status: 'Rascunho', mensagem_sefaz: erro });
      }
      return { sucesso: false, erro, status: 'Erro' };
    }

    let resultFinal = result;
    const endpointConsulta = endpointFromTipo(payload.tipo || 'NFe');
    const maxTentativas = payload.tipo === 'NFSe' ? 6 : 4;
    for (let attempt = 0; attempt < maxTentativas && !['autorizado', 'erro_autorizacao', 'rejeitado', 'erro'].includes(resultFinal.status); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, payload.tipo === 'NFSe' ? 3000 : 1500));
      const consulta = await fetch(`${focus.baseUrl}/${endpointConsulta}/${built.ref}?completo=1`, {
        headers: { Authorization: focus.authHeader },
      });
      if (consulta.ok) resultFinal = await consulta.json();
    }

    const statusNota = mapFocusStatus(resultFinal.status, 'Processando');
    const pdfUrlFocus = statusNota === 'Emitida' ? extractFocusPdfUrl(resultFinal, homologacao) : '';
    const xmlUrlFocus = statusNota === 'Emitida' ? extractFocusXmlUrl(resultFinal, homologacao) : '';
    const pdfUrlFinal = pdfUrlFocus
      ? await fetchAndStoreFile({ fileStore, url: pdfUrlFocus, authHeader: focus.authHeader, filename: `nota-${payload.nota_id || built.ref}.pdf` }) || pdfUrlFocus
      : '';
    let xmlOriginal = '';
    let xmlUrl = '';
    if (xmlUrlFocus) {
      try {
        const xmlResponse = await fetch(xmlUrlFocus, { headers: { Authorization: focus.authHeader } });
        if (xmlResponse.ok) xmlOriginal = await xmlResponse.text();
        else xmlUrl = xmlUrlFocus;
      } catch (_) {
        xmlUrl = xmlUrlFocus;
      }
    }

    const notaData = {
      tipo: payload.tipo || 'NFe',
      xml_content: JSON.stringify(payload.items || []),
      cliente_cpf_cnpj: payload.cliente_cpf_cnpj || '',
      cliente_ie: payload.cliente_ie || '',
      cliente_email: payload.cliente_email || '',
      cliente_telefone: payload.cliente_telefone || '',
      cliente_endereco: payload.cliente_endereco || '',
      cliente_numero: payload.cliente_numero || '',
      cliente_bairro: payload.cliente_bairro || '',
      cliente_cep: payload.cliente_cep || '',
      cliente_cidade: payload.cliente_cidade || '',
      cliente_estado: payload.cliente_estado || '',
      forma_pagamento: payload.forma_pagamento || '',
      numero: built.numeroFinal,
      serie: built.serie,
      status: statusNota,
      spedy_id: built.ref,
      cliente_id: payload.cliente_id || '',
      cliente_nome: payload.cliente_nome || '',
      data_emissao: payload.data_emissao || new Date().toISOString().slice(0, 10),
      valor_total: Number(payload.valor_total) || 0,
      pdf_url: pdfUrlFinal,
      ...(xmlOriginal ? { xml_original: xmlOriginal } : {}),
      ...(xmlUrl ? { xml_url: xmlUrl } : {}),
      chave_acesso: resultFinal.chave_nfe || resultFinal.chave_nfce || resultFinal.chave_nfse || '',
      ordem_venda_id: payload.ordem_venda_id || '',
      observacoes: payload.observacoes || '',
      dados_adicionais: payload.dados_adicionais || '',
      mensagem_sefaz: extractFocusMessage(resultFinal),
      status_sefaz: resultFinal.status || '',
    };

    if (payload.nota_id) {
      await store.update('NotaFiscal', payload.nota_id, notaData);
    } else {
      await store.create('NotaFiscal', notaData);
    }

    return {
      sucesso: statusNota !== 'Erro',
      mensagem: statusNota === 'Emitida'
        ? 'Nota fiscal autorizada com sucesso!'
        : statusNota === 'Processando'
          ? 'Nota enviada para processamento. O status será atualizado automaticamente.'
          : `Erro na emissão: ${notaData.mensagem_sefaz}`,
      pdf: pdfUrlFinal,
      status: statusNota,
      mensagem_sefaz: notaData.mensagem_sefaz,
    };
  },

  async preVisualizarNota() {
    return integrationPending('preVisualizarNota');
  },

  async danfeNfce() {
    return integrationPending('danfeNfce');
  },

  async consultarNotasRecebidas() {
    return integrationPending('consultarNotasRecebidas');
  },

  async importarNfseRecebidas() {
    return integrationPending('importarNfseRecebidas');
  },

  async recuperarArquivosAusentes() {
    return integrationPending('recuperarArquivosAusentes');
  },

  async restaurarNFVendasAgressivo() {
    return integrationPending('restaurarNFVendasAgressivo');
  },

  async gerarBoleto(payload = {}) {
    const { financeiro_id, nome, cpf_cnpj, email, valor, vencimento, descricao } = payload;
    if (!nome || !cpf_cnpj || !valor || !vencimento) {
      throw Object.assign(new Error('Campos obrigatórios: nome, cpf_cnpj, valor, vencimento.'), { status: 400 });
    }

    const configs = await getConfiguracoes(store);
    const apiKey = getConfigValue(configs, ['asaas_api_key', 'ASAAS_API_KEY']);
    requireConfig(apiKey, 'Token Asaas não configurado.');
    const headers = {
      'Content-Type': 'application/json',
      access_token: apiKey,
    };
    const cpfLimpo = onlyDigits(cpf_cnpj);

    const busca = await fetch(`${ASAAS_BASE}/customers?cpfCnpj=${cpfLimpo}&limit=1`, { headers });
    let customerId = null;
    if (busca.ok) {
      const result = await busca.json();
      customerId = result.data?.[0]?.id || null;
    }

    if (!customerId) {
      const criar = await fetch(`${ASAAS_BASE}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: nome,
          cpfCnpj: cpfLimpo,
          email: email || undefined,
        }),
      });
      const novoCliente = await criar.json();
      if (!criar.ok) {
        return { sucesso: false, erro: 'Erro ao criar cliente no Asaas', detalhe: novoCliente };
      }
      customerId = novoCliente.id;
    }

    const respBoleto = await fetch(`${ASAAS_BASE}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: 'BOLETO',
        value: Number(valor),
        dueDate: vencimento,
        description: descricao || 'Cobrança',
      }),
    });
    const boleto = await respBoleto.json();
    if (!respBoleto.ok) {
      return { sucesso: false, erro: 'Erro ao criar boleto no Asaas', detalhe: boleto };
    }

    const linkResp = await fetch(`${ASAAS_BASE}/payments/${boleto.id}/identificationField`, { headers });
    const linkData = linkResp.ok ? await linkResp.json() : {};
    const resultado = {
      sucesso: true,
      asaas_id: boleto.id,
      boleto_url: boleto.bankSlipUrl || boleto.invoiceUrl,
      linha_digitavel: linkData.identificationField || boleto.nossoNumero,
      vencimento: boleto.dueDate,
      valor: boleto.value,
      status: boleto.status,
    };

    if (financeiro_id) {
      await store.update('Financeiro', financeiro_id, {
        forma_pagamento: 'Boleto',
        observacoes: [
          `Boleto Asaas ID: ${boleto.id}`,
          resultado.boleto_url ? `Link: ${resultado.boleto_url}` : null,
          resultado.linha_digitavel ? `Linha: ${resultado.linha_digitavel}` : null,
        ].filter(Boolean).join('\n'),
      });
    }

    return resultado;
  },
});

export const extractDataFromUploadedFile = async ({ fileStore, payload }) => {
  const buffer = await fileStore.readFromUrl(payload?.file_url);
  const rows = parseWorksheet(buffer);
  return {
    status: 'success',
    output: {
      items: rows,
    },
  };
};
