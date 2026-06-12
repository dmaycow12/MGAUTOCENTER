import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUS_BASE = 'https://api.focusnfe.com.br/v2';

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas admin' }, { status: 403 });
    }

    const body = await req.json();
    const { nota_id } = body;

    // Buscar API key
    const configs = await base44.asServiceRole.entities.Configuracao.filter(
      { chave: { $in: ["focusnfe_api_key_producao", "focusnfe_api_key"] } },
      '',
      10
    );
    const apiKey = configs.find(c => c.chave === 'focusnfe_api_key_producao')?.valor 
      || configs.find(c => c.chave === 'focusnfe_api_key')?.valor 
      || '';
    const AUTH = 'Basic ' + btoa(apiKey + ':');

    if (nota_id) {
      // Atualizar nota específica
      const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
      const nota = notas[0];
      if (!nota) return Response.json({ erro: 'Nota não encontrada' });
      if (!nota.spedy_id) return Response.json({ erro: 'Nota sem spedy_id' });
      if (nota.pdf_original_url) return Response.json({ mensagem: 'Já tem pdf_original_url', url: nota.pdf_original_url });

      const ep = nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
      const resp = await fetch(`${FOCUS_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
        headers: { 'Authorization': AUTH }
      });

      if (!resp.ok) {
        return Response.json({ erro: `Focus retornou ${resp.status}` });
      }

      const data = await resp.json();
      const rawPdf = data.caminho_danfe_nfce || data.caminho_danfe || '';
      if (!rawPdf) {
        return Response.json({ erro: 'Focus não retornou caminho do DANFe' });
      }

      const pdfOriginal = normalizarUrl(rawPdf);
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { pdf_original_url: pdfOriginal });

      return Response.json({ sucesso: true, nota: `${nota.tipo}-${nota.numero}`, pdf_original_url: pdfOriginal });
    }

    // Processar todas pendentes
    const todas = await base44.asServiceRole.entities.NotaFiscal.filter(
      { tipo: { $in: ["NFe", "NFCe"] }, status: "Emitida" },
      '-created_date',
      100
    );

    const pendentes = todas.filter(n => n.pdf_url && !n.pdf_original_url && n.spedy_id);
    
    let atualizados = 0;
    let falhas = 0;

    for (const nota of pendentes) {
      try {
        const ep = nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
        const resp = await fetch(`${FOCUS_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
          headers: { 'Authorization': AUTH }
        });

        if (!resp.ok) {
          falhas++;
          continue;
        }

        const data = await resp.json();
        const rawPdf = data.caminho_danfe_nfce || data.caminho_danfe || '';
        if (!rawPdf) {
          falhas++;
          continue;
        }

        const pdfOriginal = normalizarUrl(rawPdf);
        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, { pdf_original_url: pdfOriginal });
        atualizados++;
      } catch {
        falhas++;
      }
    }

    return Response.json({ 
      sucesso: true, 
      total_pendentes: pendentes.length,
      atualizados,
      falhas
    });
  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});