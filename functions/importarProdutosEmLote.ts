import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });
    }

    // Extrai dados do arquivo
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                col_0: { type: "string" },
                col_1: { type: "string" },
                col_2: { type: "string" },
                col_3: { type: "number" },
                col_4: { type: "number" },
                col_5: { type: "number" },
                col_6: { type: "number" },
                col_7: { type: "string" },
                col_8: { type: "string" },
                col_9: { type: "string" }
              }
            }
          }
        }
      }
    });

    if (result.status !== "success" || !result.output?.items) {
      return Response.json({ 
        error: 'Erro ao processar arquivo', 
        details: result.details 
      }, { status: 400 });
    }

    const items = result.output.items;
    let sucesso = 0;
    let falha = 0;
    const erros = [];

    for (const row of items) {
      if (!row.col_1 || !row.col_1.trim()) {
        falha++;
        continue;
      }

      try {
        await base44.entities.Estoque.create({
          codigo: (row.col_0 || '').toString().trim(),
          descricao: (row.col_1 || '').trim(),
          unidade: (row.col_2 || 'UN').trim(),
          quantidade: Number(row.col_3) || 0,
          estoque_minimo: Number(row.col_4) || 0,
          valor_custo: Number(row.col_5) || 0,
          valor_venda: Number(row.col_6) || 0,
          cfop: (row.col_7 || '5405').toString().trim(),
          ncm: (row.col_8 || '87089990').toString().trim(),
          cest: (row.col_9 || '').toString().trim(),
          categoria: '',
          marca: '',
          localizacao: '',
          fornecedor: '',
          observacoes: ''
        });
        sucesso++;
      } catch (e) {
        falha++;
        erros.push({
          linha: sucesso + falha + 1,
          produto: row.col_1,
          erro: e.message
        });
      }
    }

    return Response.json({
      sucesso,
      falha,
      total: sucesso + falha,
      erros: erros.slice(0, 10)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});