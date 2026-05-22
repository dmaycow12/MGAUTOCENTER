import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });

    const apiKey = Deno.env.get('FOCUSNFE_API_KEY') || '';
    if (!apiKey) return Response.json({ sucesso: false, erro: 'FOCUSNFE_API_KEY não configurada' }, { status: 500 });

    const configs = await base44.asServiceRole.entities.Configuracao.list('-created_date', 200);
    const getConf = (chave, padrao = '') => configs.find(c => c.chave === chave)?.valor || padrao;
    const cnpjEmpresa = getConf('cnpj', '').replace(/\D/g, '');

    if (!cnpjEmpresa) return Response.json({ sucesso: false, erro: 'CNPJ da empresa não configurado nas configurações do sistema' }, { status: 400 });

    const authHeader = 'Basic ' + btoa(apiKey + ':');
    const baseUrl = `https://api.focusnfe.com.br/v2/nfes_recebidas?cnpj_empresa=${cnpjEmpresa}&ambiente=1`;

    const resp = await fetch(baseUrl, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });

    const responseText = await resp.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return Response.json({ sucesso: false, erro: "Resposta inválida da Focus." }, { status: 200 });
    }

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