import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notas = await base44.asServiceRole.entities.NotaFiscal.list();
    const nfses = notas.filter(n => n.tipo === 'NFSe' && parseInt(n.numero) >= 63 && parseInt(n.numero) <= 74);

    const diagnostico = nfses.map(nfse => ({
      numero: nfse.numero,
      cliente: nfse.cliente_nome,
      temXmlOriginal: !!(nfse.xml_original && nfse.xml_original.trim().length > 0),
      tamanhoXmlOriginal: nfse.xml_original ? nfse.xml_original.length : 0,
      temXmlUrl: !!(nfse.xml_url && nfse.xml_url.trim().length > 0),
      xmlUrl: nfse.xml_url || 'N/A',
      status: nfse.status,
      xmlOriginalPrimeiros100chars: nfse.xml_original ? nfse.xml_original.substring(0, 100) : 'VAZIO',
    }));

    const comXml = diagnostico.filter(d => d.temXmlOriginal);
    const semXml = diagnostico.filter(d => !d.temXmlOriginal);

    return Response.json({
      total: diagnostico.length,
      comXmlOriginal: comXml.length,
      semXmlOriginal: semXml.length,
      detalhes: diagnostico,
      resumoSemXml: semXml
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});