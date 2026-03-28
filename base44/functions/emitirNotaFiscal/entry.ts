import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const {
      tipo, cliente_nome, cliente_cpf_cnpj, cliente_email,
      cliente_numero, cliente_endereco, cliente_bairro, cliente_cep,
      cliente_cidade, cliente_estado, items, valor_total,
      forma_pagamento, observacoes, nota_id, cliente_id,
      data_emissao, serie_manual,
    } = body;

    // Usa a data do formulário com horário fixo 08:00 Brasília para evitar E0008
    const pad = (n) => String(n).padStart(2, '0');
    const agora = new Date();
    const brasiliaMs = agora.getTime() + (-3 * 60 * 60 * 1000);
    const brasiliaDate = new Date(brasiliaMs);
    const hojeStr = `${brasiliaDate.getUTCFullYear()}-${pad(brasiliaDate.getUTCMonth() + 1)}-${pad(brasiliaDate.getUTCDate())}`;
    const dataBase = data_emissao || hojeStr;
    const dataEmissaoISO = `${dataBase}T08:00:00-03:00`;

    const ref = `${(tipo || 'nfe').toLowerCase()}-${Date.now()}`;

    // Valida NCM: deve ter exatamente 8 dígitos numéricos, caso contrário usa padrão
    const NCM_PADRAO = '87089990';
    const validarNcm = (ncm) => /^[0-9]{8}$/.test((ncm || '').replace(/\D/g, '')) ? (ncm || '').replace(/\D/g, '') : NCM_PADRAO;
    const validarCest = (cest) => { if (!cest) return null; const s = (cest || '').replace(/\D/g, ''); return s.length > 0 ? s.padStart(7, '0') : null; };

    let cpfCnpjLimpo = (cliente_cpf_cnpj || '').replace(/\D/g, '');
    let cepLimpo = (cliente_cep || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) cepLimpo = '38700327';

    let endpoint = '';
    let payload = null;

    if (tipo === 'NFSe') {
      endpoint = `/nfse?ref=${ref}`;
      const discriminacao = items && items.length > 0
        ? items.map(i => `${i.descricao} (Qtd: ${i.quantidade})`).join('; ')
        : (observacoes || 'Serviços de manutenção e reparação mecânica');
      payload = {
        provedor: 'nacional',
        data_emissao: dataEmissaoISO,
        prestador: {
          cnpj: CNPJ_EMITENTE,
          inscricao_municipal: INSCRICAO_MUNICIPAL,
          codigo_municipio: COD_MUNICIPIO_PATOS,
          regime_tributario: 1,
          regime_especial_tributacao: 0,
          optante_simples_nacional: true,
        },
        tomador: {
          razao_social: (cliente_nome || 'Consumidor Final').substring(0, 100),
          ...(cpfCnpjLimpo.length === 14 ? { cnpj: cpfCnpjLimpo } : { cpf: cpfCnpjLimpo }),
          ...(cliente_email ? { email: cliente_email } : {}),
          endereco: {
            logradouro: cliente_endereco || 'Rua Rui Barbosa',
            numero: cliente_numero || '1355',
            bairro: cliente_bairro || 'Santa Terezinha',
            codigo_municipio: COD_MUNICIPIO_PATOS,
            uf: cliente_estado || 'MG',
            cep: cepLimpo,
          },
        },
        servico: {
          valor_servicos: Number(valor_total) || 1.0,
          discriminacao: discriminacao.substring(0, 1000),
          item_lista_servico: '140101',
          exigibilidade_iss: 1,
          iss_retido: false,
        },
      };
    } else if (tipo === 'NFCe') {
      endpoint = `/nfce?ref=${ref}`;
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
        ...(body.numero ? { numero: Number(body.numero) } : {}),
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        ...(serie_manual ? { serie: serie_manual } : {}),
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
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        logradouro_destinatario: cliente_endereco || 'Rua Rui Barbosa',
        numero_destinatario: cliente_numero || '1355',
        bairro_destinatario: cliente_bairro || 'Santa Terezinha',
        municipio_destinatario: cliente_cidade || 'Patos de Minas',
        uf_destinatario: cliente_estado || 'MG',
        cep_destinatario: cepLimpo,
        indicador_inscricao_estadual_destinatario: cpfCnpjLimpo.length === 14
          ? ((body.cliente_ie && body.cliente_ie.trim()) ? '1' : '9')
          : '9',
        ...(cpfCnpjLimpo.length === 14 && body.cliente_ie && body.cliente_ie.trim() ? { inscricao_estadual_destinatario: body.cliente_ie.trim() } : {}),
        consumidor_final: cpfCnpjLimpo.length === 11 || !(body.cliente_ie && body.cliente_ie.trim()) ? '1' : '0',
        modalidade_frete: '9',
        ...(body.numero ? { numero: Number(body.numero) } : {}),
        ...(serie_manual ? { serie: serie_manual } : {}),
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

    const resp = await fetch(`${FOCUSNFE_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_HEADER },
      body: JSON.stringify(payload),
    });

    const responseText = await resp.text();
    let result;
    try { result = JSON.parse(responseText); } catch {
      return Response.json({ sucesso: false, erro: `Resposta inválida: ${responseText.substring(0, 200)}` });
    }

    if (!resp.ok) {
      const msgErro = result.erros
        ? result.erros.map(e => e.mensagem).join('; ')
        : (result.mensagem || JSON.stringify(result));
      return Response.json({ sucesso: false, erro: msgErro });
    }

    const pdfUrl = normalizarUrl(result.caminho_pdf_nfse || result.caminho_danfe || '');
    const chaveAcesso = result.chave_nfe || '';
    const mensagemSefaz = result.erros?.[0]?.mensagem || result.mensagem_sefaz || result.mensagem || '';
    
    let statusNota = 'Processando';
    if (result.status === 'autorizado') statusNota = 'Emitida';
    else if (result.status === 'erro_autorizacao' || result.status === 'rejeitado') {
      // Detecta erro E0160 (delay do Portal Nacional)
      if (mensagemSefaz.includes('E0160')) {
        statusNota = 'Erro de Sincronia Governamental';
      } else {
        statusNota = 'Erro';
      }
    }

    const notaData = {
      tipo,
      status: statusNota,
      spedy_id: ref,
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      data_emissao: data_emissao || new Date().toISOString().split('T')[0],
      valor_total: Number(valor_total) || 0,
      pdf_url: pdfUrl,
      chave_acesso: chaveAcesso,
      ordem_servico_id: body.ordem_servico_id || '',
      observacoes: observacoes || '',
      mensagem_sefaz: mensagemSefaz,
    };

    // Tenta atualizar nota existente; se não existir, cria nova
    if (nota_id) {
      try {
        await base44.asServiceRole.entities.NotaFiscal.update(nota_id, notaData);
      } catch (_) {
        await base44.asServiceRole.entities.NotaFiscal.create(notaData);
      }
    } else {
      await base44.asServiceRole.entities.NotaFiscal.create(notaData);
    }

    const mensagem = tipo === 'NFCe'
      ? 'NFCe autorizada com sucesso!'
      : 'Nota enviada para processamento. Aguarde autorização da SEFAZ.';

    // Salva o número usado para manter sequência correta
    if (body.numero && (statusNota === 'Emitida' || statusNota === 'Processando')) {
      let chave = tipo === 'NFCe' ? 'nfce_ultimo_numero' : tipo === 'NFSe' ? 'nfse_ultimo_numero' : 'nfe_ultimo_numero';
      const configs = await base44.asServiceRole.entities.Configuracao.filter({ chave });
      const ultimoLocal = parseInt(configs[0]?.valor || '0', 10);
      const numeroAtual = parseInt(body.numero, 10);
      if (numeroAtual > ultimoLocal) {
        if (configs.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configs[0].id, { valor: String(numeroAtual) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave, valor: String(numeroAtual), descricao: `Último número ${tipo} autorizado` });
        }
      }
    }

    return Response.json({ sucesso: true, mensagem, pdf: pdfUrl, status: statusNota, mensagem_sefaz: mensagemSefaz });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message });
  }
});