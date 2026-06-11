import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const notaId = body.nota_id || body.numero;

    let nota;
    if (notaId.length === 36) {
      // É um ID
      const notas = await base44.entities.NotaFiscal.filter({ id: notaId });
      nota = notas[0];
    } else {
      // É um número
      const notas = await base44.entities.NotaFiscal.filter({ numero: notaId });
      nota = notas[0];
    }

    if (!nota) {
      return Response.json({ error: 'Nota não encontrada' }, { status: 404 });
    }

    return Response.json({
      sucesso: true,
      numero: nota.numero,
      tipo: nota.tipo,
      xml_original_length: nota.xml_original?.length || 0,
      xml_original_first_100: nota.xml_original?.substring(0, 100) || '',
      xml_content_length: nota.xml_content?.length || 0,
      xml_content_first_100: nota.xml_content?.substring(0, 100) || '',
      xml_url: nota.xml_url || '',
      tem_xml_original: !!nota.xml_original && nota.xml_original.length > 0,
      tem_xml_content: !!nota.xml_content && nota.xml_content.length > 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});