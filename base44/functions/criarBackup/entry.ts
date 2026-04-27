import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Entidades atuais do app
const ENTIDADES = ["Cadastro", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Tentar autenticar, mas não bloquear se falhar (app sem auth obrigatória)
    try {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Autenticação necessária' }, { status: 401 });
    } catch (_) {
      // Ignora erro de auth — app público
    }

    const backup = {};

    for (const entidade of ENTIDADES) {
      try {
        const dados = await base44.asServiceRole.entities[entidade].list('-created_date', 10000);
        backup[entidade] = dados;
      } catch (err) {
        backup[entidade] = [];
      }
    }

    return Response.json({ sucesso: true, backup, entidades: ENTIDADES });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});