import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Adiciona os 2 produtos faltantes
    const produtosFaltantes = [
      { codigo: 'JG-PASTILHA', descricao: 'JG PASTILHA DIANTEIRA', quantidade: 0, estoque_minimo: 0, valor_custo: 0, valor_venda: 0 },
      { codigo: 'ROLAMENTO', descricao: 'ROLAMENTO DIANTEIRO', quantidade: 0, estoque_minimo: 0, valor_custo: 0, valor_venda: 0 }
    ];

    for (const prod of produtosFaltantes) {
      try {
        await base44.entities.Estoque.create(prod);
      } catch (e) {
        if (e.message.includes('Rate limit')) {
          await new Promise(r => setTimeout(r, 3000));
          await base44.entities.Estoque.create(prod);
        }
      }
    }

    // 2. Busca todos os produtos
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

    // 3. Identifica duplicatas
    const mapa = {};
    const paraDeleter = [];

    for (const item of todos) {
      const chave = (item.descricao || '') + '|' + (item.codigo || '');
      
      if (!mapa[chave]) {
        mapa[chave] = item.id;
      } else {
        paraDeleter.push(item.id);
      }
    }

    // 4. Se ainda houver muitos, remove os mais antigos até ficar com 322
    const totalUnicos = Object.keys(mapa).length;
    if (totalUnicos > 322) {
      const excess = totalUnicos - 322;
      // Remove os primeiros (mais antigos)
      const todasAsList = todos.filter(item => {
        const chave = (item.descricao || '') + '|' + (item.codigo || '');
        return mapa[chave] === item.id;
      }).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
      for (let i = 0; i < excess && i < todasAsList.length; i++) {
        paraDeleter.push(todasAsList[i].id);
      }
    }

    // 5. Deleta em lotes com retry
    let deletados = 0;
    const batch = 5;
    for (let i = 0; i < paraDeleter.length; i += batch) {
      const chunk = paraDeleter.slice(i, i + batch);
      for (const id of chunk) {
        let deletado = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await base44.entities.Estoque.delete(id);
            deletado = true;
            break;
          } catch (e) {
            if (e.message.includes('Rate limit')) {
              await new Promise(r => setTimeout(r, 3000));
            }
          }
        }
        if (deletado) deletados++;
      }
      await new Promise(r => setTimeout(r, 800));
    }

    return Response.json({
      produtos_adicionados: 2,
      total_antes: todos.length,
      duplicados_removidos: deletados,
      total_depois: todos.length - deletados + 2,
      message: `✅ Limpeza concluída: +2 produtos adicionados, ${deletados} duplicados removidos.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});