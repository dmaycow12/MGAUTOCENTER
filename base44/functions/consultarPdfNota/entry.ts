import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

const endpointPorTipo = (tipo) => {
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

    if (nota.pdf_url) return Response.json({ sucesso: true, pdf_url: nota.pdf_url });

    const ref = nota.spedy_id;
    if (!ref) {
      return Response.json({ processando: false, erro: 'Referência da nota não encontrada. Esta nota pode ter sido criada antes da atualização do sistema.' });
    }

    const ep = endpointPorTipo(nota.tipo || 'NFe');
    const resp = await fetch(`${FOCUSNFE_BASE}/${ep}/${ref}?completo=1`, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (resp.status === 404) return Response.json({ erro: 'Nota não encontrada na Focus NFe.' });
    if (!resp.ok) return Response.json({ processando: true, mensagem: 'Não foi possível consultar a nota na Focus NFe.' });

    const data = await resp.json();
    const status = data.status || '';

    if (status === 'autorizado') {
      const pdfUrl = normalizarUrl(data.caminho_pdf_nfsen || data.caminho_pdf_nfse || data.caminho_danfe || '');
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        pdf_url: pdfUrl,
        status: 'Emitida',
        chave_acesso: data.chave_nfe || nota.chave_acesso || '',
        ...(data.numero ? { numero: data.numero } : {}),
        ...(data.serie ? { serie: data.serie } : {}),
      });
      return Response.json({ sucesso: true, pdf_url: pdfUrl });
    }

    if (status === 'erro_autorizacao' || status === 'rejeitado') {
      const motivo = data.erros ? data.erros.map(e => e.mensagem).join('; ') : (data.mensagem || status);
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Erro', mensagem_sefaz: motivo });
      return Response.json({ erro: `Nota rejeitada: ${motivo}` });
    }

    return Response.json({ processando: true, mensagem: 'A SEFAZ ainda está processando a nota, tente em alguns segundos.' });

  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});