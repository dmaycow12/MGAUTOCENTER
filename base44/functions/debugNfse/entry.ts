import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

Deno.serve(async (req) => {
  try {
    // Testar endpoint com id_tag da nota 603827 (chave_acesso salva no banco)
    // chave_acesso salva: "603827" (numero_dfse)
    // Tentar buscar o id_tag da nota via banco
    const base44 = createClientFromRequest(req);
    // Buscar nota pelo ID diretamente
    const notaReg = await base44.asServiceRole.entities.NotaFiscal.get('6a0c8dcb5b0470941d93216f').catch(() => null);
    
    const xmlUrl = notaReg?.xml_url || '';
    let xmlContent = null;
    if (xmlUrl) {
      const r = await fetch(xmlUrl);
      if (r.ok) xmlContent = (await r.text()).substring(0, 500);
    }
    
    // Testar endpoints da Focus NFe usando chave_acesso e id_tag salvos
    const chaveAcesso = notaReg?.chave_acesso || '';
    const endpoints = chaveAcesso ? [
      `${FOCUSNFE_BASE}/nfsens_recebidas/${chaveAcesso}.xml`,
      `${FOCUSNFE_BASE}/nfsens_recebidas/${chaveAcesso}.pdf`,
      `${FOCUSNFE_BASE}/nfsens_recebidas/${chaveAcesso}`,
    ] : [];
    const resultados = {};
    for (const ep of endpoints) {
      const r = await fetch(ep, { headers: { 'Authorization': AUTH_HEADER } });
      const key = ep.split('/').slice(-1)[0];
      resultados[key] = { status: r.status, ct: r.headers.get('content-type') };
    }
    
    return Response.json({
      nota_banco: notaReg ? { id: notaReg.id, numero: notaReg.numero, chave_acesso: notaReg.chave_acesso, xml_url: notaReg.xml_url, pdf_url: notaReg.pdf_url } : null,
      xml_content_preview: xmlContent,
      focus_endpoints: resultados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});