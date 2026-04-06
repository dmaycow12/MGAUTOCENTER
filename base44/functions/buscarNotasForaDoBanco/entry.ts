import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ sucesso: false, erro: 'Apenas admins' }, { status: 403 });
    }

    // Busca todas as notas que emitimos na Focus NFe
    const notasList = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 500);
    const nfcesNoBanco = notasList
      .filter(n => n.tipo === 'NFCe' && n.reference_id)
      .map(n => n.reference_id);

    // Busca NFCes na Focus NFe
    const focusResp = await fetch(`${FOCUSNFE_BASE}/nfce?status=all&limit=100`, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (!focusResp.ok) {
      return Response.json({ sucesso: false, erro: 'Erro ao consultar Focus NFe' }, { status: 400 });
    }

    const focusData = await focusResp.json();
    const notasFocus = focusData.nfce || [];

    // Identifica notas que estão na Focus mas NÃO estão no banco
    const notasForaDoBanco = notasFocus.filter(n => !nfcesNoBanco.includes(n.id));

    return Response.json({
      sucesso: true,
      notas_fora_do_banco: notasForaDoBanco,
      quantidade: notasForaDoBanco.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});