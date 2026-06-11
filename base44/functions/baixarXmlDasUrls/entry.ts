import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const compressString = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const compressedStream = new CompressionStream('gzip');
  const writer = compressedStream.writable.getWriter();
  writer.write(data);
  writer.close();
  const compressedData = await new Response(compressedStream.readable).arrayBuffer();
  const uint8 = new Uint8Array(compressedData);
  return btoa(String.fromCharCode(...uint8));
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Busca todas as notas com xml_url mas sem xml_original
    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({});
    
    let baixados = 0;
    let erros = [];

    for (const nota of notas) {
      if (nota.xml_url && (!nota.xml_original || !nota.xml_original.trim().startsWith('<'))) {
        try {
          const resp = await fetch(nota.xml_url);
          if (resp.ok) {
            const conteudo = await resp.text();
            if (conteudo.trim().startsWith('<')) {
              // Comprime o XML antes de salvar
              const xmlComprimido = await compressString(conteudo);
              await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
                xml_original: xmlComprimido
              });
              baixados++;
            }
          }
        } catch (e) {
          erros.push({ nota: nota.numero, erro: e.message });
        }
      }
    }

    return Response.json({ 
      sucesso: true,
      baixados,
      erros,
      total_processadas: notas.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});