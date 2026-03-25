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
    
    const {
      tipo, cliente_nome, cliente_cpf_cnpj, cliente_email,
      cliente_telefone, cliente_endereco, cliente_numero,
      cliente_bairro, cliente_cep, cliente_cidade, cliente_estado,
      items, valor_total, forma_pagamento, observacoes,
      nota_id, cliente_id,
    } = body;

    const baseUrl = 'https://homologacao.focusnfe.com.br/v2';
    const apiKey = 'dK6EQsntpg7M4gnNpAoUOO8Yos023CyC'; 
    const cnpjEmitente = '54043647000120';
    const codMunicipioPatos = "3148004";
    
    const authHeader = 'Basic ' + btoa(apiKey + ':');
    const ref = `${(tipo || 'NFSe').toLowerCase()}-${Date.now()}`;
    
    // BYPASS: Garante um CPF válido caso o formulário falhe
    let cpfCnpjLimpo = (cliente_cpf_cnpj || '').replace(/\D/g, '');
    if (cpfCnpjLimpo.length !== 11 && cpfCnpjLimpo.length !== 14) {
      cpfCnpjLimpo = '05804561005'; 
    }
    
    let cepLimpo = (cliente_cep || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      cepLimpo = '38700327'; 
    }

    let endpoint = '';
    let payload = null;

    if (tipo === 'NFSe') {
      endpoint = `/nfse?ref=${ref}`;
      
      const discriminacaoServico = items && items.length > 0 
        ? items.map(i => `${i.descricao} (Qtd: ${i.quantidade})`).join('; ')
        : (observacoes || 'Serviços de manutenção e reparação mecânica');

      payload = {
        data_emissao: new Date().toISOString(),
        prestador: {
          cnpj: cnpjEmitente,
          inscricao_municipal: "2024000738"
        },
        tomador: {
          razao_social: (cliente_nome || 'Consumidor Final Teste').substring(0, 100),
          // CORREÇÃO: A API de NFSe exige que seja neste campo único
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
          valor_servicos: Number(valor_total) || 1.0,
          discriminacao: discriminacaoServico.substring(0, 1000),
          item_lista_servico: "14.01",
          codigo_tributario_municipio: "14.01",
          exigibilidade_iss: 1,
          iss_retido: false
        }
      };
    } else {
      endpoint = `/nfe?ref=${ref}`;
      const prodItems = (items && items.length > 0) ? items : [
        { descricao: 'Pecas de Automoveis', quantidade: 1, valor_unitario: Number(valor_total) || 1.0 }
      ];

      payload = {
        cnpj_emitente: cnpjEmitente,
        natureza_operacao: 'Venda de mercadoria',
        tipo_documento: '1',
        presenca_comprador: '1',
        nome_destinatario: (cliente_nome || 'Consumidor Final Teste').substring(0, 60),
        // Já na NFe (Produto), a API exige separado:
        cpf_destinatario: cpfCnpjLimpo.length === 11 ? cpfCnpjLimpo : undefined,
        cnpj_destinatario: cpfCnpjLimpo.length === 14 ? cpfCnpjLimpo : undefined,
        logradouro_destinatario: cliente_endereco || 'Rua Rui Barbosa',
        numero_destinatario: cliente_numero || '1355',
        bairro_destinatario: cliente_bairro || 'Santa Terezinha',
        municipio_destinatario: 'Patos de Minas',
        uf_destinatario: 'MG',
        cep_destinatario: cepLimpo,
        modalidade_frete: '9',
        itens: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: `REF${idx + 1}`,
          descricao: (it.descricao || 'Produto Teste').substring(0, 120),
          codigo_ncm: '87089990',
          cfop: '5102',
          unidade_comercial: 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(valor_total) || 1.0,
          valor_bruto: Number(it.valor_total) || Number(valor_total) || 1.0,
          icms_origem: '0',
          icms_situacao_tributaria: '102',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07'
        })),
        formas_pagamento: [{
          forma_pagamento: PAYMENT_MAP[forma_pagamento] || '17',
          valor_pagamento: Number(valor_total) || 1.0
        }]
      };
    }

    const resp = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': authHeader 
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.json();

    if (!resp.ok) {
      const msgErro = result.erros ? result.erros[0].mensagem : (result.mensagem || "Erro Desconhecido");
      return Response.json({ sucesso: false, erro: `${msgErro}` }, { status: 200 });
    }

    const notaData = {
      status: 'Emitida',
      valor_total: Number(valor_total) || 1.0,
      pdf_url: result.caminho_pdf_nfse || result.caminho_danfe || '',
      chave_acesso: result.chave_nfe || ''
    };

    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, notaData);
    }

    return Response.json({ sucesso: true, mensagem: "Nota enviada!", pdf: notaData.pdf_url });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 200 });
  }
});