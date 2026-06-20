import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';

function gerarHtmlDanfseLocal(nf, notaId) {
  const fmt = (v) => v ? String(v) : '—';
  const fmtMoeda = (v) => v ? `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00';
  const fmtData = (v) => { if (!v) return '—'; const d = v.substring(0, 10); const [ano, mes, dia] = d.split('-'); return `${dia}/${mes}/${ano}`; };
  const fmtCnpj = (v) => { if (!v) return '—'; const c = v.replace(/\D/g, ''); if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); return v; };
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#000;background:#fff;padding:20px}.titulo{text-align:center;font-size:14px;font-weight:bold;margin-bottom:4px;border-bottom:2px solid #000;padding-bottom:6px}.subtitulo{text-align:center;font-size:11px;color:#444;margin-bottom:14px}.secao{border:1px solid #999;border-radius:4px;margin-bottom:10px}.secao-titulo{background:#e8e8e8;font-weight:bold;font-size:9px;padding:3px 8px;text-transform:uppercase;border-bottom:1px solid #999}.secao-corpo{padding:8px}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px}.campo label{font-size:8px;color:#666;display:block;text-transform:uppercase;margin-bottom:2px}.campo span{font-size:10px;font-weight:500}.destaque{background:#f9f9f9;border:1px solid #ddd;border-radius:4px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-top:4px}.chave{font-family:monospace;font-size:8px;word-break:break-all;background:#f0f0f0;padding:4px 6px;border-radius:3px}.rodape{text-align:center;font-size:8px;color:#888;margin-top:12px;border-top:1px solid #ccc;padding-top:8px}</style></head><body>
  <div class="titulo">DANFSe — DOCUMENTO AUXILIAR DA NOTA FISCAL DE SERVIÇOS ELETRÔNICA</div>
  <div class="subtitulo">Nota Fiscal de Serviços Nacional — NFS-e</div>
  <div class="secao"><div class="secao-titulo">Identificação</div><div class="secao-corpo"><div class="grid-4">
    <div class="campo"><label>Número NFS-e</label><span>${fmt(nf.numero || nf.numero_dfse)}</span></div>
    <div class="campo"><label>Data de Emissão</label><span>${fmtData(nf.data_emissao)}</span></div>
    <div class="campo"><label>Data de Competência</label><span>${fmtData(nf.data_competencia)}</span></div>
    <div class="campo"><label>Município Emissor</label><span>${fmt(nf.descricao_municipio_emissor)} - ${fmt(nf.uf_emitente)}</span></div>
  </div>${nf.id_tag ? `<div class="campo" style="margin-top:8px"><label>Chave de Acesso</label><div class="chave">${fmt(nf.id_tag)}</div></div>` : ''}</div></div>
  <div class="secao"><div class="secao-titulo">Prestador</div><div class="secao-corpo"><div class="grid-2">
    <div class="campo"><label>Razão Social</label><span>${fmt(nf.razao_social_prestador || nf.razao_social_emitente)}</span></div>
    <div class="campo"><label>CNPJ</label><span>${fmtCnpj(nf.cnpj_prestador || nf.cnpj_emitente)}</span></div>
    <div class="campo"><label>Inscrição Municipal</label><span>${fmt(nf.inscricao_municipal_prestador || nf.inscricao_municipal_emitente)}</span></div>
    <div class="campo"><label>E-mail</label><span>${fmt(nf.email_prestador || nf.email_emitente)}</span></div>
  </div></div></div>
  <div class="secao"><div class="secao-titulo">Tomador</div><div class="secao-corpo"><div class="grid-2">
    <div class="campo"><label>Razão Social</label><span>${fmt(nf.razao_social_tomador)}</span></div>
    <div class="campo"><label>CNPJ</label><span>${fmtCnpj(nf.cnpj_tomador || nf.cpf_tomador)}</span></div>
    <div class="campo"><label>Município</label><span>${fmt(nf.descricao_municipio_tomador)}</span></div>
    <div class="campo"><label>E-mail</label><span>${fmt(nf.email_tomador)}</span></div>
  </div></div></div>
  <div class="secao"><div class="secao-titulo">Serviço</div><div class="secao-corpo">
    <div class="campo" style="margin-bottom:8px"><label>Descrição</label><span>${fmt(nf.descricao_servico)}</span></div>
    <div class="grid-3">
      <div class="campo"><label>Tributação Nacional</label><span>${fmt(nf.descricao_tributacao_nacional)}</span></div>
      <div class="campo"><label>Município Prestação</label><span>${fmt(nf.descricao_municipio_prestacao)}</span></div>
      <div class="campo"><label>Tributação ISS</label><span>${fmt(nf.tributacao_iss)}</span></div>
    </div>
    ${nf.informacoes_complementares ? `<div class="campo" style="margin-top:6px"><label>Informações Complementares</label><span>${fmt(nf.informacoes_complementares)}</span></div>` : ''}
  </div></div>
  <div class="secao"><div class="secao-titulo">Valores</div><div class="secao-corpo"><div class="grid-4">
    <div class="campo"><label>Valor do Serviço</label><span>${fmtMoeda(nf.valor_servico)}</span></div>
    <div class="campo"><label>Base Cálculo ISS</label><span>${fmtMoeda(nf.iss_base_calculo)}</span></div>
    <div class="campo"><label>Deduções</label><span>${fmtMoeda(nf.valor_deducao_servico || nf.valor_deducao_iss)}</span></div>
    <div class="campo"><label>Retenções</label><span>${fmtMoeda(nf.valor_total_retencao)}</span></div>
  </div><div class="destaque"><span style="font-weight:bold;font-size:11px">VALOR LÍQUIDO</span><span style="font-size:16px;font-weight:bold">${fmtMoeda(nf.valor_liquido || nf.valor_servico)}</span></div></div></div>
  <div class="rodape">Documento gerado pelo sistema | Consulte a autenticidade em nfse.gov.br</div>
</body></html>`;
}
let API_KEY = '';
let AUTH_HEADER = '';

async function buscarNFSesRecebidas(cnpjEmitente) {
  let todas = [];
  let versaoCursor = 0;
  for (let i = 0; i < 40; i++) {
    const url = `${FOCUSNFE_BASE}/nfsens_recebidas?cnpj=${cnpjEmitente}&versao=${versaoCursor}&completa=1`;
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

// Gera um XML simples com os dados da NFSe Nacional
function gerarXmlNfse(nf) {
  const esc = (v) => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSeNacional>
  <IdentificacaoNFSe>
    <Numero>${esc(nf.numero_dfse || nf.numero)}</Numero>
    <ChaveAcesso>${esc(nf.id_tag)}</ChaveAcesso>
    <DataEmissao>${esc(nf.data_emissao)}</DataEmissao>
    <DataCompetencia>${esc(nf.data_competencia)}</DataCompetencia>
  </IdentificacaoNFSe>
  <Prestador>
    <CNPJ>${esc(nf.cnpj_prestador)}</CNPJ>
    <RazaoSocial>${esc(nf.razao_social_prestador)}</RazaoSocial>
    <NomeFantasia>${esc(nf.nome_fantasia_emitente)}</NomeFantasia>
    <Municipio>${esc(nf.descricao_municipio_emissor)}</Municipio>
    <UF>${esc(nf.uf_emitente)}</UF>
    <Email>${esc(nf.email_prestador)}</Email>
  </Prestador>
  <Tomador>
    <CNPJ>${esc(nf.cnpj_tomador)}</CNPJ>
    <CPF>${esc(nf.cpf_tomador)}</CPF>
    <RazaoSocial>${esc(nf.razao_social_tomador)}</RazaoSocial>
    <Municipio>${esc(nf.codigo_municipio_tomador)}</Municipio>
  </Tomador>
  <Servico>
    <Descricao>${esc(nf.descricao_servico)}</Descricao>
    <DescricaoTributacaoNacional>${esc(nf.descricao_tributacao_nacional)}</DescricaoTributacaoNacional>
    <InformacoesComplementares>${esc(nf.informacoes_complementares)}</InformacoesComplementares>
    <ValorServico>${esc(nf.valor_servico)}</ValorServico>
    <ValorLiquido>${esc(nf.valor_liquido)}</ValorLiquido>
    <BaseCalculoISS>${esc(nf.iss_base_calculo)}</BaseCalculoISS>
  </Servico>
</NFSeNacional>`;
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

    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    const { notas: nfses, erro } = await buscarNFSesRecebidas(CNPJ_EMITENTE);

    if (erro && nfses.length === 0) {
      return Response.json({ sucesso: false, erro });
    }

    let importadas = 0;
    let atualizadas = 0;
    const notasParaPdf = [];

    for (const nf of nfses) {
      const chave = nf.numero_dfse || nf.id_tag || '';
      const situacao = (nf.status_mensagem || '').toLowerCase();
      const status = situacao.includes('cancel') ? 'Cancelada' : 'Importada';
      const data_emissao = (nf.data_emissao || nf.data_competencia || '').substring(0, 10);
      const valorTotal = parseFloat(nf.valor_servico || nf.valor_liquido || '0');

      if (data_emissao && data_emissao < '2026-04-01') continue;

      const nomePrestador = nf.razao_social_prestador || nf.razao_social_emitente || nf.nome_fantasia_emitente || nf.emitente_dps || '';
      const docPrestador = nf.cnpj_prestador || nf.cpf_prestador || nf.cnpj_emitente || '';
      const descricaoServico = nf.descricao_servico || nf.descricao_tributacao_nacional || '';
      const municipio = nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor || '';

      let arquivosParaSalvar = {};
      try {
        const xmlText = gerarXmlNfse(nf);
        arquivosParaSalvar.xml_original = xmlText;
      } catch (_) {}

      // PDF será gerado após criar a nota via gerarDanfseRecebida

      if (chave && chavesExistentes.has(chave)) {
        const notaExistente = notasExistentes.find(n => n.chave_acesso === chave);
        if (notaExistente) {
          const updates = {};
          if (!notaExistente.xml_original && arquivosParaSalvar.xml_original) updates.xml_original = arquivosParaSalvar.xml_original;
          if (!notaExistente.pdf_url && arquivosParaSalvar.pdf_url) updates.pdf_url = arquivosParaSalvar.pdf_url;
          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.NotaFiscal.update(notaExistente.id, updates);
            atualizadas++;
          }
        }
        continue;
      }

      const novaNota = await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFSe',
        numero: nf.numero_dfse || nf.numero || '',
        serie: nf.serie_dps || '1',
        status,
        chave_acesso: chave,
        spedy_id: chave,
        cliente_nome: nomePrestador,
        cliente_cpf_cnpj: docPrestador,
        valor_total: valorTotal,
        data_emissao,
        observacoes: [
          descricaoServico ? `Serviço: ${descricaoServico}` : null,
          municipio ? `Município: ${municipio}` : null,
        ].filter(Boolean).join(' | '),
        mensagem_sefaz: nf.status_mensagem || '',
        ...arquivosParaSalvar,
      });

      // Guarda dados da NF para gerar PDF depois
      console.log('[PDF] Adicionando nota para PDF:', novaNota.id);
      notasParaPdf.push({ nf, id: novaNota.id });

      importadas++;
      if (chave) chavesExistentes.add(chave);
    }

    // Gera HTML das DANFSe e salva como pdf_url (HTML renderizável pelo browser)
    let pdfsGerados = 0;
    for (const { nf, id } of notasParaPdf) {
      try {
        const htmlContent = gerarHtmlDanfseLocal(nf, id);
        const htmlBlob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
        const htmlFile = new File([htmlBlob], `danfse_${id}.html`, { type: 'text/html' });
        const { file_url: htmlUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: htmlFile });
        await base44.asServiceRole.entities.NotaFiscal.update(id, { pdf_url: htmlUrl });
        pdfsGerados++;
      } catch (pdfErr) {
        console.error('[PDF] Exceção:', pdfErr.message);
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: [
        importadas > 0 ? `${importadas} NFSe(s) importada(s).` : null,
        atualizadas > 0 ? `${atualizadas} NFSe(s) atualizada(s) com XML.` : null,
        importadas === 0 && atualizadas === 0 ? `Nenhuma NFSe nova. ${nfses.length} nota(s) consultada(s).` : null,
        erro ? `Aviso: ${erro}` : null,
      ].filter(Boolean).join(' '),
      importadas,
      atualizadas,
      pdfsGerados,
      consultadas: nfses.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});