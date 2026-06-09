import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Busca todas as notas emitidas
    const notas = await base44.entities.NotaFiscal.list('-created_date', 100);
    const emitidas = notas.filter(n => n.status === 'Emitida');

    // Analisa tamanhos de XML
    const analise = emitidas.map(n => {
      const dados = {
        numero: n.numero,
        tipo: n.tipo,
        status: n.status,
        xml_original_size: n.xml_original ? String(n.xml_original).trim().length : 0,
        xml_original_comeca: n.xml_original ? String(n.xml_original).trim().substring(0, 30) : null,
        xml_content_size: n.xml_content ? String(n.xml_content).trim().length : 0,
        xml_content_comeca: n.xml_content ? String(n.xml_content).trim().substring(0, 30) : null,
        xml_url: n.xml_url ? '✓' : '✗',
      };
      return dados;
    });

    return Response.json({
      total_emitidas: emitidas.length,
      notas: analise.slice(0, 20), // primeiras 20
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});