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

// Busca paginada NFSe recebidas usando cursor de versão
async function buscarNFSesRecebidas() {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
    const url = `${FOCUSNFE_BASE}/nfses_recebidas?cnpj=${CNPJ_EMITENTE}&versao=${versaoCursor}`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) break;
    const lote = await resp.json().catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas = todas.concat(lote);
    const maxVersao = Math.max(...lote.map(n => n.versao || 0));
    if (maxVersao <= versaoCursor) break;
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
          await new Promise(r => setTimeout(r, 800));
        } catch (_) {}
      }

      // Extrair número e série do XML sem salvar o conteúdo completo
      let numeroNF = '';
      let serieNF = '1';
      if (chave) {
        for (const url of [
          `${FOCUSNFE_BASE}/nfes_recebidas/${chave}.xml`,
          `${FOCUSNFE_BASE}/nfes_recebidas/${chave}`,
        ]) {
          try {
            const r = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
            if (!r.ok) continue;
            const ct = r.headers.get('content-type') || '';
            let xmlStr = '';
            if (ct.includes('xml')) {
              xmlStr = await r.text();
            } else {
              const d = await r.json().catch(() => ({}));
              xmlStr = d.xml || d.xml_nota || '';
              if (!xmlStr && d.caminho_xml_nota_fiscal) {
                const r2 = await fetch(d.caminho_xml_nota_fiscal, { headers: { 'Authorization': AUTH_HEADER } });
                if (r2.ok) xmlStr = await r2.text();
              }
            }
            if (xmlStr && xmlStr.includes('<det')) {
              const numMatch = xmlStr.match(/<nNF>(\d+)<\/nNF>/);
              const serieMatch = xmlStr.match(/<serie>(\d+)<\/serie>/);
              if (numMatch) numeroNF = numMatch[1];
              if (serieMatch) serieNF = serieMatch[1];
              break;
            }
          } catch (_) {}
        }
      }

      const data_emissao = (nf.data_emissao || '').substring(0, 10);

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