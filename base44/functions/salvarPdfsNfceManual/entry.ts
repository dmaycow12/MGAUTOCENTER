import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const converterHtmlParaPdf = async (htmlContent) => {
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
  throw new Error(`Gotenberg retornou ${resp.status}`);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const db = base44.asServiceRole;

    const notas = [
      { id: '69d43f801a7489b07de93ab7', numero: '156', htmlUrl: 'https://api.focusnfe.com.br/notas_fiscais_consumidor/NFe31260454043647000120650010000001561673000327.html' },
      { id: '69d45df4c34c153d34c9c786', numero: '157', htmlUrl: 'https://api.focusnfe.com.br/notas_fiscais_consumidor/NFe31260454043647000120650010000001571837616543.html' },
      { id: '69d45f0254be3dc79a1fce7e', numero: '158', htmlUrl: 'https://api.focusnfe.com.br/notas_fiscais_consumidor/NFe31260454043647000120650010000001581754394800.html' },
    ];

    const resultados = [];

    for (const nota of notas) {
      try {
        console.log(`[salvarPdfsNfceManual] Buscando HTML NF ${nota.numero}...`);
        const htmlResp = await fetch(nota.htmlUrl, {
          headers: { 'Authorization': AUTH_HEADER },
        });
        if (!htmlResp.ok) throw new Error(`HTTP ${htmlResp.status} ao buscar HTML`);
        const htmlContent = await htmlResp.text();

        console.log(`[salvarPdfsNfceManual] Convertendo NF ${nota.numero} para PDF...`);
        const pdfBlob = await converterHtmlParaPdf(htmlContent);

        const pdfBuffer = await pdfBlob.arrayBuffer();
        const pdfFile = new File([pdfBuffer], `nfce-${nota.id}.pdf`, { type: 'application/pdf' });
        const { file_url } = await db.integrations.Core.UploadFile({ file: pdfFile });

        await db.entities.NotaFiscal.update(nota.id, { pdf_url: file_url });

        resultados.push({ numero: nota.numero, sucesso: true, pdf_url: file_url });
        console.log(`[salvarPdfsNfceManual] NF ${nota.numero} ✓ PDF salvo: ${file_url}`);
      } catch (e) {
        resultados.push({ numero: nota.numero, sucesso: false, erro: e.message });
        console.log(`[salvarPdfsNfceManual] NF ${nota.numero} ERRO: ${e.message}`);
      }
    }

    return Response.json({ sucesso: true, resultados });
  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});