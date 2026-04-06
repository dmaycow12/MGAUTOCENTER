import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { nota_id, ref, tipo } = await req.json();

    if (!nota_id || !ref) return Response.json({ sucesso: false, erro: 'nota_id e ref são obrigatórios' }, { status: 400 });

    let endpoint = '';
    if (tipo === 'NFSe') endpoint = `/nfsen/${ref}`;
    else if (tipo === 'NFCe') endpoint = `/nfce/${ref}`;
    else endpoint = `/nfe/${ref}`;

    // Tenta cancelar na Focus NFe
    let bodyPayload = {};
    if (tipo === 'NFCe') {
      // NFCe usa padrão diferente: justificativa diretamente
      bodyPayload = { justificativa: 'Cancelamento solicitado pelo emitente.' };
    } else {
      // NFe e NFSe usam mesmo padrão
      bodyPayload = { justificativa: 'Cancelamento solicitado pelo emitente.' };
    }
    
    const resp = await fetch(`${FOCUSNFE_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const text = await resp.text();
    let resultFinal = {};
    try {
      resultFinal = JSON.parse(text);
    } catch (_) {
      return Response.json({ sucesso: false, erro: 'Resposta inválida da Focus NFe' }, { status: 400 });
    }

    // Se retornar status HTTP >= 400, é erro
    if (!resp.ok) {
      const msgErro = resultFinal.erros ? resultFinal.erros.map(e => e.mensagem || '').filter(Boolean).join('; ') : (resultFinal.mensagem || `Erro ${resp.status}`);
      return Response.json({ sucesso: false, erro: msgErro || 'Falha ao cancelar' }, { status: 400 });
    }

    // Polling para confirmar cancelamento (até 12 tentativas × 2s = 24s)
    // Para NFCe, o status pode vir como 'cancelado' ou em um objeto 'cancelamento'
    let statusCancelamento = resultFinal.status || resultFinal.cancelamento?.status || 'processando';
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
            // Para NFCe, verificar em resultFinal.cancelamento.status
            statusCancelamento = resultFinal.status || resultFinal.cancelamento?.status || statusCancelamento;
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
        const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
        if (notas[0]?.xml_content) {
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