import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = base44.asServiceRole;
    
    // Busca todas as notas de março com status Cancelada que deveriam estar Emitida
    const notasCanceladas = await db.entities.NotaFiscal.filter({ 
      status: 'Cancelada',
      data_emissao: { $gte: '2026-03-01', $lte: '2026-03-31' }
    }, '-created_date', 1000);

    let restauradas = 0;
    const detalhes = [];
    
    for (const nota of notasCanceladas) {
      // Se tem spedy_id ou chave_acesso, era realmente emitida na SEFAZ
      if (nota.spedy_id || nota.chave_acesso) {
        await db.entities.NotaFiscal.update(nota.id, { status: 'Emitida' });
        restauradas++;
        detalhes.push(`${nota.tipo} nº ${nota.numero} - ${nota.cliente_nome}`);
      }
    }

    return Response.json({ 
      sucesso: true, 
      mensagem: `${restauradas} notas de março restauradas para status "Emitida".`,
      restauradas,
      detalhes
    });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message });
  }
});