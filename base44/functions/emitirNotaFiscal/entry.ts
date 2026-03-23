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
      nota_id, tipo,
      cliente_id, cliente_nome, cliente_cpf_cnpj, cliente_email, cliente_telefone,
      cliente_endereco, cliente_numero, cliente_bairro, cliente_cep, cliente_cidade, cliente_estado,
      ordem_servico_id, items, valor_total, forma_pagamento, observacoes, data_emissao,
    } = body;

    // 1. Busca configurações
    const configs = await base44.asServiceRole.entities.Configuracao.list();
    const apiKey = Deno.env.get('FOCUSNFE_API_KEY') || configs.find(c => c.chave === 'focusnfe_api_key')?.valor?.trim();
    const ambiente = configs.find(c => c.chave === 'focusnfe_ambiente')?.valor || 'producao';

    if (!apiKey) {
      return Response.json({ sucesso: false, erro: 'Chave API Focus NFe não configurada. Acesse Configurações e salve a chave FOCUSNFE_API_KEY.' }, { status: 400 });
    }

    const baseUrl = ambiente === 'homologacao'
      ? 'https://homologacao.focusnfe.com.br/v2'
      : 'https://api.focusnfe.com.br/v2';

    const authHeader = 'Basic ' + btoa(apiKey + ':');

    const cpfCnpj = (cliente_cpf_cnpj || '').replace(/\D/g, '') || null;
    const dataEmissao = data_emissao || new Date().toISOString().split('T')[0];

    // 2. Calcula próximo número ANTES de montar o payload (precisamos dele no payload)
    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 200);
    let proximoNum;
    let serieUsada;

    if (tipo === 'NFCe') {
      const cfgUltimoNFCe = configs.find(c => c.chave === 'nfce_ultimo_numero');
      const ultimoSalvo = parseInt(cfgUltimoNFCe?.valor || '0', 10);
      const numsNFCe = todasNotas.filter(n => n.tipo === 'NFCe').map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
      const ultimoNota = numsNFCe.length > 0 ? Math.max(...numsNFCe) : 0;
      proximoNum = Math.max(ultimoSalvo, ultimoNota) + 1;
      serieUsada = configs.find(c => c.chave === 'nfce_serie')?.valor || '1';
    } else {
      const nums = todasNotas.filter(n => n.tipo === tipo).map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
      proximoNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      // serie_manual vem do payload (campo Série no form)
      serieUsada = body.serie_manual || '1';
    }

    const ref = `${tipo.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

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

      const cfgCnpjEmit = configs.find(c => c.chave === 'cnpj')?.valor || '';
      const cfgCodigoMun = configs.find(c => c.chave === 'codigo_municipio')?.valor || '';
      const cfgCodigoServico = configs.find(c => c.chave === 'codigo_servico')?.valor || '07498';
      const cfgAliquota = parseFloat(configs.find(c => c.chave === 'aliquota_iss')?.valor || '2.0');

      payload = {
        data_emissao: dataEmissao,
        prestador: {
          cnpj: cfgCnpjEmit.replace(/\D/g, ''),
          ...(cfgCodigoMun ? { codigo_municipio: cfgCodigoMun } : {}),
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
              ...(cfgCodigoMun ? { codigo_municipio: cfgCodigoMun } : {}),
              nome_municipio: cliente_cidade || '',
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
          iss_retido: '2',
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

      const cfgCnpjEmit = configs.find(c => c.chave === 'cnpj')?.valor || '';
      // Focus NFe: csc_token = Token ID (6 dígitos), csc = código CSC
      const nfceToken = (configs.find(c => c.chave === 'nfce_token')?.valor || '').trim();
      const nfceCsc = (configs.find(c => c.chave === 'nfce_csc')?.valor || '').trim();
      const nfceVersao = configs.find(c => c.chave === 'nfce_versao')?.valor || '4.00';
      const formaPgto = PAYMENT_MAP[forma_pagamento] || '01';

      payload = {
        cnpj_emitente: cfgCnpjEmit.replace(/\D/g, ''),
        numero: String(proximoNum),
        serie: String(parseInt(serieUsada, 10) || 1),
        data_emissao: `${dataEmissao}T12:00:00-03:00`,
        modalidade_frete: '9',
        presenca_comprador: '1',
        // CSC Token para geração do QR Code (obrigatório para NFC-e)
        csc_token: nfceToken.padStart(6, '0'),
        csc: nfceCsc,
        ...(cpfCnpj ? { destinatario_cpf: cpfCnpj.length === 11 ? cpfCnpj : undefined, destinatario_cnpj: cpfCnpj.length === 14 ? cpfCnpj : undefined, destinatario_nome: cliente_nome || 'Consumidor Final' } : {}),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `PROD-${String(idx + 1).padStart(3, '0')}`,
          descricao: (it.descricao || `Produto ${idx + 1}`).substring(0, 120),
          codigo_ncm: (it.ncm || '87089990').replace(/\D/g, '').padStart(8, '0').substring(0, 8),
          cfop: it.cfop || '5102',
          ...(it.cest ? { codigo_cest: it.cest } : {}),
          unidade_comercial: it.unidade || 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || 0,
          valor_bruto: Number(it.valor_total) || 0,
          unidade_tributavel: it.unidade || 'UN',
          quantidade_tributavel: Number(it.quantidade) || 1,
          valor_unitario_tributavel: Number(it.valor_unitario) || 0,
          icms_situacao_tributaria: '400',
          icms_origem: '0',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
        })),
        formas_pagamento: [{
          forma_pagamento: formaPgto,
          valor_pagamento: String(Number(valor_total).toFixed(2)),
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes.substring(0, 500) } : {}),
      };

    // ─────────────────────────────────────────────
    // NFe — Nota Fiscal Eletrônica (produtos)
    // ─────────────────────────────────────────────
    } else {
      endpoint = `/nfe?ref=${ref}`;

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Produtos', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total) }
      ];

      const cfgCnpjEmit = configs.find(c => c.chave === 'cnpj')?.valor || '';
      const formaPgto = PAYMENT_MAP[forma_pagamento] || '01';

      payload = {
        cnpj_emitente: cfgCnpjEmit.replace(/\D/g, ''),
        numero: String(proximoNum),
        serie: String(parseInt(serieUsada, 10) || 1),
        natureza_operacao: 'Venda de mercadoria',
        data_emissao: `${dataEmissao}T12:00:00-03:00`,
        data_saida_entrada: `${dataEmissao}T12:00:00-03:00`,
        tipo_documento: '1',
        finalidade_emissao: '1',
        indicador_presenca: '1',
        ...(cpfCnpj && cpfCnpj.length === 11 ? { destinatario_cpf: cpfCnpj } : {}),
        ...(cpfCnpj && cpfCnpj.length === 14 ? { destinatario_cnpj: cpfCnpj } : {}),
        destinatario_nome: cliente_nome || 'Consumidor Final',
        destinatario_indicador_ie: '9',
        ...(cliente_email ? { destinatario_email: cliente_email } : {}),
        ...(cliente_endereco ? {
          destinatario_logradouro: cliente_endereco,
          destinatario_numero: cliente_numero || 'S/N',
          destinatario_bairro: cliente_bairro || '',
          destinatario_municipio: cliente_cidade || '',
          destinatario_uf: cliente_estado || 'MG',
          destinatario_cep: (cliente_cep || '').replace(/\D/g, ''),
          destinatario_pais: '1058',
          ...(cliente_telefone ? { destinatario_telefone: cliente_telefone.replace(/\D/g, '') } : {}),
        } : {}),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `PROD-${String(idx + 1).padStart(3, '0')}`,
          descricao: (it.descricao || `Produto ${idx + 1}`).substring(0, 120),
          codigo_ncm: (it.ncm || '87089990').replace(/\D/g, '').padStart(8, '0').substring(0, 8),
          cfop: it.cfop || '5405',
          ...(it.cest ? { codigo_cest: it.cest } : {}),
          unidade_comercial: it.unidade || 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || 0,
          valor_bruto: Number(it.valor_total) || 0,
          unidade_tributavel: it.unidade || 'UN',
          quantidade_tributavel: Number(it.quantidade) || 1,
          valor_unitario_tributavel: Number(it.valor_unitario) || 0,
          icms_situacao_tributaria: '400',
          icms_origem: '0',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
        })),
        formas_pagamento: [{
          forma_pagamento: formaPgto,
          valor_pagamento: String(Number(valor_total).toFixed(2)),
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes.substring(0, 500) } : {}),
      };
    }

    // 3. Envia para Focus NFe
    console.log(`[${tipo}] ref=${ref} numero=${proximoNum} serie=${serieUsada}`);
    console.log('Payload enviado:', JSON.stringify(payload, null, 2));

    const resp = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await resp.text();
    console.log(`Focus NFe HTTP status: ${resp.status}`);
    console.log(`Focus NFe resposta: ${rawText.substring(0, 1000)}`);

    let result = {};
    try { result = JSON.parse(rawText); } catch (_) { result = { raw: rawText }; }

    if (!resp.ok) {
      const erros = result.erros?.map(e => e.mensagem || JSON.stringify(e)).join('; ')
        || result.mensagem || rawText.substring(0, 500);
      return Response.json({
        sucesso: false,
        erro: `Erro Focus NFe (${resp.status}): ${erros}`,
        detalhes: result,
        payload_enviado: payload,
      }, { status: 400 });
    }

    // 4. Salva no banco
    const notaData = {
      tipo,
      numero: String(proximoNum),
      serie: String(serieUsada),
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

    // 5. Atualiza nfce_ultimo_numero nas configurações
    if (tipo === 'NFCe') {
      const cfgUltimoNFCe = configs.find(c => c.chave === 'nfce_ultimo_numero');
      if (cfgUltimoNFCe?.id) {
        await base44.asServiceRole.entities.Configuracao.update(cfgUltimoNFCe.id, { chave: 'nfce_ultimo_numero', valor: String(proximoNum) });
      } else {
        await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfce_ultimo_numero', valor: String(proximoNum) });
      }
    }

    return Response.json({
      sucesso: true,
      ref,
      numero: String(proximoNum),
      serie: String(serieUsada),
      status: result.status || 'processando',
      mensagem: `${tipo} nº ${proximoNum} (série ${serieUsada}) enviada ao Focus NFe. Status: ${result.status || 'processando'}`,
    });

  } catch (error) {
    console.error('Erro emitirNotaFiscal:', error.message, error.stack);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});