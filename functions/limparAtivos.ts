import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Busca todos os ativos
        const ativos = await base44.asServiceRole.entities.Ativo.list();
        
        // Mapa para encontrar duplicatas (mesmo nome e categoria)
        const visto = new Map();
        const duplicatas = [];
        
        ativos.forEach(ativo => {
            const chave = `${(ativo.nome || '').trim().toUpperCase()}|${(ativo.categoria || '').trim().toUpperCase()}`;
            if (visto.has(chave)) {
                duplicatas.push(ativo.id);
            } else {
                visto.set(chave, ativo.id);
            }
        });

        // Deleta duplicatas
        for (const id of duplicatas) {
            await base44.asServiceRole.entities.Ativo.delete(id);
        }

        // Calcula totais após limpeza
        const ativosLimpos = await base44.asServiceRole.entities.Ativo.list();
        const totalCompra = ativosLimpos.reduce((acc, a) => acc + (Number(a.valor_aquisicao || 0) * Number(a.quantidade || 1)), 0);
        const totalAtual = ativosLimpos.reduce((acc, a) => acc + (Number(a.valor_atual || 0) * Number(a.quantidade || 1)), 0);

        return Response.json({
            deletedCount: duplicatas.length,
            remainingCount: ativosLimpos.length,
            totalCompra: totalCompra.toFixed(2),
            totalAtual: totalAtual.toFixed(2),
            sucesso: ativosLimpos.length === 232 && totalCompra === 356870 && totalAtual === 356870
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});