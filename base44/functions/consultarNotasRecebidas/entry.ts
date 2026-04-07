import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');

// Busca paginada de um endpoint FocusNFe com cursor por página
async function buscarPaginado(endpoint, maxPaginas = 40) {
  let todas = [];
  let pagina = 1;
  for (let i = 0; i < maxPaginas; i++) {
    const url = `${FOCUSNFE_BASE}/${endpoint}?pagina=${pagina}`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': AUTH_HEADER } });
    if (!resp.ok) break;
    const lote = await resp.json().catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas = todas.concat(lote);
    if (lote.length < 50) break;
    pagina++;
  }
  return todas;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Busca notas já existentes para evitar duplicatas
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const refsExistentes = new Set(notasExistentes.map(n => n.spedy_id).filter(Boolean));
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    let importadas = 0;

    // ===== BUSCAR NFe EMITIDAS =====
    const nfes = await buscarPaginado('nfes');
    for (const nf of nfes) {
      const ref = nf.ref || '';
      const chave = nf.chave_nfe || '';

      // Pular canceladas e que já existem
      if (refsExistentes.has(ref)) continue;
      if (chave && chavesExistentes.has(chave)) continue;

      const situacao = nf.situacao || '';
      // Apenas notas autorizadas ou canceladas
      if (!['autorizado', 'cancelado', 'cancelada'].includes(situacao.toLowerCase())) continue;

      const status = situacao.toLowerCase().includes('cancel') ? 'Cancelada' : 'Emitida';

      // Buscar detalhes completos
      let numero = '';
      let serie = '1';
      let clienteNome = '';
      let clienteCpfCnpj = '';
      let valorTotal = 0;
      let dataEmissao = '';
      let xmlContent = '';

      if (ref) {
        try {
          const detResp = await fetch(`${FOCUSNFE_BASE}/nfes/${ref}`, { headers: { 'Authorization': AUTH_HEADER } });
          if (detResp.ok) {
            const det = await detResp.json();
            numero = det.numero_nfe || det.numero || '';
            serie = det.serie || '1';
            clienteNome = det.nome_destinatario || det.destinatario?.nome || '';
            clienteCpfCnpj = det.cpf_destinatario || det.cnpj_destinatario || det.destinatario?.cnpj || det.destinatario?.cpf || '';
            valorTotal = parseFloat(det.valor_total || nf.valor_total || '0');
            dataEmissao = (det.data_emissao || nf.data_emissao || '').substring(0, 10);
            // Tenta pegar XML
            const xmlResp = await fetch(`${FOCUSNFE_BASE}/nfes/${ref}.xml`, { headers: { 'Authorization': AUTH_HEADER } });
            if (xmlResp.ok) {
              const ct = xmlResp.headers.get('content-type') || '';
              if (ct.includes('xml')) xmlContent = await xmlResp.text();
            }
          }
        } catch (_) {}
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFe',
        numero,
        serie,
        status,
        spedy_id: ref,
        chave_acesso: chave,
        cliente_nome: clienteNome,
        cliente_cpf_cnpj: clienteCpfCnpj,
        valor_total: valorTotal,
        data_emissao: dataEmissao,
        xml_content: xmlContent,
        observacoes: `Importado via Buscar da SEFAZ`,
        mensagem_sefaz: situacao,
      });

      importadas++;
      if (ref) refsExistentes.add(ref);
      if (chave) chavesExistentes.add(chave);
    }

    // ===== BUSCAR NFSe EMITIDAS =====
    const nfses = await buscarPaginado('nfses');
    for (const nf of nfses) {
      const ref = nf.ref || '';
      if (refsExistentes.has(ref)) continue;

      const situacao = nf.situacao || '';
      if (!['autorizado', 'cancelado', 'cancelada', 'emitida'].includes(situacao.toLowerCase())) continue;

      const status = situacao.toLowerCase().includes('cancel') ? 'Cancelada' : 'Emitida';

      let numero = '';
      let clienteNome = '';
      let clienteCpfCnpj = '';
      let valorTotal = 0;
      let dataEmissao = '';

      if (ref) {
        try {
          const detResp = await fetch(`${FOCUSNFE_BASE}/nfses/${ref}`, { headers: { 'Authorization': AUTH_HEADER } });
          if (detResp.ok) {
            const det = await detResp.json();
            numero = det.numero_rps || det.numero || '';
            clienteNome = det.nome_tomador || det.tomador?.nome || '';
            clienteCpfCnpj = det.cpf_tomador || det.cnpj_tomador || det.tomador?.cnpj || det.tomador?.cpf || '';
            valorTotal = parseFloat(det.valor_servicos || det.valor_total || nf.valor_total || '0');
            dataEmissao = (det.data_emissao || nf.data_emissao || '').substring(0, 10);
          }
        } catch (_) {}
      }

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFSe',
        numero,
        serie: '1',
        status,
        spedy_id: ref,
        cliente_nome: clienteNome,
        cliente_cpf_cnpj: clienteCpfCnpj,
        valor_total: valorTotal,
        data_emissao: dataEmissao,
        observacoes: `Importado via Buscar da SEFAZ`,
        mensagem_sefaz: situacao,
      });

      importadas++;
      if (ref) refsExistentes.add(ref);
    }

    return Response.json({
      sucesso: true,
      mensagem: importadas > 0
        ? `${importadas} nota(s) importada(s) da SEFAZ (NFe + NFSe).`
        : `Nenhuma nota nova encontrada.`,
      importadas,
      nfes_consultadas: nfes.length,
      nfses_consultadas: nfses.length,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});