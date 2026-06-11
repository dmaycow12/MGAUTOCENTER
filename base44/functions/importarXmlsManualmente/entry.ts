import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Mapa de notas e URLs
    const imports = [
      { numero: '162', tipo: 'NFe', url: null }, // NFe não tem URL aqui
      { numero: '76', tipo: 'NFSe', url: 'https://api.focusnfe.com.br/arquivos/54043647000120_197487/202606/XMLsNFSe/NFS31480042254043647000120000000000007626061752232489-nfse.xml' },
      { numero: '87', tipo: 'NFSe', url: 'https://api.focusnfe.com.br/arquivos/54043647000120_197487/202606/XMLsNFSe/NFS31480042254043647000120000000000008726068474799030-nfse.xml' },
      { numero: '89', tipo: 'NFSe', url: 'https://api.focusnfe.com.br/arquivos/54043647000120_197487/202606/XMLsNFSe/NFS31480042254043647000120000000000008926060790504062-nfse.xml' }
    ];

    const resultados = [];

    for (const item of imports) {
      if (!item.url) continue;

      // Busca a nota no banco
      const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ numero: item.numero, tipo: item.tipo });
      if (notas.length === 0) {
        resultados.push({ numero: item.numero, tipo: item.tipo, sucesso: false, erro: 'Nota não encontrada' });
        continue;
      }

      const nota = notas[0];

      try {
        // Baixa o XML
        const response = await fetch(item.url);
        if (!response.ok) {
          resultados.push({ numero: item.numero, tipo: item.tipo, sucesso: false, erro: `HTTP ${response.status}` });
          continue;
        }

        const xmlContent = await response.text();

        // Atualiza o banco
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          xml_original: xmlContent
        });

        resultados.push({ numero: item.numero, tipo: item.tipo, sucesso: true, tamanho: xmlContent.length });
      } catch (err) {
        resultados.push({ numero: item.numero, tipo: item.tipo, sucesso: false, erro: err.message });
      }
    }

    return Response.json({ resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});