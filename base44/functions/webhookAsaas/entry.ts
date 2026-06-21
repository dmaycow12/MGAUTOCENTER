import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Webhook do Asaas — chamado automaticamente quando um pagamento muda de status.
// Registre esta URL no painel do Asaas em: Configurações → Integrações → Webhooks
// URL: https://app.base44.com/api/functions/webhookAsaas (copie a URL da função no dashboard)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Valida token de segurança no header (opcional mas recomendado)
    // O Asaas envia "asaas-access-token" no header com o token configurado no webhook
    const AUTH_SECRET = Deno.env.get('AUTH_SECRET');
    const token = req.headers.get('asaas-access-token');
    if (AUTH_SECRET && token && token !== AUTH_SECRET) {
      return Response.json({ erro: 'Token inválido' }, { status: 401 });
    }

    const body = await req.json();
    const { event, payment } = body;

    // Só processa eventos de pagamento confirmado
    const EVENTOS_PAGOS = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];
    if (!EVENTOS_PAGOS.includes(event) || !payment?.id) {
      return Response.json({ ok: true, ignorado: true });
    }

    const asaasId = payment.id;

    // Busca todos os lançamentos Financeiros que contenham esse Asaas ID nas observações
    const todos = await base44.asServiceRole.entities.Financeiro.list('-created_date', 9999);
    const match = todos.filter(f =>
      f.observacoes && f.observacoes.includes(`Boleto Asaas ID: ${asaasId}`)
    );

    if (match.length === 0) {
      return Response.json({ ok: true, aviso: 'Nenhum lançamento encontrado para este pagamento' });
    }

    const hoje = new Date().toISOString().split('T')[0];

    for (const item of match) {
      if (item.status !== 'Pago') {
        await base44.asServiceRole.entities.Financeiro.update(item.id, {
          status: 'Pago',
          data_pagamento: payment.paymentDate || hoje,
        });
      }
    }

    return Response.json({ ok: true, atualizados: match.length });

  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});