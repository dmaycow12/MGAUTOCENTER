import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { nota_id } = await req.json().catch(() => ({}));

    if (!nota_id) {
      // Batch: processar todas as notas com xml_url sem xml_original
      const todas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 200);
      const pendentes = todas.filter(n => n.xml_url && !n.xml_original);
      
      const resultados = [];
      for (const nota of pendentes) {
        try {
          const response = await fetch(nota.xml_url);
          if (!response.ok) {
            resultados.push({ numero: nota.numero, sucesso: false, erro: `HTTP ${response.status}` });
            continue;
          }
          const xml = await response.text();
          if (!xml.trim().startsWith('<')) {
            resultados.push({ numero: nota.numero, sucesso: false, erro: 'Conteúdo inválido' });
            continue;
          }

          // Tentar salvar direto no xml_original
          try {
            await base44.asServiceRole.entities.NotaFiscal.update(nota.id, { xml_original: xml });
            resultados.push({ numero: nota.numero, sucesso: true });
          } catch (e) {
            // XML muito grande: fazer upload como arquivo e salvar URL no xml_original_url
            if (e.message?.includes('exceeds the maximum allowed size')) {
              const blob = new Blob([xml], { type: 'application/xml' });
              const file = new File([blob], `${nota.tipo}-${nota.numero}-original.xml`, { type: 'application/xml' });
              const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file });
              if (uploadResp?.file_url) {
                await base44.asServiceRole.entities.NotaFiscal.update(nota.id, { xml_original_url: uploadResp.file_url });
                resultados.push({ numero: nota.numero, sucesso: true, upload: true });
              } else {
                resultados.push({ numero: nota.numero, sucesso: false, erro: 'Falha no upload' });
              }
            } else {
              resultados.push({ numero: nota.numero, sucesso: false, erro: e.message });
            }
          }
        } catch (e) {
          resultados.push({ numero: nota.numero, sucesso: false, erro: e.message });
        }
      }
      
      return Response.json({ processados: pendentes.length, resultados });
    }

    // Nota específica
    const nota = await base44.asServiceRole.entities.NotaFiscal.get(nota_id);
    if (!nota) return Response.json({ sucesso: false, erro: 'Nota não encontrada' }, { status: 404 });
    if (!nota.xml_url) return Response.json({ sucesso: false, erro: 'Nota não tem xml_url' }, { status: 400 });

    const response = await fetch(nota.xml_url);
    if (!response.ok) return Response.json({ sucesso: false, erro: `HTTP ${response.status}` }, { status: 502 });

    const xml = await response.text();
    if (!xml.trim().startsWith('<')) return Response.json({ sucesso: false, erro: 'Conteúdo inválido' }, { status: 502 });

    try {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_original: xml });
      return Response.json({ sucesso: true, mensagem: 'XML salvo diretamente no xml_original', tamanho: xml.length });
    } catch (e) {
      if (e.message?.includes('exceeds the maximum allowed size')) {
        const blob = new Blob([xml], { type: 'application/xml' });
        const file = new File([blob], `${nota.tipo}-${nota.numero}-original.xml`, { type: 'application/xml' });
        const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        if (uploadResp?.file_url) {
          await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_original_url: uploadResp.file_url });
          return Response.json({ sucesso: true, mensagem: 'XML enviado como arquivo (muito grande para xml_original)' });
        }
        return Response.json({ sucesso: false, erro: 'Falha no upload do arquivo' });
      }
      throw e;
    }
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});