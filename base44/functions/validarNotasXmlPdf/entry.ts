import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notas = await base44.asServiceRole.entities.NotaFiscal.list();

    const emitidas = notas.filter(n => n.status === 'Emitida');
    const importadas = notas.filter(n => n.status === 'Importada' || n.status === 'Lançada');

    const emitidasSemXml = emitidas.filter(n => !n.xml_url && !n.xml_original && !n.xml_content);
    const emitidasSemPdf = emitidas.filter(n => !n.pdf_url);
    const emitidasSemXmlOuPdf = emitidas.filter(n => (!n.xml_url && !n.xml_original && !n.xml_content) || !n.pdf_url);

    const importadasSemXml = importadas.filter(n => !n.xml_url && !n.xml_original && !n.xml_content);
    const importadasSemPdf = importadas.filter(n => !n.pdf_url);
    const importadasSemXmlOuPdf = importadas.filter(n => (!n.xml_url && !n.xml_original && !n.xml_content) || !n.pdf_url);

    return Response.json({
      resumo: {
        totalEmitidas: emitidas.length,
        emitidasSemXml: emitidasSemXml.length,
        emitidasSemPdf: emitidasSemPdf.length,
        emitidasSemXmlOuPdf: emitidasSemXmlOuPdf.length,
        totalImportadas: importadas.length,
        importadasSemXml: importadasSemXml.length,
        importadasSemPdf: importadasSemPdf.length,
        importadasSemXmlOuPdf: importadasSemXmlOuPdf.length,
      },
      detalhes: {
        emitidasSemXml: emitidasSemXml.map(n => ({
          id: n.id,
          numero: n.numero,
          serie: n.serie,
          tipo: n.tipo,
          cliente: n.cliente_nome,
          temPdf: !!n.pdf_url
        })),
        emitidasSemPdf: emitidasSemPdf.map(n => ({
          id: n.id,
          numero: n.numero,
          serie: n.serie,
          tipo: n.tipo,
          cliente: n.cliente_nome,
          temXml: !!(n.xml_url || n.xml_original || n.xml_content)
        })),
        importadasSemXml: importadasSemXml.map(n => ({
          id: n.id,
          numero: n.numero,
          serie: n.serie,
          tipo: n.tipo,
          cliente: n.cliente_nome,
          temPdf: !!n.pdf_url
        })),
        importadasSemPdf: importadasSemPdf.map(n => ({
          id: n.id,
          numero: n.numero,
          serie: n.serie,
          tipo: n.tipo,
          cliente: n.cliente_nome,
          temXml: !!(n.xml_url || n.xml_original || n.xml_content)
        }))
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});