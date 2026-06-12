import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function baixarESalvarXml(base44, nota, urlFonte) {
  const response = await fetch(urlFonte);
  if (!response.ok) return { sucesso: false, erro: `HTTP ${response.status}` };

  const xml = await response.text();
  if (!xml.trim().startsWith('<')) return { sucesso: false, erro: 'Conteúdo inválido' };

  // Tentar salvar direto no xml_original
  try {
    await base44.asServiceRole.entities.NotaFiscal.update(nota.id, { xml_original: xml });
    return { sucesso: true };
  } catch (e) {
    if (e.message?.includes('exceeds the maximum allowed size')) {
      // XML muito grande: upload como novo arquivo via new File()
      const blob = new Blob([xml], { type: 'application/xml' });
      const file = new File([blob], `${nota.tipo}-${nota.numero}-original.xml`, { type: 'application/xml' });
      const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      if (uploadResp?.file_url) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, { xml_original_url: uploadResp.file_url });
        return { sucesso: true, upload: true };
      }
      return { sucesso: false, erro: 'Falha no upload' };
    }
    return { sucesso: false, erro: e.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { nota_id } = await req.json().catch(() => ({}));

    if (!nota_id) {
      // Batch: processar notas com xml_url ou xml_original_url sem xml_original
      const todas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 200);
      const pendentes = todas.filter(n => !n.xml_original && (n.xml_original_url || n.xml_url));

      const resultados = [];
      for (const nota of pendentes) {
        const urlFonte = nota.xml_original_url || nota.xml_url;
        const res = await baixarESalvarXml(base44, nota, urlFonte);
        resultados.push({ numero: nota.numero, ...res });
      }

      return Response.json({ processados: pendentes.length, resultados });
    }

    // Nota específica
    const nota = await base44.asServiceRole.entities.NotaFiscal.get(nota_id);
    if (!nota) return Response.json({ sucesso: false, erro: 'Nota não encontrada' }, { status: 404 });

    const urlFonte = nota.xml_original_url || nota.xml_url;
    if (!urlFonte) return Response.json({ sucesso: false, erro: 'Nota não tem xml_url nem xml_original_url' }, { status: 400 });

    const res = await baixarESalvarXml(base44, nota, urlFonte);
    if (res.sucesso) {
      return Response.json({
        sucesso: true,
        mensagem: res.upload ? 'XML enviado como arquivo (muito grande para xml_original)' : 'XML salvo diretamente no xml_original',
      });
    }
    return Response.json({ sucesso: false, erro: res.erro }, { status: 502 });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});