import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Emite nota fiscal via Focus NFe.
 * - NFSe → POST /nfse
 * - NFe  → POST /nfe
 * - NFCe → POST /nfce
 *
 * Auth: Basic HTTP com API_KEY como usuário e senha vazia.
 * Docs: https://focusnfe.com.br/doc/
 */

const PAYMENT_MAP = {
  'Dinheiro': '01',
  'Cartão de Crédito': '03',
  'Cartão de Débito': '04',
  'PIX': '17',
  'Boleto': '15',
  'Transferência': '03',
  'A Prazo': '99',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      nota_id, serie_manual, tipo,
      cliente_id, cliente_nome, cliente_cpf_cnpj, cliente_email, cliente_telefone,
      cliente_endereco, cliente_numero, cliente_bairro, cliente_cep, cliente_cidade, cliente_estado,
      ordem_servico_id, items, valor_total, forma_pagamento, observacoes, data_emissao,
    } = body;

    // 1. Busca configurações
    const configs = await base44.asServiceRole.entities.Configuracao.list();
    const apiKey = Deno.env.get('FOCUSNFE_API_KEY') || configs.find(c => c.chave === 'focusnfe_api_key')?.valor?.trim();
    const ambiente = configs.find(c => c.chave === 'focusnfe_ambiente')?.valor || 'homologacao';

    if (!apiKey) {
      return Response.json({ sucesso: false, erro: 'Chave API Focus NFe não configurada.' }, { status: 400 });
    }

    const baseUrl = ambiente === 'producao'
      ? 'https://api.focusnfe.com.br/v2'
      : 'https://homologacao.focusnfe.com.br/v2';

    const authHeader = 'Basic ' + btoa(apiKey + ':');
    const ref = `${tipo}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const cpfCnpj = (cliente_cpf_cnpj || '').replace(/\D/g, '') || null;
    const serieNum = parseInt(serie_manual || '1', 10) || 1;
    const dataEmissao = data_emissao || new Date().toISOString().split('T')[0];

    let endpoint = '';
    let payload = {};

    // ─────────────────────────────────────────────
    // NFSe — Nota Fiscal de Serviço Eletrônica
    // ─────────────────────────────────────────────
    if (tipo === 'NFSe') {
      endpoint = `/nfse?ref=${ref}`;

      const servicoItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Serviços', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total) }
      ];

      // Pega dados do emitente das configurações
      const cfgCnpjEmit = configs.find(c => c.chave === 'cnpj')?.valor || '';
      const cfgCidadeEmit = configs.find(c => c.chave === 'cidade')?.valor || '';
      const cfgCodigoMun = configs.find(c => c.chave === 'codigo_municipio')?.valor || '';
      const cfgCodigoServico = configs.find(c => c.chave === 'codigo_servico')?.valor || '07498';
      const cfgAliquota = parseFloat(configs.find(c => c.chave === 'aliquota_iss')?.valor || '2.0');

      payload = {
        data_emissao: dataEmissao,
        prestador: {
          cnpj: cfgCnpjEmit.replace(/\D/g, ''),
          codigo_municipio: cfgCodigoMun || undefined,
        },
        tomador: {
          ...(cpfCnpj && cpfCnpj.length === 11 ? { cpf: cpfCnpj } : {}),
          ...(cpfCnpj && cpfCnpj.length === 14 ? { cnpj: cpfCnpj } : {}),
          razao_social: cliente_nome || 'Consumidor Final',
          ...(cliente_email ? { email: cliente_email } : {}),
          ...(cliente_telefone ? { telefone: cliente_telefone.replace(/\D/g, '') } : {}),
          ...(cliente_endereco ? {
            endereco: {
              logradouro: cliente_endereco,
              numero: cliente_numero || 'S/N',
              bairro: cliente_bairro || '',
              codigo_municipio: cfgCodigoMun || undefined,
              nome_municipio: cliente_cidade || cfgCidadeEmit || '',
              cep: (cliente_cep || '').replace(/\D/g, ''),
              uf: cliente_estado || 'MG',
            }
          } : {}),
        },
        items: servicoItems.map((it, idx) => ({
          descricao: (it.descricao || `Serviço ${idx + 1}`).substring(0, 120),
          quantidade: Number(it.quantidade) || 1,
          valor_unitario: Number(it.valor_unitario) || Number(it.valor_total) || 0,
          valor_total: Number(it.valor_total) || 0,
          codigo_servico: cfgCodigoServico,
          aliquota_iss: cfgAliquota,
          iss_retido: '2', // 2 = não retido
          ...(observacoes ? { discriminacao: observacoes } : {}),
        })),
        ...(observacoes ? { observacoes } : {}),
      };

    // ─────────────────────────────────────────────
    // NFCe — Nota Fiscal ao Consumidor Eletrônica
    // ─────────────────────────────────────────────
    } else if (tipo === 'NFCe') {
      endpoint = `/nfce?ref=${ref}`;

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Produtos', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total) }
      ];

      const formaPgto = PAYMENT_MAP[forma_pagamento] || '01';

      payload = {
        data_emissao: `${dataEmissao}T12:00:00-03:00`,
        serie: String(serieNum),
        // Consumidor final – CPF opcional
        ...(cpfCnpj ? { destinatario_cpf_cnpj: cpfCnpj, destinatario_nome: cliente_nome || 'Consumidor Final' } : {}),
        presenca_comprador: '1', // operação presencial
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: `PROD-${String(idx + 1).padStart(3, '0')}`,
          descricao: (it.descricao || `Produto ${idx + 1}`).substring(0, 120),
          ncm: '87089990',
          cfop: '5102',
          unidade_comercial: 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(it.valor_total) || 0,
          valor_bruto: Number(it.valor_total) || 0,
          unidade_tributavel: 'UN',
          quantidade_tributavel: Number(it.quantidade) || 1,
          valor_unitario_tributavel: Number(it.valor_unitario) || Number(it.valor_total) || 0,
          codigo_tributario_municipio: undefined,
          icms_situacao_tributaria: '400', // CSOSN 400 – Simples
          icms_origem: '0',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
        })),
        formas_pagamento: [{
          forma_pagamento: formaPgto,
          valor_pagamento: Number(valor_total),
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes } : {}),
      };

    // ─────────────────────────────────────────────
    // NFe — Nota Fiscal Eletrônica (produtos)
    // ─────────────────────────────────────────────
    } else {
      endpoint = `/nfe?ref=${ref}`;

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Produtos', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total) }
      ];

      const formaPgto = PAYMENT_MAP[forma_pagamento] || '01';

      payload = {
        natureza_operacao: 'Venda de mercadoria',
        data_emissao: `${dataEmissao}T12:00:00-03:00`,
        data_saida_entrada: `${dataEmissao}T12:00:00-03:00`,
        tipo_documento: '1', // saída
        finalidade_emissao: '1', // normal
        serie: String(serieNum),
        indicador_presenca: '1',
        // Destinatário
        ...(cpfCnpj && cpfCnpj.length === 11
          ? { destinatario_cpf: cpfCnpj }
          : cpfCnpj && cpfCnpj.length === 14
            ? { destinatario_cnpj: cpfCnpj }
            : {}),
        destinatario_nome: cliente_nome || 'Consumidor Final',
        destinatario_indicador_ie: '9', // não contribuinte
        ...(cliente_email ? { destinatario_email: cliente_email } : {}),
        ...(cliente_endereco ? {
          destinatario_logradouro: cliente_endereco,
          destinatario_numero: cliente_numero || 'S/N',
          destinatario_bairro: cliente_bairro || '',
          destinatario_municipio: cliente_cidade || '',
          destinatario_uf: cliente_estado || 'MG',
          destinatario_cep: (cliente_cep || '').replace(/\D/g, ''),
          destinatario_pais: '1058',
          destinatario_telefone: cliente_telefone ? cliente_telefone.replace(/\D/g, '') : undefined,
        } : {}),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: `PROD-${String(idx + 1).padStart(3, '0')}`,
          descricao: (it.descricao || `Produto ${idx + 1}`).substring(0, 120),
          ncm: '87089990',
          cfop: '5405',
          unidade_comercial: 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(it.valor_total) || 0,
          valor_bruto: Number(it.valor_total) || 0,
          unidade_tributavel: 'UN',
          quantidade_tributavel: Number(it.quantidade) || 1,
          valor_unitario_tributavel: Number(it.valor_unitario) || Number(it.valor_total) || 0,
          icms_situacao_tributaria: '400',
          icms_origem: '0',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
        })),
        formas_pagamento: [{
          forma_pagamento: formaPgto,
          valor_pagamento: Number(valor_total),
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes } : {}),
      };
    }

    // 2. Envia para Focus NFe
    console.log(`[${tipo}] Enviando para Focus NFe:`, endpoint);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const resp = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await resp.text();
    console.log(`Focus NFe status: ${resp.status}`);
    console.log(`Focus NFe response: ${rawText.substring(0, 800)}`);

    let result = {};
    try { result = JSON.parse(rawText); } catch (_) { result = { raw: rawText }; }

    if (!resp.ok) {
      const erros = result.erros?.map(e => e.mensagem || JSON.stringify(e)).join('; ')
        || result.mensagem || rawText.substring(0, 400);
      return Response.json({ sucesso: false, erro: `Erro Focus NFe (${resp.status}): ${erros}`, detalhes: result }, { status: 400 });
    }

    // 3. Sequência numérica por tipo
    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 200);
    const nums = todasNotas.filter(n => n.tipo === tipo).map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
    const proximoNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;

    // 4. Salva no banco
    const notaData = {
      tipo,
      numero: String(proximoNum),
      serie: String(serieNum),
      status: 'Emitida',
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      ordem_servico_id: ordem_servico_id || '',
      valor_total: Number(valor_total),
      spedy_id: result.ref || ref,
      data_emissao: dataEmissao,
      observacoes: observacoes || '',
      chave_acesso: result.chave_nfe || result.chave_nfce || result.chave_nfse || '',
      pdf_url: result.caminho_danfe || result.caminho_pdf_nfse || '',
      xml_url: result.caminho_xml_nota_fiscal || '',
    };

    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, notaData);
    } else {
      await base44.asServiceRole.entities.NotaFiscal.create(notaData);
    }

    return Response.json({
      sucesso: true,
      ref,
      numero: String(proximoNum),
      status: result.status || 'processando',
      mensagem: `${tipo} nº ${proximoNum} (série ${serieNum}) enfileirada no Focus NFe. Status: ${result.status || 'processando'}`,
    });

  } catch (error) {
    console.error('Erro emitirNotaFiscal:', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});