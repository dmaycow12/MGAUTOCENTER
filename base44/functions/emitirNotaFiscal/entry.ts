import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Emite nota fiscal via Spedy.
 * - NFSe → serviceInvoice
 * - NFe  → productInvoice
 * - NFCe → consumerInvoice
 *
 * IMPORTANTE: A Spedy usa o invoiceModel do produto/serviço para decidir o tipo de NF.
 * Usamos códigos prefixados por tipo (NFCE-PROD-001, NFE-PROD-001, NFSE-SRV-001)
 * para evitar reutilização de produto cadastrado com modelo errado.
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

// Spedy suporta apenas serviceInvoice e productInvoice.
// NFCe (cupom fiscal) é emitido como productInvoice — sem CPF/CNPJ obrigatório.
const INVOICE_MODEL_MAP = {
  'NFSe': 'serviceInvoice',
  'NFe':  'productInvoice',
  'NFCe': 'productInvoice',
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

    // 1. Busca configurações Spedy
    const configs = await base44.asServiceRole.entities.Configuracao.list();
    const spedyApiKey = configs.find(c => c.chave === 'spedy_api_key')?.valor?.trim();
    const ambiente = configs.find(c => c.chave === 'spedy_ambiente')?.valor || 'homologacao';

    if (!spedyApiKey) {
      return Response.json({ sucesso: false, erro: 'Chave API Spedy não configurada.' }, { status: 400 });
    }

    const baseUrl = ambiente === 'producao'
      ? 'https://api.spedy.com.br/v1'
      : 'https://sandbox-api.spedy.com.br/v1';

    const invoiceModel = INVOICE_MODEL_MAP[tipo] || 'consumerInvoice';
    const isServico = tipo === 'NFSe';
    // Prefixo único por tipo: evita que Spedy reutilize produto com invoiceModel errado
    const prefix = tipo === 'NFSe' ? 'NFSE' : tipo === 'NFCe' ? 'NFCE' : 'NFE';

    // 2. Monta cliente
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
          city: { name: cliente_cidade, state: cliente_estado || '' },
        }
      } : {}),
    };

    // 3. Monta itens com invoiceModel correto por tipo
    const buildItem = (item, idx) => {
      const qty = Number(item.quantidade) || 1;
      const unitPrice = Number(item.valor_unitario) || (Number(item.valor_total) / qty);
      const totalAmt = Number(item.valor_total) || (unitPrice * qty);
      const name = (item.descricao || `Item ${idx + 1}`).substring(0, 120);
      const code = `${prefix}-${isServico ? 'SRV' : 'PROD'}-${String(idx + 1).padStart(3, '0')}`;
      const baseItem = { description: name, quantity: qty, price: unitPrice, amount: totalAmt };
      if (isServico) {
        return { ...baseItem, service: { code, name, price: unitPrice, invoiceModel } };
      } else {
        return { ...baseItem, product: { code, name, price: unitPrice, invoiceModel } };
      }
    };

    const orderItems = (items && items.length > 0)
      ? items.map(buildItem)
      : [buildItem({ descricao: observacoes || (isServico ? 'Serviços' : 'Produtos'), quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total) }, 0)];

    // 4. Payload do pedido
    const serieNum = parseInt(serie_manual || '1', 10) || 1;
    const transactionId = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const orderPayload = {
      date: data_emissao ? new Date(data_emissao + 'T12:00:00').toISOString() : new Date().toISOString(),
      amount: Number(valor_total) || 0,
      customer,
      items: orderItems,
      status: 'approved',
      autoIssueMode: 'immediately',
      invoiceType: invoiceModel,
      ...(forma_pagamento ? { paymentMethod: PAYMENT_MAP[forma_pagamento] || 'other' } : {}),
      transactionId,
      sendEmailToCustomer: false,
    };

    console.log(`[${tipo}] invoiceModel=${invoiceModel} prefix=${prefix}`, JSON.stringify(orderPayload, null, 2));

    // 5. Cria venda na Spedy
    const orderResp = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': spedyApiKey },
      body: JSON.stringify(orderPayload),
    });

    const orderRaw = await orderResp.text();
    console.log('Spedy /orders status:', orderResp.status);
    console.log('Spedy /orders response:', orderRaw.substring(0, 1000));

    let orderResult = {};
    try { orderResult = JSON.parse(orderRaw); } catch (_) { orderResult = { raw: orderRaw }; }

    if (!orderResp.ok) {
      const erros = orderResult.errors?.map(e => e.message || JSON.stringify(e)).join('; ') || orderResult.message || orderRaw.substring(0, 400);
      return Response.json({ sucesso: false, erro: `Erro Spedy (${orderResp.status}): ${erros}`, detalhes: orderResult }, { status: 400 });
    }

    const orderId = orderResult.id;

    // 6. Solicita emissão
    const issueResp = await fetch(`${baseUrl}/orders/${orderId}/invoices/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': spedyApiKey },
      body: JSON.stringify({ effectiveDate: data_emissao ? new Date(data_emissao + 'T12:00:00').toISOString() : new Date().toISOString() }),
    });
    const issueRaw = await issueResp.text();
    console.log('Spedy /issue status:', issueResp.status, issueRaw.substring(0, 300));

    // 7. Sequência numérica por tipo
    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 200);
    const nums = todasNotas.filter(n => n.tipo === tipo).map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
    const proximoNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;

    // 8. Salva no banco
    const notaData = {
      tipo: tipo || 'NFCe',
      numero: String(proximoNum),
      serie: String(serieNum),
      status: 'Emitida',
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      ordem_servico_id: ordem_servico_id || '',
      valor_total: Number(valor_total),
      spedy_id: String(orderId || ''),
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
      numero: String(proximoNum),
      mensagem: `${tipo} nº ${proximoNum} (série ${serieNum}) enfileirada na Spedy.`,
    });

  } catch (error) {
    console.error('Erro emitirNotaFiscal:', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});