// Busca código IBGE do município via API do IBGE
// Não precisa de autenticação - é API pública

Deno.serve(async (req) => {
  try {
    const { cidade, estado } = await req.json();

    if (!cidade || !estado) {
      return Response.json({ error: 'Cidade e estado são obrigatórios' }, { status: 400 });
    }

    const cidadeNormalizada = cidade.trim().toUpperCase();
    const estadoNormalizado = estado.trim().toUpperCase();

    // Busca direto na API do IBGE
    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoNormalizado}/municipios`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return Response.json({ codigo: null, encontrado: false, mensagem: 'Erro ao consultar API do IBGE' });
    }

    const municipios = await resp.json();

    // Normaliza texto para comparação (remove acentos)
    const normalizar = (str) =>
      str.toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const cidadeNorm = normalizar(cidadeNormalizada);

    const encontrado = municipios.find(m => normalizar(m.nome) === cidadeNorm);

    if (encontrado) {
      return Response.json({ codigo: String(encontrado.id), encontrado: true });
    }

    // Tentativa de busca parcial
    const parcial = municipios.find(m => normalizar(m.nome).includes(cidadeNorm) || cidadeNorm.includes(normalizar(m.nome)));
    if (parcial) {
      return Response.json({ codigo: String(parcial.id), encontrado: true, parcial: true });
    }

    return Response.json({
      codigo: null,
      encontrado: false,
      mensagem: `Município "${cidade}" não encontrado no estado ${estado}.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});