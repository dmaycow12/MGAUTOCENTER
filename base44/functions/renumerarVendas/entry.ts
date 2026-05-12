import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateComRetry(base44, id, numeroVenda) {
  let tentativas = 0;
  const maxTentativas = 3;
  
  while (tentativas < maxTentativas) {
    try {
      await base44.entities.Vendas.update(id, {
        numero: numeroVenda.toString(),
      });
      return { ok: true };
    } catch (erro) {
      tentativas++;
      if (tentativas >= maxTentativas) {
        return { ok: false, erro: erro.message };
      }
      await sleep(1000 + tentativas * 1000);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const batchSize = 20;

    // Buscar TODAS as vendas ordenadas por created_date (mais velhas primeiro)
    let todas = [];
    let skip = 0;
    const limit = 100;
    
    while (true) {
      const batch = await base44.entities.Vendas.filter({}, 'created_date', limit, skip);
      if (batch.length === 0) break;
      todas = todas.concat(batch);
      skip += limit;
    }

    let updates = [];
    let erros = [];
    let processados = 0;
    let alterados = 0;

    // Processar batch a partir do offset
    for (let i = offset; i < Math.min(offset + batchSize, todas.length); i++) {
      processados++;
      const venda = todas[i];
      const novoNumero = (i + 1); // Numeração de 1 a N

      const result = await updateComRetry(base44, venda.id, novoNumero);
      if (result.ok) {
        updates.push({ de: venda.numero || '(vazio)', para: novoNumero });
        alterados++;
      } else {
        erros.push({ id: venda.id, numero: novoNumero, erro: result.erro });
      }
      await sleep(800);
    }

    const proximoOffset = offset + batchSize < todas.length ? offset + batchSize : null;

    return Response.json({
      ok: true,
      total: todas.length,
      offset,
      processados,
      alterados,
      erros: erros.length,
      proximoOffset,
      updates,
      errosDetalhes: erros.slice(0, 5),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});