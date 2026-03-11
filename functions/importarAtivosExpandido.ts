import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { dados } = await req.json();
        
        const ativos = [];
        
        dados.forEach(item => {
            const qtd = Number(item.col_3 || 1);
            const nome = (item.col_1 || '').trim();
            const categoria = (item.col_2 || '').trim();
            const valorAquisicao = Number(item.col_4 || 0);
            const valorAtual = Number(item.col_5 || 0);
            
            if (!nome) return;
            
            // Cria um registro para cada unidade
            for (let i = 0; i < qtd; i++) {
                ativos.push({
                    nome: nome,
                    categoria: categoria || 'OUTROS',
                    valor_aquisicao: valorAquisicao,
                    valor_atual: valorAtual,
                    quantidade: 1 // Sempre 1 agora
                });
            }
        });

        // Bulk create
        if (ativos.length > 0) {
            await base44.asServiceRole.entities.Ativo.bulkCreate(ativos);
        }

        const importados = await base44.asServiceRole.entities.Ativo.list();
        const totalCompra = importados.reduce((acc, a) => acc + Number(a.valor_aquisicao || 0), 0);
        const totalAtual = importados.reduce((acc, a) => acc + Number(a.valor_atual || 0), 0);

        return Response.json({
            importados: ativos.length,
            totalRegistros: importados.length,
            totalCompra: totalCompra.toFixed(2),
            totalAtual: totalAtual.toFixed(2)
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});