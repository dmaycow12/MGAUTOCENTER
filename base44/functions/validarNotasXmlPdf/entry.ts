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

    // Função auxiliar para validar se tem XML de verdade (xml_original OU xml_content OU xml_url)
    const temXmlReal = (n) => {
      const temOriginal = n.xml_original && typeof n.xml_original === 'string' && n.xml_original.trim().length > 0;
      const temContent = n.xml_content && typeof n.xml_content === 'string' && n.xml_content.trim().length > 0 && n.xml_content.trim().startsWith('<');
      const temUrl = n.xml_url && typeof n.xml_url === 'string' && n.xml_url.trim().length > 0;
      return temOriginal || temContent || temUrl;
    };

    // Função auxiliar para validar se tem PDF de verdade
    const temPdfReal = (n) => {
      return n.pdf_url && typeof n.pdf_url === 'string' && n.pdf_url.trim().length > 0;
    };

    const emitidasSemXml = emitidas.filter(n => !temXmlReal(n));
    const emitidasSemPdf = emitidas.filter(n => !temPdfReal(n));
    const emitidasSemXmlOuPdf = emitidas.filter(n => !temXmlReal(n) || !temPdfReal(n));

    const importadasSemXml = importadas.filter(n => !temXmlReal(n));
    const importadasSemPdf = importadas.filter(n => !temPdfReal(n));
    const importadasSemXmlOuPdf = importadas.filter(n => !temXmlReal(n) || !temPdfReal(n));

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
           temPdf: !!n.pdf_url,
           temXmlOriginal: !!(n.xml_original && n.xml_original.trim().length > 0)
         })),
        emitidasSemPdf: emitidasSemPdf.map(n => ({
           id: n.id,
           numero: n.numero,
           serie: n.serie,
           tipo: n.tipo,
           cliente: n.cliente_nome,
           temXml: temXmlReal(n),
           temXmlOriginal: !!(n.xml_original && n.xml_original.trim().length > 0)
         })),
        importadasSemXml: importadasSemXml.map(n => ({
           id: n.id,
           numero: n.numero,
           serie: n.serie,
           tipo: n.tipo,
           cliente: n.cliente_nome,
           temPdf: !!n.pdf_url,
           temXmlOriginal: !!(n.xml_original && n.xml_original.trim().length > 0)
         })),
         importadasSemPdf: importadasSemPdf.map(n => ({
           id: n.id,
           numero: n.numero,
           serie: n.serie,
           tipo: n.tipo,
           cliente: n.cliente_nome,
           temXml: temXmlReal(n),
           temXmlOriginal: !!(n.xml_original && n.xml_original.trim().length > 0)
         }))
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});