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
    const nomeOficinaConfig = configs.find(c => c.chave === 'nome_oficina');
    const cnpjConfig = configs.find(c => c.chave === 'cnpj');

    const spedyApiKey = apiKeyConfig?.valor;
    const ambiente = ambienteConfig?.valor || 'homologacao';
    const nomeOficina = nomeOficinaConfig?.valor || '';
    const cnpj = cnpjConfig?.valor || '';

    if (!spedyApiKey) {
      return Response.json({ sucesso: false, erro: 'Chave API Spedy não configurada. Acesse Configurações para inserir sua chave.' }, { status: 400 });
    }

    // URL base Spedy
    const baseUrl = ambiente === 'producao'
      ? 'https://api.spedy.com.br/v1'
      : 'https://sandbox.spedy.com.br/v1';

    // Busca dados do cliente se tiver ID
    let clienteData = { nome: cliente_nome };
    if (cliente_id) {
      const clientes = await base44.asServiceRole.entities.Cliente.filter({ id: cliente_id });
      if (clientes.length > 0) {
        const c = clientes[0];
        clienteData = {
          nome: c.nome,
          cpf_cnpj: c.cpf_cnpj,
          email: c.email,
          telefone: c.telefone,
          endereco: c.endereco,
          numero: c.numero,
          bairro: c.bairro,
          cidade: c.cidade,
          estado: c.estado,
          cep: c.cep,
        };
      }
    }

    // Monta payload para Spedy
    const payload = {
      tipo,
      emitente: { nome: nomeOficina, cnpj },
      destinatario: clienteData,
      valor_total: Number(valor_total) || 0,
      descricao: observacoes || 'Serviços de manutenção automotiva',
      data_emissao: data_emissao || new Date().toISOString().split('T')[0],
      referencia: ordem_servico_id || '',
    };

    // Chama API Spedy
    const response = await fetch(`${baseUrl}/notas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${spedyApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      // Salva a nota fiscal no banco
      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo,
        numero: result.numero || result.id || '',
        serie: result.serie || '',
        status: 'Emitida',
        cliente_id: cliente_id || '',
        cliente_nome: clienteData.nome,
        ordem_servico_id: ordem_servico_id || '',
        valor_total: Number(valor_total),
        chave_acesso: result.chave_acesso || result.chave || '',
        spedy_id: result.id || '',
        xml_url: result.xml_url || '',
        pdf_url: result.pdf_url || '',
        data_emissao: data_emissao,
        observacoes: observacoes || '',
      });

      return Response.json({ sucesso: true, nota: result });
    } else {
      return Response.json({
        sucesso: false,
        erro: result.message || result.erro || 'Erro ao emitir nota fiscal na Spedy.',
        detalhes: result,
      }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});