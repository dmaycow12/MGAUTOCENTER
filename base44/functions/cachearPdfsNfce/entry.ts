import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

const converterHtmlParaPdf = async (htmlContent) => {
  try {
    const formData = new FormData();
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    formData.append('files', htmlBlob, 'index.html');
    const resp = await fetch('https://demo.gotenberg.dev/forms/chromium/convert/html', {
      method: 'POST',
      body: formData,
    });
    if (resp.ok) {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('pdf') || ct.includes('octet')) {
        const blob = await resp.blob();
        if (blob.size > 1000) return blob;
      }
    }
  } catch (e) {
    console.log('[cachearPdfsNfce] gotenberg erro:', e.message);
  }
  return null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const db = base44.asServiceRole;

    // Busca NFCe emitidas que ainda têm HTML como pdf_url (ou sem pdf_url)
    const todas = await db.entities.NotaFiscal.list('-created_date', 1000);
    const pendentes = todas.filter(n =>
      n.tipo === 'NFCe' &&
      n.status === 'Emitida' &&
      (!n.pdf_url || n.pdf_url.endsWith('.html') || n.pdf_url.includes('/notas_fiscais_consumidor/'))
    ).slice(0, 20); // processa até 20 por vez

    console.log(`[cachearPdfsNfce] ${pendentes.length} NFCe(s) com HTML para converter`);

    let convertidas = 0;
    let erros = 0;
    const detalhes = [];

    for (const nota of pendentes) {
      try {
        // Determina URL do HTML
        let htmlUrl = '';
        let chave = nota.chave_acesso || '';

        if (nota.pdf_url && (nota.pdf_url.endsWith('.html') || nota.pdf_url.includes('/notas_fiscais_consumidor/'))) {
          htmlUrl = nota.pdf_url;
        } else if (nota.spedy_id) {
          const r = await fetch(`${FOCUSNFE_BASE}/nfce/${nota.spedy_id}?completo=1`, {
            headers: { 'Authorization': AUTH_HEADER },
          });
          if (r.ok) {
            const d = await r.json();
            chave = (d.chave_nfe || nota.chave_acesso || '').replace(/\D/g, '');
            htmlUrl = d.caminho_danfe ? normalizarUrl(d.caminho_danfe) : '';
          }
        }

        if (!htmlUrl && nota.chave_acesso) {
          // Tenta buscar via chave de acesso diretamente
          const chaveNum = nota.chave_acesso.replace(/\D/g, '');
          if (chaveNum.length === 44) {
            try {
              const r = await fetch(`${FOCUSNFE_BASE}/nfce/${chaveNum}?completo=1`, {
                headers: { 'Authorization': AUTH_HEADER },
              });
              if (r.ok) {
                const d = await r.json();
                chave = (d.chave_nfe || chaveNum);
                htmlUrl = d.caminho_danfe ? normalizarUrl(d.caminho_danfe) : '';
                if (d.referencia) {
                  await db.entities.NotaFiscal.update(nota.id, { spedy_id: d.referencia });
                }
              }
            } catch (_e) {}
          }
        }

        if (!htmlUrl) { erros++; detalhes.push(`NF ${nota.numero}: sem URL HTML`); continue; }

        const htmlResp = await fetch(htmlUrl, { headers: { 'Authorization': AUTH_HEADER } });
        if (!htmlResp.ok) { erros++; detalhes.push(`NF ${nota.numero}: erro ${htmlResp.status} ao buscar HTML`); continue; }
        const htmlContent = await htmlResp.text();

        const pdfBlob = await converterHtmlParaPdf(htmlContent);
        if (!pdfBlob) { erros++; detalhes.push(`NF ${nota.numero}: conversão falhou`); continue; }

        const pdfBuffer = await pdfBlob.arrayBuffer();
        const pdfFile = new File([pdfBuffer], `nfce-${nota.id}.pdf`, { type: 'application/pdf' });
        const { file_url } = await db.integrations.Core.UploadFile({ file: pdfFile });

        const updateData = { pdf_url: file_url };
        if (chave) updateData.chave_acesso = chave;
        await db.entities.NotaFiscal.update(nota.id, updateData);

        convertidas++;
        detalhes.push(`NF ${nota.numero}: ✓ PDF salvo`);
        console.log(`[cachearPdfsNfce] NF ${nota.numero} convertida`);
      } catch (e) {
        erros++;
        detalhes.push(`NF ${nota.numero}: ${e.message}`);
        console.log(`[cachearPdfsNfce] Erro NF ${nota.numero}:`, e.message);
      }
    }

    const restantes = todas.filter(n =>
      n.tipo === 'NFCe' &&
      n.status === 'Emitida' &&
      (!n.pdf_url || n.pdf_url.endsWith('.html') || n.pdf_url.includes('/notas_fiscais_consumidor/'))
    ).length - convertidas;

    return Response.json({
      sucesso: true,
      convertidas,
      erros,
      restantes: Math.max(0, restantes),
      detalhes,
    });

  } catch (error) {
    console.error('cachearPdfsNfce erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message });
  }
});