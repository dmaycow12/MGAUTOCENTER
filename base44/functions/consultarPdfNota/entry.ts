import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE_PROD = 'https://api.focusnfe.com.br/v2';
const FOCUSNFE_BASE_HOM = 'https://homologacao.focusnfe.com.br/v2';

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

const endpointPorTipo = (tipo) => {
  if (tipo === 'NFSe') return 'nfsen';
  if (tipo === 'NFCe') return 'nfce';
  return 'nfes'; // plural para notas emitidas
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ erro: 'Não autorizado' }, { status: 401 });
    const { nota_id } = await req.json();
    if (!nota_id) return Response.json({ erro: 'nota_id obrigatório' }, { status: 400 });

    const [notasArr, todasConfigs] = await Promise.all([
      base44.asServiceRole.entities.NotaFiscal.filter({ id: nota_id }, '-created_date', 1),
      base44.asServiceRole.entities.Configuracao.list('-created_date', 200),
    ]);
    const nota = notasArr[0];
     if (!nota) return Response.json({ erro: 'Nota não encontrada' }, { status: 404 });

     // Se já tem PDF armazenado, retorna direto
     if (nota.pdf_url) {
       console.log(`[CONSULTA] Retornando PDF pré-armazenado: ${nota.pdf_url}`);
       return Response.json({ sucesso: true, pdf_url: nota.pdf_url });
     }

    // Carrega chaves de configuração
    const getConf = (chave, padrao = '') => todasConfigs.find(c => c.chave === chave)?.valor || padrao;
    const apiKeyProd = getConf('focusnfe_api_key', '');
    const apiKeyHom = getConf('focusnfe_api_key_homologacao', '');
    const AUTH_HEADER_PROD = 'Basic ' + btoa(apiKeyProd + ':');
    const AUTH_HEADER_HOM = 'Basic ' + btoa(apiKeyHom + ':');

    const ref = nota.spedy_id;
     console.log(`[CONSULTA NOTA] ID: ${nota_id}, Tipo: ${nota.tipo}, Status: ${nota.status}, spedy_id: ${ref}, pdf_url: ${nota.pdf_url}`);

     if (!ref) {
       return Response.json({ processando: false, erro: 'Referência da nota não encontrada. Esta nota pode ter sido criada antes da atualização do sistema.', status_nota: nota.status });
     }

    // Tenta encontrar a nota em ambos os ambientes (pode estar em hom mesmo com status Homologada)
    const ep = endpointPorTipo(nota.tipo || 'NFe');

    let resp = null;
    let data = null;

    // Tenta homologação primeiro se for preview
    const isPreview = ref.startsWith('preview-');
    const ambientes = isPreview 
      ? [[FOCUSNFE_BASE_HOM, AUTH_HEADER_HOM], [FOCUSNFE_BASE_PROD, AUTH_HEADER_PROD]]
      : [[FOCUSNFE_BASE_PROD, AUTH_HEADER_PROD], [FOCUSNFE_BASE_HOM, AUTH_HEADER_HOM]];

    console.log(`[CONSULTA] spedy_id=${ref}, ep=${ep}, ambientes=${ambientes.length}`);

    for (const [baseUrl, authHeader] of ambientes) {
      const fullUrl = `${baseUrl}/${ep}/${ref}?completo=1`;
      console.log(`[CONSULTA] Tentando: ${fullUrl}`);
      resp = await fetch(fullUrl, {
        headers: { 'Authorization': authHeader },
      });

      console.log(`[CONSULTA] Status: ${resp.status} em ${baseUrl}`);

      if (resp.ok) {
        data = await resp.json();
        console.log(`[CONSULTA] Sucesso em ${baseUrl}`, data.status);
        break;
      } else {
        const errText = await resp.text().catch(() => '');
        console.log(`[CONSULTA] Erro em ${baseUrl}: ${resp.status} - ${errText.substring(0, 200)}`);
      }
    }

    if (!data) return Response.json({ erro: 'Nota não encontrada em nenhum ambiente. Verifique o spedy_id na nota.', spedy_id: ref, nota_tipo: nota.tipo, nota_status: nota.status });

    const status = data.status || '';

    if (status === 'autorizado') {
      let pdfUrlFinal = '';
      const rawPdf = data.caminho_pdf_nfsen || data.caminho_pdf_nfse || data.caminho_danfe || data.caminho_pdf_nfce || '';
      if (rawPdf) {
        const pdfUrl = normalizarUrl(rawPdf);
        try {
          const isS3 = pdfUrl.includes('amazonaws.com') || pdfUrl.includes('s3.');
          const pdfResp = await fetch(pdfUrl, isS3 ? {} : { headers: { 'Authorization': authHeader } });
          if (pdfResp.ok) {
            const blob = await pdfResp.blob();
            const buffer = await blob.arrayBuffer();
            const header = new Uint8Array(buffer, 0, 4);
            const isPdfValid = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
            if (!isPdfValid && nota.tipo === 'NFCe') {
              // NFCe — DANFE é HTML, delegar ao danfeNfce
              return Response.json({ sucesso: false, nfce_html: true, html_url: pdfUrl });
            }
            if (isPdfValid) {
              const file = new File([blob], `nota_${nota_id}.pdf`, { type: 'application/pdf' });
              const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
              pdfUrlFinal = file_url;
            }
          }
        } catch (e) {
          console.error('[PDF] Erro ao validar:', e.message);
        }
      }
      
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        pdf_url: pdfUrlFinal,
        status: 'Emitida',
        chave_acesso: data.chave_nfe || nota.chave_acesso || '',
        ...(data.numero ? { numero: String(data.numero) } : {}),
        ...(data.serie ? { serie: String(data.serie) } : {}),
      });
      return Response.json({ sucesso: true, pdf_url: pdfUrlFinal });
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