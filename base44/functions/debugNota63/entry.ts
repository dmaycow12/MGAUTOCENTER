import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Busca NFSe 63
    const notas = await base44.entities.NotaFiscal.list('-created_date', 500);
    const nota63 = notas.find(n => n.numero === '63' && n.tipo === 'NFSe');

    if (!nota63) {
      return Response.json({ error: 'NFSe 63 não encontrada' }, { status: 404 });
    }

    // Analisa cada campo XML
    const analisa = (field, value) => {
      if (!value) return { temValor: false, tamanho: 0, comeca: null };
      const trimmed = String(value).trim();
      const comeca = trimmed.substring(0, 50);
      return {
        temValor: true,
        tamanho: trimmed.length,
        comeca,
        ehJson: trimmed.startsWith('[') || trimmed.startsWith('{'),
        ehXml: trimmed.startsWith('<'),
        ehVazio: trimmed === '',
      };
    };

    return Response.json({
      nota_id: nota63.id,
      numero: nota63.numero,
      tipo: nota63.tipo,
      status: nota63.status,
      cliente: nota63.cliente_nome,
      valor: nota63.valor_total,
      xml_url: analisa('xml_url', nota63.xml_url),
      xml_original: analisa('xml_original', nota63.xml_original),
      xml_content: analisa('xml_content', nota63.xml_content),
      dados_adicionais: analisa('dados_adicionais', nota63.dados_adicionais),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});