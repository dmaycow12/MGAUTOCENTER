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

    const { numero, serie } = await req.json();

    if (!numero) return Response.json({ sucesso: false, erro: 'Número é obrigatório' }, { status: 400 });

    // Tenta buscar a NFCe na Focus NFe pelo número
    // A API da Focus usa ?numero= para filtrar
    const consultaResp = await fetch(`${FOCUSNFE_BASE}/nfce/${numero}?serie=${serie || 1}`, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    let nfceFocus = null;
    if (consultaResp.ok) {
      try {
        const data = await consultaResp.json();
        nfceFocus = data.nfce || data;
      } catch (_) {}
    }

    // Se não encontrou por esse endpoint, tenta listar todas e filtrar
    if (!nfceFocus) {
      // Endpoint alternativo: busca recentes
      const listResp = await fetch(`${FOCUSNFE_BASE}/nfce?limit=100&status=all`, {
        headers: { 'Authorization': AUTH_HEADER },
      });

      if (listResp.ok) {
        try {
          const data = await listResp.json();
          const nfces = data.nfce || data.nfces || [];
          nfceFocus = nfces.find(n => {
            return String(n.numero).trim() === String(numero).trim() && 
                   (!serie || String(n.serie).trim() === String(serie).trim());
          });
        } catch (_) {}
      }
    }

    if (!nfceFocus) {
      return Response.json({ 
        sucesso: false, 
        erro: `NFCe nº ${numero}${serie ? ` série ${serie}` : ''} não encontrada na Focus NFe` 
      }, { status: 404 });
    }

    // Verifica se já existe no banco
    const existentes = await base44.asServiceRole.entities.NotaFiscal.filter({
      tipo: 'NFCe',
      numero: String(numero),
    });

    if (existentes.length > 0) {
      return Response.json({
        sucesso: false,
        erro: `NFCe nº ${numero} já existe no banco de dados`,
      }, { status: 400 });
    }

    // Restaura no banco
    const novaNotaFiscal = await base44.asServiceRole.entities.NotaFiscal.create({
      tipo: 'NFCe',
      numero: String(nfceFocus.numero || numero),
      serie: String(nfceFocus.serie || serie || '1'),
      status: 'Emitida',
      cliente_nome: nfceFocus.emitente_nome || 'CONSUMIDOR',
      data_emissao: nfceFocus.data_emissao || new Date().toISOString().split('T')[0],
      valor_total: Number(nfceFocus.valor || 0),
      reference_id: nfceFocus.id || nfceFocus.reference,
      chave_acesso: nfceFocus.chave_acesso || nfceFocus.chave || '',
      pdf_url: nfceFocus.pdf_url || nfceFocus.danfe_url || '',
      status_sefaz: nfceFocus.status || 'Autorizado',
    });

    return Response.json({
      sucesso: true,
      mensagem: `NFCe nº ${numero} restaurada com sucesso!`,
      nota_id: novaNotaFiscal.id,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});