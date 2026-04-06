import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ erro: 'Acesso negado' }, { status: 403 });
    }

    const { nota_id, novo_status } = await req.json();
    
    if (!nota_id || !novo_status) {
      return Response.json({ erro: 'nota_id e novo_status são obrigatórios' }, { status: 400 });
    }

    await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: novo_status });
    
    return Response.json({ sucesso: true, mensagem: `Status alterado para ${novo_status}` });
  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});