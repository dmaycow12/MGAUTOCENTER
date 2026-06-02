import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function updateWithRetry(base44, id, data, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await base44.asServiceRole.entities.Estoque.update(id, data);
      return;
    } catch (e) {
      if (e.message && e.message.includes('Rate limit') && i < maxRetries - 1) {
        await sleep(2000 * (i + 1)); // espera 2s, 4s, 6s...
      } else {
        throw e;
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const items = await base44.asServiceRole.entities.Estoque.list('-created_date', 500);
    let atualizados = 0;

    for (const item of items) {
      const hist = item.historico || [];
      let modificado = false;

      const novoHist = hist.map(h => {
        const obs = (h.observacao || '').toLowerCase();
        if (obs.includes('regulariza') || obs === 'ajuste') {
          const needsFix = obs.includes('regulariza') || (h.valor_unitario && h.valor_unitario !== 0);
          if (needsFix) {
            modificado = true;
            return {
              ...h,
              observacao: 'Ajuste',
              valor_unitario: 0,
            };
          }
        }
        return h;
      });

      if (modificado) {
        await updateWithRetry(base44, item.id, { historico: novoHist });
        atualizados++;
        await sleep(400); // pausa entre cada update
      }
    }

    return Response.json({ ok: true, atualizados });
  } catch(e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});