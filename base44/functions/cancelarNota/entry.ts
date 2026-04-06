import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { nota_id, ref, tipo } = await req.json();

    if (!nota_id || !ref) return Response.json({ sucesso: false, erro: 'nota_id e ref são obrigatórios' }, { status: 400 });
    
    // Buscar a nota para ter todos os dados
    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
    if (!notas || notas.length === 0) {
      return Response.json({ sucesso: false, erro: 'Nota fiscal não encontrada' }, { status: 404 });
    }
    const nota = notas[0];
    
    console.log('[CANCEL] Nota encontrada:', { id: nota.id, tipo: nota.tipo, numero: nota.numero, spedy_id: nota.spedy_id, ref });

    // Para NFCe, tentar primeiro consultar na Focus para pegar a referência exata
    let referenceId = ref;
    
    if (tipo === 'NFCe' && nota.spedy_id) {
      // Primeiro tenta usar o spedy_id que temos
      referenceId = nota.spedy_id;
      console.log('[NFCE CANCEL] Tentando com spedy_id:', referenceId);
    } else if (tipo === 'NFCe' && nota.chave_acesso) {
      // Se não temos spedy_id mas temos chave_acesso, consulta na Focus
      console.log('[NFCE CANCEL] Consultando Focus para obter referência com chave:', nota.chave_acesso);
      try {
        const consultaInitial = await fetch(`${FOCUSNFE_BASE}/nfce?chave_acesso=${nota.chave_acesso}`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (consultaInitial.ok) {
          const dataInitial = await consultaInitial.json();
          if (dataInitial.referencia) {
            referenceId = dataInitial.referencia;
            console.log('[NFCE CANCEL] Referência obtida da Focus:', referenceId);
          }
        }
      } catch (e) {
        console.warn('[NFCE CANCEL] Erro ao consultar Focus para ref:', e.message);
      }
    }
    
    let endpoint = '';
    if (tipo === 'NFSe') endpoint = `/nfsen/${referenceId}`;
    else if (tipo === 'NFCe') endpoint = `/nfce/${referenceId}`;
    else endpoint = `/nfe/${referenceId}`;

    // Tenta cancelar na Focus NFe
    // Para NFCe: DELETE /v2/nfce/{referencia} com justificativa no body (15-255 chars)
    const justificativa = 'Cancelamento solicitado pelo emitente.';
    
    const resp = await fetch(`${FOCUSNFE_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ justificativa }),
    });
    
    console.log('[CANCEL REQUEST] Endpoint:', endpoint, 'Tipo:', tipo);

    const text = await resp.text();
    let resultFinal = {};
    
    // Validar resposta HTTP
    if (resp.status === 401) {
      console.error('[AUTH ERROR] API Key inválida ou expirada');
      return Response.json({ sucesso: false, erro: 'Autenticação falhou - verifique a API Key da Focus NFe', debug: text }, { status: 401 });
    }
    
    if (resp.status === 404) {
      console.error('[NOT FOUND] Referência não encontrada na Focus:', referenceId);
      return Response.json({ sucesso: false, erro: `NFCe não encontrada na Focus com referência: ${referenceId}`, debug: text }, { status: 404 });
    }
    
    try {
      resultFinal = JSON.parse(text);
    } catch (_) {
      console.error('[FOCUS ERRO] Resposta não-JSON:', text, 'Status:', resp.status);
      return Response.json({ sucesso: false, erro: 'Resposta inválida da Focus NFe', debug: text }, { status: 400 });
    }

    console.log('[FOCUS RESPONSE]', JSON.stringify(resultFinal), 'Status HTTP:', resp.status);

    // Se retornar status HTTP >= 400, é erro
    if (!resp.ok) {
      const msgErro = resultFinal.erros 
        ? resultFinal.erros.map(e => e.mensagem || '').filter(Boolean).join('; ') 
        : (resultFinal.mensagem || resultFinal.erro || resultFinal.mensagem_sefaz || `Erro ${resp.status}`);
      console.error('[FOCUS ERROR] MSG:', msgErro);
      return Response.json({ sucesso: false, erro: msgErro || 'Falha ao cancelar', debug: { status: resp.status, response: resultFinal } }, { status: 400 });
    }

    // Para NFCe, o status retornado é simples: "cancelado" ou "erro_cancelamento"
    // Para NFe/NFSe, é igual
    let statusCancelamento = resultFinal.status || 'processando';
    for (let i = 0; i < 12 && statusCancelamento !== 'cancelado'; i++) {
      if (i > 0) {
        await new Promise(r => setTimeout(r, 2000));
      }
      try {
        const consultaResp = await fetch(`${FOCUSNFE_BASE}${endpoint}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (consultaResp.ok) {
          const consultaText = await consultaResp.text();
          try {
            resultFinal = JSON.parse(consultaText);
            statusCancelamento = resultFinal.status || statusCancelamento;
            console.log('[POLLING]', i, 'Status:', statusCancelamento);
          } catch (_) {}
        }
      } catch (_) {}
    }

    // Atualiza status local
    if (statusCancelamento === 'cancelado') {
      console.log('[SUCCESS] Nota cancelada! Atualizando banco...');
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        status: 'Cancelada',
        mensagem_sefaz: resultFinal.mensagem_sefaz || resultFinal.mensagem || 'Cancelada com sucesso',
      });
      
      // Devolver estoque se NFe/NFCe
      if ((tipo === 'NFe' || tipo === 'NFCe') && resultFinal.xml_url) {
        if (nota?.xml_content) {
          try {
            const items = JSON.parse(notas[0].xml_content);
            for (const it of items) {
              const qtd = Number(it.quantidade) || 1;
              let estoqueItem = null;
              if (it.estoque_id) {
                const found = await base44.asServiceRole.entities.Estoque.filter({ id: it.estoque_id });
                estoqueItem = found[0] || null;
              }
              if (!estoqueItem && it.codigo) {
                const found = await base44.asServiceRole.entities.Estoque.filter({ codigo: it.codigo });
                estoqueItem = found[0] || null;
              }
              if (estoqueItem) {
                await base44.asServiceRole.entities.Estoque.update(estoqueItem.id, { quantidade: (Number(estoqueItem.quantidade) || 0) + qtd });
              }
            }
          } catch (_) {}
        }
      }
      
      return Response.json({ sucesso: true, mensagem: 'Nota cancelada com sucesso' });
    }

    console.error('[TIMEOUT] Cancelamento não confirmado após polling - status:', statusCancelamento);
    return Response.json({ sucesso: false, erro: `Cancelamento não confirmado - status: ${statusCancelamento}` }, { status: 400 });

  } catch (error) {
    console.error('[EXCEPTION]', error);
    return Response.json({ sucesso: false, erro: 'Erro ao cancelar: ' + error.message, debug: error.toString() }, { status: 500 });
  }
});