import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ASAAS_BASE = 'https://api.asaas.com/v3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ erro: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { financeiro_id, nome, cpf_cnpj, email, valor, vencimento, descricao } = body;

    if (!nome || !cpf_cnpj || !valor || !vencimento) {
      return Response.json({ erro: 'Campos obrigatórios: nome, cpf_cnpj, valor, vencimento' }, { status: 400 });
    }

    const API_KEY = Deno.env.get('ASAAS_API_KEY');
    const headers = {
      'Content-Type': 'application/json',
      'access_token': API_KEY,
    };

    // 1. Busca ou cria o cliente no Asaas pelo CPF/CNPJ
    const cpfLimpo = cpf_cnpj.replace(/\D/g, '');
    let customerId = null;

    const busca = await fetch(`${ASAAS_BASE}/customers?cpfCnpj=${cpfLimpo}&limit=1`, { headers });
    if (busca.ok) {
      const res = await busca.json();
      if (res.data && res.data.length > 0) {
        customerId = res.data[0].id;
      }
    }

    if (!customerId) {
      const criar = await fetch(`${ASAAS_BASE}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: nome,
          cpfCnpj: cpfLimpo,
          email: email || undefined,
        }),
      });
      const novoCliente = await criar.json();
      if (!criar.ok) {
        return Response.json({ erro: 'Erro ao criar cliente no Asaas', detalhe: novoCliente }, { status: 400 });
      }
      customerId = novoCliente.id;
    }

    // 2. Cria o boleto
    const payload = {
      customer: customerId,
      billingType: 'BOLETO',
      value: Number(valor),
      dueDate: vencimento, // formato YYYY-MM-DD
      description: descricao || 'Cobrança',
    };

    const respBoleto = await fetch(`${ASAAS_BASE}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const boleto = await respBoleto.json();

    if (!respBoleto.ok) {
      return Response.json({ erro: 'Erro ao criar boleto no Asaas', detalhe: boleto }, { status: 400 });
    }

    // 3. Busca o link do boleto para impressão
    const linkResp = await fetch(`${ASAAS_BASE}/payments/${boleto.id}/identificationField`, { headers });
    const linkData = linkResp.ok ? await linkResp.json() : {};

    const resultado = {
      asaas_id: boleto.id,
      boleto_url: boleto.bankSlipUrl || boleto.invoiceUrl,
      linha_digitavel: linkData.identificationField || boleto.nossoNumero,
      vencimento: boleto.dueDate,
      valor: boleto.value,
      status: boleto.status,
    };

    // 4. Salva referência no registro financeiro se fornecido
    if (financeiro_id) {
      await base44.asServiceRole.entities.Financeiro.update(financeiro_id, {
        forma_pagamento: 'Boleto',
        observacoes: [
          `Boleto Asaas ID: ${boleto.id}`,
          resultado.boleto_url ? `Link: ${resultado.boleto_url}` : null,
          resultado.linha_digitavel ? `Linha: ${resultado.linha_digitavel}` : null,
        ].filter(Boolean).join('\n'),
      });
    }

    return Response.json({ sucesso: true, ...resultado });

  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});