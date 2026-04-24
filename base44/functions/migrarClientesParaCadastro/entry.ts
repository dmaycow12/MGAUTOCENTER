import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', 1000);
    let migrados = 0;
    let erros = 0;

    for (const c of clientes) {
      try {
        await base44.asServiceRole.entities.Cadastro.create({
          categoria: c.categoria || 'Cliente',
          nome: c.nome || '',
          nome_fantasia: c.nome_fantasia || '',
          tipo: c.tipo || 'Pessoa Física',
          cpf_cnpj: c.cpf_cnpj || '',
          rg_ie: c.rg_ie || '',
          telefone: c.telefone || '',
          email: c.email || '',
          cep: c.cep || '',
          endereco: c.endereco || '',
          numero: c.numero || '',
          complemento: c.complemento || '',
          bairro: c.bairro || '',
          cidade: c.cidade || '',
          estado: c.estado || '',
          observacoes: c.observacoes || '',
        });
        migrados++;
      } catch (e) {
        erros++;
        console.error('Erro ao migrar cliente:', c.id, e.message);
      }
    }

    return Response.json({
      sucesso: true,
      total: clientes.length,
      migrados,
      erros,
      mensagem: `Migração concluída: ${migrados} registros migrados, ${erros} erros.`
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});