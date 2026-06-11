import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
            const blob = await resp.blob();
            const conteudo = await blob.text();
            if (conteudo.trim().startsWith('<')) {
              const file = new File([blob], `XML-${nota.numero}.xml`, { type: 'application/xml' });
              const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file });
              
              if (uploadResp?.file_url) {
                await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
                  xml_url: uploadResp.file_url
                });
                baixados++;
              }
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