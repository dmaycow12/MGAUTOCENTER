import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateComRetry(base44, id, data) {
  let tentativas = 0;
  while (tentativas < 3) {
    try {
      await base44.entities.Vendas.update(id, data);
      return { ok: true };
    } catch (erro) {
      tentativas++;
      if (tentativas >= 3) return { ok: false, erro: erro.message };
      await sleep(1000 * tentativas);
    }
  }
}

async function buscarTodasVendas(base44) {
  let todas = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.Vendas.filter({}, 'created_date', 100, skip);
    if (batch.length === 0) break;
    todas = todas.concat(batch);
    skip += 100;
  }
  return todas;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // fase: "limpar" | "numerar"
    const fase = body.fase || 'limpar';
    const offset = body.offset || 0;
    const batchSize = 20;

    const todas = await buscarTodasVendas(base44);
    const total = todas.length;
    let processados = 0;
    let alterados = 0;
    let erros = [];

    if (fase === 'limpar') {
      // FASE 1: Apagar o número de todas as vendas (setar como string vazia)
      for (let i = offset; i < Math.min(offset + batchSize, total); i++) {
        processados++;
        const venda = todas[i];
        if (venda.numero !== '' && venda.numero !== null && venda.numero !== undefined) {
          const result = await updateComRetry(base44, venda.id, { numero: '' });
          if (result.ok) alterados++;
          else erros.push({ id: venda.id, erro: result.erro });
        } else {
          alterados++; // já estava vazio
        }
        await sleep(500);
      }

      const proximoOffset = offset + batchSize < total ? offset + batchSize : null;

      return Response.json({
        ok: true,
        fase: 'limpar',
        total,
        offset,
        processados,
        alterados,
        erros: erros.length,
        proximoOffset,
        // Quando limpar terminar, indicar para começar a numeração
        proximaFase: proximoOffset === null ? 'numerar' : 'limpar',
        mensagem: proximoOffset === null
          ? 'Limpeza concluída! Agora chame com fase="numerar" e offset=0'
          : `Limpeza em andamento... próximo offset: ${proximoOffset}`,
      });

    } else if (fase === 'numerar') {
      // FASE 2: Numerar da mais velha (1) para a mais nova (N)
      let updates = [];

      for (let i = offset; i < Math.min(offset + batchSize, total); i++) {
        processados++;
        const venda = todas[i];
        const novoNumero = (i + 1).toString();

        const result = await updateComRetry(base44, venda.id, { numero: novoNumero });
        if (result.ok) {
          updates.push({ posicao: i + 1, id: venda.id, numero: novoNumero });
          alterados++;
        } else {
          erros.push({ id: venda.id, numero: novoNumero, erro: result.erro });
        }
        await sleep(800);
      }

      const proximoOffset = offset + batchSize < total ? offset + batchSize : null;

      return Response.json({
        ok: true,
        fase: 'numerar',
        total,
        offset,
        processados,
        alterados,
        erros: erros.length,
        proximoOffset,
        updates,
        errosDetalhes: erros.slice(0, 5),
        mensagem: proximoOffset === null
          ? `Numeração concluída! ${total} vendas numeradas de 1 a ${total}.`
          : `Numerando... próximo offset: ${proximoOffset}`,
      });
    }

    return Response.json({ error: 'fase inválida. Use "limpar" ou "numerar"' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});