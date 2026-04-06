import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const configs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);

    // Busca notas em processamento
    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ status: 'Processando' });

    if (!notas || notas.length === 0) {
      return Response.json({ sucesso: true, mensagem: 'Nenhuma nota em processamento.' });
    }

    const resultados = [];

    for (const nota of notas) {
      const tipo = nota.tipo || 'NFe';
      const ref = nota.spedy_id;
      if (!ref) continue;

      // Define ambiente e API key por tipo
      let ambiente = 'producao';
      if (tipo === 'NFe') ambiente = configs.find(c => c.chave === 'nfe_ambiente')?.valor || 'producao';
      else if (tipo === 'NFCe') ambiente = configs.find(c => c.chave === 'nfce_ambiente')?.valor || 'producao';
      else if (tipo === 'NFSe') ambiente = configs.find(c => c.chave === 'nfse_ambiente')?.valor || 'producao';

      const chaveAmbiente = ambiente === 'homologacao' ? 'focusnfe_api_key_homologacao' : 'focusnfe_api_key_producao';
      const apiKey = Deno.env.get('FOCUSNFE_API_KEY') ||
        configs.find(c => c.chave === chaveAmbiente)?.valor?.trim() ||
        configs.find(c => c.chave === 'focusnfe_api_key')?.valor?.trim();

      if (!apiKey) continue;

      const baseUrl = ambiente === 'homologacao'
        ? 'https://homologacao.focusnfe.com.br/v2'
        : 'https://api.focusnfe.com.br/v2';

      const authHeader = 'Basic ' + btoa(apiKey + ':');

      // Endpoint de consulta por tipo
      let endpoint = '';
      if (tipo === 'NFe') endpoint = `/nfe?ref=${ref}`;
      else if (tipo === 'NFCe') endpoint = `/nfce?ref=${ref}`;
      else if (tipo === 'NFSe') endpoint = `/nfsen?ref=${ref}`;

      const resp = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader },
      });

      if (!resp.ok) continue;

      const result = await resp.json();
      const statusFocus = result.status || '';

      let statusInterno = 'Processando';
      if (['autorizado'].includes(statusFocus)) statusInterno = 'Emitida';
      else if (['erro', 'rejeitado', 'denegado', 'cancelado'].includes(statusFocus)) statusInterno = 'Erro';

      if (statusInterno !== 'Processando') {
        let pdfUrl = nota.pdf_url || '';
        if (statusInterno === 'Emitida') {
          const rawPdf = result.caminho_pdf_nfsen || result.caminho_danfe || result.caminho_pdf_nfse || '';
          const pdfUrlFull = rawPdf ? (rawPdf.startsWith('http') ? rawPdf : `https://api.focusnfe.com.br${rawPdf}`) : '';
          if (pdfUrlFull && !pdfUrl) {
            try {
              const pdfResp = await fetch(pdfUrlFull, { headers: { 'Authorization': authHeader } });
              if (pdfResp.ok) {
                const pdfBlob = await pdfResp.blob();
                const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfBlob });
                pdfUrl = uploaded.file_url || pdfUrlFull;
              } else {
                pdfUrl = pdfUrlFull;
              }
            } catch {
              pdfUrl = pdfUrlFull;
            }
          }
        }
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          status: statusInterno,
          status_sefaz: statusFocus,
          mensagem_sefaz: result.mensagem_sefaz || result.mensagem || '',
          chave_acesso: result.chave_nfe || result.chave_nfce || result.chave_nfse || nota.chave_acesso || '',
          pdf_url: pdfUrl,
          xml_url: result.caminho_xml_nota_fiscal || nota.xml_url || '',
        });
        resultados.push({ ref, statusAnterior: 'Processando', statusNovo: statusInterno });
        console.log(`Nota ${ref} atualizada: ${statusInterno}`);
      }
    }

    return Response.json({
      sucesso: true,
      processadas: resultados.length,
      detalhes: resultados,
    });

  } catch (error) {
    console.error('Erro consultarStatusNotas:', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});