import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { ENTITY_NAMES } from '../config/entities.js';

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

const normalizeRestorePayload = async ({ payload, fileStore }) => {
  if (payload?.backup && typeof payload.backup === 'object') {
    return payload.backup;
  }

  if (!payload?.zip_url) {
    throw Object.assign(new Error('Informe backup ou zip_url para restaurar.'), { status: 400 });
  }

  const zipBuffer = await fileStore.readFromUrl(payload.zip_url);
  const zip = await JSZip.loadAsync(zipBuffer);
  const backup = {};

  for (const entityName of ENTITY_NAMES) {
    const directJson = zip.file(`${entityName}/${entityName}.json`) || zip.file(`${entityName}.json`);
    if (directJson) {
      backup[entityName] = JSON.parse(await directJson.async('string'));
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

  return backup;
};

const restoreBackup = async ({ store, fileStore, payload }) => {
  const backup = await normalizeRestorePayload({ payload, fileStore });
  const resultados = {};
  let totalImportados = 0;
  let totalPulados = 0;

  for (const entityName of ENTITY_NAMES) {
    const records = Array.isArray(backup[entityName]) ? backup[entityName] : [];
    if (!records.length) {
      resultados[entityName] = { importados: 0, pulados: 0 };
      continue;
    }

    const current = await store.list(entityName);
    const existingIds = new Set(current.map((item) => String(item.id)));
    const nextRecords = [...current];
    let importados = 0;
    let pulados = 0;

    for (const record of records) {
      if (record?.id && existingIds.has(String(record.id))) {
        pulados += 1;
        continue;
      }
      nextRecords.push(record);
      if (record?.id) existingIds.add(String(record.id));
      importados += 1;
    }

    await store.replaceAll(entityName, nextRecords);
    resultados[entityName] = { importados, pulados };
    totalImportados += importados;
    totalPulados += pulados;
  }

  return {
    sucesso: true,
    msg: `${totalImportados} registros importados, ${totalPulados} pulados.`,
    totalImportados,
    totalPulados,
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

  async consultarStatusNotas() {
    return integrationPending('consultarStatusNotas');
  },

  async cancelarNota() {
    return integrationPending('cancelarNota');
  },

  async emitirNotaFiscal() {
    return integrationPending('emitirNotaFiscal');
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

  async gerarBoleto() {
    return integrationPending('gerarBoleto');
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
