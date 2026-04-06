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

    if (resp.ok || result.status === 'cancelado') {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        status: 'Cancelada',
        mensagem_sefaz: result.mensagem || 'Cancelada com sucesso',
      });
      // Devolver estoque se NFe/NFCe
      if (tipo === 'NFe' || tipo === 'NFCe') {
        const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
        if (notas[0]?.xml_content) {
          try {
            const items = JSON.parse(notas[0].xml_content);
            for (const it of items) {
              if (it.estoque_id) {
                const estoqueItems = await base44.asServiceRole.entities.Estoque.filter({ id: it.estoque_id });
                if (estoqueItems.length > 0) {
                  await base44.asServiceRole.entities.Estoque.update(it.estoque_id, { quantidade: (Number(estoqueItems[0].quantidade) || 0) + (Number(it.quantidade) || 1) });
                }
              }
            }
          } catch (_) {}
        }
      }
      return Response.json({ sucesso: true });
    }

    const msgErro = result.erros ? result.erros.map(e => e.mensagem).join('; ') : (result.mensagem || JSON.stringify(result));
    return Response.json({ sucesso: false, erro: msgErro });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});