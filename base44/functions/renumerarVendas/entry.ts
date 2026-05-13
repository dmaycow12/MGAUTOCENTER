import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateComRetry(base44, id, data) {
  let tentativas = 0;
  while (tentativas < 3) {
    try {
      await base44.asServiceRole.entities.Vendas.update(id, data);
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
    const batch = await base44.asServiceRole.entities.Vendas.filter({}, 'data_entrada', 500, skip);
    if (batch.length === 0) break;
    todas = todas.concat(batch);
    if (batch.length < 500) break;
    skip += 500;
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
    const fase = body.fase || 'limpar';
    const offset = body.offset || 0;
    const batchSize = 20;

    // Buscar TODAS as vendas
    const todasRaw = await buscarTodasVendas(base44);
    const total = todasRaw.length;

    // ORDENAR LOCALMENTE de forma estável:
    // 1. data_entrada ASC (YYYY-MM-DD string, comparável diretamente)
    // 2. created_date ASC como desempate (garante ordem estável)
    const todas = todasRaw.slice().sort((a, b) => {
      const dataA = a.data_entrada || '0000-00-00';
      const dataB = b.data_entrada || '0000-00-00';
      if (dataA < dataB) return -1;
      if (dataA > dataB) return 1;
      // Desempate por created_date
      const cdA = a.created_date ? new Date(a.created_date).getTime() : 0;
      const cdB = b.created_date ? new Date(b.created_date).getTime() : 0;
      return cdA - cdB;
    });

    let processados = 0;
    let alterados = 0;
    let erros = [];

    if (fase === 'limpar') {
      for (let i = offset; i < Math.min(offset + batchSize, total); i++) {
        processados++;
        const venda = todas[i];
        const result = await updateComRetry(base44, venda.id, { numero: '' });
        if (result.ok) alterados++;
        else erros.push({ id: venda.id, erro: result.erro });
        await sleep(300);
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
        proximaFase: proximoOffset === null ? 'numerar' : 'limpar',
        mensagem: proximoOffset === null
          ? 'Limpeza concluída! Agora chame com fase="numerar" e offset=0'
          : `Limpeza em andamento... próximo offset: ${proximoOffset}`,
      });

    } else if (fase === 'numerar') {
      let updates = [];

      for (let i = offset; i < Math.min(offset + batchSize, total); i++) {
        processados++;
        const venda = todas[i];
        const novoNumero = (i + 1).toString();

        const result = await updateComRetry(base44, venda.id, { numero: novoNumero });
        if (result.ok) {
          updates.push({ posicao: i + 1, id: venda.id, numero: novoNumero, data: venda.data_entrada });
          alterados++;
        } else {
          erros.push({ id: venda.id, numero: novoNumero, erro: result.erro });
        }
        await sleep(500);
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