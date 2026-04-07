import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem restaurar backup' }, { status: 403 });
    }

    const body = await req.json();
    const backup = body.backup;

    if (!backup || typeof backup !== 'object') {
      return Response.json({ error: 'Backup inválido' }, { status: 400 });
    }

    let totalRestaurado = 0;
    const entidades = Object.keys(backup);

    for (const entidade of entidades) {
      const dados = backup[entidade];
      if (!Array.isArray(dados)) continue;

      try {
        for (const item of dados) {
          const { id, created_date, updated_date, created_by, ...resto } = item;
          await base44.asServiceRole.entities[entidade].create(resto);
          totalRestaurado++;
        }
      } catch (err) {
        console.error(`Erro ao restaurar ${entidade}:`, err.message);
      }
    }

    return Response.json({ 
      msg: `Backup restaurado com sucesso! ${totalRestaurado} registros importados.` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});