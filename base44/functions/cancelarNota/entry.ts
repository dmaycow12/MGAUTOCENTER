import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authed = await base44.auth.isAuthenticated();
    if (!authed) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
    const { nota_id, ref, tipo } = await req.json();

    if (!nota_id) return Response.json({ sucesso: false, erro: 'nota_id é obrigatório' }, { status: 400 });

    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
    if (!notas || notas.length === 0) {
      return Response.json({ sucesso: false, erro: 'Nota fiscal não encontrada' }, { status: 404 });
    }
    const nota = notas[0];

    const referencia = nota.spedy_id || ref;
    if (!referencia) {
      return Response.json({ sucesso: false, erro: 'Referência (spedy_id) não encontrada para esta nota.' }, { status: 400 });
    }

    const tipoNota = tipo || nota.tipo || 'NFCe';
    let epBase = 'nfce';
    if (tipoNota === 'NFe') epBase = 'nfe';
    else if (tipoNota === 'NFSe') epBase = 'nfsen';

    const justificativa = 'Cancelamento solicitado pelo emitente.';
    const url = `${FOCUSNFE_BASE}/${epBase}/${referencia}`;

    console.log('[CANCEL] URL:', url, 'Tipo:', tipoNota, 'Ref:', referencia);

    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ justificativa }),
    });

    const text = await resp.text();
    console.log('[CANCEL RESPONSE] Status HTTP:', resp.status, 'Body:', text);

    let result = {};
    try { result = JSON.parse(text); } catch (_) {
      return Response.json({ sucesso: false, erro: 'Resposta inválida da Focus NFe', debug: text }, { status: 400 });
    }

    if (result.status === 'cancelado') {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        status: 'Cancelada',
        status_sefaz: result.status_sefaz || 'cancelado',
        mensagem_sefaz: result.mensagem_sefaz || 'Cancelada com sucesso',
      });
      return Response.json({
        sucesso: true,
        mensagem: 'Nota cancelada com sucesso',
        numero_protocolo: result.numero_protocolo,
        mensagem_sefaz: result.mensagem_sefaz,
      });
    }

    const msgErro = result.mensagem || result.mensagem_sefaz || result.codigo || `Erro ${resp.status}: ${text}`;
    console.error('[CANCEL ERROR]', msgErro, result);
    return Response.json({ sucesso: false, erro: msgErro, debug: result }, { status: 400 });

  } catch (error) {
    console.error('[EXCEPTION]', error);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});