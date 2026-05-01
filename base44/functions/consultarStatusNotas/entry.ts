import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

const salvarPdfPermanente = async (base44, pdfUrl, nota_id) => {
  if (!pdfUrl) return null;
  try {
    const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
    const resp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    
    // Valida se é PDF válido (%PDF header)
    const buffer = await blob.arrayBuffer();
    const header = new Uint8Array(buffer, 0, 4);
    const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
    if (!isPdfValid) {
      console.warn('[PDF INVALIDO]', nota_id, '- não começa com %PDF');
      return null;
    }
    
    const file = new File([blob], `nota_${nota_id}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    console.log('[PDF PERMANENTE]', nota_id, '->', file_url);
    return file_url;
  } catch (e) {
    console.error('[PDF ERRO]', e.message);
    return null;
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Modo: consulta específica (nota_id + ref) OU varredura geral (Processando + Aguardando)
    let notasParaConsultar = [];

    if (body.nota_id && body.ref) {
      // Consulta específica de uma nota
      const lista = await base44.asServiceRole.entities.NotaFiscal.filter({ id: body.nota_id });
      if (lista[0]) notasParaConsultar = [lista[0]];
    } else {
      // Varredura: busca todas em Processando ou Aguardando Sefin Nacional
      const [processando, aguardando] = await Promise.all([
        base44.asServiceRole.entities.NotaFiscal.filter({ status: 'Processando' }),
        base44.asServiceRole.entities.NotaFiscal.filter({ status: 'Aguardando Sefin Nacional' }),
      ]);
      notasParaConsultar = [...processando, ...aguardando];
    }

    if (notasParaConsultar.length === 0) {
      return Response.json({ sucesso: true, mensagem: 'Nenhuma nota pendente.' });
    }

    const resultados = [];

    for (const nota of notasParaConsultar) {
      const tipo = nota.tipo || 'NFe';
      const ref = nota.spedy_id;
      if (!ref) {
        console.log('[SKIP] Nota sem spedy_id:', nota.id);
        continue;
      }

      // Endpoint de consulta por tipo
      const ep = tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe';
      const consultaResp = await fetch(`${FOCUSNFE_BASE}/${ep}/${ref}?completo=1`, {
        headers: { 'Authorization': AUTH_HEADER },
      });

      if (!consultaResp.ok) {
        console.log('[SKIP] Erro ao consultar Focus NFe para nota:', ref, consultaResp.status);
        continue;
      }

      const result = await consultaResp.json();
      const statusFocus = result.status || '';
      console.log('[STATUS]', ref, '->', statusFocus);

      let statusInterno = nota.status; // mantém se não definitivo
      if (statusFocus === 'autorizado') statusInterno = 'Emitida';
      else if (['erro_autorizacao', 'rejeitado', 'denegado', 'cancelado'].includes(statusFocus)) statusInterno = 'Erro';
      else if (statusFocus === 'cancelado') statusInterno = 'Cancelada';

      if (statusInterno !== nota.status) {
        let pdfUrlFinal = nota.pdf_url || '';

        if (statusInterno === 'Emitida' && !pdfUrlFinal) {
          const rawPdf = result.url_danfse || result.caminho_pdf_nfsen || result.caminho_pdf_nfse || result.caminho_danfe || '';
          const pdfUrlFocus = normalizarUrl(rawPdf);
          if (pdfUrlFocus) {
            // Tenta salvar permanentemente
            const pdfSalvo = await salvarPdfPermanente(base44, pdfUrlFocus, nota.id);
            pdfUrlFinal = pdfSalvo || pdfUrlFocus;
          }
        }

        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          status: statusInterno,
          status_sefaz: statusFocus,
          mensagem_sefaz: result.mensagem_sefaz || result.mensagem || '',
          chave_acesso: result.chave_nfe || result.chave_nfce || result.chave_nfse || nota.chave_acesso || '',
          pdf_url: pdfUrlFinal,
          xml_url: result.caminho_xml_nota_fiscal || nota.xml_url || '',
        });

        resultados.push({ ref, nota_id: nota.id, statusAnterior: nota.status, statusNovo: statusInterno });
        console.log(`[ATUALIZADO] Nota ${ref}: ${nota.status} -> ${statusInterno}`);
      }
    }

    const atualizado = resultados.length > 0 ? resultados[0] : null;
    return Response.json({
      sucesso: true,
      processadas: resultados.length,
      status: atualizado?.statusNovo || notasParaConsultar[0]?.status || 'Processando',
      detalhes: resultados,
    });

  } catch (error) {
    console.error('Erro consultarStatusNotas:', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});