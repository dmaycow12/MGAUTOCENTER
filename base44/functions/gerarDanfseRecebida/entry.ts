import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';

function gerarHtmlDanfse(nf) {
  const fmt = (v) => v ? String(v) : '—';
  const fmtMoeda = (v) => v ? `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00';
  const fmtData = (v) => {
    if (!v) return '—';
    const d = v.substring(0, 10);
    const [ano, mes, dia] = d.split('-');
    return `${dia}/${mes}/${ano}`;
  };
  const fmtCnpj = (v) => {
    if (!v) return '—';
    const c = v.replace(/\D/g, '');
    if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return v;
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; padding: 20px; }
  .titulo { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 4px; border-bottom: 2px solid #000; padding-bottom: 6px; }
  .subtitulo { text-align: center; font-size: 11px; color: #444; margin-bottom: 14px; }
  .secao { border: 1px solid #999; border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
  .secao-titulo { background: #e8e8e8; font-weight: bold; font-size: 9px; padding: 3px 8px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #999; }
  .secao-corpo { padding: 8px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
  .campo label { font-size: 8px; color: #666; display: block; text-transform: uppercase; margin-bottom: 2px; }
  .campo span { font-size: 10px; font-weight: 500; }
  .destaque { background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
  .destaque-label { font-size: 11px; font-weight: bold; color: #333; }
  .destaque-valor { font-size: 16px; font-weight: bold; color: #000; }
  .chave { font-family: monospace; font-size: 8px; word-break: break-all; background: #f0f0f0; padding: 4px 6px; border-radius: 3px; }
  .rodape { text-align: center; font-size: 8px; color: #888; margin-top: 12px; border-top: 1px solid #ccc; padding-top: 8px; }
</style>
</head>
<body>
  <div class="titulo">DANFSe — DOCUMENTO AUXILIAR DA NOTA FISCAL DE SERVIÇOS ELETRÔNICA</div>
  <div class="subtitulo">Nota Fiscal de Serviços Nacional — NFS-e</div>

  <div class="secao">
    <div class="secao-titulo">Identificação da Nota</div>
    <div class="secao-corpo">
      <div class="grid-4">
        <div class="campo"><label>Número NFS-e</label><span>${fmt(nf.numero || nf.numero_dfse)}</span></div>
        <div class="campo"><label>Data de Emissão</label><span>${fmtData(nf.data_emissao)}</span></div>
        <div class="campo"><label>Data de Competência</label><span>${fmtData(nf.data_competencia)}</span></div>
        <div class="campo"><label>Município Emissor</label><span>${fmt(nf.descricao_municipio_emissor)} - ${fmt(nf.uf_emitente)}</span></div>
      </div>
      ${nf.id_tag ? `<div class="campo" style="margin-top:8px"><label>Chave de Acesso</label><div class="chave">${fmt(nf.id_tag)}</div></div>` : ''}
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Prestador do Serviço</div>
    <div class="secao-corpo">
      <div class="grid-2">
        <div class="campo"><label>Razão Social / Nome</label><span>${fmt(nf.razao_social_prestador || nf.razao_social_emitente)}</span></div>
        <div class="campo"><label>CNPJ / CPF</label><span>${fmtCnpj(nf.cnpj_prestador || nf.cnpj_emitente || nf.cpf_prestador)}</span></div>
        <div class="campo"><label>Inscrição Municipal</label><span>${fmt(nf.inscricao_municipal_prestador || nf.inscricao_municipal_emitente)}</span></div>
        <div class="campo"><label>E-mail</label><span>${fmt(nf.email_prestador || nf.email_emitente)}</span></div>
      </div>
      ${nf.logradouro_prestador || nf.logradouro_emitente ? `
      <div class="campo" style="margin-top:6px">
        <label>Endereço</label>
        <span>${fmt(nf.logradouro_prestador || nf.logradouro_emitente)}, ${fmt(nf.numero_prestador || nf.numero_emitente)} — ${fmt(nf.bairro_prestador || nf.bairro_emitente)}</span>
      </div>` : ''}
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Tomador do Serviço</div>
    <div class="secao-corpo">
      <div class="grid-2">
        <div class="campo"><label>Razão Social / Nome</label><span>${fmt(nf.razao_social_tomador)}</span></div>
        <div class="campo"><label>CNPJ / CPF</label><span>${fmtCnpj(nf.cnpj_tomador || nf.cpf_tomador)}</span></div>
        <div class="campo"><label>Município</label><span>${fmt(nf.descricao_municipio_tomador)}</span></div>
        <div class="campo"><label>E-mail</label><span>${fmt(nf.email_tomador)}</span></div>
      </div>
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Serviço Prestado</div>
    <div class="secao-corpo">
      <div class="campo" style="margin-bottom:8px">
        <label>Descrição do Serviço</label>
        <span>${fmt(nf.descricao_servico)}</span>
      </div>
      <div class="grid-3">
        <div class="campo"><label>Tributação Nacional</label><span>${fmt(nf.descricao_tributacao_nacional)}</span></div>
        <div class="campo"><label>Município de Prestação</label><span>${fmt(nf.descricao_municipio_prestacao)}</span></div>
        <div class="campo"><label>Tributação ISS</label><span>${fmt(nf.tributacao_iss)}</span></div>
      </div>
      ${nf.informacoes_complementares ? `
      <div class="campo" style="margin-top:6px">
        <label>Informações Complementares</label>
        <span>${fmt(nf.informacoes_complementares)}</span>
      </div>` : ''}
    </div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Valores</div>
    <div class="secao-corpo">
      <div class="grid-4">
        <div class="campo"><label>Valor do Serviço</label><span>${fmtMoeda(nf.valor_servico)}</span></div>
        <div class="campo"><label>Base de Cálculo ISS</label><span>${fmtMoeda(nf.iss_base_calculo)}</span></div>
        <div class="campo"><label>Deduções</label><span>${fmtMoeda(nf.valor_deducao_servico || nf.valor_deducao_iss)}</span></div>
        <div class="campo"><label>Retenções</label><span>${fmtMoeda(nf.valor_total_retencao)}</span></div>
      </div>
      <div class="destaque">
        <span class="destaque-label">VALOR LÍQUIDO</span>
        <span class="destaque-valor">${fmtMoeda(nf.valor_liquido || nf.valor_servico)}</span>
      </div>
    </div>
  </div>

  <div class="rodape">
    Documento gerado pelo sistema | Consulte a autenticidade em nfse.gov.br
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

    if (!gotResp.ok) {
      // Fallback: retorna o HTML diretamente
      return Response.json({ sucesso: true, html: htmlContent, aviso: 'PDF não gerado, HTML retornado.' });
    }

    const pdfBuf = await gotResp.arrayBuffer();
    const h = new Uint8Array(pdfBuf, 0, 4);
    if (h[0] !== 0x25 || h[1] !== 0x50 || h[2] !== 0x44 || h[3] !== 0x46) {
      return Response.json({ sucesso: true, html: htmlContent, aviso: 'Gotenberg não retornou PDF válido.' });
    }

    const pdfFile = new File([pdfBuf], `nfse_${nota_id}.pdf`, { type: 'application/pdf' });
    const { file_url } = await db.integrations.Core.UploadFile({ file: pdfFile });
    await db.entities.NotaFiscal.update(nota_id, { pdf_url: file_url });

    return Response.json({ sucesso: true, pdf_url: file_url });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});