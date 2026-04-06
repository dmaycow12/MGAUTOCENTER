import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

const epPorTipo = (tipo) => {
  if (tipo === 'NFSe') return 'nfsen';
  if (tipo === 'NFCe') return 'nfce';
  return 'nfe';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { nota_id } = await req.json();
    if (!nota_id) return Response.json({ erro: 'nota_id obrigatório' }, { status: 400 });

    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id }, '-created_date', 1);
    const nota = notas[0];
    if (!nota) return Response.json({ erro: 'Nota não encontrada' }, { status: 404 });

    // Se já tem URL salva, tenta baixar direto
    let pdfUrlFull = nota.pdf_url ? normalizarUrl(nota.pdf_url) : '';

    // Se não tem URL ou é URL da Focus NFe, consulta a API
    if (!pdfUrlFull || pdfUrlFull.includes('focusnfe')) {
      const ep = epPorTipo(nota.tipo || 'NFe');
      const ref = nota.spedy_id;
      if (!ref) return Response.json({ erro: 'Referência não encontrada' }, { status: 404 });

      const resp = await fetch(`${FOCUSNFE_BASE}/${ep}/${ref}?completo=1`, {
        headers: { 'Authorization': AUTH_HEADER },
      });

      if (!resp.ok) return Response.json({ processando: true, mensagem: 'Nota ainda em processamento.' });

      const data = await resp.json();
      const status = data.status || '';

      if (status !== 'autorizado') {
        if (status === 'erro_autorizacao' || status === 'rejeitado' || status === 'erro') {
          const motivo = data.erros ? data.erros.map(e => e.mensagem).join('; ') : (data.mensagem || status);
          await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Erro', mensagem_sefaz: motivo });
          return Response.json({ erro: `Nota rejeitada: ${motivo}` });
        }
        return Response.json({ processando: true, mensagem: 'A SEFAZ ainda está processando a nota.' });
      }

      const rawPdf = data.caminho_pdf_nfsen || data.caminho_pdf_nfse || data.caminho_danfe || '';
      pdfUrlFull = normalizarUrl(rawPdf);

      // Salva a URL e atualiza status
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        pdf_url: pdfUrlFull,
        status: 'Emitida',
        chave_acesso: data.chave_nfe || data.chave_nfse || nota.chave_acesso || '',
        ...(data.numero ? { numero: String(data.numero) } : {}),
      });
    }

    if (!pdfUrlFull) return Response.json({ erro: 'PDF não disponível' });

    // Baixa o PDF da Focus NFe com auth e retorna como base64
    const pdfResp = await fetch(pdfUrlFull, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (!pdfResp.ok) return Response.json({ erro: 'Não foi possível baixar o PDF da Focus NFe' });

    const arrayBuffer = await pdfResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return Response.json({ sucesso: true, pdf_base64: base64 });

  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});