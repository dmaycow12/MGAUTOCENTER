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
        type: "array",
        items: {
          type: "object",
          properties: {
            "Cód. interno": { type: "string" },
            "Nome": { type: "string" },
            "Unidade": { type: "string" },
            "Estoque": { type: ["number", "string"] },
            "Estoque min.": { type: ["number", "string"] },
            "Custo unit.": { type: ["number", "string"] },
            "Valor venda": { type: ["number", "string"] },
            "CPOP": { type: ["number", "string"] },
            "NCM": { type: ["number", "string"] },
            "CEST": { type: ["number", "string"] }
          }
        }
      }
    });

    if (result.status !== "success" || !Array.isArray(result.output)) {
      return Response.json({ 
        error: 'Erro ao processar arquivo', 
        details: result.details 
      }, { status: 400 });
    }

    const items = result.output;
    let sucesso = 0;
    let falha = 0;
    const erros = [];

    const parseNum = (val) => {
      if (!val) return 0;
      const str = val.toString().replace(',', '.');
      return isNaN(Number(str)) ? 0 : Number(str);
    };

    const createWithRetry = async (data, maxRetries = 3) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await base44.entities.Estoque.create(data);
          return true;
        } catch (e) {
          if (e.message.includes('Rate limit') && attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 4000 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }
    };

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const nome = (row["Nome"] || row.col_1 || '').toString().trim();
      if (!nome) {
        falha++;
        continue;
      }

      try {
        await createWithRetry({
          codigo: (row["Cód. interno"] || row.col_0 || '').toString().trim(),
          descricao: nome,
          unidade: (row["Unidade"] || row.col_8 || 'UN').toString().trim(),
          quantidade: parseNum(row["Estoque"] || row.col_4),
          estoque_minimo: parseNum(row["Estoque min."] || row.col_5),
          valor_custo: parseNum(row["Custo unit."] || row.col_6),
          valor_venda: parseNum(row["Valor venda"] || row.col_7),
          cfop: (row["CPOP"] || row.col_9 || '5405').toString().trim(),
          ncm: (row["NCM"] || row.col_10 || '87089990').toString().trim(),
          cest: (row["CEST"] || row.col_11 || '').toString().trim(),
          categoria: '',
          marca: '',
          localizacao: '',
          fornecedor: '',
          observacoes: ''
        });
        sucesso++;
        
        if ((i + 1) % 30 === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        falha++;
        erros.push({
          linha: i + 2,
          produto: nome,
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