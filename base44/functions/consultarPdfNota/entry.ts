import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = 'NoVwceYcJEYWnkweE8agjTEzBRtDe9lr';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

const endpointPorTipo = (tipo) => {
  if (tipo === 'NFSe') return 'nfse_nacional';
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

    // Se já tem PDF salvo, retorna direto
    if (nota.pdf_url) {
      return Response.json({ sucesso: true, pdf_url: nota.pdf_url });
    }

    // Sem ref salvo não tem como consultar
    if (!nota.spedy_id && !nota.chave_acesso) {
      return Response.json({ processando: true, mensagem: 'Referência da nota não encontrada. Tente novamente.' });
    }

    // Consulta por chave de acesso ou pelo spedy_id (ref)
    const tipo = nota.tipo || 'NFe';
    const ep = endpointPorTipo(tipo);

    let url;
    if (nota.spedy_id) {
      url = `${FOCUSNFE_BASE}/${ep}/${nota.spedy_id}?completo=1`;
    } else {
      // Tenta por chave de acesso
      url = `${FOCUSNFE_BASE}/${ep}/${nota.chave_acesso}?completo=1`;
    }

    const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) {
      return Response.json({ processando: true, mensagem: 'Não foi possível consultar a nota na Focus NFe.' });
    }

    const data = await resp.json();

    const status = data.status || '';
    const pdfUrl = normalizarUrl(data.caminho_pdf_nfse || data.caminho_danfe || data.url_danfe || '');

    if (status === 'autorizado' && pdfUrl) {
      // Salva no banco e retorna URL
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        pdf_url: pdfUrl,
        status: 'Emitida',
        chave_acesso: data.chave_nfe || nota.chave_acesso || '',
      });
      return Response.json({ sucesso: true, pdf_url: pdfUrl });
    }

    if (status === 'processando_autorizacao' || status === 'processando') {
      return Response.json({ processando: true, mensagem: 'A SEFAZ ainda está processando a nota, tente imprimir em alguns segundos.' });
    }

    if (status === 'cancelado' || status === 'denegado') {
      return Response.json({ erro: `Nota com status: ${status}` });
    }

    return Response.json({ processando: true, mensagem: 'A SEFAZ ainda está processando a nota, tente imprimir em alguns segundos.' });

  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});