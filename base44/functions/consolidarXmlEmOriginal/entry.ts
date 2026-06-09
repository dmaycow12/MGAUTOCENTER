import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Busca todas as notas
    const notas = await base44.asServiceRole.entities.NotaFiscal.list();
    
    let atualizadas = 0;
    let erros = [];

    for (const nota of notas) {
      try {
        const xmlOriginalVazio = !nota.xml_original || nota.xml_original.trim().length === 0;
        const isInvalidXml = nota.xml_original && (
          nota.xml_original.startsWith('{') || 
          nota.xml_original.startsWith('[') ||
          (!nota.xml_original.startsWith('<?') && !nota.xml_original.startsWith('<')) ||
          nota.xml_original === 'XML_IN_URL'
        );
        
        // Se tem xml_url E (xml_original vazio OU inválido)
        if (nota.xml_url && (xmlOriginalVazio || isInvalidXml)) {
          // Tenta buscar XML
          let xmlContent;
          try {
            const resp = await fetch(nota.xml_url);
            if (resp.ok) {
              xmlContent = await resp.text();
            }
          } catch (e) {
            // Continua mesmo se fetch falhar
          }

          // Se conseguiu buscar XML válido
          if (xmlContent && xmlContent.trim().startsWith('<')) {
            // Se for pequeno (< 500KB), salva direto
            if (xmlContent.length < 500000) {
              try {
                await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
                  xml_original: xmlContent,
                  xml_url: null
                });
                atualizadas++;
              } catch (updateErr) {
                // Se der erro ao salvar, marca como em URL
                await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
                  xml_original: 'XML_IN_URL',
                  xml_url: nota.xml_url
                });
                atualizadas++;
              }
            } else {
              // Se for grande, marca como em URL (não tenta salvar)
              await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
                xml_original: 'XML_IN_URL',
                xml_url: nota.xml_url
              });
              atualizadas++;
            }
          } else if (!xmlContent && (isInvalidXml || xmlOriginalVazio)) {
            // Se não conseguiu buscar mas tem xml_url, marca como "em xml_url"
            await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
              xml_original: 'XML_IN_URL',
              xml_url: nota.xml_url
            });
            atualizadas++;
          }
        }
      } catch (e) {
        erros.push({ notaId: nota.id, numero: nota.numero, erro: e.message });
      }
    }

    return Response.json({
      status: 'success',
      total: notas.length,
      atualizadas,
      erros
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});