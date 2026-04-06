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

    // 1. Primeiro, consulta o status atual da nota
    let statusAtual = '';
    try {
      const consultaResp = await fetch(`${FOCUSNFE_BASE}${endpoint}?completo=1`, {
        headers: { 'Authorization': AUTH_HEADER },
      });
      if (consultaResp.ok) {
        const consultaText = await consultaResp.text();
        try {
          const consultaData = JSON.parse(consultaText);
          statusAtual = consultaData.status || '';
        } catch (_) {}
      }
    } catch (_) {}

    // Se não está autorizado, retorna erro
    if (statusAtual && statusAtual !== 'autorizado' && statusAtual !== 'cancelado') {
      return Response.json({ 
        sucesso: false, 
        erro: `Nota em status "${statusAtual}" - só notas autorizadas podem ser canceladas` 
      }, { status: 400 });
    }

    // Se já está cancelado, retorna sucesso
    if (statusAtual === 'cancelado') {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Cancelada' });
      return Response.json({ sucesso: true, mensagem: 'Nota já estava cancelada' });
    }

    // 2. Tenta cancelar
    let resultFinal = {};
    try {
      const resp = await fetch(`${FOCUSNFE_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa: 'Cancelamento solicitado pelo emitente.' }),
      });

      const text = await resp.text();
      try {
        resultFinal = JSON.parse(text);
      } catch (_) {
        resultFinal = { status: resp.status };
      }

      if (!resp.ok && resp.status !== 200) {
        const msgErro = resultFinal.erros ? resultFinal.erros.map(e => e.mensagem || '').filter(Boolean).join('; ') : (resultFinal.mensagem || `Erro ${resp.status}`);
        return Response.json({ sucesso: false, erro: msgErro }, { status: 400 });
      }
    } catch (fetchErr) {
      return Response.json({ sucesso: false, erro: 'Falha ao conectar com Focus NFe: ' + fetchErr.message }, { status: 500 });
    }

    // 3. Polling para confirmar cancelamento (até 15 tentativas × 2s = 30s)
    let statusCancelamento = resultFinal.status || 'pendente';
    for (let i = 0; i < 15 && statusCancelamento !== 'cancelado'; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const consultaResp = await fetch(`${FOCUSNFE_BASE}${endpoint}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (consultaResp.ok) {
          const consultaText = await consultaResp.text();
          try {
            resultFinal = JSON.parse(consultaText);
            statusCancelamento = resultFinal.status || statusCancelamento;
          } catch (_) {}
        }
      } catch (_) {}
    }

    // 4. Confirma cancelamento no banco local
    if (statusCancelamento === 'cancelado') {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        status: 'Cancelada',
        mensagem_sefaz: resultFinal.mensagem || resultFinal.mensagem_sefaz || 'Cancelada com sucesso',
      });
      // Devolver estoque se NFe/NFCe
      if (tipo === 'NFe' || tipo === 'NFCe') {
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

    return Response.json({ sucesso: false, erro: `Cancelamento não confirmado - status atual: ${statusCancelamento}` }, { status: 400 });

  } catch (error) {
    return Response.json({ sucesso: false, erro: 'Erro ao cancelar: ' + error.message }, { status: 500 });
  }
});