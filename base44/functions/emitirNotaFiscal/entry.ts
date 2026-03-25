import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

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
    const configs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    
    const {
      tipo, cliente_nome, cliente_cpf_cnpj, cliente_email,
      cliente_telefone, cliente_endereco, cliente_numero,
      cliente_bairro, cliente_cep, cliente_cidade, cliente_estado,
      items, valor_total, forma_pagamento, observacoes, data_emissao,
      nota_id, cliente_id,
    } = body;

    // CONFIGURAÇÕES FIXAS DO CLIENTE MG AUTOCENTER
    const ambiente = 'homologacao'; // Travado em teste para segurança
    const baseUrl = 'https://homologacao.focusnfe.com.br/v2';
    const apiKey = 'dK6EQsntpg7M4gnNpAoUOO8Yos023CyC'; 
    const cnpjEmitente = '54043647000120'; // CNPJ da MG Autocenter
    const codMunicipioPatos = "3148004"; // Código IBGE obrigatório
    
    const authHeader = 'Basic ' + btoa(apiKey + ':');
    const ref = `${tipo.toLowerCase()}-${Date.now()}`;
    const cpfCnpjLimpo = (cliente_cpf_cnpj || '').replace(/\D/g, '');
    const cepLimpo = (cliente_cep || '38700327').replace(/\D/g, '');

    let endpoint = '';
    let payload = null;

    // ==========================================
    // ESTRUTURA PARA NOTA DE SERVIÇO (NFSe)
    // ==========================================
    if (tipo === 'NFSe') {
      endpoint = `/nfse?ref=${ref}`;
      
      const descritivo = items && items.length > 0 
        ? items.map(i => `${i.descricao}`).join(', ')
        : (observacoes || 'Serviços de manutenção automotiva');

      payload = {
        data_emissao: new Date().toISOString(),
        prestador: { cnpj: cnpjEmitente },
        tomador: {
          razao_social: (cliente_nome || 'Consumidor Teste').substring(0, 100),
          cnpj_cpf: cpfCnpjLimpo,
          email: cliente_email || undefined,
          endereco: {
            logradouro: cliente_endereco || 'Rua Rui Barbosa',
            numero: cliente_numero || '1355',
            bairro: cliente_bairro || 'Santa Terezinha',
            codigo_municipio: codMunicipioPatos,
            uf: cliente_estado || 'MG',
            cep: cepLimpo
          }
        },
        servico: {
          valor_servicos: Number(valor_total) || 1.00,
          discriminacao: descritivo.substring(0, 1000),
          item_lista_servico: "14.01", // Código fornecido pelo cliente
          codigo_tributario_municipio: "14.01",
          exigibilidade_iss: "1",
          iss_retido: "false"
        }
      };
    } 
    // ==========================================
    // ESTRUTURA PARA NOTA DE PRODUTO (NFe)
    // ==========================================
    else {
      endpoint = `/nfe?ref=${ref}`;
      payload = {
        cnpj_emitente: cnpjEmitente,
        natureza_operacao: 'Venda de mercadoria',
        tipo_documento: '1',
        local_destino: '1',
        finalidade_emissao: '1',
        consumidor_final: '1',
        presenca_comprador: '1',
        nome_destinatario: (cliente_nome || 'Consumidor Teste').substring(0, 60),
        cpf_destinatario: cpfCnpjLimpo.length === 11 ? cpfCnpjLimpo : undefined,
        cnpj_destinatario: cpfCnpjLimpo.length === 14 ? cpfCnpjLimpo : undefined,
        logradouro_destinatario: cliente_endereco || 'Rua Rui Barbosa',
        numero_destinatario: cliente_numero || '1355',
        bairro_destinatario: cliente_bairro || 'Santa Terezinha',
        municipio_destinatario: 'Patos de Minas',
        uf_destinatario: 'MG',
        cep_destinatario: cepLimpo,
        modalidade_frete: '9',
        itens: [{
          numero_item: 1,
          codigo_produto: 'TESTE01',
          descricao: 'PRODUTO TESTE',
          codigo_ncm: '87089990',
          cfop: '5102',
          unidade_comercial: 'UN',
          quantidade_comercial: 1,
          valor_unitario_comercial: Number(valor_total),
          valor_bruto: Number(valor_total),
          unidade_tributavel: 'UN',
          quantidade_tributavel: 1,
          valor_unitario_tributavel: Number(valor_total),
          icms_origem: '0',
          icms_situacao_tributaria: '102',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07'
        }],
        formas_pagamento: [{
          forma_pagamento: PAYMENT_MAP[forma_pagamento] || '17',
          valor_pagamento: Number(valor_total)
        }]
      };
    }

    // DISPARO PARA FOCUS NFE
    const resp = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify(payload),
    });

    const result = await resp.json();

    if (!resp.ok) {
      return Response.json({
        sucesso: false,
        erro: result.mensagem || "Erro na validação dos dados",
        detalhes: result.erros
      }, { status: 400 });
    }

    // ATUALIZAÇÃO NO BANCO DE DADOS DA BASE 44
    const notaData = {
      status: 'Emitida',
      valor_total: Number(valor_total),
      pdf_url: result.caminho_pdf_nfse || result.caminho_danfe || '',
      chave_acesso: result.chave_nfe || ''
    };

    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, notaData);
    }

    return Response.json({ sucesso: true, mensagem: "Nota enviada!", pdf: notaData.pdf_url });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});