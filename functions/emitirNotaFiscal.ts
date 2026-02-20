import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tipo, cliente_id, cliente_nome, ordem_servico_id, valor_total, observacoes, data_emissao } = body;

    // Busca configurações Spedy
    const configs = await base44.asServiceRole.entities.Configuracao.list();
    const apiKeyConfig = configs.find(c => c.chave === 'spedy_api_key');
    const ambienteConfig = configs.find(c => c.chave === 'spedy_ambiente');

    const spedyApiKey = apiKeyConfig?.valor?.trim();
    const ambiente = ambienteConfig?.valor || 'homologacao';

    if (!spedyApiKey) {
      return Response.json({ sucesso: false, erro: 'Chave API Spedy não configurada.' }, { status: 400 });
    }

    // URL base Spedy conforme documentação oficial
    const baseUrl = ambiente === 'producao'
      ? 'https://api.spedy.com.br/v1'
      : 'https://sandbox-api.spedy.com.br/v1';

    // Busca dados do cliente se tiver ID
    let clienteData = { nome: cliente_nome || '', cpf_cnpj: '', email: '', telefone: '', endereco: '', cidade: '', estado: '', cep: '' };
    if (cliente_id) {
      const clientes = await base44.asServiceRole.entities.Cliente.list();
      const c = clientes.find(cl => cl.id === cliente_id);
      if (c) {
        clienteData = {
          nome: c.nome || '',
          cpf_cnpj: c.cpf_cnpj || '',
          email: c.email || '',
          telefone: c.telefone || '',
          endereco: c.endereco || '',
          numero: c.numero || '',
          bairro: c.bairro || '',
          cidade: c.cidade || '',
          estado: c.estado || '',
          cep: c.cep || '',
        };
      }
    }

    // Monta receiver (destinatário/tomador)
    const cpfCnpj = (clienteData.cpf_cnpj || '').replace(/\D/g, '');
    const receiver = {
      name: clienteData.nome,
      ...(cpfCnpj.length === 14 ? { federalTaxNumber: cpfCnpj } : {}),
      ...(cpfCnpj.length === 11 ? { federalTaxNumber: cpfCnpj } : {}),
      email: clienteData.email || undefined,
      address: clienteData.cidade ? {
        street: clienteData.endereco || '',
        number: clienteData.numero || '',
        district: clienteData.bairro || '',
        postalCode: (clienteData.cep || '').replace(/\D/g, ''),
        city: {
          name: clienteData.cidade || '',
          state: clienteData.estado || '',
        }
      } : undefined,
    };

    let endpoint = '';
    let payload = {};

    if (tipo === 'NFSe') {
      // Endpoint NFSe: POST /service-invoices
      endpoint = `${baseUrl}/service-invoices`;
      payload = {
        cityServiceCode: '1.01', // código genérico - idealmente configurável
        description: observacoes || 'Serviços de manutenção automotiva',
        servicesAmount: Number(valor_total) || 0,
        issuedOn: data_emissao ? new Date(data_emissao).toISOString() : new Date().toISOString(),
        externalId: ordem_servico_id || undefined,
        taker: receiver,
      };
    } else if (tipo === 'NFe') {
      // Endpoint NFe: POST /product-invoices
      endpoint = `${baseUrl}/product-invoices`;
      payload = {
        nature: 1, // venda
        recipient: receiver,
        items: [{
          code: '001',
          description: observacoes || 'Serviços e peças - manutenção automotiva',
          quantity: 1,
          unitOfMeasure: 'UN',
          unitPrice: Number(valor_total) || 0,
          totalPrice: Number(valor_total) || 0,
          ncm: '8708.99.90',
          cfop: '5102',
        }],
        total: { goods: Number(valor_total) || 0 },
      };
    } else if (tipo === 'NFCe') {
      // NFCe via product-invoices com model nfce
      endpoint = `${baseUrl}/product-invoices`;
      payload = {
        model: 'nfce',
        nature: 1,
        recipient: receiver,
        items: [{
          code: '001',
          description: observacoes || 'Serviços e peças - manutenção automotiva',
          quantity: 1,
          unitOfMeasure: 'UN',
          unitPrice: Number(valor_total) || 0,
          totalPrice: Number(valor_total) || 0,
          ncm: '8708.99.90',
          cfop: '5102',
        }],
        total: { goods: Number(valor_total) || 0 },
      };
    } else {
      return Response.json({ sucesso: false, erro: `Tipo de nota "${tipo}" não suportado.` }, { status: 400 });
    }

    console.log('Chamando Spedy:', endpoint);
    console.log('Payload:', JSON.stringify(payload));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': spedyApiKey,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    console.log('Spedy status:', response.status);
    console.log('Spedy response:', rawText.substring(0, 1000));

    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch (_) {
      result = { raw: rawText };
    }

    if (response.ok || response.status === 201 || response.status === 202) {
      // Salva a nota fiscal no banco como Emitida
      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo,
        numero: String(result.number || result.numero || result.id || ''),
        serie: String(result.series || result.serie || ''),
        status: 'Emitida',
        cliente_id: cliente_id || '',
        cliente_nome: clienteData.nome,
        ordem_servico_id: ordem_servico_id || '',
        valor_total: Number(valor_total),
        chave_acesso: result.accessKey || result.chave_acesso || result.chave || '',
        spedy_id: String(result.id || ''),
        xml_url: result.xmlUrl || result.xml_url || '',
        pdf_url: result.pdfUrl || result.pdf_url || '',
        data_emissao: data_emissao,
        observacoes: observacoes || '',
      });

      return Response.json({ sucesso: true, nota: result });
    } else {
      const erroMsg = result.message || result.erro || result.error || result.errors?.join(', ') || rawText.substring(0, 500) || `Status ${response.status}`;
      return Response.json({
        sucesso: false,
        erro: `Spedy (${response.status}): ${erroMsg}`,
        detalhes: result,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Erro função emitirNotaFiscal:', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});