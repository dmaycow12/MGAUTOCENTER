import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notas = await base44.asServiceRole.entities.NotaFiscal.list();
    
    // Filtrar NFSes de números 63-74
    const nfsesAlvo = notas.filter(n => {
      const numero = parseInt(n.numero);
      return n.tipo === 'NFSe' && numero >= 63 && numero <= 74;
    });

    const resultado = {
      total: nfsesAlvo.length,
      notas: nfsesAlvo.map(n => ({
        id: n.id,
        tipo: n.tipo,
        numero: n.numero,
        serie: n.serie,
        cliente: n.cliente_nome,
        status: n.status,
        temXmlUrl: !!(n.xml_url && n.xml_url.trim().length > 0),
        temXmlOriginal: !!(n.xml_original && n.xml_original.trim().length > 0),
        temXmlContent: !!(n.xml_content && n.xml_content.trim().length > 0),
        xmlUrl: n.xml_url || null,
        xmlContent: n.xml_content ? n.xml_content.substring(0, 200) + '...' : null,
        temPdf: !!(n.pdf_url && n.pdf_url.trim().length > 0),
        pdfUrl: n.pdf_url || null
      }))
    };

    return Response.json(resultado);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});