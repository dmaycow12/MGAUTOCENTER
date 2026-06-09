import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {}
    
    const mes = body.mes || 5;
    const ano = body.ano || 2026;
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0);

    // Buscar notas de entrada (Importada ou Lançada) no período
    const notasEntrada = await base44.entities.NotaFiscal.filter({
      status: { "$in": ["Importada", "Lançada"] }
    });

    const filtradas = notasEntrada.filter(n => {
      const d = new Date(n.data_emissao);
      return d >= dataInicio && d <= dataFim;
    });

    // Analisar cada nota
    const debug = filtradas.map(nota => {
      let itens = [];
      let parseError = null;

      if (nota.xml_content) {
        try {
          const parsed = JSON.parse(nota.xml_content);
          if (Array.isArray(parsed)) {
            itens = parsed;
          } else if (parsed && typeof parsed === 'object') {
            itens = parsed.itens || parsed.det || parsed.details || parsed.products || parsed.items || [];
          }
        } catch (e) {
          parseError = e.message;
        }
      }

      const totalItens = itens.reduce((sum, i) => sum + (i.valor_total || 0), 0);

      return {
        numero: nota.numero,
        serie: nota.serie,
        data: nota.data_emissao,
        status: nota.status,
        valor_total: nota.valor_total,
        temXml: !!nota.xml_content,
        xmlTamanho: nota.xml_content ? nota.xml_content.length : 0,
        qtdItens: itens.length,
        totalItens,
        parseError,
        itens: itens.slice(0, 3).map(i => ({
          codigo: i.codigo || i.code || "???",
          descricao: (i.descricao || i.description || "").substring(0, 30),
          quantidade: i.quantidade || i.qty,
          valor_unitario: i.valor_unitario || i.unit_value,
          valor_total: i.valor_total || i.total_value
        }))
      };
    });

    return Response.json({
      periodo: `${mes}/${ano}`,
      totalNotas: filtradas.length,
      totalValor: filtradas.reduce((sum, n) => sum + (n.valor_total || 0), 0),
      notas: debug
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});