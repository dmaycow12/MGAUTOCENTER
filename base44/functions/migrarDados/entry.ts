import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const ordensAntiga = await base44.entities.OrdemServico.list('-created_date', 1000);
    console.log(`Encontradas ${ordensAntiga.length} ordens em OrdemServico`);

    if (ordensAntiga.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhuma ordem encontrada',
        migradas: 0 
      });
    }

    // Buscar já existentes em Vendas
    const vendas = await base44.entities.Vendas.list('-created_date', 1000);
    const vendasExistentes = new Set(vendas.map(v => v.numero));
    
    let migradas = 0;
    for (const ordem of ordensAntiga) {
      // Pular se já existe
      if (vendasExistentes.has(ordem.numero)) {
        console.log(`Saltando ordem ${ordem.numero} (já existe em Vendas)`);
        continue;
      }

      const dados = { ...ordem };
      delete dados.id;
      delete dados.created_date;
      delete dados.updated_date;
      delete dados.created_by;

      try {
        await base44.entities.Vendas.create(dados);
        migradas++;
        
        // Pequeno delay para evitar rate limit
        if (migradas % 10 === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (e) {
        console.error(`Erro ao migrar ordem ${ordem.numero}:`, e.message);
      }
    }

    console.log(`${migradas} ordens migradas para Vendas`);

    return Response.json({ 
      success: true, 
      message: `${migradas} ordens migradas com sucesso`,
      migradas,
      total: ordensAntiga.length
    });
  } catch (error) {
    console.error('Erro na migração:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});