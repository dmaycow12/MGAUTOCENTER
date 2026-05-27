import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ sucesso: false, erro: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const body = await req.json();
    const registros = body.registros; // array de NotaFiscal

    if (!Array.isArray(registros) || registros.length === 0) {
      return Response.json({ sucesso: false, erro: 'Nenhum registro enviado' }, { status: 400 });
    }

    // Busca existentes para evitar duplicatas
    const existentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 5000);
    const chavesExistentes = new Set(existentes.map(n => n.chave_acesso).filter(Boolean));
    const speudyIdsExistentes = new Set(existentes.map(n => n.spedy_id).filter(Boolean));
    // Chave composta numero+tipo para evitar duplicata sem chave_acesso
    const numTipoExistentes = new Set(existentes.map(n => `${n.tipo}-${n.numero}`).filter(n => n !== '-'));

    let importadas = 0;
    let ignoradas = 0;
    const erros = [];

    for (const item of registros) {
      try {
        // Extrair dados reais (remove campos de sistema)
        const { id, created_date, updated_date, created_by, created_by_id, entity_name, app_id, is_sample, is_deleted, deleted_date, environment, ...dados } = item;

        // Verificar duplicatas
        if (dados.chave_acesso && chavesExistentes.has(dados.chave_acesso)) { ignoradas++; continue; }
        if (dados.spedy_id && speudyIdsExistentes.has(dados.spedy_id)) { ignoradas++; continue; }
        const numTipo = `${dados.tipo}-${dados.numero}`;
        if (dados.tipo && dados.numero && numTipoExistentes.has(numTipo)) { ignoradas++; continue; }

        await base44.asServiceRole.entities.NotaFiscal.create(dados);
        importadas++;

        // Atualiza sets para evitar duplicatas dentro do lote
        if (dados.chave_acesso) chavesExistentes.add(dados.chave_acesso);
        if (dados.spedy_id) speudyIdsExistentes.add(dados.spedy_id);
        if (dados.tipo && dados.numero) numTipoExistentes.add(numTipo);
      } catch (e) {
        erros.push(e.message);
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: `${importadas} NFSe importada(s) com sucesso. ${ignoradas} já existiam e foram ignoradas.`,
      importadas,
      ignoradas,
      erros: erros.length > 0 ? erros.slice(0, 5) : undefined,
    });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});