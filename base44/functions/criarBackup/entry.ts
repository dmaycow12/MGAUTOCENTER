import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ENTIDADES = ["Cadastro", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Busca todas as entidades em paralelo usando service role
    const resultados = await Promise.all(
      ENTIDADES.map(async (entidade) => {
        try {
          const dados = await base44.asServiceRole.entities[entidade].list('-created_date', 10000);
          return [entidade, dados];
        } catch (_) {
          return [entidade, []];
        }
      })
    );

    const backup = Object.fromEntries(resultados);

    return Response.json({ sucesso: true, backup, entidades: ENTIDADES });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});