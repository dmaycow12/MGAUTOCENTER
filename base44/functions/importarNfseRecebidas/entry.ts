import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

async function buscarNFSesRecebidas() {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
    const url = `${FOCUSNFE_BASE}/nfsens_recebidas?cnpj=${CNPJ_EMITENTE}&versao=${versaoCursor}&completa=1`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { notas: todas, erro: `Erro ${resp.status}: ${txt}` };
    }
    const lote = await resp.json().catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas = todas.concat(lote);
    const maxVersionHeader = resp.headers.get('X-Max-Version');
    if (!maxVersionHeader) break;
    const maxVersao = parseInt(maxVersionHeader, 10);
    if (isNaN(maxVersao) || maxVersao <= versaoCursor) break;
    versaoCursor = maxVersao;
    if (lote.length < 100) break;
  }
  return { notas: todas, erro: null };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Busca notas já existentes para evitar duplicatas
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    const { notas: nfses, erro } = await buscarNFSesRecebidas();

    if (erro && nfses.length === 0) {
      return Response.json({ sucesso: false, erro });
    }

    let importadas = 0;
    let atualizadas = 0;

    for (const nf of nfses) {
      const chave = nf.chave || '';
      const situacao = (nf.status || '').toLowerCase();
      const status = situacao.includes('cancel') ? 'Cancelada' : 'Importada';
      const data_emissao = (nf.data_emissao || '').substring(0, 10);
      const valorTotal = parseFloat(nf.valor_servicos || nf.servicos?.[0]?.valor_servicos || '0');

      // Filtrar notas anteriores a 01/03/2026
      if (data_emissao && data_emissao < '2026-03-01') continue;

      // Tentar baixar XML se url_xml disponível
      let xmlParaSalvar = {};
      if (nf.url_xml) {
        try {
          const xmlResp = await fetch(nf.url_xml, { headers: { 'Authorization': AUTH_HEADER } });
          if (xmlResp.ok) {
            const xmlText = await xmlResp.text();
            if (xmlText && xmlText.length > 100) {
              const xmlFile = new File([xmlText], `NFSe-${nf.numero || chave}.xml`, { type: 'text/xml' });
              const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });
              if (uploadResp?.file_url) xmlParaSalvar = { xml_url: uploadResp.file_url };
            }
          }
        } catch (_) {}
      }

      const nomePrestador = nf.prestador?.razao_social || nf.nome_prestador || 'Prestador';
      const docPrestador = nf.prestador?.cnpj || nf.prestador?.cpf || nf.documento_prestador || '';
      const discriminacao = nf.servicos?.[0]?.discriminacao || '';

      if (chave && chavesExistentes.has(chave)) {
        // Nota já existe — atualizar XML/PDF se estiver faltando
        const notaExistente = notasExistentes.find(n => n.chave_acesso === chave);
        if (notaExistente && !notaExistente.xml_url && xmlParaSalvar.xml_url) {
          const updates = { ...xmlParaSalvar };
          if (!notaExistente.pdf_url && nf.url) updates.pdf_url = nf.url;
          await base44.asServiceRole.entities.NotaFiscal.update(notaExistente.id, updates);
          atualizadas++;
        }
        continue;
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFSe',
        numero: nf.numero || nf.numero_rps || '',
        serie: nf.serie_rps || nf.serie || '1',
        status,
        chave_acesso: chave,
        spedy_id: chave,
        cliente_nome: nomePrestador,
        cliente_cpf_cnpj: docPrestador,
        valor_total: valorTotal,
        data_emissao,
        pdf_url: nf.url || '',
        observacoes: [
          discriminacao ? `Serviço: ${discriminacao}` : null,
          `Município: ${nf.nome_municipio || nf.prestador?.endereco?.nome_municipio || ''} ${nf.sigla_uf || nf.prestador?.endereco?.uf || ''}`,
        ].filter(Boolean).join(' | '),
        mensagem_sefaz: nf.status || '',
        ...xmlParaSalvar,
      });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    return Response.json({
      sucesso: true,
      mensagem: [
        importadas > 0 ? `${importadas} NFSe(s) importada(s).` : null,
        atualizadas > 0 ? `${atualizadas} NFSe(s) atualizada(s) com XML faltante.` : null,
        importadas === 0 && atualizadas === 0 ? `Nenhuma NFSe nova encontrada. ${nfses.length} nota(s) consultada(s).` : null,
        erro ? `Aviso: ${erro}` : null,
      ].filter(Boolean).join(' '),
      importadas,
      atualizadas,
      consultadas: nfses.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});