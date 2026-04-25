import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

// Busca paginada NFe recebidas usando cursor de versão
async function buscarNFesRecebidas() {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
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

// Busca paginada NFSe recebidas usando X-Max-Version header
async function buscarNFSesRecebidas() {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
    const url = `${FOCUSNFE_BASE}/nfses_recebidas?cnpj=${CNPJ_EMITENTE}&versao=${versaoCursor}`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) {
      // 400 pode significar município não integrado - retorna vazio sem erro
      break;
    }
    const lote = await resp.json().catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas = todas.concat(lote);
    // Usar X-Max-Version conforme documentação
    const maxVersionHeader = resp.headers.get('X-Max-Version');
    if (!maxVersionHeader) break;
    const maxVersao = parseInt(maxVersionHeader, 10);
    if (isNaN(maxVersao) || maxVersao <= versaoCursor) break;
    versaoCursor = maxVersao;
    if (lote.length < 100) break;
  }
  return todas;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Busca notas já existentes para evitar duplicatas
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));
    const spedyIds = new Set(notasExistentes.map(n => n.spedy_id).filter(Boolean));

    let importadas = 0;

    // ===== NFe RECEBIDAS =====
    const nfes = await buscarNFesRecebidas();
    for (const nf of nfes) {
      const chave = nf.chave_nfe || '';
      if (chave && chavesExistentes.has(chave)) continue;

      const data_emissao = (nf.data_emissao || '').substring(0, 10);

      // Filtrar ANTES de qualquer request extra — notas anteriores a 01/03/2026
      if (data_emissao && data_emissao < '2026-03-01') continue;

      const situacao = (nf.situacao || '').toLowerCase();
      const status = situacao.includes('cancel') ? 'Cancelada' : 'Importada';

      // Manifestação para liberar XML
      if (chave) {
        try {
          await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}/manifestacoes`, {
            method: 'POST',
            headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'ciencia_operacao' }),
          });
        } catch (_) {}
      }

      // Extrair número e série da chave de acesso
      let numeroNF = nf.numero || '';
      let serieNF = nf.serie || '1';
      if (!numeroNF && chave && chave.length === 44) {
        serieNF = String(parseInt(chave.substring(22, 25), 10));
        numeroNF = String(parseInt(chave.substring(25, 34), 10));
      }

      // Tentar buscar XML completo da nota
      let xmlOriginal = null;
      if (chave) {
        try {
          const xmlEndpoints = [
            `${FOCUSNFE_BASE}/nfes_recebidas/${chave}.xml`,
            `${FOCUSNFE_BASE}/nfes_recebidas/${chave}/xml`,
            `${FOCUSNFE_BASE}/download_nfe/${chave}`,
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
              const xmlData = await xmlResp.json().catch(() => null);
              candidate = xmlData?.xml || xmlData?.xml_nota || xmlData?.xml_nfe || xmlData?.xml_documento || '';
              if (!candidate && xmlData?.caminho_xml_nota_fiscal) {
                const r2 = await fetch(xmlData.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
                if (r2.ok) candidate = await r2.text();
              }
            }
            if (candidate && candidate.length > 500 && (candidate.includes('<det') || candidate.includes(':det') || candidate.includes('infNFe'))) {
              xmlOriginal = candidate.trim();
              break;
            }
          }
        } catch (_) {}
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFe',
        numero: numeroNF,
        serie: serieNF,
        status,
        chave_acesso: chave,
        cliente_nome: nf.nome_emitente || 'Fornecedor',
        cliente_cpf_cnpj: nf.documento_emitente || '',
        valor_total: parseFloat(nf.valor_total || '0'),
        data_emissao,
        observacoes: `Nota recebida via SEFAZ | Manifesto: ${nf.manifestacao_destinatario || 'pendente'}`,
        mensagem_sefaz: nf.situacao || '',
        ...(xmlOriginal ? { xml_original: xmlOriginal } : {}),
      });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    // ===== NFSe RECEBIDAS =====
    const nfses = await buscarNFSesRecebidas();
    for (const nf of nfses) {
      const chave = nf.chave || '';
      if (chave && chavesExistentes.has(chave)) continue;

      const situacao = (nf.status || '').toLowerCase();
      const status = situacao.includes('cancel') ? 'Cancelada' : 'Importada';

      const data_emissao = (nf.data_emissao || '').substring(0, 10);
      const valorTotal = parseFloat(nf.valor_servicos || '0');

      // Filtrar notas anteriores a 01/03/2026
      if (data_emissao && data_emissao < '2026-03-01') continue;

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFSe',
        numero: nf.numero || nf.numero_rps || '',
        serie: nf.serie_rps || '1',
        status,
        chave_acesso: chave,
        spedy_id: chave,
        cliente_nome: nf.nome_prestador || 'Prestador',
        cliente_cpf_cnpj: nf.documento_prestador || '',
        valor_total: valorTotal,
        data_emissao,
        pdf_url: nf.url || '',
        observacoes: `NFSe recebida via SEFAZ | Município: ${nf.nome_municipio || ''} ${nf.sigla_uf || ''}`,
        mensagem_sefaz: nf.status || '',
      });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    return Response.json({
      sucesso: true,
      mensagem: importadas > 0
        ? `${importadas} nota(s) importada(s) da SEFAZ (NFe: ${nfes.length} consultadas, NFSe: ${nfses.length} consultadas).`
        : `Nenhuma nota nova encontrada. NFe consultadas: ${nfes.length}, NFSe consultadas: ${nfses.length}.`,
      importadas,
      nfes_consultadas: nfes.length,
      nfses_consultadas: nfses.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});