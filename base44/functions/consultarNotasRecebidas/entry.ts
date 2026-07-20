import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
let API_KEY = '';
let AUTH_HEADER = '';

// Chaves de notas bloqueadas para re-importação (ex: notas canceladas removidas manualmente)
const CHAVES_BLOQUEADAS = new Set([
  '31260542580092005305551700000509431243551811', // NFe 50943 - CIA BRASILEIRA DIST AUTO S.A
]);

// Busca paginada NFe recebidas usando cursor de versão
async function buscarNFesRecebidas(cnpjEmitente) {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
    const url = `${FOCUSNFE_BASE}/nfes_recebidas?cnpj=${cnpjEmitente}&versao=${versaoCursor}`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) break;
    const lote = await resp.json().catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas = todas.concat(lote);
    const maxVersao = Math.max(...lote.map(n => n.versao || 0));
    if (maxVersao <= versaoCursor) break;
    versaoCursor = maxVersao + 1;
    if (lote.length < 50) break;
  }
  return todas;
}

// Busca paginada NFSe recebidas usando X-Max-Version header
async function buscarNFSesRecebidas(cnpjEmitente) {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
    const url = `${FOCUSNFE_BASE}/nfses_recebidas?cnpj=${cnpjEmitente}&versao=${versaoCursor}`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) break;
    const lote = await resp.json().catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas = todas.concat(lote);
    const maxVersionHeader = resp.headers.get('X-Max-Version');
    if (!maxVersionHeader) break;
    const maxVersao = parseInt(maxVersionHeader, 10);
    if (isNaN(maxVersao) || maxVersao <= versaoCursor) break;
    versaoCursor = maxVersao + 1;
    if (lote.length < 100) break;
  }
  return todas;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Carrega CNPJ e API KEY das configurações
    const allConfigs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const getConf = (chave, padrao = '') => allConfigs.find(c => c.chave === chave)?.valor || padrao;
    API_KEY = getConf('focusnfe_api_key_producao', '');
    AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
    const CNPJ_EMITENTE = getConf('cnpj', '').replace(/\D/g, '');
    if (!CNPJ_EMITENTE) return Response.json({ sucesso: false, erro: 'CNPJ da empresa não configurado' }, { status: 400 });

    // Busca notas já existentes para evitar duplicatas
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));
    // Mapa chave -> nota existente (para atualizar XML/PDF faltantes em notas já importadas)
    const notasPorChave = new Map();
    for (const n of notasExistentes) {
      if (n.chave_acesso && !notasPorChave.has(n.chave_acesso)) notasPorChave.set(n.chave_acesso, n);
    }

    let importadas = 0;
    let atualizadas = 0;
    // Notas já importadas mas sem XML/PDF serão atualizadas na reimportação

    // ===== NFe RECEBIDAS =====
    const nfes = await buscarNFesRecebidas(CNPJ_EMITENTE);
    for (const nf of nfes) {
      const chave = nf.chave_nfe || '';
      if (chave && CHAVES_BLOQUEADAS.has(chave)) continue; // Bloqueada para re-importação

      const data_emissao = (nf.data_emissao || '').substring(0, 10);
      if (data_emissao && data_emissao < '2026-04-01') continue;

      const situacao = (nf.situacao || '').toLowerCase();
      if (situacao.includes('cancel')) continue; // Não importa notas canceladas
      const status = 'Importada';

      // Verifica se a nota já existe no banco
      let notaExistente = chave ? (notasPorChave.get(chave) || null) : null;

      // Se já existe e já tem XML e PDF, pula
      if (notaExistente && notaExistente.xml_url && notaExistente.pdf_url) {
        if (chave) chavesExistentes.add(chave);
        continue;
      }

      // Envia manifestação apenas para notas novas (fire-and-forget, sem esperar)
      if (chave && !notaExistente) {
        try {
          await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}/manifestacoes`, {
            method: 'POST',
            headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'ciencia_operacao' }),
          });
        } catch (_) {}
      }

      let numeroNF = nf.numero || '';
      let serieNF = nf.serie || '1';
      if (!numeroNF && chave && chave.length === 44) {
        serieNF = String(parseInt(chave.substring(22, 25), 10));
        numeroNF = String(parseInt(chave.substring(25, 34), 10));
      }

      // Tenta baixar XML apenas se estiver faltando na nota existente (ou é nota nova)
      const precisaXml = !notaExistente || !notaExistente.xml_url;
      let xmlParaSalvar = {};
      if (chave && precisaXml) {
        try {
          const xmlResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}.xml`, { headers: { 'Authorization': AUTH_HEADER } });
          if (xmlResp.ok) {
            const ct = xmlResp.headers.get('content-type') || '';
            let candidate = '';
            if (ct.includes('xml')) {
              candidate = await xmlResp.text();
            } else {
              const xmlData = await xmlResp.json().catch(() => ({}));
              candidate = xmlData.xml || xmlData.xml_nota || xmlData.xml_nfe || '';
            }
            if (candidate && candidate.length > 500 && (candidate.includes('infNFe') || candidate.includes('nfeProc') || candidate.includes('<det'))) {
              const xmlFile = new File([candidate], `NF-${numeroNF || chave}.xml`, { type: 'text/xml' });
              const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });
              if (uploadResp?.file_url) {
                xmlParaSalvar = { xml_url: uploadResp.file_url, xml_original_url: uploadResp.file_url };
              }
            }
          }
        } catch (_) {}
      }

      // Tenta baixar PDF apenas se estiver faltando na nota existente (ou é nota nova)
      const precisaPdf = !notaExistente || !notaExistente.pdf_url;
      let pdfParaSalvar = {};
      if (chave && precisaPdf) {
        try {
          const danfeResp = await fetch(`${FOCUSNFE_BASE}/nfes_recebidas/${chave}.pdf`, { headers: { 'Authorization': AUTH_HEADER } });
          if (danfeResp.ok) {
            const ct = danfeResp.headers.get('content-type') || '';
            if (ct.includes('pdf') || ct.includes('octet')) {
              const blob = await danfeResp.blob();
              const pdfFile = new File([blob], `NF-${numeroNF || chave}.pdf`, { type: 'application/pdf' });
              const uploadPdf = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
              if (uploadPdf?.file_url) pdfParaSalvar = { pdf_url: uploadPdf.file_url };
            }
          }
        } catch (_) {}
      }

      // Se a nota já existe, atualiza XML/PDF que foram baixados
      if (notaExistente) {
        const updateData = {};
        if (xmlParaSalvar.xml_url) { updateData.xml_url = xmlParaSalvar.xml_url; updateData.xml_original_url = xmlParaSalvar.xml_original_url; }
        if (pdfParaSalvar.pdf_url) { updateData.pdf_url = pdfParaSalvar.pdf_url; }
        if (Object.keys(updateData).length > 0) {
          await base44.asServiceRole.entities.NotaFiscal.update(notaExistente.id, updateData);
          atualizadas++;
        }
        if (chave) chavesExistentes.add(chave);
        continue;
      }

      // Re-verifica no banco logo antes de criar (evita duplicata se outra importação rodou em paralelo)
      if (chave) {
        const jaExiste = await base44.asServiceRole.entities.NotaFiscal.filter({ chave_acesso: chave }, '-created_date', 1);
        if (jaExiste && jaExiste.length > 0) { chavesExistentes.add(chave); continue; }
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFe',
        numero: numeroNF,
        serie: serieNF,
        status,
        chave_acesso: chave,
        cliente_nome: (nf.nome_emitente || 'Fornecedor').toUpperCase(),
        cliente_cpf_cnpj: nf.documento_emitente || '',
        valor_total: parseFloat(nf.valor_total || '0'),
        data_emissao,
        observacoes: `Nota recebida via SEFAZ | Manifesto: ${nf.manifestacao_destinatario || 'pendente'}`,
        mensagem_sefaz: nf.situacao || '',
        ...xmlParaSalvar,
        ...pdfParaSalvar,
      });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    // ===== NFSe RECEBIDAS =====
    const nfses = await buscarNFSesRecebidas(CNPJ_EMITENTE);
    for (const nf of nfses) {
      const chave = nf.chave || '';

      const situacao = (nf.status || '').toLowerCase();
      if (situacao.includes('cancel')) continue; // Não importa notas canceladas
      const status = 'Importada';

      const data_emissao = (nf.data_emissao || '').substring(0, 10);
      const valorTotal = parseFloat(nf.valor_servicos || '0');

      if (data_emissao && data_emissao < '2026-04-01') continue;

      // Verifica se a nota já existe no banco
      let notaExistente = chave ? (notasPorChave.get(chave) || null) : null;

      // Se já existe e já tem PDF, pula
      if (notaExistente && notaExistente.pdf_url) {
        if (chave) chavesExistentes.add(chave);
        continue;
      }

      // Baixa PDF apenas se estiver faltando (ou é nota nova)
      let pdfNFSe = nf.url || '';
      if (!pdfNFSe && chave) {
        try {
          const danfeResp = await fetch(`${FOCUSNFE_BASE}/nfses_recebidas/${chave}.pdf`, { headers: { 'Authorization': AUTH_HEADER } });
          if (danfeResp.ok) {
            const ct = danfeResp.headers.get('content-type') || '';
            if (ct.includes('pdf') || ct.includes('octet')) {
              const blob = await danfeResp.blob();
              const pdfFile = new File([blob], `NFSe-${nf.numero || chave}.pdf`, { type: 'application/pdf' });
              const uploadPdf = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
              if (uploadPdf?.file_url) pdfNFSe = uploadPdf.file_url;
            }
          }
        } catch (_) {}
      }

      // Se a nota já existe, atualiza o PDF que foi baixado
      if (notaExistente) {
        if (pdfNFSe) {
          await base44.asServiceRole.entities.NotaFiscal.update(notaExistente.id, { pdf_url: pdfNFSe });
          atualizadas++;
        }
        if (chave) chavesExistentes.add(chave);
        continue;
      }

      // Re-verifica no banco logo antes de criar (evita duplicata se outra importação rodou em paralelo)
      if (chave) {
        const jaExiste = await base44.asServiceRole.entities.NotaFiscal.filter({ chave_acesso: chave }, '-created_date', 1);
        if (jaExiste && jaExiste.length > 0) { chavesExistentes.add(chave); continue; }
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFSe',
        numero: nf.numero || nf.numero_rps || '',
        serie: nf.serie_rps || '1',
        status,
        chave_acesso: chave,
        spedy_id: chave,
        cliente_nome: (nf.nome_prestador || 'Prestador').toUpperCase(),
        cliente_cpf_cnpj: nf.documento_prestador || '',
        valor_total: valorTotal,
        data_emissao,
        pdf_url: pdfNFSe,
        observacoes: `NFSe recebida via SEFAZ | Município: ${nf.nome_municipio || ''} ${nf.sigla_uf || ''}`,
        mensagem_sefaz: nf.status || '',
      });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    return Response.json({
      sucesso: true,
      mensagem: `${importadas} nota(s) importada(s) e ${atualizadas} nota(s) com XML/PDF atualizado(s). NFe: ${nfes.length}, NFSe: ${nfses.length} consultadas.`,
      importadas,
      atualizadas,
      nfes_consultadas: nfes.length,
      nfses_consultadas: nfses.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});