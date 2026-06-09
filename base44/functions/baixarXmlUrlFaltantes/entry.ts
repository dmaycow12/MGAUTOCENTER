import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca todas as notas
    const notas = await base44.entities.NotaFiscal.list('-created_date', 500);
    
    // Filtra: SEM xml_original MAS COM xml_url
    const notasFaltantes = notas.filter(n => 
      (!n.xml_original || n.xml_original.trim().length === 0) &&
      (n.xml_url && n.xml_url.trim().length > 0)
    );

    let sucesso = 0;
    let erros = 0;
    const erroList = [];

    // Baixa cada XML e salva
    for (const nota of notasFaltantes) {
      try {
        const response = await fetch(nota.xml_url);
        if (!response.ok) {
          erroList.push(`${nota.tipo} ${nota.numero}: HTTP ${response.status}`);
          erros++;
          continue;
        }
        
        const xmlContent = await response.text();
        
        // Valida se é XML
        if (!xmlContent || !xmlContent.trim().startsWith('<')) {
          erroList.push(`${nota.tipo} ${nota.numero}: Conteúdo não é XML`);
          erros++;
          continue;
        }

        // Se XMLé pequeno, salva direto. Se é grande, só guarda URL
        if (xmlContent.length < 50000) {
          // Arquivo pequeno - salva no BD
          await base44.entities.NotaFiscal.update(nota.id, { 
            xml_original: xmlContent 
          });
        } else {
          // Arquivo grande - já tem xml_url, só marca como processado
          // Poderia fazer upload via UploadPrivateFile se necessário
          await base44.entities.NotaFiscal.update(nota.id, {
            observacoes: (nota.observacoes || '') + ' [XML verificado em ' + new Date().toISOString().split('T')[0] + ']'
          });
        }
        
        sucesso++;
      } catch (e) {
        erroList.push(`${nota.tipo} ${nota.numero}: ${e.message}`);
        erros++;
      }
    }

    return Response.json({
      sucesso: true,
      total_faltantes: notasFaltantes.length,
      baixados: sucesso,
      erros: erros,
      detalhes_erros: erroList,
      mensagem: `${sucesso} XML(s) processado(s) com sucesso, ${erros} erro(s)`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});