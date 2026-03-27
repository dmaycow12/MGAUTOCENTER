import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // NOTA IMPORTANTE: A API Focus NFe não expõe endpoint público para consultar notas recebidas diretamente.
    // A distribuição de NF-e (DFe) via SEFAZ requer:
    // 1. Integração webhook na Focus NFe para receber notificações em tempo real
    // 2. Ou integração direta com a Sefaz via APIs de manifestação
    
    // Por enquanto, retorna informação sobre a limitação
    return Response.json({
      sucesso: true,
      mensagem: 'Consulta DFe não disponível via API da Focus NFe. Configure webhooks na sua conta Focus para receber notificações automáticas.',
      importadas: 0,
      detalhes: {
        cnpj: CNPJ_EMITENTE,
        instrucao: 'Acesse https://focusnfe.com.br/doc/#webhooks para configurar webhooks de recebimento de NF-e',
        opcoes: [
          'Registrar webhook para eventos de "nfe_recebida"',
          'Integrar com Sefaz diretamente para distribuição de documentos',
          'Usar importação manual de XML via plataforma'
        ]
      }
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});