import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca todos os produtos com retry
    let todos;
    let tentativas = 0;
    while (tentativas < 3) {
      try {
        todos = await base44.entities.Estoque.list("-created_date", 1000);
        break;
      } catch (e) {
        if (e.message.includes('Rate limit') && tentativas < 2) {
          await new Promise(r => setTimeout(r, 5000));
          tentativas++;
        } else {
          throw e;
        }
      }
    }

    // Agrupa por descrição + código (para identificar duplicatas)
    const mapa = {};
    const paraDeleter = [];

    for (const item of todos) {
      const chave = (item.descricao || '') + '|' + (item.codigo || '');
      
      if (!mapa[chave]) {
        mapa[chave] = item.id; // Guarda o primeiro
      } else {
        paraDeleter.push(item.id); // Marca os duplicados para deletar
      }
    }

    // Deleta em lotes
    let deletados = 0;
    const batch = 10;
    for (let i = 0; i < paraDeleter.length; i += batch) {
      const chunk = paraDeleter.slice(i, i + batch);
      await Promise.all(chunk.map(id => base44.entities.Estoque.delete(id)));
      deletados += chunk.length;
      await new Promise(r => setTimeout(r, 500));
    }

    const restante = todos.length - deletados;
    return Response.json({
      total_antes: todos.length,
      duplicados_encontrados: paraDeleter.length,
      deletados,
      total_depois: restante,
      message: `Limpeza concluída. Foram ${deletados} duplicados removidos.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});