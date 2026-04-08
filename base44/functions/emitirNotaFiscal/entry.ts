import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PAYMENT_MAP = {
  'Dinheiro': '01', 'Cheque': '02', 'Cartão de Crédito': '03',
  'Cartão de Débito': '04', 'PIX': '17', 'Boleto': '15',
  'Transferência': '03', 'A Prazo': '99',
};

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const CNPJ_EMITENTE = '54043647000120';
const COD_MUNICIPIO_PATOS = '3148004';
const INSCRICAO_MUNICIPAL = '2024000738';

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const {
      tipo, cliente_nome, cliente_cpf_cnpj, cliente_ie, cliente_email,
      cliente_numero, cliente_endereco, cliente_bairro, cliente_cep,
      cliente_cidade, cliente_estado, cliente_codigo_municipio, codigo_municipio_prestacao, items, valor_total,
      forma_pagamento, observacoes, nota_id, cliente_id,
      data_emissao, serie_manual, ordem_venda_id,
    } = body;

    // Monta timestamp de emissão
    const pad = (n) => String(n).padStart(2, '0');
    const agora = new Date();
    const brasiliaMs = agora.getTime() - (3 * 60 * 60 * 1000);
    const brasiliaDate = new Date(brasiliaMs);
    const hojeStr = `${brasiliaDate.getUTCFullYear()}-${pad(brasiliaDate.getUTCMonth() + 1)}-${pad(brasiliaDate.getUTCDate())}`;
    const dataBase = data_emissao || hojeStr;

    let dataEmissaoISO;
    if (dataBase >= hojeStr) {
      // NFCe é muito sensível a atraso — usa horário atual de Brasília exato
      const h = pad(brasiliaDate.getUTCHours());
      const m = pad(brasiliaDate.getUTCMinutes());
      const s = pad(brasiliaDate.getUTCSeconds());
      dataEmissaoISO = `${hojeStr}T${h}:${m}:${s}-03:00`;
    } else {
      // Data passada: usa meio-dia (sempre seguro)
      dataEmissaoISO = `${dataBase}T12:00:00-03:00`;
    }

    const ref = `${(tipo || 'nfe').toLowerCase()}-${Date.now()}`;

    const NCM_PADRAO = '87089990';
    const validarNcm = (ncm) => /^[0-9]{8}$/.test((ncm || '').replace(/\D/g, '')) ? (ncm || '').replace(/\D/g, '') : NCM_PADRAO;
    const validarCest = (cest) => { if (!cest) return null; const s = (cest || '').replace(/\D/g, ''); return s.length > 0 ? s.padStart(7, '0') : null; };

    let cpfCnpjLimpo = (cliente_cpf_cnpj || '').replace(/\D/g, '');
    let cepLimpo = (cliente_cep || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) cepLimpo = '';

    let endpoint = '';
    let payload = null;
    let proximoRps = null;
    let proximoNfce = null;
    let proximoNfe = null;

    // Se nota_id fornecido, verifica se já tem número reservado (retry após erro)
    let notaExistente = null;
    if (nota_id) {
      try {
        const lista = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
        notaExistente = lista[0] || null;
      } catch {}
    }

    if (tipo === 'NFSe') {
      endpoint = `/nfsen?ref=${ref}`;

      if (notaExistente?.numero) {
        // Retry: reusa o número já salvo na nota (não incrementa mais)
        proximoRps = parseInt(notaExistente.numero, 10);
      } else {
        const configsNfse = await base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfse_ultimo_dps' });
        const ultimoDps = parseInt(configsNfse[0]?.valor || '0', 10);
        proximoRps = ultimoDps + 1;
        if (configsNfse.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfse[0].id, { valor: String(proximoRps) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfse_ultimo_dps', valor: String(proximoRps), descricao: 'Ultimo numero DPS/NFSe Nacional autorizado' });
        }
      }

      const valorServico = Number(valor_total) || 1.0;
      const valorIss = parseFloat((valorServico * 0.025).toFixed(2));
      const discriminacao = (items && items.length > 0)
        ? items.map(it => `${it.descricao} - Qtd: ${it.quantidade} - Valor: R$ ${Number(it.valor_total).toFixed(2)}`).join('; ')
        : (observacoes || 'Serviços prestados');

      const codMunTomador = cliente_codigo_municipio || COD_MUNICIPIO_PATOS;

      // Payload NFSe Nacional (DPS) - endpoint /nfsen, payload flat
      payload = {
        data_emissao: dataEmissaoISO,
        data_competencia: dataBase,
        serie_dps: '900',
        numero_dps: String(proximoRps),
        codigo_municipio_emissora: codigo_municipio_prestacao || COD_MUNICIPIO_PATOS,
        cnpj_prestador: CNPJ_EMITENTE,
        inscricao_municipal_prestador: INSCRICAO_MUNICIPAL,
        codigo_opcao_simples_nacional: 3,
        regime_tributario_simples_nacional: 1,
        regime_especial_tributacao: 0,
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_tomador: cpfCnpjLimpo } : (cpfCnpjLimpo.length === 11 ? { cpf_tomador: cpfCnpjLimpo } : {})),
        razao_social_tomador: (cliente_nome || 'Consumidor Final').substring(0, 100),
        ...(cliente_email ? { email_tomador: cliente_email } : {}),
        ...(cliente_codigo_municipio ? { codigo_municipio_tomador: cliente_codigo_municipio } : { codigo_municipio_tomador: COD_MUNICIPIO_PATOS }),
        ...(cliente_endereco ? { logradouro_tomador: cliente_endereco } : {}),
        ...(cliente_numero ? { numero_tomador: cliente_numero } : {}),
        ...(cliente_bairro ? { bairro_tomador: cliente_bairro } : {}),
        codigo_municipio_prestacao: codigo_municipio_prestacao || COD_MUNICIPIO_PATOS,
        codigo_municipio_tomador: codMunTomador,
        codigo_tributacao_nacional_iss: '140101',
        descricao_servico: discriminacao.substring(0, 1000),
        valor_servico: valorServico,
        valor_iss: valorIss,
        tributacao_iss: 1,
        tipo_retencao_iss: 1,
        situacao_tributaria_pis_cofins: '00',
        percentual_total_tributos_federais: '10.38',
        percentual_total_tributos_estaduais: '0.00',
        percentual_total_tributos_municipais: '2.50',
        indicador_total_tributacao: null,
        codigo_municipio_prestacao: codigo_municipio_prestacao || COD_MUNICIPIO_PATOS,
      };
    } else if (tipo === 'NFCe') {
      endpoint = `/nfce?ref=${ref}`;

      if (notaExistente?.numero) {
        proximoNfce = parseInt(notaExistente.numero, 10);
      } else {
        const configsNfce = await base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfce_ultimo_numero' });
        const ultimoNfce = parseInt(configsNfce[0]?.valor || '0', 10);
        proximoNfce = ultimoNfce + 1;
        if (configsNfce.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfce[0].id, { valor: String(proximoNfce) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfce_ultimo_numero', valor: String(proximoNfce), descricao: 'Ultimo numero NFCe autorizado' });
        }
      }
      
      const prodItems = (items && items.length > 0) ? items : [
        { descricao: 'Peças e serviços', quantidade: 1, valor_unitario: Number(valor_total) || 1.0, valor_total: Number(valor_total) || 1.0, ncm: '87089990', cfop: '5102' }
      ];
      payload = {
        cnpj_emitente: CNPJ_EMITENTE,
        data_emissao: dataEmissaoISO,
        natureza_operacao: 'VENDA AO CONSUMIDOR',
        modalidade_frete: '9',
        local_destino: '1',
        presenca_comprador: '1',
        numero: proximoNfce,
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        ...(serie_manual ? { serie: serie_manual } : { serie: '1' }),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `REF${idx + 1}`,
          descricao: (it.descricao || 'Produto').substring(0, 120),
          codigo_ncm: validarNcm(it.ncm),
          cfop: '5102',
          unidade_comercial: it.unidade || 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(valor_total) || 1.0,
          valor_bruto: Number(it.valor_total) || Number(valor_total) || 1.0,
          icms_origem: '0',
          icms_situacao_tributaria: '102',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
          ...(validarCest(it.cest) ? { cest: validarCest(it.cest) } : {}),
        })),
        formas_pagamento: [{
          forma_pagamento: PAYMENT_MAP[forma_pagamento] || '17',
          valor_pagamento: Number(valor_total) || 1.0,
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes.substring(0, 500) } : {}),
      };
    } else {
      // NFe
      endpoint = `/nfe?ref=${ref}`;

      if (notaExistente?.numero) {
        proximoNfe = parseInt(notaExistente.numero, 10);
      } else {
        const configsNfe = await base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfe_ultimo_numero' });
        const ultimoNfe = parseInt(configsNfe[0]?.valor || '0', 10);
        proximoNfe = ultimoNfe + 1;
        if (configsNfe.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configsNfe[0].id, { valor: String(proximoNfe) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({ chave: 'nfe_ultimo_numero', valor: String(proximoNfe), descricao: 'Ultimo numero NFe autorizado' });
        }
      }
      
      const prodItems = (items && items.length > 0) ? items : [
        { descricao: 'Peças de Automóveis', quantidade: 1, valor_unitario: Number(valor_total) || 1.0, valor_total: Number(valor_total) || 1.0, ncm: '87089990', cfop: '5102' }
      ];
      payload = {
        cnpj_emitente: CNPJ_EMITENTE,
        data_emissao: dataEmissaoISO,
        data_saida_entrada: dataEmissaoISO,
        natureza_operacao: body.natureza_operacao || 'Venda de mercadoria',
        finalidade_emissao: '1',
        tipo_documento: body.tipo_documento || '1',
        presenca_comprador: '1',
        local_destino: '1',
        nome_destinatario: (cliente_nome || 'Consumidor Final').substring(0, 60),
        numero: proximoNfe,
        ...(cpfCnpjLimpo.length === 11 ? { cpf_destinatario: cpfCnpjLimpo } : {}),
        ...(cpfCnpjLimpo.length === 14 ? { cnpj_destinatario: cpfCnpjLimpo } : {}),
        logradouro_destinatario: cliente_endereco || 'Rua Rui Barbosa',
        numero_destinatario: cliente_numero || '1355',
        bairro_destinatario: cliente_bairro || 'Santa Terezinha',
        municipio_destinatario: cliente_cidade || 'Patos de Minas',
        uf_destinatario: cliente_estado || 'MG',
        cep_destinatario: cepLimpo,
        indicador_inscricao_estadual_destinatario: cpfCnpjLimpo.length === 14
          ? ((cliente_ie && cliente_ie.trim()) ? '1' : '9')
          : '9',
        ...(cpfCnpjLimpo.length === 14 && cliente_ie && cliente_ie.trim() ? { inscricao_estadual_destinatario: cliente_ie.replace(/\D/g, '') } : {}),
        consumidor_final: cpfCnpjLimpo.length === 11 || !(cliente_ie && cliente_ie.trim()) ? '1' : '0',
        modalidade_frete: '9',
        ...(serie_manual ? { serie: serie_manual } : { serie: '1' }),
        items: prodItems.map((it, idx) => ({
          numero_item: idx + 1,
          codigo_produto: it.codigo || `REF${idx + 1}`,
          descricao: (it.descricao || 'Produto').substring(0, 120),
          codigo_ncm: validarNcm(it.ncm),
          cfop: it.cfop || '5102',
          unidade_comercial: it.unidade || 'UN',
          quantidade_comercial: Number(it.quantidade) || 1,
          valor_unitario_comercial: Number(it.valor_unitario) || Number(valor_total) || 1.0,
          valor_bruto: Number(it.valor_total) || Number(valor_total) || 1.0,
          icms_origem: '0',
          icms_situacao_tributaria: '102',
          pis_situacao_tributaria: '07',
          cofins_situacao_tributaria: '07',
          ...(validarCest(it.cest) ? { cest: validarCest(it.cest) } : {}),
        })),
        formas_pagamento: [{
          forma_pagamento: PAYMENT_MAP[forma_pagamento] || '17',
          valor_pagamento: Number(valor_total) || 1.0,
        }],
        ...(observacoes ? { informacoes_adicionais_contribuinte: observacoes.substring(0, 500) } : {}),
      };
    }

    const resp = await fetch(`${FOCUSNFE_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_HEADER },
      body: JSON.stringify(payload),
    });

    const responseText = await resp.text();
    let result;
    try { result = JSON.parse(responseText); } catch {
      return Response.json({ sucesso: false, erro: `Resposta invalida: ${responseText.substring(0, 200)}` });
    }

    if (!resp.ok) {
      const msgErro = result.erros
        ? result.erros.map(e => e.mensagem).join('; ')
        : (result.mensagem || JSON.stringify(result));
      return Response.json({ sucesso: false, erro: msgErro });
    }

    // Determina endpoint de consulta por tipo
    const epConsulta = tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe';

    // Polling até autorizar (até 10 tentativas × 3s = 30s)
    let statusNota = 'Processando';
    let pdfUrl = '';
    let chaveAcesso = result.chave_nfe || '';
    let mensagemSefaz = result.erros?.[0]?.mensagem || result.mensagem_sefaz || result.mensagem || '';
    let resultFinal = result;

    for (let i = 0; i < 10; i++) {
      const st = resultFinal.status || '';
      if (st === 'autorizado') {
        statusNota = 'Emitida';
        const rawPdf = resultFinal.caminho_pdf_nfsen || resultFinal.caminho_pdf_nfse || resultFinal.caminho_danfe || '';
        const pdfUrlFull = normalizarUrl(rawPdf);
        // Salva a URL do PDF da Focus NFe (será baixado via proxy na hora de imprimir)
        if (pdfUrlFull) {
          pdfUrl = pdfUrlFull;
        }
        chaveAcesso = resultFinal.chave_nfe || resultFinal.chave_nfse || chaveAcesso;
        mensagemSefaz = resultFinal.mensagem_sefaz || resultFinal.mensagem || '';
        break;
      } else if (st === 'erro_autorizacao' || st === 'rejeitado' || st === 'erro') {
        mensagemSefaz = resultFinal.erros ? resultFinal.erros.map(e => e.mensagem).join('; ') : (resultFinal.mensagem || st);
        statusNota = mensagemSefaz.includes('E0160') ? 'Erro de Sincronia Governamental' : 'Erro';
        break;
      }
      // Ainda processando - aguarda e consulta de novo
      if (i < 9) {
        await new Promise(r => setTimeout(r, 3000));
        const consultaResp = await fetch(`${FOCUSNFE_BASE}/${epConsulta}/${ref}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (consultaResp.ok) {
          resultFinal = await consultaResp.json();
        }
      }
    }

    // Baixar estoque se NFe/NFCe e emitida com sucesso
    // Se a nota está vinculada a uma Ordem de Venda, o estoque JÁ foi baixado ao concluir a Ordem de Venda — não baixar novamente
    const vinculadaAOS = !!(body.ordem_venda_id);
    if (statusNota === 'Emitida' && (tipo === 'NFe' || tipo === 'NFCe') && !vinculadaAOS) {
      for (const it of (items || [])) {
        const qtd = Number(it.quantidade) || 1;
        let estoqueItem = null;
        if (it.estoque_id) {
          const found = await base44.asServiceRole.entities.Estoque.filter({ id: it.estoque_id });
          estoqueItem = found[0] || null;
        }
        // Fallback: busca pelo código se não achou por id
        if (!estoqueItem && it.codigo) {
          const found = await base44.asServiceRole.entities.Estoque.filter({ codigo: it.codigo });
          estoqueItem = found[0] || null;
        }
        if (estoqueItem) {
          const atual = Number(estoqueItem.quantidade || 0);
          await base44.asServiceRole.entities.Estoque.update(estoqueItem.id, { quantidade: Math.max(0, atual - qtd) });
        }
      }
    }

    let numeroFinal = '';
    if (tipo === 'NFSe') {
      numeroFinal = String(proximoRps);
    } else if (tipo === 'NFCe') {
      numeroFinal = String(proximoNfce);
    } else {
      numeroFinal = String(proximoNfe);
    }
    
    const notaData = {
      tipo,
      xml_content: JSON.stringify(items || []),
      cliente_cpf_cnpj: cliente_cpf_cnpj || '',
      cliente_ie: cliente_ie || '',
      cliente_email: cliente_email || '',
      cliente_telefone: body.cliente_telefone || '',
      cliente_endereco: cliente_endereco || '',
      cliente_numero: cliente_numero || '',
      cliente_bairro: cliente_bairro || '',
      cliente_cep: body.cliente_cep || '',
      cliente_cidade: cliente_cidade || '',
      cliente_estado: cliente_estado || '',
      forma_pagamento: forma_pagamento || '',
      numero: numeroFinal,
      serie: tipo === 'NFSe' ? '900' : (serie_manual || '1'),
      status: statusNota,
      spedy_id: ref,
      cliente_id: cliente_id || '',
      cliente_nome: cliente_nome || '',
      data_emissao: data_emissao || new Date().toISOString().split('T')[0],
      valor_total: Number(valor_total) || 0,
      pdf_url: pdfUrl,
      chave_acesso: chaveAcesso,
      ordem_venda_id: body.ordem_venda_id || '',
      observacoes: observacoes || '',
      mensagem_sefaz: mensagemSefaz,
    };

    // Reverter número reservado se erro em nova emissão (não em retry)
    if (statusNota === 'Erro' && !nota_id && tipo === 'NFSe') {
      try {
        const configsNfse = await base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfse_ultimo_dps' });
        if (configsNfse.length > 0) {
          const ultimoDps = parseInt(configsNfse[0].valor || '0', 10);
          if (ultimoDps === proximoRps) {
            await base44.asServiceRole.entities.Configuracao.update(configsNfse[0].id, { valor: String(ultimoDps - 1) });
            console.log('[DPS REVERT] DPS revertido de', proximoRps, 'para', ultimoDps - 1);
          }
        }
      } catch (revertError) {
        console.error('[DPS REVERT ERROR]', revertError);
      }
    }

    // Atualiza ou cria a nota com o status correto (Emitida, Processando ou Erro)
    try {
      if (nota_id) {
        // Atualizar nota existente (a que foi salva como rascunho)
        await base44.asServiceRole.entities.NotaFiscal.update(nota_id, notaData);
        console.log('[NOTA UPDATE] Nota atualizada com sucesso:', nota_id, 'Status:', statusNota);
      } else {
        // Criar nota nova se não existir
        const novaNota = await base44.asServiceRole.entities.NotaFiscal.create(notaData);
        console.log('[NOTA CREATE] Nota criada:', novaNota.id, 'Status:', statusNota);
      }
    } catch (updateError) {
      console.error('[NOTA ERROR] Erro ao atualizar/criar nota:', updateError);
      // Mesmo com erro na atualização, retorna o sucesso da emissão
      return Response.json({ sucesso: statusNota !== 'Erro', mensagem: `${statusNota} na SEFAZ, mas erro ao salvar no banco: ${updateError.message}`, status: statusNota });
    }

    const mensagem = statusNota === 'Emitida'
      ? 'Nota fiscal autorizada com sucesso!'
      : statusNota === 'Processando'
        ? 'Nota enviada para processamento. Aguarde autorizacao da SEFAZ.'
        : `Erro na emissão: ${mensagemSefaz}`;

    // Numero ja foi reservado no inicio, nao precisa atualizar novamente

    return Response.json({ sucesso: statusNota !== 'Erro', mensagem, pdf: pdfUrl, status: statusNota, mensagem_sefaz: mensagemSefaz });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message });
  }
});