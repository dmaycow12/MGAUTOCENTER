import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  // Aceita apenas POST
  if (req.method !== 'POST') {
    return Response.json({ erro: 'Apenas POST permitido' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Processa o body do webhook
    const body = await req.json();
    
    // Focus NFe envia a nota recebida em diferentes campos dependendo do tipo
    // Normalizando a estrutura
    const chave = body.chave_nfe || body.chave || body.chave_acesso || '';
    const numero = body.numero || body.numero_nfe || '';
    const serie = body.serie || '1';
    const emitente = body.emitente || body.nome_emitente || '';
    const cnpjEmitente = body.cnpj_emitente || body.cnpj || '';
    const dataEmissao = (body.data_emissao || body.data || '').split('T')[0] || new Date().toISOString().split('T')[0];
    const valor = Number(body.valor_total || body.valor || 0);
    const statusRecebimento = body.status || 'recebida';

    // Validação básica
    if (!chave) {
      return Response.json(
        { erro: 'Chave de acesso não encontrada no webhook' },
        { status: 400 }
      );
    }

    // Verifica se já existe
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.filter(
      { chave_acesso: chave },
      '-created_date',
      1
    );

    if (notasExistentes.length > 0) {
      // Nota já foi importada
      return Response.json({
        sucesso: true,
        mensagem: 'Nota já existente no sistema',
        chave_acesso: chave,
      });
    }

    // Salva como nota importada (entrada)
    const notaData = {
      tipo: 'NFe',
      status: 'Importada',
      chave_acesso: chave,
      numero: String(numero),
      serie: String(serie),
      cliente_nome: emitente,
      cliente_cpf_cnpj: cnpjEmitente,
      data_emissao: dataEmissao,
      valor_total: valor,
      observacoes: `NF recebida via webhook Focus NFe. Status: ${statusRecebimento}`,
      mensagem_sefaz: statusRecebimento,
    };

    const notaCriada = await base44.asServiceRole.entities.NotaFiscal.create(notaData);

    return Response.json({
      sucesso: true,
      mensagem: `Nota ${numero} de ${emitente} importada com sucesso`,
      chave_acesso: chave,
      nota_id: notaCriada.id,
    });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return Response.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
});