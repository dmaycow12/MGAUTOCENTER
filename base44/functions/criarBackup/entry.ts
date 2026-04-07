import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem fazer backup' }, { status: 403 });
    }

    const entidades = ["Cliente", "Veiculo", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
    const backup = {};

    for (const entidade of entidades) {
      try {
        const dados = await base44.asServiceRole.entities[entidade].list('-created_date', 10000);
        backup[entidade] = dados;
      } catch (err) {
        backup[entidade] = [];
      }
    }

    return Response.json(backup);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});