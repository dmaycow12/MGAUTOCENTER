import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calcula os últimos 90 dias
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 90);

    const pad = (n) => String(n).padStart(2, '0');
    const formatoData = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const dataInicioStr = formatoData(dataInicio);
    const dataFimStr = formatoData(dataFim);

    // Consulta manifestos (recebidas/entradas)
    const res = await fetch(
      `${FOCUSNFE_BASE}/manifestos?cnpj=${CNPJ_EMITENTE}&data_inicio=${dataInicioStr}&data_fim=${dataFimStr}`,
      {
        method: 'GET',
        headers: {
          'Authorization': AUTH_HEADER,
          'Content-Type': 'application/json',
        },
      }
    );

    const responseText = await res.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      return Response.json({
        sucesso: false,
        erro: `Resposta inválida da Focus: ${responseText.substring(0, 200)}`,
      });
    }

    if (!res.ok) {
      const msgErro = result.erros
        ? result.erros.map(e => e.mensagem).join('; ')
        : (result.mensagem || JSON.stringify(result));
      return Response.json({
        sucesso: false,
        erro: msgErro,
      });
    }

    // result deve ser um array de manifestos/notas
    const manifestos = Array.isArray(result) ? result : (result.manifestos || []);
    if (manifestos.length === 0) {
      return Response.json({
        sucesso: true,
        mensagem: 'Nenhuma nota encontrada no período de 90 dias.',
        importadas: 0,
      });
    }

    let importadas = 0;
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list(
      '-created_date',
      500
    );
    const chavasExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    for (const manifesto of manifestos) {
      const chave = manifesto.chave_nfe || manifesto.chave || manifesto.nfe_numero_chave;
      if (!chave || chavasExistentes.has(chave)) continue;

      const numero = manifesto.nfe_numero || manifesto.numero || '';
      const serie = manifesto.nfe_serie || manifesto.serie || '1';
      const cliente_nome = manifesto.nome_emitente || manifesto.razao_social || 'Fornecedor';
      const cliente_cpf_cnpj = manifesto.cnpj_emitente || manifesto.cpf_emitente || '';
      const valor = parseFloat(manifesto.nfe_valor_total || manifesto.valor_total || '0');
      const data_emissao = manifesto.nfe_data_emissao || manifesto.data_emissao || '';

      try {
        await base44.asServiceRole.entities.NotaFiscal.create({
          tipo: 'NFe',
          numero,
          serie,
          status: 'Importada',
          cliente_nome,
          cliente_cpf_cnpj,
          chave_acesso: chave,
          valor_total: valor,
          data_emissao: data_emissao.substring(0, 10),
          observacoes: `Sincronização retroativa - ${new Date().toLocaleDateString('pt-BR')}`,
        });

        importadas++;
      } catch (_) {
        // Continua com a próxima nota em caso de erro
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: `Sincronização concluída: ${importadas} nota(s) importada(s) dos últimos 90 dias.`,
      importadas,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});