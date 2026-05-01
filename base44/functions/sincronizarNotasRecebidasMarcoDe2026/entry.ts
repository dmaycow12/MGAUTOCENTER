import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

// Busca paginada NFes RECEBIDAS usando cursor de versão
async function buscarNFesRecebidas() {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 50; i++) {
    const url = `${FOCUSNFE_BASE}/nfes_recebidas?cnpj=${CNPJ_EMITENTE}&versao=${versaoCursor}`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) break;
    const lote = await resp.json().catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas = todas.concat(lote);
    const maxVersao = Math.max(...lote.map(n => n.versao || 0));
    if (maxVersao <= versaoCursor) break;
    versaoCursor = maxVersao;
    if (lote.length < 50) break;
  }
  return todas;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    console.log('[RECEBIDAS MARÇO+] Iniciando busca a partir de 2026-03-01...');

    // Busca notas já existentes para evitar duplicatas
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 3000);
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    let importadas = 0;
    let xmlRecuperados = 0;
    let pdfRecuperados = 0;

    // Buscar notas recebidas
    const nfes = await buscarNFesRecebidas();
    console.log(`[RECEBIDAS] ${nfes.length} notas encontradas na Focus NFe`);

    for (const nf of nfes) {
      const chave = nf.chave_nfe || '';
      if (chave && chavesExistentes.has(chave)) {
        console.log(`[SKIP] ${chave} já existe`);
        continue;
      }

      const data_emissao = (nf.data_emissao || '').substring(0, 10);

      // Filtrar ANTES de qualquer request extra — notas a partir de 01/03/2026
      if (data_emissao && data_emissao < '2026-03-01') {
        console.log(`[SKIP] ${chave} anterior a 2026-03-01`);
        continue;
      }

      const situacao = (nf.situacao || '').toLowerCase();
      const status = situacao.includes('cancel') ? 'Cancelada' : 'Importada';

      console.log(`[PROCESSANDO] ${chave} - ${nf.nome_emitente} - ${data_emissao}`);

      // Extrair número e série da chave de acesso
      let numeroNF = nf.numero || '';
      let serieNF = nf.serie || '1';
      if (!numeroNF && chave && chave.length === 44) {
        serieNF = String(parseInt(chave.substring(22, 25), 10));
        numeroNF = String(parseInt(chave.substring(25, 34), 10));
      }

      // Tentar buscar XML completo
      let xmlOriginal = null;
      if (chave) {
        try {
          const xmlEndpoints = [
            `${FOCUSNFE_BASE}/nfes_recebidas/${chave}.xml`,
            `${FOCUSNFE_BASE}/nfes_recebidas/${chave}`,
          ];
          for (const endpoint of xmlEndpoints) {
            const xmlResp = await fetch(endpoint, { headers: { 'Authorization': AUTH_HEADER } });
            if (!xmlResp.ok) continue;
            const ct = xmlResp.headers.get('content-type') || '';
            let candidate = '';
            if (ct.includes('xml')) {
              candidate = await xmlResp.text();
            } else {
              const xmlData = await xmlResp.json().catch(() => ({}));
              candidate = xmlData.xml || xmlData.xml_nota || xmlData.xml_nfe || '';
              if (!candidate && xmlData.caminho_xml_nota_fiscal) {
                const r2 = await fetch(xmlData.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
                if (r2.ok) candidate = await r2.text();
              }
            }
            if (candidate && candidate.length > 500 && (candidate.includes('infNFe') || candidate.includes('nfeProc') || candidate.includes('<det'))) {
              xmlOriginal = candidate;
              console.log(`[XML] ${chave} recuperado (${candidate.length} bytes)`);
              break;
            }
          }
        } catch (e) {
          console.error(`[XML ERROR] ${chave}:`, e.message);
        }
      }

      // Salvar XML sempre via upload de arquivo
      let xmlParaSalvar = {};
      if (xmlOriginal) {
        try {
          const xmlFile = new File([xmlOriginal], `entrada_${numeroNF || chave}.xml`, { type: 'text/xml' });
          const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });
          if (uploadResp?.file_url) {
            xmlParaSalvar = { xml_url: uploadResp.file_url };
            xmlRecuperados++;
            console.log(`[XML SALVO] ${chave}`);
          }
        } catch (e) {
          console.error(`[UPLOAD XML ERROR] ${chave}:`, e.message);
        }
      }

      // Buscar DANFE (PDF) da nota de entrada
      let pdfParaSalvar = {};
      if (chave) {
        try {
          const danfeResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}.pdf`, {
            headers: { 'Authorization': AUTH_HEADER },
          });
          if (danfeResp.ok) {
            const ct = danfeResp.headers.get('content-type') || '';
            if (ct.includes('pdf') || ct.includes('octet')) {
              const blob = await danfeResp.blob();
              if (blob.size > 0) {
                const pdfFile = new File([blob], `entrada_${numeroNF || chave}.pdf`, { type: 'application/pdf' });
                const uploadPdf = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
                if (uploadPdf?.file_url) {
                  pdfParaSalvar = { pdf_url: uploadPdf.file_url };
                  pdfRecuperados++;
                  console.log(`[PDF SALVO] ${chave} (${blob.size} bytes)`);
                }
              }
            }
          }
        } catch (e) {
          console.error(`[PDF ERROR] ${chave}:`, e.message);
        }
      }

      // Buscar fornecedor vinculado
      let cliente_id = null;
      const doc = nf.documento_emitente || nf.cnpj_emitente || '';
      if (doc) {
        try {
          const cRes = await base44.asServiceRole.entities.Cadastro.filter(
            { cpf_cnpj: doc.replace(/\D/g, '') },
            '-created_date',
            1
          );
          if (cRes.length > 0) cliente_id = cRes[0].id;
        } catch (_) {}
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFe',
        numero: numeroNF,
        serie: serieNF,
        status,
        chave_acesso: chave,
        spedy_id: nf.referencia || chave,
        cliente_nome: nf.nome_emitente || 'Fornecedor',
        cliente_cpf_cnpj: doc,
        cliente_id,
        valor_total: parseFloat(nf.valor_total || '0'),
        data_emissao,
        observacoes: `Nota de entrada sincronizada de ${data_emissao} | Status SEFAZ: ${nf.situacao || ''}`,
        ...xmlParaSalvar,
        ...pdfParaSalvar,
      });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    const resultado = {
      sucesso: true,
      mensagem: `Sincronização de notas de entrada concluída a partir de 2026-03-01`,
      encontradas: nfes.length,
      importadas,
      xmlRecuperados,
      pdfRecuperados,
    };

    console.log('[RECEBIDAS] Resultado:', resultado);

    return Response.json(resultado);
  } catch (error) {
    console.error('[ERRO]', error);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});