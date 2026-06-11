import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { xmlContent } = await req.json();

    if (!xmlContent) {
      return Response.json({ erro: 'XML não fornecido' }, { status: 400 });
    }

    // Procura NFe-162
    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ numero: '162', tipo: 'NFe' });
    
    if (notas.length === 0) {
      return Response.json({ sucesso: false, erro: 'NFe-162 não encontrada' });
    }

    const nota = notas[0];

    // Salva o XML
    await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
      xml_original: xmlContent
    });

    return Response.json({ 
      sucesso: true, 
      numero: '162',
      tamanho: xmlContent.length,
      nota_id: nota.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});