import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOCUSNFE_API_KEY = Deno.env.get('FOCUSNFE_API_KEY');
const FOCUSNFE_URL = 'https://api.focusnfe.com.br/v2';

async function buscarNotasEmitidas(dataInicio) {
  const notasEmitidas = [];
  let pagina = 0;
  let temMais = true;

  while (temMais && pagina < 100) {
    try {
      const url = new URL(`${FOCUSNFE_URL}/nfes`);
      url.searchParams.append('api_key', FOCUSNFE_API_KEY);
      url.searchParams.append('data_inicio', dataInicio);
      url.searchParams.append('data_fim', new Date().toISOString().split('T')[0]);
      url.searchParams.append('limite', '50');
      url.searchParams.append('offset', String(pagina * 50));

      const resp = await fetch(url.toString(), { method: 'GET' });
      const data = await resp.json();

      if (!data || !Array.isArray(data)) break;
      if (data.length === 0) break;

      notasEmitidas.push(...data);
      temMais = data.length === 50;
      pagina++;
    } catch (e) {
      console.error(`[EMITIDAS] Erro na página ${pagina}:`, e.message);
      break;
    }
  }

  return notasEmitidas;
}

async function buscarNotasRecebidas(dataInicio) {
  const notasRecebidas = [];
  let pagina = 0;
  let temMais = true;

  while (temMais && pagina < 100) {
    try {
      const url = new URL(`${FOCUSNFE_URL}/nfes_recebidas`);
      url.searchParams.append('api_key', FOCUSNFE_API_KEY);
      url.searchParams.append('data_inicio', dataInicio);
      url.searchParams.append('data_fim', new Date().toISOString().split('T')[0]);
      url.searchParams.append('limite', '50');
      url.searchParams.append('offset', String(pagina * 50));

      const resp = await fetch(url.toString(), { method: 'GET' });
      const data = await resp.json();

      if (!data || !Array.isArray(data)) break;
      if (data.length === 0) break;

      notasRecebidas.push(...data);
      temMais = data.length === 50;
      pagina++;
    } catch (e) {
      console.error(`[RECEBIDAS] Erro na página ${pagina}:`, e.message);
      break;
    }
  }

  return notasRecebidas;
}

async function fetchXmlNota(referencia, tipo) {
  try {
    const url = `${FOCUSNFE_URL}/${tipo}s/${referencia}/xml`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${FOCUSNFE_API_KEY}` },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

async function fetchPdfNota(referencia, tipo) {
  try {
    const url = `${FOCUSNFE_URL}/${tipo}s/${referencia}/pdf`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${FOCUSNFE_API_KEY}` },
    });
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

async function uploadArquivo(base44, arquivo, nomeArquivo) {
  try {
    const blob = typeof arquivo === 'string' 
      ? new Blob([arquivo], { type: 'application/xml' })
      : new Blob([arquivo], { type: 'application/pdf' });
    
    const file = new File([blob], nomeArquivo, { type: blob.type });
    const res = await base44.integrations.Core.UploadFile({ file });
    return res.file_url;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    console.log('[SINCRONIZAÇÃO] Iniciando busca de notas a partir de 2026-03-01...');

    const [notasEmitidas, notasRecebidas] = await Promise.all([
      buscarNotasEmitidas('2026-03-01'),
      buscarNotasRecebidas('2026-03-01'),
    ]);

    console.log(`[EMITIDAS] ${notasEmitidas.length} notas encontradas`);
    console.log(`[RECEBIDAS] ${notasRecebidas.length} notas encontradas`);

    let emitidasCriadas = 0, emitidAsXmlRecuperados = 0, emitidasPdfRecuperados = 0;
    let recebidasCriadas = 0, recebidAsXmlRecuperados = 0, recebidasPdfRecuperados = 0;

    // Processar notas emitidas
    for (const nf of notasEmitidas) {
      try {
        const existente = await base44.entities.NotaFiscal.filter(
          { chave_acesso: nf.chave_acesso },
          '-created_date',
          1
        );

        if (existente.length === 0) {
          const xml = await fetchXmlNota(nf.referencia, 'nfe');
          const pdfBuffer = await fetchPdfNota(nf.referencia, 'nfe');

          let xml_url = null, pdf_url = null;

          if (xml) {
            xml_url = await uploadArquivo(base44, xml, `${nf.numero}_${nf.serie}.xml`);
            if (xml_url) emitidAsXmlRecuperados++;
          }

          if (pdfBuffer) {
            pdf_url = await uploadArquivo(base44, pdfBuffer, `${nf.numero}_${nf.serie}.pdf`);
            if (pdf_url) emitidasPdfRecuperados++;
          }

          const cliente = await base44.entities.Cadastro.filter(
            { cpf_cnpj: nf.cnpj_destinatario?.replace(/\D/g, '') },
            '-created_date',
            1
          );

          await base44.entities.NotaFiscal.create({
            tipo: 'NFe',
            numero: String(nf.numero),
            serie: String(nf.serie),
            status: 'Emitida',
            cliente_nome: nf.nome_destinatario || 'Desconhecido',
            cliente_cpf_cnpj: nf.cnpj_destinatario || '',
            cliente_id: cliente.length > 0 ? cliente[0].id : null,
            data_emissao: nf.data_emissao?.split('T')[0] || new Date().toISOString().split('T')[0],
            valor_total: nf.valor_total || 0,
            chave_acesso: nf.chave_acesso,
            spedy_id: nf.referencia,
            xml_url,
            pdf_url,
            xml_original: xml || undefined,
          });

          emitidasCriadas++;
        }
      } catch (e) {
        console.error(`[EMITIDA] Erro ao processar ${nf.numero}:`, e.message);
      }
    }

    // Processar notas recebidas
    for (const nf of notasRecebidas) {
      try {
        const existente = await base44.entities.NotaFiscal.filter(
          { chave_acesso: nf.chave_acesso },
          '-created_date',
          1
        );

        if (existente.length === 0) {
          const xml = await fetchXmlNota(nf.referencia, 'nfe_recebida');
          const pdfBuffer = await fetchPdfNota(nf.referencia, 'nfe_recebida');

          let xml_url = null, pdf_url = null;

          if (xml) {
            xml_url = await uploadArquivo(base44, xml, `entrada_${nf.numero}_${nf.serie}.xml`);
            if (xml_url) recebidAsXmlRecuperados++;
          }

          if (pdfBuffer) {
            pdf_url = await uploadArquivo(base44, pdfBuffer, `entrada_${nf.numero}_${nf.serie}.pdf`);
            if (pdf_url) recebidasPdfRecuperados++;
          }

          const fornecedor = await base44.entities.Cadastro.filter(
            { cpf_cnpj: nf.cnpj_emitente?.replace(/\D/g, '') },
            '-created_date',
            1
          );

          await base44.entities.NotaFiscal.create({
            tipo: 'NFe',
            numero: String(nf.numero),
            serie: String(nf.serie),
            status: 'Importada',
            cliente_nome: nf.nome_emitente || 'Fornecedor',
            cliente_cpf_cnpj: nf.cnpj_emitente || '',
            cliente_id: fornecedor.length > 0 ? fornecedor[0].id : null,
            data_emissao: nf.data_emissao?.split('T')[0] || new Date().toISOString().split('T')[0],
            valor_total: nf.valor_total || 0,
            chave_acesso: nf.chave_acesso,
            spedy_id: nf.referencia,
            xml_url,
            pdf_url,
            xml_original: xml || undefined,
          });

          recebidasCriadas++;
        }
      } catch (e) {
        console.error(`[RECEBIDA] Erro ao processar ${nf.numero}:`, e.message);
      }
    }

    const resultado = {
      sucesso: true,
      mensagem: `Sincronização concluída a partir de 2026-03-01`,
      emitidas: {
        encontradas: notasEmitidas.length,
        criadas: emitidasCriadas,
        xmlRecuperados: emitidAsXmlRecuperados,
        pdfRecuperados: emitidasPdfRecuperados,
      },
      recebidas: {
        encontradas: notasRecebidas.length,
        criadas: recebidasCriadas,
        xmlRecuperados: recebidAsXmlRecuperados,
        pdfRecuperados: recebidasPdfRecuperados,
      },
      total: emitidasCriadas + recebidasCriadas,
    };

    return Response.json(resultado);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});