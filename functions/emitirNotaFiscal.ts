import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Emite nota fiscal via Spedy usando o endpoint /orders (Venda).
 * Essa é a forma mais simples: a Spedy usa as configurações tributárias
 * já definidas no backoffice para gerar a NF automaticamente.
 * 
 * Payload esperado:
 * {
 *   nota_id: string (ID do registro NotaFiscal existente para atualizar, opcional),
 *   tipo: 'NFSe' | 'NFe' | 'NFCe',
 *   cliente_id: string,
 *   cliente_nome: string,
 *   cliente_cpf_cnpj: string,
 *   cliente_email: string,
 *   cliente_telefone: string,
 *   cliente_endereco: string,
 *   cliente_numero: string,
 *   cliente_bairro: string,
 *   cliente_cep: string,
 *   cliente_cidade: string,
 *   cliente_estado: string,
 *   ordem_servico_id: string,
 *   items: [{ descricao: string, quantidade: number, valor_unitario: number, valor_total: number }],
 *   valor_total: number,
 *   forma_pagamento: string,
 *   observacoes: string,
 *   data_emissao: string (YYYY-MM-DD),
 * }
 */

const PAYMENT_MAP = {
  'Dinheiro': 'cash',
  'Cartão de Crédito': 'creditCard',
  'Cartão de Débito': 'debitCard',
  'PIX': 'pix',
  'Boleto': 'billetBank',
  'Transferência': 'bankTransfer',
  'A Prazo': 'other',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const {
      nota_id,
      numero_manual,
      tipo,
      cliente_id,
      cliente_nome,
      cliente_cpf_cnpj,
      cliente_email,
      cliente_telefone,
      cliente_endereco,
      cliente_numero,
      cliente_bairro,
      cliente_cep,
      cliente_cidade,
      cliente_estado,
      ordem_servico_id,
      items,
      valor_total,
      forma_pagamento,
      observacoes,
      data_emissao,
    } = body;

    // 1. Busca configurações Spedy
    const configs = await base44.asServiceRole.entities.Configuracao.list();
    const apiKeyConfig = configs.find(c => c.chave === 'spedy_api_key');
    const ambienteConfig = configs.find(c => c.chave === 'spedy_ambiente');

    const spedyApiKey = apiKeyConfig?.valor?.trim();
    const ambiente = ambienteConfig?.valor || 'homologacao';

    if (!spedyApiKey) {
      return Response.json({ sucesso: false, erro: 'Chave API Spedy não configurada. Acesse Configurações.' }, { status: 400 });
    }

    const baseUrl = ambiente === 'producao'
      ? 'https://api.spedy.com.br/v1'
      : 'https://sandbox-api.spedy.com.br/v1';

    // 2. Monta dados do cliente (tomador)
    const cpfCnpj = (cliente_cpf_cnpj || '').replace(/\D/g, '') || null;
    const cep = (cliente_cep || '').replace(/\D/g, '') || null;

    const customer = {
      name: cliente_nome || 'Consumidor Final',
      ...(cpfCnpj ? { federalTaxNumber: cpfCnpj } : {}),
      ...(cliente_email ? { email: cliente_email } : {}),
      ...(cliente_telefone ? { phone: cliente_telefone.replace(/\D/g, '').substring(0, 15) } : {}),
      ...(cliente_cidade ? {
        address: {
          street: cliente_endereco || '',
          number: cliente_numero || 'S/N',
          district: cliente_bairro || '',
          postalCode: cep || '',
          city: {
            name: cliente_cidade,
            state: cliente_estado || '',
          },
          country: 'BRA',
        }
      } : {}),
    };

    // 3. Monta itens da venda
    // NFSe = servicos, NFe/NFCe = produtos
    const isServico = tipo === 'NFSe';
    const orderItems = (items && items.length > 0) ? items.map((item, idx) => ({
      description: item.descricao || `Item ${idx + 1}`,
      quantity: Number(item.quantidade) || 1,
      price: Number(item.valor_unitario) || Number(item.valor_total) || Number(valor_total),
      amount: Number(item.valor_total) || (Number(item.quantidade) * Number(item.valor_unitario)),
      ...(isServico ? {
        service: {
          code: `SRV-${String(idx + 1).padStart(3, '0')}`,
          name: (item.descricao || `Serviço ${idx + 1}`).substring(0, 120),
          price: Number(item.valor_unitario) || Number(item.valor_total) || Number(valor_total),
        }
      } : {
        product: {
          code: `PROD-${String(idx + 1).padStart(3, '0')}`,
          name: (item.descricao || `Produto ${idx + 1}`).substring(0, 120),
          price: Number(item.valor_unitario) || Number(item.valor_total) || Number(valor_total),
        }
      }),
    })) : [{
      description: observacoes || (isServico ? 'Serviços de manutenção automotiva' : 'Produtos'),
      quantity: 1,
      price: Number(valor_total) || 0,
      amount: Number(valor_total) || 0,
      ...(isServico ? {
        service: { code: 'SRV-001', name: (observacoes || 'Serviços').substring(0, 120), price: Number(valor_total) || 0 }
      } : {
        product: { code: 'PROD-001', name: (observacoes || 'Produtos').substring(0, 120), price: Number(valor_total) || 0 }
      }),
    }];

    // 4. Monta payload do pedido (Order)
    // invoiceType: 'NFS-e' para serviços, 'NF-e' para produtos/NFe, 'NFC-e' para consumidor
    const invoiceTypeMap = { 'NFSe': 'NFS-e', 'NFe': 'NF-e', 'NFCe': 'NFC-e' };
    const invoiceType = invoiceTypeMap[tipo] || 'NFS-e';

    const orderPayload = {
      date: data_emissao ? new Date(data_emissao).toISOString() : new Date().toISOString(),
      amount: Number(valor_total) || 0,
      customer,
      items: orderItems,
      status: 'approved',
      autoIssueMode: 'immediately',
      invoiceType,
      ...(forma_pagamento ? { paymentMethod: PAYMENT_MAP[forma_pagamento] || 'other' } : {}),
      ...(ordem_servico_id ? { transactionId: ordem_servico_id } : {}),
      sendEmailToCustomer: false,
    };

    console.log('Criando venda na Spedy:', JSON.stringify(orderPayload, null, 2));

    // 5. Cria a venda na Spedy
    const orderResp = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': spedyApiKey,
      },
      body: JSON.stringify(orderPayload),
    });

    const orderRawText = await orderResp.text();
    console.log('Spedy /orders status:', orderResp.status);
    console.log('Spedy /orders response:', orderRawText.substring(0, 1000));

    let orderResult = {};
    try { orderResult = orderRawText ? JSON.parse(orderRawText) : {}; } catch (_) { orderResult = { raw: orderRawText }; }

    if (!orderResp.ok) {
      const erroMsg = orderResult.message || orderResult.error || orderResult.errors?.join(', ') || orderRawText.substring(0, 400);
      return Response.json({
        sucesso: false,
        erro: `Erro ao criar venda na Spedy (${orderResp.status}): ${erroMsg}`,
        detalhes: orderResult,
      }, { status: 400 });
    }

    const orderId = orderResult.id;

    // 6. Emite as notas fiscais da venda
    const issueResp = await fetch(`${baseUrl}/orders/${orderId}/invoices/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': spedyApiKey,
      },
      body: JSON.stringify({ effectiveDate: data_emissao ? new Date(data_emissao).toISOString() : new Date().toISOString() }),
    });

    const issueRawText = await issueResp.text();
    console.log('Spedy /issue status:', issueResp.status);
    console.log('Spedy /issue response:', issueRawText.substring(0, 500));

    let issueResult = {};
    try { issueResult = issueRawText ? JSON.parse(issueRawText) : {}; } catch (_) { issueResult = {}; }

    // 7. Salva/atualiza no banco local
    const notaData = {
      tipo: tipo || 'NFSe',
      numero: numero_manual || String(orderResult.number || orderResult.id || orderId || ''),
      serie: String(orderResult.series || ''),
      status: 'Emitida',
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      ordem_servico_id: ordem_servico_id || '',
      valor_total: Number(valor_total),
      spedy_id: String(orderId || ''),
      xml_url: '',
      pdf_url: '',
      data_emissao: data_emissao || new Date().toISOString().split('T')[0],
      observacoes: observacoes || '',
    };

    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, notaData);
    } else {
      await base44.asServiceRole.entities.NotaFiscal.create(notaData);
    }

    return Response.json({
      sucesso: true,
      ordem_id: orderId,
      ordem: orderResult,
      emissao: issueResult,
      mensagem: `Venda criada (ID: ${orderId}) e NF enfileirada para emissão. Status: enqueued → será autorizada automaticamente pela prefeitura/SEFAZ.`,
    });

  } catch (error) {
    console.error('Erro emitirNotaFiscal:', error.message, error.stack);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});