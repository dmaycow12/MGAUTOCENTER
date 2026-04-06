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

    // Para NFCe, o ref pode ser spedy_id (UUID) ou reference_id
    // Tentar usar reference_id primeiro, depois spedy_id
    let referenceId = ref;
    if (tipo === 'NFCe') {
      // NFCe: preferir spedy_id que é o UUID da Focus
      referenceId = nota.spedy_id || ref;
      console.log('[NFCE CANCEL] Usando referenceId:', referenceId, 'spedy_id:', nota.spedy_id, 'ref passado:', ref);
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
    try {
      resultFinal = JSON.parse(text);
    } catch (_) {
      console.error('[FOCUS ERRO] Resposta não-JSON:', text, 'Status:', resp.status);
      return Response.json({ sucesso: false, erro: 'Resposta inválida da Focus NFe', debug: text }, { status: 400 });
    }

    console.log('[FOCUS RESPONSE]', JSON.stringify(resultFinal));

    // Se retornar status HTTP >= 400, é erro
    if (!resp.ok) {
      const msgErro = resultFinal.erros 
        ? resultFinal.erros.map(e => e.mensagem || '').filter(Boolean).join('; ') 
        : (resultFinal.mensagem || resultFinal.erro || `Erro ${resp.status}`);
      console.error('[FOCUS ERROR]', msgErro);
      return Response.json({ sucesso: false, erro: msgErro || 'Falha ao cancelar', debug: resultFinal }, { status: 400 });
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
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        status: 'Cancelada',
        mensagem_sefaz: resultFinal.mensagem || resultFinal.mensagem_sefaz || 'Cancelada com sucesso',
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

    return Response.json({ sucesso: false, erro: `Cancelamento não confirmado - status: ${statusCancelamento}` }, { status: 400 });

  } catch (error) {
    return Response.json({ sucesso: false, erro: 'Erro ao cancelar: ' + error.message }, { status: 500 });
  }
});