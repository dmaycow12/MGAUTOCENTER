import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = base44.asServiceRole;
    
    // Busca todas as NFCe emitidas
    const nfces = await db.entities.NotaFiscal.filter({ tipo: 'NFCe', status: 'Emitida' }, '-created_date', 1000);
    
    let limpas = 0;
    for (const nfce of nfces) {
      if (nfce.pdf_url) {
        await db.entities.NotaFiscal.update(nfce.id, { pdf_url: null });
        limpas++;
      }
    }

    return Response.json({ 
      sucesso: true, 
      mensagem: `${limpas} PDFs de NFCe limpos. Agora clique em "Recuperar PDFs" para buscar todos novamente.`,
      limpas
    });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message });
  }
});