import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notas = await base44.asServiceRole.entities.NotaFiscal.list();

    const notasComXml = notas.filter(nota => 
      nota.xml_url || nota.xml_original || nota.xml_content
    ).map(nota => ({
      id: nota.id,
      numero: nota.numero,
      serie: nota.serie,
      tipo: nota.tipo,
      status: nota.status,
      temXmlUrl: !!nota.xml_url,
      temXmlOriginal: !!nota.xml_original,
      temXmlContent: !!nota.xml_content
    }));

    const notasSemXml = notas.filter(nota => 
      !nota.xml_url && !nota.xml_original && !nota.xml_content
    ).map(nota => ({
      id: nota.id,
      numero: nota.numero,
      serie: nota.serie,
      tipo: nota.tipo,
      status: nota.status
    }));

    return Response.json({
      totalNotas: notas.length,
      notasComXml: notasComXml.length,
      notasSemXml: notasSemXml.length,
      listaComXml: notasComXml,
      listaSemXml: notasSemXml
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});