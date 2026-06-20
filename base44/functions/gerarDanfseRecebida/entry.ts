import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';

function gerarHtmlDanfse(nf) {
  const fmt = (v) => (v != null && v !== '') ? String(v) : '-';
  const fmtMoeda = (v) => v ? `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
  const fmtData = (v) => {
    if (!v) return '-';
    const d = v.substring(0, 10);
    const [ano, mes, dia] = d.split('-');
    return `${dia}/${mes}/${ano}`;
  };
  const fmtDataHora = (v) => {
    if (!v) return '-';
    const [data, hora] = v.split('T');
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}${hora ? ' ' + hora.substring(0,8) : ''}`;
  };
  const fmtCnpj = (v) => {
    if (!v) return '-';
    const c = v.replace(/\D/g, '');
    if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return v;
  };

  const prestNome = fmt(nf.razao_social_prestador || nf.razao_social_emitente);
  const prestCnpj = fmtCnpj(nf.cnpj_prestador || nf.cnpj_emitente || nf.cpf_prestador);
  const prestIm = fmt(nf.inscricao_municipal_prestador || nf.inscricao_municipal_emitente);
  const prestEmail = fmt(nf.email_prestador || nf.email_emitente);
  const prestFone = fmt(nf.telefone_prestador || nf.fone_prestador);
  const prestEnd = [nf.logradouro_prestador || nf.logradouro_emitente, nf.numero_prestador || nf.numero_emitente, nf.bairro_prestador || nf.bairro_emitente].filter(Boolean).join(', ') || '-';
  const prestMunicipio = fmt(nf.descricao_municipio_prestador || nf.descricao_municipio_emissor);
  const prestUf = fmt(nf.uf_prestador || nf.uf_emitente);
  const prestCep = fmt(nf.cep_prestador || nf.cep_emitente);

  const tomNome = fmt(nf.razao_social_tomador);
  const tomCnpj = fmtCnpj(nf.cnpj_tomador || nf.cpf_tomador);
  const tomIm = fmt(nf.inscricao_municipal_tomador);
  const tomEmail = fmt(nf.email_tomador);
  const tomFone = fmt(nf.telefone_tomador);
  const tomEnd = [nf.logradouro_tomador, nf.numero_tomador, nf.bairro_tomador].filter(Boolean).join(', ') || '-';
  const tomMunicipio = fmt(nf.descricao_municipio_tomador);
  const tomCep = fmt(nf.cep_tomador);

  const municipioEmissor = fmt(nf.descricao_municipio_emissor || nf.descricao_municipio_prestacao);
  const uf = fmt(nf.uf_emitente || nf.uf_prestador);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; background: #fff; padding: 12px 16px; }

  /* CABEÇALHO */
  .cabecalho { display: flex; align-items: center; border: 1px solid #000; margin-bottom: 0; }
  .cab-logo { width: 90px; min-width: 90px; border-right: 1px solid #000; display: flex; align-items: center; justify-content: center; padding: 6px; }
  .cab-logo svg { width: 70px; height: 70px; }
  .cab-centro { flex: 1; text-align: center; border-right: 1px solid #000; padding: 6px 4px; }
  .cab-centro .doc-titulo { font-size: 12px; font-weight: bold; }
  .cab-centro .doc-sub { font-size: 10px; font-weight: bold; }
  .cab-direita { width: 180px; min-width: 180px; padding: 6px 8px; font-size: 8px; line-height: 1.5; }
  .cab-direita .mun-nome { font-weight: bold; font-size: 9px; }

  /* BLOCO CHAVE */
  .bloco-chave { border: 1px solid #000; border-top: none; padding: 4px 8px; }
  .bloco-chave .label-chave { font-size: 7.5px; font-weight: bold; text-transform: uppercase; }
  .bloco-chave .valor-chave { font-family: monospace; font-size: 8.5px; letter-spacing: 0.5px; }

  /* BLOCO IDENTIFICAÇÃO */
  .bloco-ids { display: flex; border: 1px solid #000; border-top: none; }
  .bloco-ids .id-item { flex: 1; padding: 4px 8px; border-right: 1px solid #000; }
  .bloco-ids .id-item:last-child { border-right: none; }
  .id-label { font-size: 7.5px; font-weight: bold; color: #000; }
  .id-valor { font-size: 9px; font-weight: bold; }
  .id-valor-sm { font-size: 8.5px; }

  /* SEÇÕES */
  .secao { border: 1px solid #000; border-top: none; }
  .secao-header { background: #f0f0f0; border-bottom: 1px solid #000; padding: 2px 8px; font-size: 8px; font-weight: bold; text-transform: uppercase; }
  .secao-corpo { padding: 0; }
  .linha { display: flex; border-bottom: 1px solid #ddd; }
  .linha:last-child { border-bottom: none; }
  .cel { flex: 1; padding: 3px 8px; border-right: 1px solid #ddd; }
  .cel:last-child { border-right: none; }
  .cel-label { font-size: 7px; font-weight: bold; text-transform: uppercase; color: #444; margin-bottom: 1px; }
  .cel-valor { font-size: 8.5px; }
  .cel-valor-bold { font-size: 9px; font-weight: bold; }

  /* TOTAL */
  .bloco-total { border: 1px solid #000; border-top: none; display: flex; align-items: center; justify-content: space-between; padding: 5px 12px; background: #f8f8f8; }
  .total-label { font-size: 10px; font-weight: bold; text-transform: uppercase; }
  .total-valor { font-size: 13px; font-weight: bold; }

  /* RODAPÉ */
  .rodape { border: 1px solid #000; border-top: 1px solid #ccc; padding: 4px 8px; font-size: 7.5px; color: #555; text-align: center; }

  @media print {
    body { padding: 0; }
    @page { margin: 10mm; size: A4; }
  }
</style>
</head>
<body>

  <!-- CABEÇALHO -->
  <div class="cabecalho">
    <div class="cab-logo">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" stroke="#1a3a6b" stroke-width="3"/>
        <text x="50" y="38" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="11" fill="#1a3a6b">NFS-e</text>
        <text x="50" y="52" text-anchor="middle" font-family="Arial" font-size="7" fill="#1a3a6b">Nota Fiscal de</text>
        <text x="50" y="62" text-anchor="middle" font-family="Arial" font-size="7" fill="#1a3a6b">Serviço eletrônica</text>
      </svg>
    </div>
    <div class="cab-centro">
      <div class="doc-titulo">DANFSe v1.0</div>
      <div class="doc-sub">Documento Auxiliar da NFS-e</div>
    </div>
    <div class="cab-direita">
      <div class="mun-nome">MUNICÍPIO DE ${municipioEmissor.toUpperCase()}</div>
      <div>${uf.toUpperCase()}</div>
      <div>Secretaria Municipal de Finanças</div>
    </div>
  </div>

  <!-- CHAVE DE ACESSO -->
  ${nf.id_tag ? `
  <div class="bloco-chave">
    <div class="label-chave">Chave de Acesso da NFS-e</div>
    <div class="valor-chave">${fmt(nf.id_tag)}</div>
  </div>` : ''}

  <!-- IDENTIFICAÇÃO -->
  <div class="bloco-ids">
    <div class="id-item">
      <div class="id-label">Número da NFS-e</div>
      <div class="id-valor">${fmt(nf.numero || nf.numero_dfse)}</div>
    </div>
    <div class="id-item">
      <div class="id-label">Competência da NFS-e</div>
      <div class="id-valor-sm">${fmtData(nf.data_competencia || nf.data_emissao)}</div>
    </div>
    <div class="id-item">
      <div class="id-label">Data e Hora da emissão</div>
      <div class="id-valor-sm">${fmtDataHora(nf.data_emissao_completa || nf.data_emissao)}</div>
    </div>
    <div class="id-item">
      <div class="id-label">Número da DPS</div>
      <div class="id-valor-sm">${fmt(nf.numero_dfse || nf.numero)}</div>
    </div>
  </div>

  <!-- EMITENTE / PRESTADOR -->
  <div class="secao">
    <div class="secao-header">EMITENTE DA NFS-e — Prestador do Serviço</div>
    <div class="secao-corpo">
      <div class="linha">
        <div class="cel" style="flex:2">
          <div class="cel-label">Nome / Nome Empresarial</div>
          <div class="cel-valor-bold">${prestNome}</div>
        </div>
        <div class="cel">
          <div class="cel-label">CNPJ / CPF / NIF</div>
          <div class="cel-valor">${prestCnpj}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Inscrição Municipal</div>
          <div class="cel-valor">${prestIm}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Telefone</div>
          <div class="cel-valor">${prestFone}</div>
        </div>
      </div>
      <div class="linha">
        <div class="cel" style="flex:2">
          <div class="cel-label">Endereço</div>
          <div class="cel-valor">${prestEnd}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Município</div>
          <div class="cel-valor">${prestMunicipio} - ${prestUf}</div>
        </div>
        <div class="cel">
          <div class="cel-label">CEP</div>
          <div class="cel-valor">${prestCep}</div>
        </div>
        <div class="cel">
          <div class="cel-label">E-mail</div>
          <div class="cel-valor">${prestEmail}</div>
        </div>
      </div>
      ${nf.simples_nacional ? `
      <div class="linha">
        <div class="cel" style="flex:1">
          <div class="cel-label">Simples Nacional na Data de Competência</div>
          <div class="cel-valor">${fmt(nf.simples_nacional)}</div>
        </div>
        <div class="cel" style="flex:1">
          <div class="cel-label">Regime de Apuração Tributária pelo SN</div>
          <div class="cel-valor">${fmt(nf.regime_tributacao)}</div>
        </div>
      </div>` : ''}
    </div>
  </div>

  <!-- TOMADOR -->
  <div class="secao">
    <div class="secao-header">TOMADOR DO SERVIÇO</div>
    <div class="secao-corpo">
      <div class="linha">
        <div class="cel" style="flex:2">
          <div class="cel-label">Nome / Nome Empresarial</div>
          <div class="cel-valor-bold">${tomNome}</div>
        </div>
        <div class="cel">
          <div class="cel-label">CNPJ / CPF / NIF</div>
          <div class="cel-valor">${tomCnpj}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Inscrição Municipal</div>
          <div class="cel-valor">${tomIm}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Telefone</div>
          <div class="cel-valor">${tomFone}</div>
        </div>
      </div>
      <div class="linha">
        <div class="cel" style="flex:2">
          <div class="cel-label">Endereço</div>
          <div class="cel-valor">${tomEnd}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Município</div>
          <div class="cel-valor">${tomMunicipio}</div>
        </div>
        <div class="cel">
          <div class="cel-label">CEP</div>
          <div class="cel-valor">${tomCep}</div>
        </div>
        <div class="cel">
          <div class="cel-label">E-mail</div>
          <div class="cel-valor">${tomEmail}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- SERVIÇO PRESTADO -->
  <div class="secao">
    <div class="secao-header">SERVIÇO PRESTADO</div>
    <div class="secao-corpo">
      <div class="linha">
        <div class="cel" style="flex:2">
          <div class="cel-label">Código de Tributação Nacional</div>
          <div class="cel-valor">${fmt(nf.descricao_tributacao_nacional || nf.codigo_tributacao_nacional)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Código de Tributação Municipal</div>
          <div class="cel-valor">${fmt(nf.codigo_tributacao_municipio)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Local da Prestação</div>
          <div class="cel-valor">${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</div>
        </div>
      </div>
      <div class="linha">
        <div class="cel" style="flex:1">
          <div class="cel-label">Descrição do Serviço</div>
          <div class="cel-valor">${fmt(nf.descricao_servico)}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- TRIBUTAÇÃO MUNICIPAL -->
  <div class="secao">
    <div class="secao-header">TRIBUTAÇÃO MUNICIPAL</div>
    <div class="secao-corpo">
      <div class="linha">
        <div class="cel">
          <div class="cel-label">Tributação do ISSQN</div>
          <div class="cel-valor">${fmt(nf.tributacao_iss || nf.natureza_operacao)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Município de Incidência do ISSQN</div>
          <div class="cel-valor">${fmt(nf.descricao_municipio_prestacao || nf.descricao_municipio_emissor)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Retenção do ISSQN</div>
          <div class="cel-valor">${fmt(nf.retencao_iss ? 'Retido' : 'Não Retido')}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Regime Especial de Tributação</div>
          <div class="cel-valor">${fmt(nf.regime_especial_tributacao || 'Nenhum')}</div>
        </div>
      </div>
      <div class="linha">
        <div class="cel">
          <div class="cel-label">Valor do Serviço</div>
          <div class="cel-valor">${fmtMoeda(nf.valor_servico)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Desconto Incondicionado</div>
          <div class="cel-valor">${fmtMoeda(nf.valor_desconto_incondicionado)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Base de Cálculo (BC ISSQN)</div>
          <div class="cel-valor">${fmtMoeda(nf.iss_base_calculo)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Alíquota Aplicada</div>
          <div class="cel-valor">${nf.aliquota_iss ? (parseFloat(nf.aliquota_iss) * 100).toFixed(2) + '%' : '-'}</div>
        </div>
        <div class="cel">
          <div class="cel-label">ISSQN Apurado</div>
          <div class="cel-valor">${fmtMoeda(nf.valor_iss)}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- VALOR TOTAL -->
  <div class="secao">
    <div class="secao-header">VALOR TOTAL DA NFS-E</div>
    <div class="secao-corpo">
      <div class="linha">
        <div class="cel">
          <div class="cel-label">Valor do Serviço</div>
          <div class="cel-valor">${fmtMoeda(nf.valor_servico)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Desconto Condicionado</div>
          <div class="cel-valor">${fmtMoeda(nf.valor_desconto_condicionado)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Desconto Incondicionado</div>
          <div class="cel-valor">${fmtMoeda(nf.valor_desconto_incondicionado)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">ISSQN Retido</div>
          <div class="cel-valor">${fmtMoeda(nf.valor_iss_retido)}</div>
        </div>
        <div class="cel">
          <div class="cel-label">Total das Retenções Federais</div>
          <div class="cel-valor">${fmtMoeda(nf.valor_total_retencao)}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="bloco-total">
    <span class="total-label">Valor Líquido da NFS-e</span>
    <span class="total-valor">${fmtMoeda(nf.valor_liquido || nf.valor_servico)}</span>
  </div>

  ${nf.informacoes_complementares ? `
  <div class="secao" style="border-top: 1px solid #000;">
    <div class="secao-header">INFORMAÇÕES COMPLEMENTARES</div>
    <div class="secao-corpo">
      <div class="linha"><div class="cel"><div class="cel-valor">${fmt(nf.informacoes_complementares)}</div></div></div>
    </div>
  </div>` : ''}

  <div class="rodape">
    Nota Fiscal de Serviços Eletrônica — DANFSe gerada pelo sistema | Consulte a autenticidade em nfse.gov.br
  </div>

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