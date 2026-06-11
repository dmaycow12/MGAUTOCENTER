import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const STATUS_CANCELADO = ['cancelado', 'cancelada', 'inutilizado', 'denegado'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { chave_acesso, nota_id } = body;

  if (!chave_acesso) {
    return Response.json({ sucesso: false, erro: 'chave_acesso é obrigatória' });
  }

  // Passo 1: manifestação para liberar XML completo na SEFAZ
   try {
     await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}/manifestacoes`, {
       method: 'POST',
       headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
       body: JSON.stringify({ tipo: 'ciencia_operacao' }),
     });
   } catch (_) {}

   // Passo 2: Retry com backoff para notas recém-emitidas
   const endpoints = [
     `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}.xml`,
     `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}/xml`,
     `${FOCUSNFE_BASE}/download_nfe/${chave_acesso}`,
     `${FOCUSNFE_BASE}/nfes_recebidas/${chave_acesso}`,
   ];

   let xml = '';
   const maxTentativas = 4;
   const delays = [2000, 3000, 4000, 5000]; // Progressivo: 2s, 3s, 4s, 5s

   for (let tentativa = 0; tentativa < maxTentativas && !xml; tentativa++) {
     if (tentativa > 0) {
       await new Promise(r => setTimeout(r, delays[tentativa - 1]));
     }

     for (const url of endpoints) {
       try {
         const resp = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
         if (!resp.ok) continue;
         const ct = resp.headers.get('content-type') || '';
         let candidate = '';
         if (ct.includes('xml')) {
           candidate = await resp.text();
           // Detectar cancelamento no XML
           if (candidate && (candidate.includes('<evCanc') || candidate.includes('110111') || candidate.includes('Cancelamento'))) {
             if (nota_id) {
               await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Cancelada' });
             }
             return Response.json({ sucesso: false, cancelada: true, erro: 'Nota cancelada pelo fornecedor. Status atualizado para Cancelada.' });
           }
         } else {
           const data = await resp.json().catch(() => ({}));

           // Detectar cancelamento no JSON da Focus NFe
           const situacao = (data.situacao || data.status || data.status_sefaz || '').toLowerCase();
           if (STATUS_CANCELADO.some(s => situacao.includes(s))) {
             if (nota_id) {
               await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Cancelada' });
             }
             return Response.json({ sucesso: false, cancelada: true, erro: 'Nota cancelada pelo fornecedor. Status atualizado para Cancelada.' });
           }

           candidate = data.xml || data.xml_nota || data.xml_nfe || '';
           if (!candidate && data.caminho_xml_nota_fiscal) {
             const r2 = await fetch(data.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
             if (r2.ok) candidate = await r2.text();
           }
         }
         // Aceita apenas XML completo com dados de itens (não apenas resumo resNFe)
         if (candidate && candidate.length > 500 && (
           candidate.includes('infNFe') || candidate.includes('nfeProc') || candidate.includes('<det') || candidate.includes(':det')
         )) {
           xml = candidate;
           break;
         }
       } catch (_) {}
     }
   }

  if (!xml) {
    return Response.json({
      sucesso: false,
      erro: 'XML completo ainda não disponível na SEFAZ. Clique no ícone de upload (↑) na tabela para tentar novamente ou importe manualmente.'
    });
  }

  // Detectar cancelamento no XML encontrado
  if (xml.includes('<evCanc') || xml.includes('110111')) {
    if (nota_id) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { status: 'Cancelada' });
    }
    return Response.json({ sucesso: false, cancelada: true, erro: 'Nota cancelada pelo fornecedor. Status atualizado para Cancelada.' });
  }

  // Salva XML na nota
  if (nota_id) {
    try {
      if (xml.length <= 50000) {
        await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_original: xml });
      } else {
        const blob = new Blob([xml], { type: 'text/xml' });
        const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        if (uploadResp?.file_url) {
          await base44.asServiceRole.entities.NotaFiscal.update(nota_id, { xml_url: uploadResp.file_url });
        }
      }
    } catch (_) {}
  }

  return Response.json({ sucesso: true, xml });
});