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

    const body = await req.json().catch(() => ({}));
    const dataInicioParam = body.data_inicio; // ex: "2026-01-01"
    const dataFimParam = body.data_fim; // ex: "2026-03-27"

    const pad = (n) => String(n).padStart(2, '0');
    const formatoData = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let dataInicio, dataFim;
    if (dataInicioParam && dataFimParam) {
      dataInicio = new Date(dataInicioParam + 'T00:00:00Z');
      dataFim = new Date(dataFimParam + 'T23:59:59Z');
    } else {
      // Padrão: últimos 90 dias
      dataFim = new Date();
      dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 90);
    }

    // Busca em lotes de 60 dias para evitar timeout
    const allManifestos = [];
    let currentStart = new Date(dataInicio);
    const end = new Date(dataFim);

    while (currentStart < end) {
      let currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 60);
      if (currentEnd > end) currentEnd = new Date(end);

      const startStr = formatoData(currentStart);
      const endStr = formatoData(currentEnd);

      try {
        const res = await fetch(
          `${FOCUSNFE_BASE}/manifestos?cnpj=${CNPJ_EMITENTE}&data_inicio=${startStr}&data_fim=${endStr}`,
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
          currentStart = new Date(currentEnd);
          continue;
        }

        if (res.ok) {
          const manifestos = Array.isArray(result) ? result : (result.manifestos || []);
          allManifestos.push(...manifestos);
        }
      } catch (_) {
        // Continua com o próximo lote
      }

      currentStart = new Date(currentEnd);
    }

    if (allManifestos.length === 0) {
      return Response.json({
        sucesso: true,
        mensagem: 'Nenhuma nota encontrada no período selecionado.',
        importadas: 0,
      });
    }

    let importadas = 0;
    let primeiraNotaJaneiro = null;

    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list(
      '-created_date',
      1000
    );
    const chavasExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    // Ordena as notas por data para rastrear a primeira de janeiro
    const notasOrdenadas = allManifestos.sort((a, b) => {
      const dataA = a.nfe_data_emissao || a.data_emissao || '';
      const dataB = b.nfe_data_emissao || b.data_emissao || '';
      return new Date(dataA) - new Date(dataB);
    });

    for (const manifesto of notasOrdenadas) {
      const chave = manifesto.chave_nfe || manifesto.chave || manifesto.nfe_numero_chave;
      if (!chave || chavasExistentes.has(chave)) continue;

      const numero = manifesto.nfe_numero || manifesto.numero || '';
      const serie = manifesto.nfe_serie || manifesto.serie || '1';
      const cliente_nome = manifesto.nome_emitente || manifesto.razao_social || 'Fornecedor';
      const cliente_cpf_cnpj = manifesto.cnpj_emitente || manifesto.cpf_emitente || '';
      const valor = parseFloat(manifesto.nfe_valor_total || manifesto.valor_total || '0');
      const data_emissao = (manifesto.nfe_data_emissao || manifesto.data_emissao || '').substring(0, 10);

      try {
        const createdNota = await base44.asServiceRole.entities.NotaFiscal.create({
          tipo: 'NFe',
          numero,
          serie,
          status: 'Importada',
          cliente_nome,
          cliente_cpf_cnpj,
          chave_acesso: chave,
          valor_total: valor,
          data_emissao,
          observacoes: `Sincronização retroativa - ${new Date().toLocaleDateString('pt-BR')}`,
        });

        importadas++;

        // Rastreia a primeira nota de janeiro
        if (!primeiraNotaJaneiro && data_emissao.startsWith('2026-01')) {
          primeiraNotaJaneiro = {
            id: createdNota.id,
            numero,
            data: data_emissao,
            cliente: cliente_nome,
          };
        }
      } catch (_) {
        // Continua com a próxima nota em caso de erro
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: `Sincronização concluída: ${importadas} nota(s) importada(s).`,
      importadas,
      primeiraNotaJaneiro,
    });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});