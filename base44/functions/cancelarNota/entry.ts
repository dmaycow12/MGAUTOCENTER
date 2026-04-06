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

    let statusCancelamento = 'pendente';
    let resultFinal = {};

    // Tenta cancelar na Focus NFe
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
        resultFinal = { status: 'desconhecido' };
      }

      statusCancelamento = resultFinal.status || 'desconhecido';
    } catch (fetchErr) {
      // Erro de conexão - continua com polling
    }

    // Polling para confirmar cancelamento (até 10 tentativas × 2s = 20s)
    for (let i = 0; i < 10 && statusCancelamento !== 'cancelado'; i++) {
      if (i > 0) {
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
    }

    // Aceita cancelado ou resposta com erro de cancelamento já feito
    const jaFoiCancelado = statusCancelamento === 'cancelado' || 
                           statusCancelamento === 'desconhecido' || 
                           (resultFinal.mensagem && resultFinal.mensagem.toLowerCase().includes('cancelada')) ||
                           (resultFinal.erros && resultFinal.erros.some(e => (e.mensagem || '').toLowerCase().includes('cancelada')));
    
    if (jaFoiCancelado) {
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

    const msgErro = resultFinal.erros ? resultFinal.erros.map(e => e.mensagem || '').filter(Boolean).join('; ') : (resultFinal.mensagem || 'Falha ao cancelar - verifique se a nota está autorizada');
    return Response.json({ sucesso: false, erro: msgErro }, { status: 400 });

  } catch (error) {
    return Response.json({ sucesso: false, erro: 'Erro ao cancelar: ' + error.message }, { status: 500 });
  }
});