import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let { numero, serie } = await req.json();
    if (!numero) return Response.json({ sucesso: false, erro: 'Número é obrigatório' }, { status: 400 });

    // Detecta se é chave de acesso (44 dígitos)
    const chaveInput = String(numero).replace(/\D/g, '');
    let chaveAcesso = null;
    let tipoNota = 'NFCe';
    let epBase = 'nfce';

    if (chaveInput.length === 44) {
      chaveAcesso = chaveInput;
      const mod = chaveInput.substring(20, 22); // 55=NFe, 65=NFCe
      if (mod === '55') { tipoNota = 'NFe'; epBase = 'nfe'; }
      serie = chaveInput.substring(22, 25).replace(/^0+/, '') || '1';
      numero = chaveInput.substring(25, 34).replace(/^0+/, '') || numero;
      console.log('[CHAVE] tipo:', tipoNota, 'numero:', numero, 'serie:', serie);
    }

    let notaFocus = null;

    // 1. Tenta buscar pela chave de acesso em vários endpoints
    if (chaveAcesso) {
      const urls = [
        `${FOCUSNFE_BASE}/${epBase}/${chaveAcesso}?completo=1`,
        `${FOCUSNFE_BASE}/${epBase}/chave/${chaveAcesso}?completo=1`,
        `${FOCUSNFE_BASE}/${epBase}?chave_nfe=${chaveAcesso}`,
      ];
      for (const url of urls) {
        const r = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
        const txt = await r.text();
        console.log('[URL]', url.replace(FOCUSNFE_BASE, ''), 'status:', r.status, 'body:', txt.substring(0, 200));
        if (r.ok) {
          try {
            const data = JSON.parse(txt);
            const c = Array.isArray(data) ? data[0] : data;
            if (c && (c.chave_nfe || c.numero || c.status)) { notaFocus = c; break; }
          } catch (_) {}
        }
      }
    }

    // 2. Tenta referência direta nfe-{numero} / nfce-{numero}
    if (!notaFocus) {
      const numPadded = String(numero).padStart(9, '0');
      const refs = [`${epBase}-${numero}`, `${epBase}-${numPadded}`, `${epBase}${numero}`];
      for (const ref of refs) {
        const r = await fetch(`${FOCUSNFE_BASE}/${epBase}/${ref}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        console.log('[REF]', ref, 'status:', r.status);
        if (r.ok) {
          try { notaFocus = await r.json(); break; } catch (_) {}
        }
      }
    }

    // 3. Varre listagem paginada como último recurso
    if (!notaFocus) {
      for (let offset = 0; offset <= 500 && !notaFocus; offset += 50) {
        const r = await fetch(`${FOCUSNFE_BASE}/${epBase}?limit=50&offset=${offset}`, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (!r.ok) { console.log('[LIST] erro status:', r.status); break; }
        let items = [];
        try {
          const data = await r.json();
          items = Array.isArray(data) ? data : [];
          console.log('[LIST] offset:', offset, 'itens:', items.length, 'primeiro_num:', items[0]?.numero);
        } catch (_) { break; }
        if (items.length === 0) break;
        notaFocus = items.find(n => {
          if (chaveAcesso) return (n.chave_nfe || n.chave_acesso || '') === chaveAcesso;
          const nNum = String(n.numero || '').replace(/^0+/, '');
          const bNum = String(numero).replace(/^0+/, '');
          return nNum === bNum && (!serie || String(n.serie || '') === String(serie));
        });
        if (items.length < 50) break;
      }
    }

    // 4. Fallback: se temos a chave de acesso e não encontrou na Focus, cria manualmente no banco
    if (!notaFocus && chaveAcesso) {
      console.log('[FALLBACK] Nota não encontrada na Focus. Criando no banco com dados da chave.');
      const existentes2 = await base44.asServiceRole.entities.NotaFiscal.filter({ numero: String(numero) });
      const duplo2 = existentes2.find(e => e.tipo === tipoNota);
      if (duplo2) {
        return Response.json({ sucesso: false, erro: `${tipoNota} nº ${numero} já existe no banco` }, { status: 400 });
      }
      const nova2 = await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: tipoNota,
        numero: String(numero),
        serie: String(serie || '1'),
        status: 'Importada',
        cliente_nome: 'CONSUMIDOR',
        data_emissao: new Date().toISOString().split('T')[0],
        valor_total: 0,
        chave_acesso: chaveAcesso,
        spedy_id: '',
        status_sefaz: 'importado_manualmente',
        mensagem_sefaz: 'Restaurado manualmente via chave de acesso (nota não encontrada na Focus NFe)',
      });
      return Response.json({
        sucesso: true,
        mensagem: `${tipoNota} nº ${numero} importada manualmente no banco! Edite para preencher os dados completos.`,
        nota_id: nova2.id,
        aviso: 'Nota não encontrada na Focus NFe — apenas a chave de acesso foi salva.',
      });
    }

    if (!notaFocus) {
      return Response.json({
        sucesso: false,
        erro: `${tipoNota} nº ${numero} série ${serie} não encontrada na Focus NFe e nenhuma chave de acesso foi fornecida.`,
      }, { status: 404 });
    }

    // Verifica duplicata no banco
    const existentes = await base44.asServiceRole.entities.NotaFiscal.filter({
      numero: String(numero),
    });
    const duplo = existentes.find(e => e.tipo === tipoNota);
    if (duplo) {
      return Response.json({ sucesso: false, erro: `${tipoNota} nº ${numero} já existe no banco de dados` }, { status: 400 });
    }

    console.log('[RESTORE] dados:', JSON.stringify(notaFocus));

    // Download e valida PDF se disponível
    let pdfUrlFinal = '';
    const rawPdfUrl = notaFocus.caminho_danfe || notaFocus.pdf_url || notaFocus.danfe_url || '';
    if (rawPdfUrl) {
      try {
        const pdfUrlNormalizado = rawPdfUrl.startsWith('http') ? rawPdfUrl : `https://api.focusnfe.com.br${rawPdfUrl}`;
        const isS3 = pdfUrlNormalizado.includes('amazonaws.com') || pdfUrlNormalizado.includes('s3.');
        const pdfResp = await fetch(pdfUrlNormalizado, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
        
        if (pdfResp.ok) {
          const blob = await pdfResp.blob();
          const buffer = await blob.arrayBuffer();
          const header = new Uint8Array(buffer, 0, 4);
          const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
          
          if (isPdfValid) {
            const nomeArquivo = `${tipoNota.toLowerCase()}-${numero}.pdf`;
            const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            pdfUrlFinal = file_url;
          }
        }
      } catch (e) {
        console.error('[PDF] Erro ao validar:', e.message);
      }
    }

    const nova = await base44.asServiceRole.entities.NotaFiscal.create({
      tipo: tipoNota,
      numero: String(notaFocus.numero || numero),
      serie: String(notaFocus.serie || serie || '1'),
      status: notaFocus.status === 'cancelado' ? 'Cancelada' : 'Emitida',
      cliente_nome: notaFocus.destinatario_nome || notaFocus.nome_destinatario || 'CONSUMIDOR',
      data_emissao: (notaFocus.data_emissao || new Date().toISOString()).split('T')[0],
      valor_total: Number(notaFocus.valor_total || notaFocus.valor || 0),
      spedy_id: notaFocus.referencia || notaFocus.reference || notaFocus.id || '',
      chave_acesso: notaFocus.chave_nfe || notaFocus.chave_acesso || notaFocus.chave || chaveAcesso || '',
      pdf_url: pdfUrlFinal,
      xml_url: notaFocus.caminho_xml_nota_fiscal || notaFocus.xml_url || '',
      status_sefaz: notaFocus.status || 'autorizado',
      mensagem_sefaz: notaFocus.mensagem_sefaz || '',
    });

    return Response.json({ sucesso: true, mensagem: `${tipoNota} nº ${numero} restaurada com sucesso!`, nota_id: nova.id });

  } catch (error) {
    console.error('[ERRO]', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});