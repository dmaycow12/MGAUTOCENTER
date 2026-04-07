import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const notas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 30);
    
    const com_ov = notas.filter(n => n.ordem_venda_id && n.ordem_venda_id.trim() !== '');
    const sem_ov = notas.filter(n => !n.ordem_venda_id || n.ordem_venda_id.trim() === '');
    const sem_cliente = notas.filter(n => !n.cliente_id || n.cliente_id.trim() === '');
    
    const amostra = sem_ov.slice(0, 5).map(n => ({
      numero: n.numero,
      cliente_id: n.cliente_id,
      cliente_nome: n.cliente_nome,
      ordem_venda_id: n.ordem_venda_id,
      tipo: n.tipo
    }));
    
    return Response.json({
      total: notas.length,
      com_ordem_venda_id: com_ov.length,
      sem_ordem_venda_id: sem_ov.length,
      sem_cliente_id: sem_cliente.length,
      amostra_sem_ov: amostra
    });
  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});