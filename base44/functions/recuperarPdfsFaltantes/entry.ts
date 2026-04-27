import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    const todasNotas = await db.entities.NotaFiscal.list('-created_date', 500);

    // Notas emitidas que têm spedy_id mas não têm pdf_url salvo
    const semPdf = todasNotas.filter(n =>
      n.status === 'Emitida' &&
      n.spedy_id &&
      !n.pdf_url
    ).slice(0, 20); // processa 20 por vez

    const totalSemPdf = todasNotas.filter(n => n.status === 'Emitida' && n.spedy_id && !n.pdf_url).length;

    const logs = [];
    let recuperadas = 0;
    let falhas = 0;

    for (const nota of semPdf) {
      try {
        const ep = nota.tipo === 'NFSe' ? 'nfsen' : nota.tipo === 'NFCe' ? 'nfce' : 'nfe';
        const consultaResp = await fetch(`${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`, {
          headers: { 'Authorization': AUTH_HEADER },
        });

        if (!consultaResp.ok) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - API retornou ${consultaResp.status}`);
          falhas++;
          continue;
        }

        const result = await consultaResp.json();
        if (result.status !== 'autorizado') {
          logs.push(`SKIP: ${nota.tipo} nº ${nota.numero} - status ${result.status}`);
          falhas++;
          continue;
        }

        const rawPdf = result.url_danfse || result.caminho_pdf_nfsen || result.caminho_pdf_nfse || result.caminho_danfe || result.url_danfe || result.caminho_pdf || '';
        const pdfUrl = normalizarUrl(rawPdf);

        if (!pdfUrl) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - sem URL de PDF`);
          falhas++;
          continue;
        }

        const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
        const pdfResp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });

        if (!pdfResp.ok) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - download PDF ${pdfResp.status}`);
          falhas++;
          continue;
        }

        const blob = await pdfResp.blob();
        const file = new File([blob], `nota_${nota.id}.pdf`, { type: 'application/pdf' });
        const { file_url } = await db.integrations.Core.UploadFile({ file });

        await db.entities.NotaFiscal.update(nota.id, { pdf_url: file_url });

        logs.push(`OK: ${nota.tipo} nº ${nota.numero}`);
        recuperadas++;
      } catch (e) {
        logs.push(`ERRO: ${nota.tipo} nº ${nota.numero} - ${e.message}`);
        falhas++;
      }
    }

    return Response.json({
      sucesso: true,
      total_sem_pdf_geral: totalSemPdf,
      processadas_agora: semPdf.length,
      restantes: Math.max(0, totalSemPdf - semPdf.length),
      recuperadas,
      falhas,
      logs,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});