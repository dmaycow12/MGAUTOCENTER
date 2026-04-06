import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ sucesso: false, erro: 'Apenas admins' }, { status: 403 });
    }

    const { nota_id } = await req.json();

    if (!nota_id) {
      return Response.json({ sucesso: false, erro: 'nota_id é obrigatório' }, { status: 400 });
    }

    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
    
    if (!notas || notas.length === 0) {
      return Response.json({ sucesso: false, erro: 'Nota não encontrada' }, { status: 404 });
    }

    const nota = notas[0];

    return Response.json({
      sucesso: true,
      nota: {
        id: nota.id,
        tipo: nota.tipo,
        numero: nota.numero,
        serie: nota.serie,
        status: nota.status,
        cliente_nome: nota.cliente_nome,
        spedy_id: nota.spedy_id || 'NÃO DEFINIDO',
        reference_id: nota.reference_id || 'NÃO DEFINIDO',
        chave_acesso: nota.chave_acesso || 'NÃO DEFINIDO',
        pdf_url: nota.pdf_url || 'NÃO DEFINIDO',
        status_sefaz: nota.status_sefaz || 'NÃO DEFINIDO',
        mensagem_sefaz: nota.mensagem_sefaz || 'SEM MENSAGEM',
        // Todos os campos para debug
        todos_campos: nota,
      }
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});