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
        const updateData = {};
        let temAlgo = false;

        // Se tem xml_url, tentar buscar e mover para xml_original
        if (nota.xml_url && !nota.xml_original) {
          try {
            const resp = await fetch(nota.xml_url);
            if (resp.ok) {
              const xmlContent = await resp.text();
              if (xmlContent && xmlContent.trim().length > 0) {
                updateData.xml_original = xmlContent;
                updateData.xml_url = null;
                temAlgo = true;
              }
            }
          } catch (e) {
            // Ignorar erro de fetch
          }
        }

        // Se tem xml_content (JSON) e não tem xml_original, não fazer nada (é apenas JSON dos items)
        // Se tem xml_original, deixar como está

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