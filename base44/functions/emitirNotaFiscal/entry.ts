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
      nota_id, ordem_servico_id, cliente_id,
    } = body;

    if (!['NFCe', 'NFe', 'NFSe'].includes(tipo)) {
      return Response.json({ sucesso: false, erro: 'Tipo deve ser NFCe, NFe ou NFSe' }, { status: 400 });
    }

    // AMBIENTE TRAVADO EM HOMOLOGAÇÃO PARA TESTES (Depois mudamos para 'producao')
    const ambiente = 'homologacao';
    const baseUrl = 'https://homologacao.focusnfe.com.br/v2';
    
    // TOKEN E CNPJ DO MAYCOW INJETADOS
    const apiKey = 'dK6EQsntpg7M4gnNpAoUOO8Yos023CyC'; 
    const cnpjEmitente = '54043647000120';
    
    const authHeader = 'Basic ' + btoa(apiKey + ':');

    // Lógica para gerar número da nota (mantida do seu sistema)
    const todasNotas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 300);
    let proximoNum = 1;
    let serieUsada = '1';

    const notasDoTipo = todasNotas.filter(n => n.tipo === tipo).map(n => parseInt(n.numero, 10)).filter(n => !isNaN(n));
    const ultimoNota = notasDoTipo.length > 0 ? Math.max(...notasDoTipo) : 0;
    proximoNum = ultimoNota + 1;

    const agora = new Date();
    const agoraBrasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
    const dataEmissaoFormatada = data_emissao || agoraBrasilia.toISOString().split('T')[0];
    const horaEmissao = agoraBrasilia.toISOString().substring(11, 19);
    const ref = `${tipo.toLowerCase()}-${Date.now()}`;
    const formaPgtoCode = PAYMENT_MAP[forma_pagamento] || '17'; // Padrão PIX
    const cpfCnpjLimpo = (cliente_cpf_cnpj || '').replace(/\D/g, '');

    let endpoint = '';
    let payload = null;

    // ==========================================
    // NOTA DE SERVIÇO (NFS-e) - ESTRUTURA CORRIGIDA
    // ==========================================
    if (tipo === 'NFSe') {
      endpoint = `/nfse?ref=${ref}`;
      
      let itensDescricao = observacoes || 'Serviços de manutenção automotiva';
      if (items && items.length > 0) {
        itensDescricao = items.map(i => `${i.descricao} (Qtd: ${i.quantidade})`).join(', ');
      }

      payload = {
        data_emissao: `${dataEmissaoFormatada}T${horaEmissao}-03:00`,
        prestador: { cnpj: cnpjEmitente },
        tomador: {
          razao_social: cliente_nome || 'Consumidor',
          cnpj_cpf: cpfCnpjLimpo || undefined,
          email: cliente_email || undefined,
          telefone: cliente_telefone ? cliente_telefone.replace(/\D/g, '') : undefined,
          endereco: cliente_endereco ? {
            logradouro: cliente_endereco,
            numero: cliente_numero || 'S/N',
            bairro: cliente_bairro || '',
            nome_municipio: cliente_cidade || 'Patos de Minas',
            uf: cliente_estado || 'MG',
            cep: (cliente_cep || '').replace(/\D/g, '')
          } : undefined
        },
        servico: {
          valor_servicos: Number(valor_total) || 0,
          discriminacao: itensDescricao,
          item_lista_servico: "14.01", // Código informado pelo Maycow
          codigo_tributario_municipio: "14.01",
          iss_retido: "false"
        }
      };
    } 
    // ==========================================
    // NOTA DE PRODUTO (NF-e) - ESTRUTURA CORRIGIDA
    // ==========================================
    else if (tipo === 'NFe') {
      endpoint = `/nfe?ref=${ref}`;
      const prodItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Peças/Produtos', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total) }
      ];

      payload = {
        cnpj_emitente: cnpjEmitente,
        numero: String(proximoNum),
        serie: serieUsada,
        natureza_operacao: 'Venda de mercadoria',
        data_emissao: `${dataEmissaoFormatada}T${horaEmissao}-03:00`,
        tipo_documento: '1',
        local_destino: '1',
        finalidade_emissao: '1',
        consumidor_final: '1',
        presenca_comprador: '1',
        nome_destinatario: cliente_nome || 'Consumidor Final',
        cpf_destinatario: cpfCnpjLimpo.length === 11 ? cpfCnpjLimpo : undefined,
        cnpj_destinatario: cpfCnpjLimpo.length === 14 ? cpfCnpjLimpo : undefined,
        indicador_ie_destinatario: '9',
        logradouro_destinatario: cliente_endereco || 'Rua Teste',
        numero_destinatario: cliente_numero || 'S/N',
        bairro_destinatario: cliente_bairro || 'Centro',
        municipio_destinatario: cliente_cidade || 'Patos de Minas',
        uf_destinatario: cliente_estado || 'MG',
        cep_destinatario: (cliente_cep || '38700327').replace(/\D/g, ''),
        modalidade_frete: '9',
        
        // CORRIGIDO: Array 'itens' em português e chaves formatadas para Simples Nacional
        itens: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: 'PROD' + (idx + 1),
          descricao: (it.descricao || 'Produto').substring(0, 120),
          codigo_ncm: '87089990', // NCM genérico de auto peças
          cfop: '5102',
          unidade_comercial: 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: parseFloat(Number(it.valor_unitario || valor_total).toFixed(2)),
          valor_bruto: parseFloat(Number(it.valor_total || valor_total).toFixed(2)),
          unidade_tributavel: 'UN',
          quantidade_tributavel: Number(it.quantidade) || 1,
          valor_unitario_tributavel: parseFloat(Number(it.valor_unitario || valor_total).toFixed(2)),
          icms_origem: '0',
          icms_situacao_tributaria: '102', // CSOSN Simples Nacional sem permissão de crédito
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07'
        })),
        formas_pagamento: [{
          forma_pagamento: formaPgtoCode,
          valor_pagamento: parseFloat(Number(valor_total).toFixed(2))
        }]
      };
    }

    // Limpa undefined do payload
    const cleanPayload = JSON.parse(JSON.stringify(payload));

    console.log(`[${tipo}] Enviando para Focus...`);
    
    // Disparo para a API da Focus
    const resp = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(cleanPayload),
    });

    const result = await resp.json();

    if (!resp.ok) {
      console.error(`Erro Focus:`, result);
      return Response.json({
        sucesso: false,
        erro: `Erro Sefaz/Prefeitura: ${result.mensagem || JSON.stringify(result.erros)}`,
      }, { status: 400 });
    }

    // Salva no banco da Base 44
    const statusInterno = ['autorizado', 'processando_autorizacao'].includes(result.status) ? 'Emitida' : 'Processando';

    const notaData = {
      tipo,
      numero: String(proximoNum),
      serie: serieUsada,
      status: statusInterno,
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      valor_total: Number(valor_total),
      data_emissao: dataEmissaoFormatada,
      chave_acesso: result.chave_nfe || result.chave_nfce || '',
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
      mensagem: `Nota ${tipo} enviada com sucesso!`,
      pdf: result.caminho_danfe || result.caminho_pdf_nfse || 'Processando'
    });

  } catch (error) {
    console.error('Erro na função:', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});