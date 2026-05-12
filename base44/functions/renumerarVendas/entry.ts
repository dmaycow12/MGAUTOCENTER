import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function updateComRetry(base44, id, numero, tentativas = 3) {
  for (let t = 0; t < tentativas; t++) {
    try {
      await base44.asServiceRole.entities.Vendas.update(id, { numero });
      return { ok: true };
    } catch (e) {
      if (t < tentativas - 1) await sleep(500 + t * 500);
      else return { ok: false, erro: e.message };
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const batchSize = 50;

    // Busca todas as vendas ordenadas por data de criação
    const all = await base44.asServiceRole.entities.Vendas.list('created_date', 500);
    all.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));

    // Processa apenas o batch atual
    const batch = all.slice(offset, offset + batchSize);

    const updates = [];
    const erros = [];

    for (let i = 0; i < batch.length; i++) {
      const globalIndex = offset + i;
      const novoNumero = String(globalIndex + 1);
      // Normaliza quilometragem para string se vier como número
      const km = batch[i].quilometragem;
      if (typeof km === 'number') {
        try {
          await base44.asServiceRole.entities.Vendas.update(batch[i].id, { quilometragem: String(Math.round(km)) });
          await sleep(100);
        } catch (_) {}
      }
      if (batch[i].numero !== novoNumero) {
        const result = await updateComRetry(base44, batch[i].id, novoNumero);
        if (result.ok) {
          updates.push({ de: batch[i].numero, para: novoNumero });
        } else {
          erros.push({ id: batch[i].id, numero: novoNumero, erro: result.erro });
        }
        await sleep(150);
      }
    }

    const hasMore = offset + batchSize < all.length;
    return Response.json({
      ok: true,
      total: all.length,
      offset,
      processados: batch.length,
      alterados: updates.length,
      erros: erros.length,
      proximoOffset: hasMore ? offset + batchSize : null,
      updates,
      errosDetalhes: erros,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});