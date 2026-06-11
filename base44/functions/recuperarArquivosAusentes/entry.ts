import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    const user = await base44.auth.me();
    if (!user) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { nota_id } = body;

    if (!nota_id) {
      return Response.json({ sucesso: false, erro: 'nota_id é obrigatória' });
    }

    // Busca a nota
    const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id });
    const nota = notas[0];
    if (!nota) {
      return Response.json({ sucesso: false, erro: 'Nota não encontrada' });
    }

    if (!nota.chave_acesso) {
      return Response.json({ sucesso: false, erro: 'Nota sem chave de acesso' });
    }

    const chave = nota.chave_acesso;
    const updates = {};

    // Tenta recuperar XML
    if (!nota.xml_original && !nota.xml_url) {
      console.log('[RECUPERAR] Buscando XML para:', chave);
      const endpointsXml = [
        `${FOCUSNFE_BASE}/nfes/${chave}.xml`,
        `${FOCUSNFE_BASE}/nfes/${chave}/xml`,
        `${FOCUSNFE_BASE}/nfes_recebidas/${chave}.xml`,
        `${FOCUSNFE_BASE}/nfes_recebidas/${chave}/xml`,
        `${FOCUSNFE_BASE}/download_nfe/${chave}`,
      ];

      for (const url of endpointsXml) {
        try {
          const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
          if (resp.ok) {
            const ct = resp.headers.get('content-type') || '';
            if (ct.includes('xml')) {
              const text = await resp.text();
              if (text && text.length > 500 && text.includes('<')) {
                updates.xml_original = text;
                console.log('[RECUPERAR] XML encontrado (conteúdo)');
                break;
              }
            }
          }
        } catch (e) {
          console.error('[RECUPERAR XML ERROR]', url, e.message);
        }
      }

      // Se não conseguiu o conteúdo, tenta salvar a URL
      if (!updates.xml_original) {
        for (const url of endpointsXml) {
          try {
            const resp = await fetch(url, { method: 'HEAD', headers: { 'Authorization': AUTH_HEADER } });
            if (resp.ok) {
              updates.xml_url = url;
              console.log('[RECUPERAR] URL XML encontrada:', url);
              break;
            }
          } catch (e) {}
        }
      }
    }

    // Tenta recuperar PDF
    if (!nota.pdf_url) {
      console.log('[RECUPERAR] Buscando PDF para:', chave);
      const endpointsPdf = [
        `${FOCUSNFE_BASE}/nfes/${chave}/pdf`,
        `${FOCUSNFE_BASE}/nfes/${chave}/danfe`,
        `${FOCUSNFE_BASE}/nfes_recebidas/${chave}/pdf`,
        `${FOCUSNFE_BASE}/nfes_recebidas/${chave}/danfe`,
      ];

      // Se for NFSe, tenta endpoints específicos
      if (nota.tipo === 'NFSe') {
        endpointsPdf.unshift(
          `${FOCUSNFE_BASE}/nfsen/${chave}/pdf`,
          `${FOCUSNFE_BASE}/nfsen/${chave}/danfse`
        );
      }

      for (const url of endpointsPdf) {
        try {
          const resp = await fetch(url, { method: 'HEAD', headers: { 'Authorization': AUTH_HEADER } });
          if (resp.ok) {
            updates.pdf_url = url;
            console.log('[RECUPERAR] URL PDF encontrada:', url);
            break;
          }
        } catch (e) {}
      }
    }

    // Atualiza a nota se encontrou algo
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, updates);
      return Response.json({
        sucesso: true,
        mensagem: 'Arquivos recuperados com sucesso!',
        encontrou_xml: !!updates.xml_original || !!updates.xml_url,
        encontrou_pdf: !!updates.pdf_url,
      });
    }

    return Response.json({
      sucesso: false,
      erro: 'Nenhum arquivo encontrado na SEFAZ para esta nota.',
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message });
  }
});