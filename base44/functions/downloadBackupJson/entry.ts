import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const entidades = ["Cliente", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
    const backup = {};

    console.log("[BACKUP JSON] Iniciando...");

    for (const entidade of entidades) {
      try {
        const dados = await base44.asServiceRole.entities[entidade].list('-created_date', 10000);
        backup[entidade] = Array.isArray(dados) ? dados : [];
        console.log(`[BACKUP JSON] ${entidade}: ${backup[entidade].length} registros`);
      } catch (err) {
        console.error(`[BACKUP JSON] Erro ${entidade}:`, err.message);
        backup[entidade] = [];
      }
    }

    const jsonStr = JSON.stringify(backup, null, 2);
    const jsonBytes = new TextEncoder().encode(jsonStr);

    return new Response(jsonBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`,
        'Content-Length': jsonBytes.byteLength.toString()
      }
    });
  } catch (error) {
    console.error('[BACKUP JSON] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});