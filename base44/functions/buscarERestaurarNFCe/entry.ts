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

    // A Focus NFe usa referências no formato nfce-XXXX
    // Para encontrar por número, buscamos as notas recentes e filtramos
    let nfceFocus = null;

    // Tenta múltiplas páginas para encontrar a nota pelo número
    for (let offset = 0; offset <= 200 && !nfceFocus; offset += 50) {
      const listResp = await fetch(`${FOCUSNFE_BASE}/nfce?limit=50&offset=${offset}`, {
        headers: { 'Authorization': AUTH_HEADER },
      });

      if (!listResp.ok) break;

      let items = [];
      try {
        const data = await listResp.json();
        items = Array.isArray(data) ? data : (data.nfce || data.nfces || []);
      } catch (_) { break; }

      if (items.length === 0) break;

      // Busca pelo número e série
      nfceFocus = items.find(n => {
        const nNumero = String(n.numero || '').trim();
        const nSerie = String(n.serie || '').trim();
        const bNumero = String(numero).trim();
        const bSerie = serie ? String(serie).trim() : null;
        return nNumero === bNumero && (!bSerie || nSerie === bSerie);
      });

      // Se a lista tem menos de 50, não há mais páginas
      if (items.length < 50) break;
    }

    // Se ainda não encontrou, tenta buscar pela referência direta nfce-{numero}
    if (!nfceFocus) {
      // Tenta referências comuns
      const refs = [`nfce-${numero}`, `nfce${numero}`];
      for (const ref of refs) {
        const resp = await fetch(`${FOCUSNFE_BASE}/nfce/${ref}`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (resp.ok) {
          try { nfceFocus = await resp.json(); break; } catch (_) {}
        }
      }
    }

    if (!nfceFocus) {
      return Response.json({ 
        sucesso: false, 
        erro: `NFCe nº ${numero}${serie ? ` série ${serie}` : ''} não encontrada na Focus NFe. Verifique o número e a série.` 
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

    console.log('[RESTORE] Dados da Focus:', JSON.stringify(nfceFocus));

    // Restaura no banco — campos conforme retorno real da Focus NFe
    const novaNotaFiscal = await base44.asServiceRole.entities.NotaFiscal.create({
      tipo: 'NFCe',
      numero: String(nfceFocus.numero || numero),
      serie: String(nfceFocus.serie || serie || '1'),
      status: 'Emitida',
      cliente_nome: nfceFocus.destinatario_nome || nfceFocus.emitente_nome || 'CONSUMIDOR',
      data_emissao: (nfceFocus.data_emissao || nfceFocus.data_emissao_info || new Date().toISOString()).split('T')[0],
      valor_total: Number(nfceFocus.valor_total || nfceFocus.valor || 0),
      spedy_id: nfceFocus.referencia || nfceFocus.reference || nfceFocus.id || '',
      chave_acesso: nfceFocus.chave_nfe || nfceFocus.chave_acesso || nfceFocus.chave || '',
      pdf_url: nfceFocus.caminho_danfe || nfceFocus.pdf_url || nfceFocus.danfe_url || '',
      xml_url: nfceFocus.caminho_xml_nota_fiscal || nfceFocus.xml_url || '',
      status_sefaz: nfceFocus.status || 'autorizado',
      mensagem_sefaz: nfceFocus.mensagem_sefaz || '',
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