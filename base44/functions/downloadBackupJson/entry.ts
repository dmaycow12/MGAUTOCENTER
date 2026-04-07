import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const entidades = ["Cliente", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
    const backup = {};

    for (const entidade of entidades) {
      try {
        const dados = await base44.asServiceRole.entities[entidade].list('-created_date', 10000);
        backup[entidade] = Array.isArray(dados) ? dados : [];
      } catch (err) {
        backup[entidade] = [];
      }
    }

    const jsonStr = JSON.stringify(backup);
    const encoder = new TextEncoder();
    const jsonBytes = encoder.encode(jsonStr);
    
    let base64 = '';
    for (let i = 0; i < jsonBytes.length; i += 65535) {
      const chunk = jsonBytes.slice(i, i + 65535);
      base64 += btoa(String.fromCharCode(...chunk));
    }

    return Response.json({ 
      file: base64,
      filename: `backup-${new Date().toISOString().split('T')[0]}.json`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});