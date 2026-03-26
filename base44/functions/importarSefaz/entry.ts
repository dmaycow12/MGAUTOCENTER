import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const cnpjEmpresa = '54043647000120';
    // USANDO O TOKEN DE PRODUÇÃO DIRETAMENTE
    const apiKey = 'NoVwceYcJEYWnkweE8agjTEzBRtDe9lr';
    
    // Forçando o ambiente 1 (Produção) na marra
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
      return Response.json({ sucesso: false, erro: "Resposta inválida da Focus." }, { status: 200 });
    }

    // Se der erro de autorização, vamos dar a dica real do que falta
    if (!resp.ok) {
      const msg = result.erros ? result.erros[0].mensagem : (result.mensagem || "Erro na SEFAZ");
      
      if (msg.includes("não autorizado")) {
        return Response.json({ 
          sucesso: false, 
          erro: "SEFAZ Recusou: Verifique se salvou a ativação de 'Produção' no painel Focus e se o Certificado A1 está correto." 
        }, { status: 200 });
      }
      return Response.json({ sucesso: false, erro: msg }, { status: 200 });
    }

    return Response.json({ 
      sucesso: true, 
      mensagem: "Notas localizadas com sucesso!", 
      notas: result 
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 200 });
  }
});