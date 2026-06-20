import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';

function gerarHtmlDanfse(nf) {
  const fmt = (v) => (v != null && v !== '') ? String(v) : '-';
  const fmtMoeda = (v) => v ? `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
  const fmtData = (v) => { if (!v) return '-'; const d = v.substring(0, 10); const [ano, mes, dia] = d.split('-'); return `${dia}/${mes}/${ano}`; };
  const fmtDataHora = (v) => { if (!v) return '-'; const [data, hora] = v.split('T'); if (!data) return '-'; const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}${hora ? ' ' + hora.substring(0, 8) : ''}`; };
  const fmtCnpj = (v) => { if (!v) return '-'; const c = v.replace(/\D/g, ''); if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); return v; };
  const fmtCep = (v) => { if (!v) return '-'; const c = v.replace(/\D/g, ''); if (c.length === 8) return c.replace(/(\d{5})(\d{3})/, '$1-$2'); return v; };

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

  const aliquota = nf.aliquota_iss ? (parseFloat(nf.aliquota_iss) * 100).toFixed(2) + '%' : '-';
  const tributacaoIss = fmt(nf.tributacao_iss || nf.natureza_operacao);
  const retencao = nf.retencao_iss ? 'Retido' : 'Não Retido';
  const regimeEsp = fmt(nf.regime_especial_tributacao != null ? nf.regime_especial_tributacao : '0');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; color: #000; background: #fff; padding: 10mm 10mm; }
  table { width: 100%; border-collapse: collapse; }
  td, th { font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; color: #000; vertical-align: top; }
  .sec-hdr { background: #e8e8e8; border: 1px solid #000; border-bottom: 1px solid #000; padding: 2px 4px; font-size: 7.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
  .lbl { font-size: 7px; font-weight: bold; color: #000; padding: 2px 4px 0 4px; text-transform: uppercase; white-space: nowrap; }
  .val { font-size: 8.5px; padding: 0 4px 3px 4px; }
  .val-bold { font-size: 8.5px; font-weight: bold; padding: 0 4px 3px 4px; }
  .bd { border: 1px solid #000; }
  .bd-r { border-right: 1px solid #000; }
  .bd-b { border-bottom: 1px solid #000; }
  .bd-t { border-top: 1px solid #000; }
  .chave-val { font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: 0.8px; padding: 2px 4px; word-break: break-all; }
  .total-row td { background: #f0f0f0; border: 1px solid #000; }
  .total-lbl { font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 4px 8px; }
  .total-val { font-size: 11px; font-weight: bold; text-align: right; padding: 4px 8px; }
  .rodape-cell { font-size: 7.5px; color: #333; text-align: center; padding: 3px 4px; border: 1px solid #000; border-top: none; }
  @media print { body { padding: 0; } @page { margin: 10mm; size: A4 portrait; } }
</style>
</head>
<body>

<!-- CABEÇALHO -->
<table style="border: 1px solid #000; margin-bottom: 0;">
  <tr>
    <td style="width: 80px; min-width:80px; border-right: 1px solid #000; text-align:center; padding: 6px; vertical-align: middle;">
      <svg viewBox="0 0 100 100" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="47" stroke="#1a3a6b" stroke-width="3" fill="white"/>
        <text x="50" y="37" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="12" fill="#1a3a6b">NFS-e</text>
        <text x="50" y="51" text-anchor="middle" font-family="Arial" font-size="7.5" fill="#1a3a6b">Nota Fiscal de</text>
        <text x="50" y="62" text-anchor="middle" font-family="Arial" font-size="7.5" fill="#1a3a6b">Serviço eletrônica</text>
      </svg>
    </td>
    <td style="text-align:center; border-right: 1px solid #000; vertical-align: middle; padding: 8px 4px;">
      <div style="font-size:13px; font-weight:bold;">DANFSe v1.0</div>
      <div style="font-size:10px; font-weight:bold;">Documento Auxiliar da NFS-e</div>
    </td>
    <td style="width: 190px; min-width:190px; padding: 6px 8px; vertical-align: middle;">
      <div style="font-weight:bold; font-size:9px;">MUNICÍPIO DE ${municipioEmissor.toUpperCase()}</div>
      <div style="font-size:8.5px;">${uf.toUpperCase()}</div>
      <div style="font-size:8px;">Secretaria Municipal de Finanças</div>
    </td>
  </tr>
</table>

<!-- CHAVE DE ACESSO -->
${nf.id_tag ? `
<table style="border: 1px solid #000; border-top: none;">
  <tr>
    <td>
      <div class="lbl" style="padding: 2px 4px;">CHAVE DE ACESSO DA NFS-E</div>
      <div class="chave-val">${fmt(nf.id_tag)}</div>
    </td>
  </tr>
</table>` : ''}

<!-- IDENTIFICAÇÃO -->
<table style="border: 1px solid #000; border-top: none;">
  <tr>
    <td class="bd-r" style="width:25%">
      <div class="lbl">Número da NFS-e</div>
      <div class="val-bold">${fmt(nf.numero || nf.numero_dfse)}</div>
    </td>
    <td class="bd-r" style="width:25%">
      <div class="lbl">Competência da NFS-e</div>
      <div class="val">${fmtData(nf.data_competencia || nf.data_emissao)}</div>
    </td>
    <td class="bd-r" style="width:30%">
      <div class="lbl">Data e Hora da emissão</div>
      <div class="val">${fmtDataHora(nf.data_emissao_completa || nf.data_emissao)}</div>
    </td>
    <td style="width:20%">
      <div class="lbl">Número da DPS</div>
      <div class="val">${fmt(nf.numero_dfse || nf.numero)}</div>
    </td>
  </tr>
</table>

<!-- EMITENTE -->
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="4" class="sec-hdr">EMITENTE DA NFS-E — PRESTADOR DO SERVIÇO</td></tr>
  <tr>
    <td class="bd-r bd-b" style="width:40%; padding:0">
      <div class="lbl">NOME / NOME EMPRESARIAL</div>
      <div class="val-bold">${prestNome}</div>
    </td>
    <td class="bd-r bd-b" style="width:20%; padding:0">
      <div class="lbl">CNPJ / CPF / NIF</div>
      <div class="val">${prestCnpj}</div>
    </td>
    <td class="bd-r bd-b" style="width:20%; padding:0">
      <div class="lbl">INSCRIÇÃO MUNICIPAL</div>
      <div class="val">${prestIm}</div>
    </td>
    <td class="bd-b" style="width:20%; padding:0">
      <div class="lbl">TELEFONE</div>
      <div class="val">${prestFone}</div>
    </td>
  </tr>
  <tr>
    <td class="bd-r" style="width:40%; padding:0">
      <div class="lbl">ENDEREÇO</div>
      <div class="val">${prestEnd}</div>
    </td>
    <td class="bd-r" style="width:20%; padding:0">
      <div class="lbl">MUNICÍPIO</div>
      <div class="val">${prestMunicipio} - ${prestUf}</div>
    </td>
    <td class="bd-r" style="width:20%; padding:0">
      <div class="lbl">CEP</div>
      <div class="val">${prestCep}</div>
    </td>
    <td style="width:20%; padding:0">
      <div class="lbl">E-MAIL</div>
      <div class="val">${prestEmail}</div>
    </td>
  </tr>
</table>

<!-- TOMADOR -->
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="4" class="sec-hdr">TOMADOR DO SERVIÇO</td></tr>
  <tr>
    <td class="bd-r bd-b" style="width:40%; padding:0">
      <div class="lbl">NOME / NOME EMPRESARIAL</div>
      <div class="val-bold">${tomNome}</div>
    </td>
    <td class="bd-r bd-b" style="width:20%; padding:0">
      <div class="lbl">CNPJ / CPF / NIF</div>
      <div class="val">${tomCnpj}</div>
    </td>
    <td class="bd-r bd-b" style="width:20%; padding:0">
      <div class="lbl">INSCRIÇÃO MUNICIPAL</div>
      <div class="val">${tomIm}</div>
    </td>
    <td class="bd-b" style="width:20%; padding:0">
      <div class="lbl">TELEFONE</div>
      <div class="val">${tomFone}</div>
    </td>
  </tr>
  <tr>
    <td class="bd-r" style="width:40%; padding:0">
      <div class="lbl">ENDEREÇO</div>
      <div class="val">${tomEnd}</div>
    </td>
    <td class="bd-r" style="width:20%; padding:0">
      <div class="lbl">MUNICÍPIO</div>
      <div class="val">${tomMunicipio}</div>
    </td>
    <td class="bd-r" style="width:20%; padding:0">
      <div class="lbl">CEP</div>
      <div class="val">${tomCep}</div>
    </td>
    <td style="width:20%; padding:0">
      <div class="lbl">E-MAIL</div>
      <div class="val">${tomEmail}</div>
    </td>
  </tr>
</table>

<!-- SERVIÇO PRESTADO -->
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="3" class="sec-hdr">SERVIÇO PRESTADO</td></tr>
  <tr>
    <td class="bd-r bd-b" style="width:50%; padding:0">
      <div class="lbl">CÓDIGO DE TRIBUTAÇÃO NACIONAL</div>
      <div class="val">${fmt(nf.descricao_tributacao_nacional || nf.codigo_tributacao_nacional)}</div>
    </td>
    <td class="bd-r bd-b" style="width:25%; padding:0">
      <div class="lbl">CÓDIGO DE TRIBUTAÇÃO MUNICIPAL</div>
      <div class="val">${fmt(nf.codigo_tributacao_municipio)}</div>
    </td>
    <td class="bd-b" style="width:25%; padding:0">
      <div class="lbl">LOCAL DA PRESTAÇÃO</div>
      <div class="val">${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</div>
    </td>
  </tr>
  <tr>
    <td colspan="3" style="padding:0">
      <div class="lbl">DESCRIÇÃO DO SERVIÇO</div>
      <div class="val">${fmt(nf.descricao_servico)}</div>
    </td>
  </tr>
</table>

<!-- TRIBUTAÇÃO MUNICIPAL -->
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="4" class="sec-hdr">TRIBUTAÇÃO MUNICIPAL</td></tr>
  <tr>
    <td class="bd-r bd-b" style="width:15%; padding:0">
      <div class="lbl">TRIBUTAÇÃO DO ISSQN</div>
      <div class="val">${tributacaoIss}</div>
    </td>
    <td class="bd-r bd-b" style="width:30%; padding:0">
      <div class="lbl">MUNICÍPIO DE INCIDÊNCIA DO ISSQN</div>
      <div class="val">${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</div>
    </td>
    <td class="bd-r bd-b" style="width:25%; padding:0">
      <div class="lbl">RETENÇÃO DO ISSQN</div>
      <div class="val">${retencao}</div>
    </td>
    <td class="bd-b" style="width:30%; padding:0">
      <div class="lbl">REGIME ESPECIAL DE TRIBUTAÇÃO</div>
      <div class="val">${regimeEsp}</div>
    </td>
  </tr>
  <tr>
    <td class="bd-r" style="padding:0">
      <div class="lbl">VALOR DO SERVIÇO</div>
      <div class="val">${fmtMoeda(nf.valor_servico)}</div>
    </td>
    <td class="bd-r" style="padding:0">
      <div class="lbl">DESCONTO INCONDICIONADO</div>
      <div class="val">${fmtMoeda(nf.valor_desconto_incondicionado)}</div>
    </td>
    <td class="bd-r" style="padding:0">
      <div class="lbl">BC ISSQN</div>
      <div class="val">${fmtMoeda(nf.iss_base_calculo || nf.valor_servico)}</div>
    </td>
    <td style="padding:0; display: table-cell;">
      <!-- Split last cell into 2 sub-cols via nested table -->
      <table style="width:100%; border-collapse:collapse; height:100%;">
        <tr>
          <td class="bd-r" style="padding:0; width:50%">
            <div class="lbl">ALÍQUOTA APLICADA</div>
            <div class="val">${aliquota}</div>
          </td>
          <td style="padding:0; width:50%">
            <div class="lbl">ISSQN APURADO</div>
            <div class="val">${fmtMoeda(nf.valor_iss)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- VALOR TOTAL DA NFS-E -->
<table style="border: 1px solid #000; border-top: none;">
  <tr><td colspan="5" class="sec-hdr">VALOR TOTAL DA NFS-E</td></tr>
  <tr>
    <td class="bd-r" style="width:20%; padding:0">
      <div class="lbl">VALOR DO SERVIÇO</div>
      <div class="val">${fmtMoeda(nf.valor_servico)}</div>
    </td>
    <td class="bd-r" style="width:20%; padding:0">
      <div class="lbl">DESCONTO CONDICIONADO</div>
      <div class="val">${fmtMoeda(nf.valor_desconto_condicionado)}</div>
    </td>
    <td class="bd-r" style="width:20%; padding:0">
      <div class="lbl">DESCONTO INCONDICIONADO</div>
      <div class="val">${fmtMoeda(nf.valor_desconto_incondicionado)}</div>
    </td>
    <td class="bd-r" style="width:20%; padding:0">
      <div class="lbl">ISSQN RETIDO</div>
      <div class="val">${fmtMoeda(nf.valor_iss_retido)}</div>
    </td>
    <td style="width:20%; padding:0">
      <div class="lbl">TOTAL DAS RETENÇÕES FEDERAIS</div>
      <div class="val">${fmtMoeda(nf.valor_total_retencao)}</div>
    </td>
  </tr>
</table>

<!-- VALOR LÍQUIDO -->
<table style="border: 1px solid #000; border-top: none;">
  <tr class="total-row">
    <td class="total-lbl bd-r" style="width:50%">VALOR LÍQUIDO DA NFS-E</td>
    <td class="total-val" style="width:50%">${fmtMoeda(nf.valor_liquido || nf.valor_servico)}</td>
  </tr>
</table>

${nf.informacoes_complementares ? `
<table style="border: 1px solid #000; border-top: none;">
  <tr><td class="sec-hdr">INFORMAÇÕES COMPLEMENTARES</td></tr>
  <tr><td class="val" style="padding: 3px 4px;">${fmt(nf.informacoes_complementares)}</td></tr>
</table>` : ''}

<div class="rodape-cell">Nota Fiscal de Serviços Eletrônica — DANFSe v1.0 | Consulte a autenticidade em nfse.gov.br</div>

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