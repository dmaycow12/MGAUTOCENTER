import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Emissão de Notas Fiscais via Focus NFe
 * Documentação: https://focusnfe.com.br/doc/
 * 
 * Endpoints:
 * - NFe:  POST /nfe?ref=XXX
 * - NFCe: POST /nfce?ref=XXX
 * - NFSe: POST /nfse?ref=XXX
 * 
 * Autenticação: Basic HTTP (API_KEY:vazio)
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

    // 1. Busca e valida configurações
    const configs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const apiKey = Deno.env.get('FOCUSNFE_API_KEY') || 
      configs.find(c => c.chave === 'focusnfe_api_key')?.valor?.trim();
    
    if (!apiKey) {
      return Response.json(
        { sucesso: false, erro: 'API Key Focus NFe não configurada' },
        { status: 400 }
      );
    }

    // 2. Extrai dados do request
    const {
      tipo, cliente_nome, cliente_cpf_cnpj, cliente_email,
      cliente_telefone, cliente_endereco, cliente_numero,
      cliente_bairro, cliente_cep, cliente_cidade, cliente_estado,
      items, valor_total, forma_pagamento, observacoes, data_emissao,
      serie_manual, nota_id, ordem_servico_id, cliente_id,
    } = body;

    // 3. Valida tipo de documento
    if (!['NFCe', 'NFe', 'NFSe'].includes(tipo)) {
      return Response.json(
        { sucesso: false, erro: 'Tipo deve ser NFCe, NFe ou NFSe' },
        { status: 400 }
      );
    }

    // 4. Calcula próximo número
    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 300);
    let proximoNum;
    let serieUsada;

    if (tipo === 'NFCe') {
      const cfgUltimoNFCe = configs.find(c => c.chave === 'nfce_ultimo_numero');
      const ultimoSalvo = parseInt(cfgUltimoNFCe?.valor || '0', 10);
      const numsNFCe = todasNotas
        .filter(n => n.tipo === 'NFCe')
        .map(n => parseInt(n.numero, 10))
        .filter(n => !isNaN(n));
      const ultimoNota = numsNFCe.length > 0 ? Math.max(...numsNFCe) : 0;
      proximoNum = Math.max(ultimoSalvo, ultimoNota) + 1;
      serieUsada = (configs.find(c => c.chave === 'nfce_serie')?.valor || '1').padStart(3, '0');
    } else {
      const nums = todasNotas
        .filter(n => n.tipo === tipo)
        .map(n => parseInt(n.numero, 10))
        .filter(n => !isNaN(n));
      proximoNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      serieUsada = (serie_manual || '1').padStart(3, '0');
    }

    const agora = new Date();
    const agoraBrasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
    const dataEmissaoFormatada = data_emissao || agoraBrasilia.toISOString().split('T')[0];
    const horaEmissao = agoraBrasilia.toISOString().substring(11, 19);
    const ref = `${tipo.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const formaPgtoCode = PAYMENT_MAP[forma_pagamento] || '01';
    const cpfCnpjLimpo = (cliente_cpf_cnpj || '').replace(/\D/g, '');

    const ambiente = configs.find(c => c.chave === 'focusnfe_ambiente')?.valor || 'producao';
    const baseUrl = ambiente === 'homologacao'
      ? 'https://homologacao.focusnfe.com.br/v2'
      : 'https://api.focusnfe.com.br/v2';

    const authHeader = 'Basic ' + btoa(apiKey + ':');

    // 5. Prepara payload conforme tipo
    let endpoint = '';
    let payload = null;

    if (tipo === 'NFSe') {
      endpoint = `/nfse?ref=${ref}`;
      const cfgCnpj = configs.find(c => c.chave === 'cnpj')?.valor || '';
      const cfgCodMun = configs.find(c => c.chave === 'codigo_municipio')?.valor || '';
      const cfgCodServ = configs.find(c => c.chave === 'codigo_servico')?.valor || '07498';
      const cfgAliq = parseFloat(configs.find(c => c.chave === 'aliquota_iss')?.valor || '2.0');

      const servicoItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Serviços', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total) }
      ];

      payload = {
        data_emissao: dataEmissaoFormatada,
        prestador: {
          cnpj: cfgCnpj.replace(/\D/g, ''),
          ...(cfgCodMun ? { codigo_municipio: cfgCodMun } : {}),
        },
        tomador: {
          razao_social: cliente_nome || 'Consumidor',
          ...(cpfCnpjLimpo && cpfCnpjLimpo.length === 11 ? { cpf: cpfCnpjLimpo } : {}),
          ...(cpfCnpjLimpo && cpfCnpjLimpo.length === 14 ? { cnpj: cpfCnpjLimpo } : {}),
          ...(cliente_email ? { email: cliente_email } : {}),
          ...(cliente_telefone ? { telefone: cliente_telefone.replace(/\D/g, '') } : {}),
          ...(cliente_endereco ? {
            endereco: {
              logradouro: cliente_endereco,
              numero: cliente_numero || 'S/N',
              bairro: cliente_bairro || '',
              nome_municipio: cliente_cidade || '',
              cep: (cliente_cep || '').replace(/\D/g, ''),
              uf: cliente_estado || 'MG',
              ...(cfgCodMun ? { codigo_municipio: cfgCodMun } : {}),
            }
          } : {}),
        },
        items: servicoItems.map((it, idx) => ({
          descricao: (it.descricao || `Serviço ${idx + 1}`).substring(0, 120),
          quantidade: Number(it.quantidade) || 1,
          valor_unitario: Number(it.valor_unitario) || 0,
          valor_total: Number(it.valor_total) || 0,
          codigo_servico: cfgCodServ,
          aliquota_iss: cfgAliq,
          iss_retido: '2',
        })),
        ...(observacoes ? { observacoes } : {}),
      };

    } else if (tipo === 'NFCe') {
      endpoint = `/nfce?ref=${ref}`;
      const cfgCnpj = configs.find(c => c.chave === 'cnpj')?.valor || '';
      const nfceToken = configs.find(c => c.chave === 'nfce_token')?.valor?.trim() || '';
      const nfceCsc = configs.find(c => c.chave === 'nfce_csc')?.valor?.trim() || '';

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Produtos', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total), ncm: '87089990', cfop: '5102', unidade: 'UN' }
      ];

      payload = {
        cnpj_emitente: cfgCnpj.replace(/\D/g, ''),
        numero: String(proximoNum),
        serie: String(parseInt(serieUsada, 10) || 1),
        data_emissao: `${dataEmissaoFormatada}T${horaEmissao}-03:00`,
        modalidade_frete: '9',
        presenca_comprador: '1',
        csc_token: nfceToken.padStart(6, '0'),
        csc: nfceCsc,
        ...(cpfCnpjLimpo && cpfCnpjLimpo.length === 11 ? { destinatario_cpf: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo && cpfCnpjLimpo.length === 14 ? { destinatario_cnpj: cpfCnpjLimpo } : {}),
        destinatario_nome: cliente_nome || 'Consumidor Final',
        ...(cliente_email ? { destinatario_email: cliente_email } : {}),
        ...(cliente_telefone ? { destinatario_telefone: cliente_telefone.replace(/\D/g, '') } : {}),
        ...(cliente_endereco ? {
          destinatario_logradouro: cliente_endereco,
          destinatario_numero: cliente_numero || 'S/N',
          destinatario_bairro: cliente_bairro || '',
          destinatario_municipio: cliente_cidade || '',
          destinatario_uf: cliente_estado || 'MG',
          destinatario_cep: (cliente_cep || '').replace(/\D/g, ''),
        } : {}),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `PROD${String(idx + 1).padStart(3, '0')}`,
          descricao: (it.descricao || `Produto ${idx + 1}`).substring(0, 120),
          codigo_ncm: (it.ncm || '87089990').replace(/\D/g, '').padStart(8, '0').substring(0, 8),
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
          forma_pagamento: formaPgtoCode,
          valor_pagamento: String(Number(valor_total).toFixed(2)),
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes.substring(0, 500) } : {}),
      };

    } else {
      // NFe
      endpoint = `/nfe?ref=${ref}`;
      const cfgCnpj = configs.find(c => c.chave === 'cnpj')?.valor || '';

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Produtos', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total), ncm: '87089990', cfop: '5405', unidade: 'UN' }
      ];

      payload = {
        cnpj_emitente: cfgCnpj.replace(/\D/g, ''),
        numero: String(proximoNum),
        serie: String(parseInt(serieUsada, 10) || 1),
        natureza_operacao: 'Venda de mercadoria',
        data_emissao: `${dataEmissaoFormatada}T${horaEmissao}-03:00`,
        data_saida_entrada: `${dataEmissaoFormatada}T${horaEmissao}-03:00`,
        tipo_documento: '1',
        finalidade_emissao: '1',
        indicador_presenca: '1',
        ...(cpfCnpjLimpo && cpfCnpjLimpo.length === 11 ? { destinatario_cpf: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo && cpfCnpjLimpo.length === 14 ? { destinatario_cnpj: cpfCnpjLimpo } : {}),
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
          codigo_produto: it.codigo || `PROD${String(idx + 1).padStart(3, '0')}`,
          descricao: (it.descricao || `Produto ${idx + 1}`).substring(0, 120),
          codigo_ncm: (it.ncm || '87089990').replace(/\D/g, '').padStart(8, '0').substring(0, 8),
          cfop: it.cfop || '5405',
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
          forma_pagamento: formaPgtoCode,
          valor_pagamento: String(Number(valor_total).toFixed(2)),
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes.substring(0, 500) } : {}),
      };
    }

    // 6. Envia para Focus NFe
    console.log(`[${tipo}] Enviando: número=${proximoNum}, série=${serieUsada}, ref=${ref}`);
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
    console.log(`Status: ${resp.status}`);
    console.log(`Resposta (primeiros 1000 chars): ${rawText.substring(0, 1000)}`);

    let result = {};
    try {
      result = JSON.parse(rawText);
    } catch (_) {
      result = { raw: rawText };
    }

    if (!resp.ok) {
      const errMsg = result.mensagem || result.erros?.map(e => e.mensagem).join('; ') || rawText.substring(0, 500);
      console.error(`Erro Focus NFe: ${errMsg}`);
      
      const itensParaSalvar = (items && items.length > 0) ? items : [{
        descricao: observacoes || 'Serviços',
        quantidade: 1,
        valor_unitario: Number(valor_total),
        valor_total: Number(valor_total),
        forma_pagamento: forma_pagamento || 'PIX',
      }];
      
      const notaRascunho = {
        tipo,
        numero: String(proximoNum),
        serie: String(parseInt(serieUsada, 10) || 1),
        status: 'Rascunho',
        cliente_id: cliente_id || '',
        cliente_nome: cliente_nome || '',
        ordem_servico_id: ordem_servico_id || '',
        valor_total: Number(valor_total),
        data_emissao: dataEmissaoFormatada,
        observacoes: observacoes || '',
        xml_content: JSON.stringify(itensParaSalvar),
      };
      
      if (!nota_id) {
        await base44.asServiceRole.entities.NotaFiscal.create(notaRascunho);
      }
      
      return Response.json({
        sucesso: false,
        erro: `Erro Focus NFe (${resp.status}): ${errMsg}`,
        detalhes: result,
        payload,
      }, { status: 400 });
    }

    // 7. Salva no banco de dados
    const itensParaSalvar = (items && items.length > 0) ? items : [{
      descricao: observacoes || 'Serviços',
      quantidade: 1,
      valor_unitario: Number(valor_total),
      valor_total: Number(valor_total),
      forma_pagamento: forma_pagamento || 'PIX',
    }];

    const notaData = {
      tipo,
      numero: String(proximoNum),
      serie: String(parseInt(serieUsada, 10) || 1),
      status: 'Emitida',
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      ordem_servico_id: ordem_servico_id || '',
      valor_total: Number(valor_total),
      spedy_id: result.ref || ref,
      data_emissao: dataEmissaoFormatada,
      observacoes: observacoes || '',
      chave_acesso: result.chave_nfe || result.chave_nfce || result.chave_nfse || '',
      pdf_url: result.caminho_danfe || result.caminho_pdf_nfse || '',
      xml_url: result.caminho_xml_nota_fiscal || '',
      xml_content: JSON.stringify(itensParaSalvar),
    };

    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, notaData);
    } else {
      await base44.asServiceRole.entities.NotaFiscal.create(notaData);
    }

    // 8. Atualiza último número NFCe nas config
    if (tipo === 'NFCe') {
      const cfgUltimoNFCe = configs.find(c => c.chave === 'nfce_ultimo_numero');
      if (cfgUltimoNFCe?.id) {
        await base44.asServiceRole.entities.Configuracao.update(cfgUltimoNFCe.id, {
          chave: 'nfce_ultimo_numero',
          valor: String(proximoNum),
        });
      } else {
        await base44.asServiceRole.entities.Configuracao.create({
          chave: 'nfce_ultimo_numero',
          valor: String(proximoNum),
        });
      }
    }

    return Response.json({
      sucesso: true,
      ref,
      numero: String(proximoNum),
      serie: String(parseInt(serieUsada, 10) || 1),
      status: result.status || 'processando',
      mensagem: `${tipo} nº ${proximoNum} (série ${parseInt(serieUsada, 10) || 1}) enviada para Focus NFe com sucesso!`,
    });

  } catch (error) {
    console.error('Erro emitirNotaFiscal:', error.message, error.stack);
    return Response.json({
      sucesso: false,
      erro: `Erro interno: ${error.message}`,
    }, { status: 500 });
  }
});