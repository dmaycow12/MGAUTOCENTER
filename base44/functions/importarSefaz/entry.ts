import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // URL COM AMBIENTE 1 (PRODUÇÃO) FORÇADO
    const cnpjEmpresa = '54043647000120';
    const apiKey = 'NoVwceYcJEYWnkweE8agjTEzBRtDe9lr';
    const baseUrl = `https://api.focusnfe.com.br/v2/nfes_recebidas?cnpj_empresa=${cnpjEmpresa}&ambiente=1`; 
    
    const authHeader = 'Basic ' + btoa(apiKey + ':');

    const resp = await fetch(baseUrl, {
      method: 'GET',
      headers: { 
        'Authorization': authHeader 
      }
    });

    const responseText = await resp.text();
    let result;
    
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return Response.json({ sucesso: false, erro: "Erro na resposta da Focus NFe." }, { status: 200 });
    }

    if (!resp.ok) {
      // Se ainda der erro, vamos mostrar exatamente o que a Focus respondeu
      const msgErro = result.erros ? result.erros[0].mensagem : (result.mensagem || "Erro na SEFAZ");
      return Response.json({ sucesso: false, erro: msgErro }, { status: 200 });
    }

    return Response.json({ 
      sucesso: true, 
      mensagem: "Notas localizadas!", 
      notas: result 
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 200 });
  }
});