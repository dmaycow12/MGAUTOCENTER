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
        // Só processa notas sem xml_original E com xml_url (vazio OU inválido)
        const xmlOriginalVazio = !nota.xml_original || nota.xml_original.trim().length === 0;
        
        if (xmlOriginalVazio && nota.xml_url) {
          try {
            const resp = await fetch(nota.xml_url);
            if (resp.ok) {
              const xmlContent = await resp.text();
              if (xmlContent && xmlContent.trim().startsWith('<') && xmlContent.length < 500000) {
                // Só atualiza se XML é menor que 500KB (limite SEFAZ)
                await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
                  xml_original: xmlContent,
                  xml_url: null
                });
                atualizadas++;
              }
            }
          } catch (e) {
            // Ignorar erro de fetch
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