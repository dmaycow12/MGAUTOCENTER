import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { financeiro_id, valor } = await req.json();
    const apiKey = Deno.env.get("ASAAS_API_KEY");

    // Busca pagamentos no Asaas pelo valor
    const res = await fetch(`https://api.asaas.com/v3/payments?limit=100`, {
      headers: { "access_token": apiKey }
    });
    const data = await res.json();

    // Retorna todos
    return Response.json({
      matches: (data.data || []).map(p => ({
        id: p.id,
        value: p.value,
        description: p.description,
        status: p.status,
        bankSlipUrl: p.bankSlipUrl,
        invoiceUrl: p.invoiceUrl,
        nossoNumero: p.nossoNumero,
        dueDate: p.dueDate,
        dateCreated: p.dateCreated,
      }))
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});