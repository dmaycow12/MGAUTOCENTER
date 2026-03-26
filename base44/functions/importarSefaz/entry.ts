import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // CORREÇÃO: Coloquei o "S" (nfes_recebidas) no endereço da Sefaz!
    const baseUrl = 'https://api.focusnfe.com.br/v2/nfes_recebidas'; 
    const apiKey = 'NoVwceYcJEYWnkweE8agjTEzBRtDe9lr'; // Token Principal de Produção
    const cnpjEmpresa = '54043647000120'; // CNPJ da MG Autocenter
    
    const authHeader = 'Basic ' + btoa(apiKey + ':');

    // Vai na Sefaz perguntar: "Tem nota nova pra esse CNPJ?"
    const resp = await fetch(`${baseUrl}?cnpj=${cnpjEmpresa}`, {
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
      return Response.json({ sucesso: false, erro: `Erro de comunicação com a SEFAZ.` }, { status: 200 });
    }

    if (!resp.ok) {
      const msgErro = result.erros ? result.erros[0].mensagem : (result.mensagem || "Erro Desconhecido na Sefaz");
      return Response.json({ sucesso: false, erro: `${msgErro}` }, { status: 200 });
    }

    // Retorna a lista de notas encontradas
    return Response.json({ 
      sucesso: true, 
      mensagem: "Busca na SEFAZ concluída!", 
      notas_encontradas: result 
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 200 });
  }
});