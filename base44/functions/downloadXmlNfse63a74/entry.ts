import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca as NFSes 63-74 com xml_original
    const notas = await base44.asServiceRole.entities.NotaFiscal.list();
    const nfses = notas.filter(n => n.tipo === 'NFSe' && parseInt(n.numero) >= 63 && parseInt(n.numero) <= 74);

    if (nfses.length === 0) {
      return Response.json({ error: 'Nenhuma NFSe encontrada entre 63-74' }, { status: 400 });
    }

    // Importa jszip
    const JSZip = (await import('npm:jszip@3.10.1')).default;
    const zip = new JSZip();

    // Adiciona cada xml_original ao ZIP
    for (const nfse of nfses) {
      if (nfse.xml_original && nfse.xml_original.trim().length > 0) {
        const fileName = `NFSe_${nfse.numero}_${nfse.cliente_nome?.replace(/[^a-zA-Z0-9]/g, '_') || 'cliente'}.xml`;
        zip.file(fileName, nfse.xml_original);
      }
    }

    // Gera o arquivo ZIP
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=NFSes_63_74.zip'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});