import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Mapeamento de cidades MG para código de município IBGE
const MUNICIPIOS_MG = {
  'PATOS DE MINAS': '3148004',
  'VARJÃO DE MINAS': '3170750',
  // Adicione mais cidades conforme necessário
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { cidade, estado } = await req.json();

    if (!cidade || !estado) {
      return Response.json({ error: 'Cidade e estado são obrigatórios' }, { status: 400 });
    }

    // Normalizar entrada
    const cidadeNormalizada = cidade.trim().toUpperCase();
    const estadoNormalizado = estado.trim().toUpperCase();

    // Se for MG, buscar no mapeamento
    if (estadoNormalizado === 'MG') {
      const codigo = MUNICIPIOS_MG[cidadeNormalizada];
      if (codigo) {
        return Response.json({ codigo, encontrado: true });
      }
    }

    // Se não encontrar, retornar não encontrado
    return Response.json({ 
      codigo: null, 
      encontrado: false,
      mensagem: `Cidade ${cidade} não encontrada na base de dados. Preencha manualmente.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});