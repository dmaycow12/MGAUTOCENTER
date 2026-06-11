import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({});
    const tamanhos = [];

    for (const nota of notas) {
      if (nota.xml_url && (!nota.xml_original || !nota.xml_original.trim().startsWith('<'))) {
        try {
          const resp = await fetch(nota.xml_url);
          if (resp.ok) {
            const conteudo = await resp.text();
            if (conteudo.trim().startsWith('<')) {
              const tamanhoByte = new Blob([conteudo]).size;
              tamanhos.push({
                numero: nota.numero,
                tamanhoKB: (tamanhoByte / 1024).toFixed(2),
                tamanhoByte
              });
            }
          }
        } catch (e) {
          // skip
        }
      }
    }

    tamanhos.sort((a, b) => b.tamanhoByte - a.tamanhoByte);
    return Response.json({ 
      tamanhos: tamanhos.slice(0, 10),
      maiorKB: tamanhos[0]?.tamanhoKB,
      menorKB: tamanhos[tamanhos.length - 1]?.tamanhoKB
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});