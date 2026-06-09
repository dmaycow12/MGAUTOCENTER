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
    const caminhoHtml = nota.xml_url;
     console.log(`[CONSULTA NOTA] ID: ${nota_id}, Tipo: ${nota.tipo}, Status: ${nota.status}, spedy_id: ${ref}, xml_url: ${caminhoHtml}, pdf_url: ${nota.pdf_url}`);

     // Se tem caminho da DANFE guardado, tenta buscar direto (mais confiável)
     if (caminhoHtml && nota.status === 'Homologada') {
       console.log(`[CONSULTA] Tentando buscar DANFE direto de: ${caminhoHtml}`);
       try {
         // O caminho já vem com https://, é direto do S3 da Focus
         const pdfResp = await fetch(caminhoHtml, { headers: { 'Authorization': AUTH_HEADER_HOM } });
         if (pdfResp.ok) {
           const blob = await pdfResp.blob();
           const file = new File([blob], `nota_${nota_id}.pdf`, { type: 'application/pdf' });
           const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
           return Response.json({ sucesso: true, pdf_url: file_url });
         } else {
           console.log(`[CONSULTA] Erro ao buscar DANFE direto: ${pdfResp.status}`);
         }
       } catch (e) {
         console.log(`[CONSULTA] Exception ao buscar DANFE: ${e.message}`);
       }
     }

     // Se não tem caminhoHtml e não tem nota emitida (chave_acesso), não conseguimos recuperar
     if (!caminhoHtml && !nota.chave_acesso) {
       return Response.json({ 
         processando: false, 
         erro: 'Nota sem caminho de DANFE guardado e sem chave de acesso. Consulte o status da nota em "Configurações" ou tente emitir novamente.',
         status_nota: nota.status 
       });
     }

     // Se tem chave de acesso (nota autorizada), tenta consultar pelo número + série
     let data = null;
     if (nota.numero && nota.serie) {
       const ep = endpointPorTipo(nota.tipo || 'NFe');
       const searchRef = `${nota.numero}-${nota.serie}`;

       const baseUrl = FOCUSNFE_BASE_PROD;
       const authHeader = AUTH_HEADER_PROD;
       const fullUrl = `${baseUrl}/${ep}/${searchRef}?completo=1`;

       console.log(`[CONSULTA CHAVE] Tentando buscar por número-série: ${fullUrl}`);
       const resp = await fetch(fullUrl, { headers: { 'Authorization': authHeader } });

       if (resp.ok) {
         data = await resp.json();
         console.log(`[CONSULTA CHAVE] Sucesso em produção, status:`, data.status);
       } else {
         console.log(`[CONSULTA CHAVE] Erro: ${resp.status}`);
       }
     }

    // Se conseguiu buscar nota por número-série
    if (data && data.status === 'autorizado') {
      let pdfUrlFinal = '';
      const rawPdf = data.caminho_pdf_nfsen || data.caminho_pdf_nfse || data.caminho_danfe || data.caminho_pdf_nfce || '';
      if (rawPdf) {
        const pdfUrl = normalizarUrl(rawPdf);
        try {
          const pdfResp = await fetch(pdfUrl, { headers: { 'Authorization': AUTH_HEADER_PROD } });
          if (pdfResp.ok) {
            const blob = await pdfResp.blob();
            const file = new File([blob], `nota_${nota_id}.pdf`, { type: 'application/pdf' });
            const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
            pdfUrlFinal = file_url;
          }
        } catch (e) {
          console.error('[PDF] Erro ao validar:', e.message);
        }
      }

      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, {
        pdf_url: pdfUrlFinal,
        status: 'Emitida',
        chave_acesso: data.chave_nfe || nota.chave_acesso || '',
      });
      return Response.json({ sucesso: true, pdf_url: pdfUrlFinal });
    }

    // Se não conseguiu buscar por número-série, ao menos tenta retornar o xml_url que já tem guardado
    if (caminhoHtml) {
      console.log(`[CONSULTA] Retornando xml_url guardado: ${caminhoHtml}`);
      return Response.json({ sucesso: true, pdf_url: caminhoHtml, aviso: 'Retornando URL de homologação guardada' });
    }

    return Response.json({ 
      erro: 'Não foi possível recuperar a DANFE. Consulte o status da nota em Configurações.',
      status_nota: nota.status 
    });

  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});