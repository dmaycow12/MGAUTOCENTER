import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTIDADES_VALIDAS = ["Cadastro", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem restaurar backup' }, { status: 403 });
    }

    const body = await req.json();
    const backup = body.backup; // { Cadastro: [...], Estoque: [...], ... }

    if (!backup || typeof backup !== 'object') {
      return Response.json({ error: 'Backup inválido' }, { status: 400 });
    }

    const resultados = {};
    let totalRestaurado = 0;

    for (const entidade of Object.keys(backup)) {
      if (!ENTIDADES_VALIDAS.includes(entidade)) continue;
      const dados = backup[entidade];
      if (!Array.isArray(dados)) continue;

      let ok = 0;
      let erros = 0;
      for (const item of dados) {
        try {
          const { id, created_date, updated_date, created_by, created_by_id, entity_name, app_id, is_sample, is_deleted, deleted_date, environment, ...resto } = item;
          // Se tem campo 'data', usar os dados de dentro
          const dadosReais = item.data ? item.data : resto;
          await base44.asServiceRole.entities[entidade].create(dadosReais);
          ok++;
          totalRestaurado++;
        } catch (err) {
          erros++;
        }
      }
      resultados[entidade] = { importados: ok, erros };
    }

    return Response.json({
      sucesso: true,
      msg: `${totalRestaurado} registros restaurados com sucesso.`,
      resultados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});