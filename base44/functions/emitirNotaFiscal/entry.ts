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

    // 1. Busca e valida configurações
    const configs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    
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

    // Define ambiente específico por tipo
    let ambiente = 'producao';
    if (tipo === 'NFe') {
      ambiente = configs.find(c => c.chave === 'nfe_ambiente')?.valor || 'producao';
    } else if (tipo === 'NFCe') {
      ambiente = configs.find(c => c.chave === 'nfce_ambiente')?.valor || 'producao';
    } else if (tipo === 'NFSe') {
      ambiente = configs.find(c => c.chave === 'nfse_ambiente')?.valor || 'producao';
    }
    
    // Usa API key específica por ambiente, com fallback para variável de ambiente
    const chaveAmbiente = ambiente === 'homologacao' ? 'focusnfe_api_key_homologacao' : 'focusnfe_api_key_producao';
    const apiKey = Deno.env.get('FOCUSNFE_API_KEY') || 
      configs.find(c => c.chave === chaveAmbiente)?.valor?.trim() ||
      configs.find(c => c.chave === 'focusnfe_api_key')?.valor?.trim();
    
    if (!apiKey) {
      return Response.json(
        { sucesso: false, erro: `API Key Focus NFe não configurada para ${ambiente}` },
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
    } else if (tipo === 'NFe') {
      const cfgUltimoNFe = configs.find(c => c.chave === 'nfe_ultimo_numero');
      const ultimoSalvo = parseInt(cfgUltimoNFe?.valor || '0', 10);
      const numsNFe = todasNotas
        .filter(n => n.tipo === 'NFe')
        .map(n => parseInt(n.numero, 10))
        .filter(n => !isNaN(n));
      const ultimoNota = numsNFe.length > 0 ? Math.max(...numsNFe) : 0;
      proximoNum = Math.max(ultimoSalvo, ultimoNota) + 1;
      serieUsada = (configs.find(c => c.chave === 'nfe_serie')?.valor || '1').padStart(3, '0');
    } else {
      // NFSe
      const cfgUltimoNFSe = configs.find(c => c.chave === 'nfse_ultimo_rps');
      const ultimoSalvo = parseInt(cfgUltimoNFSe?.valor || '0', 10);
      const numsNFSe = todasNotas
        .filter(n => n.tipo === 'NFSe')
        .map(n => parseInt(n.numero, 10))
        .filter(n => !isNaN(n));
      const ultimoNota = numsNFSe.length > 0 ? Math.max(...numsNFSe) : 0;
      proximoNum = Math.max(ultimoSalvo, ultimoNota) + 1;
      serieUsada = (configs.find(c => c.chave === 'nfse_serie_rps')?.valor || '1').padStart(3, '0');
    }

    const agora = new Date();
    // Subtrai 5 minutos para evitar erro 703 (clock skew com SEFAZ)
    const agoraBrasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000 - 5 * 60 * 1000);
    const dataEmissaoFormatada = data_emissao || agoraBrasilia.toISOString().split('T')[0];
    const horaEmissao = agoraBrasilia.toISOString().substring(11, 19);
    const ref = `${tipo.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const formaPgtoCode = PAYMENT_MAP[forma_pagamento] || '01';
    const cpfCnpjLimpo = (cliente_cpf_cnpj || '').replace(/\D/g, '');

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

      const servicoItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Serviços', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total) }
      ];

      payload = {
        data_emissao: dataEmissaoFormatada,
        prestador: {
          cnpj: cfgCnpj.replace(/\D/g, ''),
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
            }
          } : {}),
        },
        items: servicoItems.map((it, idx) => ({
          descricao: (it.descricao || `Serviço ${idx + 1}`).substring(0, 120),
          quantidade: Number(it.quantidade) || 1,
          valor_unitario: Number(it.valor_unitario) || 0,
          valor_total: Number(it.valor_total) || 0,
        })),
        ...(observacoes ? { observacoes } : {}),
      };

    } else if (tipo === 'NFCe') {
      endpoint = `/nfce?ref=${ref}`;
      const cfgCnpj = configs.find(c => c.chave === 'cnpj')?.valor || '';
      const nfceToken = configs.find(c => c.chave === 'nfce_token')?.valor?.trim() || '';
      const nfceCsc = configs.find(c => c.chave === 'nfce_csc')?.valor?.trim() || '';

      // Validar configurações obrigatórias
      if (!cfgCnpj || cfgCnpj.replace(/\D/g, '').length !== 14) {
        return Response.json(
          { sucesso: false, erro: 'CNPJ da empresa não configurado ou inválido' },
          { status: 400 }
        );
      }
      if (!nfceToken || nfceToken.length < 6) {
        return Response.json(
          { sucesso: false, erro: 'Token NFCe não configurado (nfce_token)' },
          { status: 400 }
        );
      }
      if (!nfceCsc || nfceCsc.length < 4) {
        return Response.json(
          { sucesso: false, erro: 'CSC NFCe não configurado (nfce_csc)' },
          { status: 400 }
        );
      }

      const prodItems = (items && items.length > 0) ? items : [
        { descricao: observacoes || 'Produtos', quantidade: 1, valor_unitario: Number(valor_total), valor_total: Number(valor_total), ncm: '87089990', unidade: 'UN' }
      ];

      const temCPFCNPJ = cpfCnpjLimpo && (cpfCnpjLimpo.length === 11 || cpfCnpjLimpo.length === 14);

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

        items: prodItems.map((it, idx) => {
          const qtd = Number(it.quantidade) || 1;
          const valUni = Number(it.valor_unitario) || 0;
          const valTotal = Number(it.valor_total) || (qtd * valUni);
          const item = {
            numero_item: idx + 1,
            codigo_produto: (it.codigo || `PROD${String(idx + 1).padStart(3, '0')}`).substring(0, 60),
            descricao: (it.descricao || `Produto ${idx + 1}`).substring(0, 120),
            codigo_ncm: (it.ncm || '87089990').replace(/\D/g, '').padStart(8, '0').substring(0, 8),
            unidade_comercial: (it.unidade || 'UN').substring(0, 6),
            quantidade_comercial: qtd,
            valor_unitario_comercial: parseFloat(valUni.toFixed(2)),
            valor_bruto: parseFloat(valTotal.toFixed(2)),
            unidade_tributavel: (it.unidade || 'UN').substring(0, 6),
            quantidade_tributavel: qtd,
            valor_unitario_tributavel: parseFloat(valUni.toFixed(2)),
            icms_situacao_tributaria: '400',
            icms_origem: '0',
            pis_situacao_tributaria: '07',
            cofins_situacao_tributaria: '07',
          };
          return item;
        }),
        formas_pagamento: [{
          forma_pagamento: formaPgtoCode,
          valor_pagamento: parseFloat(Number(valor_total).toFixed(2)),
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
        natureza_operacao: data.natureza_operacao || 'Venda de mercadoria',
        data_emissao: `${dataEmissaoFormatada}T${horaEmissao}-03:00`,
        data_saida_entrada: `${dataEmissaoFormatada}T${horaEmissao}-03:00`,
        tipo_documento: data.tipo_documento || '1',
        indicador_presenca: '1',
        ...(cpfCnpjLimpo && cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo && cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        nome_destinatario: cliente_nome || 'Consumidor Final',
        indicador_ie_destinatario: '9',
        ...(cliente_email ? { email_destinatario: cliente_email } : {}),
        ...(cliente_endereco ? {
          logradouro_destinatario: cliente_endereco,
          numero_destinatario: cliente_numero || 'S/N',
          bairro_destinatario: cliente_bairro || '',
          municipio_destinatario: cliente_cidade || '',
          uf_destinatario: cliente_estado || 'MG',
          cep_destinatario: (cliente_cep || '').replace(/\D/g, ''),
          pais_destinatario: 'Brasil',
          ...(cliente_telefone ? { telefone_destinatario: cliente_telefone.replace(/\D/g, '') } : {}),
        } : {}),
        modalidade_frete: '9',
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: (it.codigo || `PROD${String(idx + 1).padStart(3, '0')}`).substring(0, 60),
          descricao: (it.descricao || `Produto ${idx + 1}`).substring(0, 120),
          codigo_ncm: (it.ncm || '87089990').replace(/\D/g, '').padStart(8, '0'),
          cfop: it.cfop || '5405',
          unidade_comercial: (it.unidade || 'UN').substring(0, 6),
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: parseFloat(Number(it.valor_unitario || 0).toFixed(2)),
          valor_bruto: parseFloat(Number(it.valor_total || 0).toFixed(2)),
          unidade_tributavel: (it.unidade || 'UN').substring(0, 6),
          quantidade_tributavel: Number(it.quantidade) || 1,
          valor_unitario_tributavel: parseFloat(Number(it.valor_unitario || 0).toFixed(2)),
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
      return Response.json({
        sucesso: false,
        erro: `Erro Focus NFe (${resp.status}): ${errMsg}`,
        detalhes: result,
        payload,
      }, { status: 400 });
    }

    // 7. Salva no banco de dados com status correto da API
    const itensParaSalvar = (items && items.length > 0) ? items : [{
      descricao: observacoes || 'Serviços',
      quantidade: 1,
      valor_unitario: Number(valor_total),
      valor_total: Number(valor_total),
      forma_pagamento: forma_pagamento || 'PIX',
    }];

    // Mapeia status do Focus NFe para status interno
    const statusFocus = result.status || '';
    let statusInterno = 'Processando';
    if (['autorizado'].includes(statusFocus)) statusInterno = 'Emitida';
    else if (['erro', 'rejeitado', 'denegado', 'cancelado'].includes(statusFocus)) statusInterno = 'Erro';

    const notaData = {
      tipo,
      numero: String(proximoNum),
      serie: String(parseInt(serieUsada, 10) || 1),
      status: statusInterno,
      status_sefaz: statusFocus,
      mensagem_sefaz: result.mensagem_sefaz || result.mensagem || '',
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

    // 8. Atualiza último número nas config
    let chaveAtualizar = '';
    if (tipo === 'NFe') chaveAtualizar = 'nfe_ultimo_numero';
    if (tipo === 'NFCe') chaveAtualizar = 'nfce_ultimo_numero';
    if (tipo === 'NFSe') chaveAtualizar = 'nfse_ultimo_rps';
    
    const cfgUltimo = configs.find(c => c.chave === chaveAtualizar);
    if (cfgUltimo?.id) {
      await base44.asServiceRole.entities.Configuracao.update(cfgUltimo.id, {
        chave: chaveAtualizar,
        valor: String(proximoNum),
      });
    } else {
      await base44.asServiceRole.entities.Configuracao.create({
        chave: chaveAtualizar,
        valor: String(proximoNum),
      });
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