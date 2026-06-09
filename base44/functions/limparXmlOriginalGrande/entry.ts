import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // IDs das 8 notas com XML grande
    const notasGrandes = [
      '6a2899b039b8c65284a543e3', // 48701
      '6a1f1e0a1fb8ec1adada9e8f', // 131260
      '6a188594cae384b08915600c', // 51498
      '6a18858526ea59581c41cf54', // 50953
      '69f20391b61edde13ddae274', // 47256
      '69ec0be3f79ba08b01269836', // 21504
      '69ec05645735e31872a03a3c', // 46279
      '69ebe1cfd937ded73f8ea447'  // 44854
    ];

    let limpas = 0;
    let erros = [];

    for (const notaId of notasGrandes) {
      try {
        // Busca a nota
        const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: notaId });
        if (notas.length === 0) continue;
        
        const nota = notas[0];
        
        // Se tem xml_url, limpa xml_original e marca como em URL
        if (nota.xml_url) {
          await base44.asServiceRole.entities.NotaFiscal.update(notaId, {
            xml_original: 'XML_IN_URL',
            xml_url: nota.xml_url
          });
          limpas++;
        }
      } catch (e) {
        erros.push({ notaId, erro: e.message });
      }
    }

    return Response.json({
      status: 'success',
      limpas,
      erros
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});