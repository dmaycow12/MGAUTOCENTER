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
      if (nota.xml_url && (!nota.xml_original_url || nota.xml_original_url.trim() === '')) {
        try {
          let xmlUrl = nota.xml_url;
          
          // Se a URL for relativa, construir absoluta
          if (xmlUrl.startsWith('/')) {
            xmlUrl = 'https://focusnfe.com.br' + xmlUrl;
          }
          
          const resp = await fetch(xmlUrl);
          if (resp.ok) {
            const xmlBuffer = await resp.arrayBuffer();
            const xmlString = new TextDecoder().decode(xmlBuffer);
            
            if (xmlString.trim().startsWith('<')) {
              // Upload do XML como arquivo para o storage (mesmo padrão dos PDFs)
              const xmlFile = new File([xmlBuffer], `xml_nota_${nota.id}.xml`, { type: 'application/xml' });
              const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });
              
              await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
                xml_original_url: file_url
              });
              baixados++;
            }
          }
        } catch (e) {
          erros.push({ nota: nota.numero, erro: e.message });
        }
        
        // Pequena pausa para evitar rate limit
        await new Promise(r => setTimeout(r, 100));
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