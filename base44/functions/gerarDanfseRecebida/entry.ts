import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';

function gerarHtmlDanfse(nf) {
  const fmt = (v) => (v != null && v !== '') ? String(v) : '—';
  const fmtMoeda = (v) => v ? `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const fmtData = (v) => { if (!v) return '—'; const d = v.substring(0, 10); const [ano, mes, dia] = d.split('-'); return `${dia}/${mes}/${ano}`; };
  const fmtDataHora = (v) => { if (!v) return '—'; const [data, hora] = v.split('T'); if (!data) return '—'; const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}${hora ? ' ' + hora.substring(0, 8) : ''}`; };
  const fmtCnpj = (v) => { if (!v) return '—'; const c = v.replace(/\D/g, ''); if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); return v; };
  const fmtCep = (v) => { if (!v) return '—'; const c = v.replace(/\D/g, ''); if (c.length === 8) return c.replace(/(\d{5})(\d{3})/, '$1-$2'); return v; };

  const prestNome = fmt(nf.razao_social_prestador || nf.razao_social_emitente);
  const prestCnpj = fmtCnpj(nf.cnpj_prestador || nf.cnpj_emitente || nf.cpf_prestador);
  const prestIm = fmt(nf.inscricao_municipal_prestador || nf.inscricao_municipal_emitente);
  const prestEmail = fmt(nf.email_prestador || nf.email_emitente);
  const prestFone = fmt(nf.telefone_prestador || nf.fone_prestador);
  const prestEnd = [nf.logradouro_prestador || nf.logradouro_emitente, nf.numero_prestador || nf.numero_emitente, nf.bairro_prestador || nf.bairro_emitente].filter(Boolean).join(', ') || '-';
  const prestMunicipio = fmt(nf.descricao_municipio_prestador || nf.descricao_municipio_emissor);
  const prestUf = fmt(nf.uf_prestador || nf.uf_emitente);
  const prestCep = fmtCep(nf.cep_prestador || nf.cep_emitente);

  const tomNome = fmt(nf.razao_social_tomador);
  const tomCnpj = fmtCnpj(nf.cnpj_tomador || nf.cpf_tomador);
  const tomIm = fmt(nf.inscricao_municipal_tomador);
  const tomEmail = fmt(nf.email_tomador);
  const tomFone = fmt(nf.telefone_tomador);
  const tomEnd = [nf.logradouro_tomador, nf.numero_tomador, nf.bairro_tomador].filter(Boolean).join(', ') || '-';
  const tomMunicipio = fmt(nf.descricao_municipio_tomador);
  const tomCep = fmtCep(nf.cep_tomador);

  const municipioEmissor = fmt(nf.descricao_municipio_emissor || nf.descricao_municipio_prestacao);
  const uf = fmt(nf.uf_emitente || nf.uf_prestador);
  const municipioUf = municipioEmissor !== '—' ? `${municipioEmissor}${uf !== '—' ? ' - ' + uf : ''}` : '—';
  const valorServico = parseFloat(nf.valor_servico || 0);
  const valorLiquido = parseFloat(nf.valor_liquido || nf.valor_servico || 0);
  const bcIss = parseFloat(nf.iss_base_calculo || nf.valor_servico || 0);
  const deducoes = parseFloat(nf.valor_desconto_incondicionado || 0) + parseFloat(nf.valor_desconto_condicionado || 0);
  const retencoes = parseFloat(nf.valor_iss_retido || 0) + parseFloat(nf.valor_total_retencao || 0);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; padding: 20px; }
  .titulo { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 4px; border-bottom: 2px solid #000; padding-bottom: 6px; }
  .subtitulo { text-align: center; font-size: 11px; color: #444; margin-bottom: 14px; }
  .secao { border: 1px solid #999; border-radius: 4px; margin-bottom: 10px; }
  .secao-titulo { background: #e8e8e8; font-weight: bold; font-size: 9px; padding: 3px 8px; text-transform: uppercase; border-bottom: 1px solid #999; border-radius: 4px 4px 0 0; }
  .secao-corpo { padding: 8px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
  .campo label { font-size: 8px; color: #666; display: block; text-transform: uppercase; margin-bottom: 2px; }
  .campo span { font-size: 10px; font-weight: 500; }
  .destaque { background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-top: 10px; }
  .chave { font-family: monospace; font-size: 9px; letter-spacing: 1px; word-break: break-all; background: #f5f5f5; padding: 4px 6px; border-radius: 3px; border: 1px solid #ddd; }
  .rodape { text-align: center; font-size: 8px; color: #888; margin-top: 14px; border-top: 1px solid #ddd; padding-top: 6px; }
  .recibo { display: flex; justify-content: space-between; align-items: flex-start; border: 1px solid #999; border-radius: 4px; padding: 10px 12px; margin-bottom: 6px; gap: 12px; }
  .recibo-texto { font-size: 10px; flex: 1; line-height: 1.5; }
  .recibo-lado { text-align: center; font-size: 10px; min-width: 110px; border-left: 1px solid #999; padding-left: 12px; line-height: 1.6; }
  .assinatura-row { display: flex; gap: 16px; margin-bottom: 4px; padding: 0 4px; }
  .assinatura-campo { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .assinatura-linha { border-bottom: 1px solid #000; height: 22px; }
  .assinatura-label { font-size: 8px; font-weight: bold; text-transform: uppercase; text-align: center; color: #333; }
  .recibo-corte { font-size: 9px; color: #999; letter-spacing: 0px; margin-bottom: 10px; overflow: hidden; white-space: nowrap; }
  @media print { body { padding: 0; } @page { margin: 0; size: A4; } body { margin: 12mm; } }
</style>
</head>
<body>

<div class="recibo">
  <div class="recibo-texto">Recebemos de <strong>${prestNome}</strong> os serviços constantes na Nota Fiscal de Serviços Eletrônica indicada ao lado.<br>Destinatário: ${tomNome}. Valor total: ${fmtMoeda(valorLiquido)}.</div>
  <div class="recibo-lado">
    <div style="font-weight:bold;font-size:13px;">NFS-e</div>
    <div>Nº: ${fmt(nf.numero || nf.numero_dfse)}</div>
    <div>Emissão: ${fmtData(nf.data_emissao_completa || nf.data_emissao)}</div>
  </div>
</div>
<div class="assinatura-row">
  <div class="assinatura-campo"><div class="assinatura-linha"></div><div class="assinatura-label">DATA DE RECEBIMENTO</div></div>
  <div class="assinatura-campo" style="flex:2"><div class="assinatura-linha"></div><div class="assinatura-label">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div></div>
</div>
<div class="recibo-corte">...........................................................................................................................................................................</div>

<div class="secao">
  <div class="secao-titulo">Identificação</div>
  <div class="secao-corpo">
    <div class="grid-4">
      <div class="campo"><label>Número NFS-e</label><span>${fmt(nf.numero || nf.numero_dfse)}</span></div>
      <div class="campo"><label>Data de Emissão</label><span>${fmtData(nf.data_emissao_completa || nf.data_emissao)}</span></div>
      <div class="campo"><label>Data de Competência</label><span>${fmtData(nf.data_competencia || nf.data_emissao)}</span></div>
      <div class="campo"><label>Município Emissor</label><span>${municipioUf}</span></div>
    </div>
    ${nf.id_tag ? `<div class="campo" style="margin-top:8px"><label>Chave de Acesso</label><div class="chave">${fmt(nf.id_tag)}</div></div>` : ''}
  </div>
</div>

<div class="secao">
  <div class="secao-titulo">Prestador</div>
  <div class="secao-corpo">
    <div class="grid-2">
      <div class="campo"><label>Razão Social</label><span>${prestNome}</span></div>
      <div class="campo"><label>CNPJ</label><span>${prestCnpj}</span></div>
      <div class="campo"><label>Inscrição Municipal</label><span>${prestIm}</span></div>
      <div class="campo"><label>E-mail</label><span>${prestEmail}</span></div>
    </div>
    ${(prestEnd !== '—' || prestFone !== '—') ? `
    <div class="grid-2" style="margin-top:8px">
      <div class="campo"><label>Endereço</label><span>${prestEnd}</span></div>
      <div class="campo"><label>Município / CEP</label><span>${prestMunicipio !== '—' ? prestMunicipio + (prestUf !== '—' ? ' - ' + prestUf : '') : '—'}${prestCep !== '—' ? ' | ' + prestCep : ''}</span></div>
    </div>` : ''}
  </div>
</div>

<div class="secao">
  <div class="secao-titulo">Tomador</div>
  <div class="secao-corpo">
    <div class="grid-2">
      <div class="campo"><label>Razão Social</label><span>${tomNome}</span></div>
      <div class="campo"><label>CNPJ / CPF</label><span>${tomCnpj}</span></div>
      <div class="campo"><label>Município</label><span>${tomMunicipio}</span></div>
      <div class="campo"><label>E-mail</label><span>${tomEmail}</span></div>
    </div>
  </div>
</div>

<div class="secao">
  <div class="secao-titulo">Serviço</div>
  <div class="secao-corpo">
    <div class="campo" style="margin-bottom:8px"><label>Descrição</label><span>${fmt(nf.descricao_servico)}</span></div>
    <div class="grid-3">
      <div class="campo"><label>Tributação Nacional</label><span>${fmt(nf.descricao_tributacao_nacional || nf.codigo_tributacao_nacional)}</span></div>
      <div class="campo"><label>Município Prestação</label><span>${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</span></div>
      <div class="campo"><label>Tributação ISS</label><span>${fmt(nf.tributacao_iss || nf.natureza_operacao)}</span></div>
    </div>
    ${nf.informacoes_complementares ? `<div class="campo" style="margin-top:8px"><label>Informações Complementares</label><span>${fmt(nf.informacoes_complementares)}</span></div>` : ''}
  </div>
</div>

<div class="secao">
  <div class="secao-titulo">Valores</div>
  <div class="secao-corpo">
    <div class="grid-4">
      <div class="campo"><label>Valor do Serviço</label><span>${fmtMoeda(valorServico)}</span></div>
      <div class="campo"><label>Base Cálculo ISS</label><span>${fmtMoeda(bcIss)}</span></div>
      <div class="campo"><label>Deduções</label><span>${fmtMoeda(deducoes)}</span></div>
      <div class="campo"><label>Retenções</label><span>${fmtMoeda(retencoes)}</span></div>
    </div>
    <div class="destaque">
      <span style="font-weight:bold;font-size:11px">VALOR LÍQUIDO</span>
      <span style="font-size:16px;font-weight:bold">${fmtMoeda(valorLiquido)}</span>
    </div>
  </div>
</div>

<div class="rodape">Documento gerado pelo sistema | Consulte a autenticidade em nfse.gov.br</div>

</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { nota_id } = body;
    if (!nota_id) return Response.json({ sucesso: false, erro: 'nota_id obrigatório' });

    const db = base44.asServiceRole;
    const [notaLista, configs] = await Promise.all([
      db.entities.NotaFiscal.filter({ id: nota_id }),
      db.entities.Configuracao.list('-created_date', 200),
    ]);
    const nota = notaLista[0];
    if (!nota) return Response.json({ sucesso: false, erro: 'Nota não encontrada' });

    const getConf = (chave) => configs.find(c => c.chave === chave)?.valor || '';
    const apiKey = getConf('focusnfe_api_key_producao') || getConf('focusnfe_api_key');
    const AUTH_HEADER = 'Basic ' + btoa(apiKey + ':');
    const cnpj = getConf('cnpj').replace(/\D/g, '');

    // Busca dados completos da nota na Focus NFe para gerar o HTML
    let dadosNota = null;

    // Tenta buscar pelo id_tag extraído do XML
    let idTag = nota.chave_acesso || '';
    if (nota.xml_original) {
      const m = nota.xml_original.match(/<ChaveAcesso>(NFS[^<]+)<\/ChaveAcesso>/);
      if (m) idTag = m[1].trim();
    }

    // Busca a nota na lista completa da Focus NFe pelo número ou id_tag
    const listResp = await fetch(`${FOCUSNFE_BASE}/nfsens_recebidas?cnpj=${cnpj}&versao=0&completa=1`, {
      headers: { 'Authorization': AUTH_HEADER },
    });
    if (listResp.ok) {
      const lista = await listResp.json().catch(() => []);
      if (Array.isArray(lista)) {
        dadosNota = lista.find(n => n.id_tag === idTag || n.numero === nota.numero || n.numero_dfse === nota.numero);
      }
    }

    // Se não encontrou via API, usa os dados do XML salvo
    if (!dadosNota) {
      // Reconstrói objeto a partir do XML/dados salvos na nota
      dadosNota = {
        numero: nota.numero,
        id_tag: idTag,
        razao_social_prestador: nota.cliente_nome,
        cnpj_prestador: nota.cliente_cpf_cnpj,
        data_emissao: nota.data_emissao,
        data_competencia: nota.data_emissao,
        valor_liquido: nota.valor_total,
        valor_servico: nota.valor_total,
        descricao_servico: nota.observacoes || '',
      };
    }

    // Gera HTML da DANFSe
    const htmlContent = gerarHtmlDanfse(dadosNota);

    // Converte para PDF via Gotenberg
    const formData = new FormData();
    const htmlBlob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
    formData.append('files', htmlBlob, 'index.html');
    formData.append('paperWidth', '8.5');
    formData.append('paperHeight', '11');
    formData.append('marginTop', '0.5');
    formData.append('marginBottom', '0.5');
    formData.append('marginLeft', '0.5');
    formData.append('marginRight', '0.5');

    const gotResp = await fetch('https://gotenberg.spedy.com.br/forms/chromium/convert/html', {
      method: 'POST',
      body: formData,
    });

    // Tenta converter para PDF via Gotenberg, com fallback para HTML
    let fileUrl = null;
    if (gotResp.ok) {
      const pdfBuf = await gotResp.arrayBuffer();
      const h = new Uint8Array(pdfBuf, 0, 4);
      if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) {
        const pdfFile = new File([pdfBuf], `nfse_${nota_id}.pdf`, { type: 'application/pdf' });
        const { file_url } = await db.integrations.Core.UploadFile({ file: pdfFile });
        fileUrl = file_url;
      }
    }

    // Fallback: salva HTML como arquivo visualizável
    if (!fileUrl) {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
      const htmlFile = new File([htmlBlob], `danfse_${nota_id}.html`, { type: 'text/html' });
      const { file_url } = await db.integrations.Core.UploadFile({ file: htmlFile });
      fileUrl = file_url;
    }

    await db.entities.NotaFiscal.update(nota_id, { pdf_url: fileUrl });
    return Response.json({ sucesso: true, pdf_url: fileUrl });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});