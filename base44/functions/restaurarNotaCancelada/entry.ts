import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ sucesso: false, erro: 'Apenas admins podem restaurar notas' }, { status: 403 });
    }

    const { nota_id } = await req.json();

    if (!nota_id) return Response.json({ sucesso: false, erro: 'nota_id é obrigatório' }, { status: 400 });

    // Busca a nota
    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
    if (!notas || notas.length === 0) {
      return Response.json({ sucesso: false, erro: 'Nota não encontrada' }, { status: 404 });
    }

    const nota = notas[0];

    // Restaura para "Emitida" se estava "Cancelada"
    if (nota.status === 'Cancelada') {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        status: 'Emitida',
        mensagem_sefaz: '',
      });

      return Response.json({ 
        sucesso: true, 
        mensagem: `Nota ${nota.tipo} nº ${nota.numero} restaurada para "Emitida". Tente cancelar novamente.`,
        nota_numero: nota.numero,
        nota_tipo: nota.tipo,
      });
    }

    return Response.json({ sucesso: false, erro: `Nota está com status "${nota.status}" - não é cancelada` }, { status: 400 });

  } catch (error) {
    return Response.json({ sucesso: false, erro: 'Erro: ' + error.message }, { status: 500 });
  }
});