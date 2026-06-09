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
        // Estratégia: XMLs pequenos em xml_original, XMLs grandes em xml_url
        // Se xml_original for inválido (JSON ou erro anterior), tenta resgatar de xml_url
        const updateData = {};
        let temAlgo = false;

        // Verifica se xml_original parece ser JSON (não começa com <xml ou <NFSe)
        const isInvalidXml = nota.xml_original && (
          nota.xml_original.startsWith('{') || 
          nota.xml_original.startsWith('[') ||
          (!nota.xml_original.startsWith('<?') && !nota.xml_original.startsWith('<'))
        );

        // Se xml_original é inválido E tem xml_url, tenta buscar conteúdo
        if (isInvalidXml && nota.xml_url) {
          try {
            const resp = await fetch(nota.xml_url);
            if (resp.ok) {
              const xmlContent = await resp.text();
              if (xmlContent && xmlContent.trim().startsWith('<')) {
                // XML pequeno? salva em xml_original
                if (xmlContent.length < 50000) {
                  updateData.xml_original = xmlContent;
                  updateData.xml_url = null;
                }
                // XML grande? mantém em xml_url
                temAlgo = true;
              }
            }
          } catch (e) {
            // Ignorar erro de fetch
          }
        }

        // Se achou algo pra atualizar, faz
        if (temAlgo) {
          await base44.asServiceRole.entities.NotaFiscal.update(nota.id, updateData);
          atualizadas++;
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