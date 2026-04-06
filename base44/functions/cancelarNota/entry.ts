import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { nota_id, ref, tipo } = await req.json();

    if (!nota_id || !ref) return Response.json({ erro: 'nota_id e ref são obrigatórios' }, { status: 400 });

    let endpoint = '';
    if (tipo === 'NFSe') endpoint = `/nfsen/${ref}`;
    else if (tipo === 'NFCe') endpoint = `/nfce/${ref}`;
    else endpoint = `/nfe/${ref}`;

    const resp = await fetch(`${FOCUSNFE_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ justificativa: 'Cancelamento solicitado pelo emitente.' }),
    });

    const text = await resp.text();
    let result;
    try { result = JSON.parse(text); } catch { result = {}; }

    // Polling para confirmar cancelamento (até 10 tentativas × 3s = 30s)
    let statusCancelamento = result.status || '';
    let resultFinal = result;
    
    for (let i = 0; i < 10 && statusCancelamento !== 'cancelado'; i++) {
      if (statusCancelamento === 'cancelado') break;
      if (i < 9) {
        await new Promise(r => setTimeout(r, 3000));
        const consultaResp = await fetch(`${FOCUSNFE_BASE}${endpoint}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (consultaResp.ok) {
          resultFinal = await consultaResp.json();
          statusCancelamento = resultFinal.status || '';
        }
      }
    }

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
      return Response.json({ sucesso: true });
    }

    const msgErro = resultFinal.erros ? resultFinal.erros.map(e => e.mensagem).join('; ') : (resultFinal.mensagem || JSON.stringify(resultFinal));
    return Response.json({ sucesso: false, erro: msgErro });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});