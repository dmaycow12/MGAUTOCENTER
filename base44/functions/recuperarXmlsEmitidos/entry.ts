import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

const normalizarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://api.focusnfe.com.br${url}`;
};

const buscarXmlDaFocusNFe = async (ref, tipo, chaveAcesso) => {
  const ep = tipo === 'NFSe' ? 'nfsen' : tipo === 'NFCe' ? 'nfce' : 'nfe';

  // Se não tem ref (spedy_id), a nota não existe na FocusNFe com referência indexada — não é possível recuperar
  if (!ref) return null;

  // Passo 1: consultar dados da nota (inclui caminho_xml_nota_fiscal)
  const consultaResp = await fetch(`${FOCUSNFE_BASE}/${ep}/${ref}?completo=1`, {
    headers: { 'Authorization': AUTH_HEADER },
  });
  if (!consultaResp.ok) return null;
  const data = await consultaResp.json();

  // Passo 2: tentar baixar o XML via caminho retornado
  const caminhoXml = data.caminho_xml_nota_fiscal || data.caminho_xml || '';
  if (caminhoXml) {
    const xmlUrl = normalizarUrl(caminhoXml);
    const xmlResp = await fetch(xmlUrl, { headers: { 'Authorization': AUTH_HEADER } });
    if (xmlResp.ok) {
      const text = await xmlResp.text();
      if (text && text.length > 200 && text.includes('<')) return text;
    }
  }

  // Passo 3: tentar endpoint .xml direto
  const xmlDireto = await fetch(`${FOCUSNFE_BASE}/${ep}/${ref}.xml`, {
    headers: { 'Authorization': AUTH_HEADER },
  });
  if (xmlDireto.ok) {
    const ct = xmlDireto.headers.get('content-type') || '';
    if (ct.includes('xml')) {
      const text = await xmlDireto.text();
      if (text && text.length > 200 && text.includes('<')) return text;
    }
    // Pode retornar JSON com campo xml
    const json = await xmlDireto.json().catch(() => null);
    if (json?.xml) return json.xml;
  }

  return null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar notas Emitidas sem xml_url — aceita tanto spedy_id quanto chave_acesso como referência
    const emitidas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 500);
    const todasSemXml = emitidas.filter(n =>
      n.status === 'Emitida' &&
      (n.spedy_id || n.chave_acesso) &&
      !n.xml_url &&
      !(n.xml_original && n.xml_original.trim().startsWith('<'))
    );
    const semXml = todasSemXml.slice(0, 15);

    const logs = [];
    let recuperadas = 0;
    let falhas = 0;

    for (const nota of semXml) {
      try {
        const ref = nota.spedy_id || '';
        const xml = await buscarXmlDaFocusNFe(ref, nota.tipo || 'NFe', nota.chave_acesso || '');

        if (!xml) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} (ref: ${ref || nota.chave_acesso}) - XML não encontrado na FocusNFe`);
          falhas++;
          continue;
        }

        // Salvar como arquivo
        const xmlFile = new File([xml], `NF-${nota.numero || nota.spedy_id}.xml`, { type: 'text/xml' });
        const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: xmlFile });

        if (!uploadResp?.file_url) {
          logs.push(`FALHA: ${nota.tipo} nº ${nota.numero} - erro no upload`);
          falhas++;
          continue;
        }

        await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
          xml_url: uploadResp.file_url,
        });

        logs.push(`OK: ${nota.tipo} nº ${nota.numero}`);
        recuperadas++;
      } catch (e) {
        logs.push(`ERRO: ${nota.tipo} nº ${nota.numero} - ${e.message}`);
        falhas++;
      }
    }

    return Response.json({
      sucesso: true,
      total_sem_xml_geral: todasSemXml.length,
      processadas_agora: semXml.length,
      restantes: Math.max(0, todasSemXml.length - semXml.length),
      recuperadas,
      falhas,
      logs,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});