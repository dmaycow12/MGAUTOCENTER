import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
let API_KEY = '';
let AUTH_HEADER = '';

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

    // Carrega chave API do banco de dados
    const allConfigs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const getConf = (chave, padrao = '') => allConfigs.find(c => c.chave === chave)?.valor || padrao;
    API_KEY = getConf('focusnfe_api_key_producao', '');
    AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

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

    // Usa chave_acesso ou spedy_id como alternativa
    const chave = nota.chave_acesso || nota.spedy_id;
    if (!chave) {
      return Response.json({ sucesso: false, erro: 'Nota sem chave de acesso ou spedy_id' });
    }
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