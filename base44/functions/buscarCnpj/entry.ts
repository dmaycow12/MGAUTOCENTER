async function fetchCnpjWs(cnpj) {
  const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
  });
  if (!resp.ok) throw new Error(`cnpj.ws: ${resp.status}`);
  return await resp.json();
}

async function fetchBrasilApi(cnpj) {
  const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!resp.ok) throw new Error(`BrasilAPI: ${resp.status}`);
  const d = await resp.json();
  // Normaliza para o mesmo formato do cnpj.ws
  return {
    razao_social: d.razao_social,
    capital_social: d.capital_social,
    estabelecimento: {
      cnpj: d.cnpj,
      nome_fantasia: d.nome_fantasia,
      email: d.email,
      ddd1: d.ddd_telefone_1?.substring(0, 2),
      telefone1: d.ddd_telefone_1?.substring(2),
      cep: d.cep?.replace(/\D/g, ''),
      logradouro: d.logradouro,
      numero: d.numero,
      complemento: d.complemento,
      bairro: d.bairro,
      cidade: { nome: d.municipio },
      estado: { sigla: d.uf },
      inscricoes_estaduais: []
    }
  };
}

Deno.serve(async (req) => {
  try {
    const { cnpj } = await req.json();
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return Response.json({ error: 'CNPJ inválido' }, { status: 400 });

    let data = null;
    let lastError = null;

    // Tenta cnpj.ws primeiro (tem inscrição estadual)
    try {
      data = await fetchCnpjWs(cnpjLimpo);
    } catch (e) {
      lastError = e.message;
    }

    // Fallback para BrasilAPI
    if (!data) {
      try {
        data = await fetchBrasilApi(cnpjLimpo);
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!data) {
      return Response.json({ error: `CNPJ não encontrado. ${lastError || ''}` }, { status: 404 });
    }

    return Response.json({ sucesso: true, data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});