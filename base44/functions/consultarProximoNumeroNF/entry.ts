import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const tipo = (body.tipo || 'NFe');

    let endpoint = '';
    if (tipo === 'NFCe') {
      endpoint = `/nfce?cnpj_emitente=${CNPJ_EMITENTE}&versao=4.00&status=autorizado`;
    } else {
      endpoint = `/nfe?cnpj_emitente=${CNPJ_EMITENTE}&versao=4.00&status=autorizado`;
    }

    const resp = await fetch(`${FOCUSNFE_BASE}${endpoint}`, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (!resp.ok) {
      // Fallback: busca último número salvo na Configuracao
      const chave = tipo === 'NFCe' ? 'nfce_ultimo_numero' : 'nfe_ultimo_numero';
      const configs = await base44.asServiceRole.entities.Configuracao.filter({ chave });
      const ultimo = parseInt(configs[0]?.valor || '0', 10);
      return Response.json({ sucesso: true, proximo_numero: ultimo + 1, fonte: 'local' });
    }

    const data = await resp.json();
    // Focus NFe retorna array de notas; pegamos o maior número
    const notas = Array.isArray(data) ? data : (data.notas || []);
    const numeros = notas
      .map(n => parseInt(n.numero || n.numero_nfe || '0', 10))
      .filter(n => !isNaN(n) && n > 0);

    let ultimoNumero = numeros.length > 0 ? Math.max(...numeros) : 0;

    // Salva na Configuracao para ter fallback local
    const chave = tipo === 'NFCe' ? 'nfce_ultimo_numero' : 'nfe_ultimo_numero';
    const configs = await base44.asServiceRole.entities.Configuracao.filter({ chave });
    const ultimoLocal = parseInt(configs[0]?.valor || '0', 10);

    // Usa o maior entre Focus NFe e local
    ultimoNumero = Math.max(ultimoNumero, ultimoLocal);

    // Atualiza local
    if (configs.length > 0) {
      await base44.asServiceRole.entities.Configuracao.update(configs[0].id, { valor: String(ultimoNumero) });
    } else {
      await base44.asServiceRole.entities.Configuracao.create({ chave, valor: String(ultimoNumero), descricao: `Último número ${tipo} autorizado` });
    }

    return Response.json({ sucesso: true, proximo_numero: ultimoNumero + 1, ultimo_numero: ultimoNumero, fonte: 'focusnfe' });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message, proximo_numero: 1 });
  }
});