import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const categoriasCorretas = [
            "OUTROS",
            "ESTOQUE",
            "EXTINTOR",
            "COZINHA",
            "ESCRITÓRIO",
            "SEGURANÇA",
            "VEÍCULO",
            "FERRAMENTA",
            "ELÉTRICO",
            "PNEUMÁTICO",
            "EQUIPAMENTO"
        ];

        // Mapa de conversão de categorias duplicadas/erradas
        const mapaCategorias = {
            "EUIPAMENTO": "EQUIPAMENTO",
            "ELETRICO": "ELÉTRICO",
            "ELETRONICO": "EQUIPAMENTO",
            "ESCRITORIO": "ESCRITÓRIO",
            "VEICULO": "VEÍCULO",
            "PNEUMATICO": "PNEUMÁTICO",
            "SEGURANCA": "SEGURANÇA",
            "IMOVEL": "OUTROS",
            "OUTRO": "OUTROS",
            "MOVEL": "OUTROS",
            "MOBILIARIO": "OUTROS",
            "FERRAMENTA": "FERRAMENTA",
            "EQUIPAMENTO": "EQUIPAMENTO",
            "ELÉTRICO": "ELÉTRICO"
        };

        // Busca todos os ativos
        const ativos = await base44.asServiceRole.entities.Ativo.list();
        
        let atualizados = 0;
        for (const ativo of ativos) {
            const catNormalizada = (ativo.categoria || "").trim().toUpperCase();
            const novaCategoria = mapaCategorias[catNormalizada] || (
                categoriasCorretas.includes(catNormalizada) ? catNormalizada : "OUTROS"
            );

            if (ativo.categoria !== novaCategoria) {
                await base44.asServiceRole.entities.Ativo.update(ativo.id, { categoria: novaCategoria });
                atualizados++;
            }
        }

        // Retorna as categorias finais
        const ativosAtualizados = await base44.asServiceRole.entities.Ativo.list();
        const categoriasUsadas = [...new Set(ativosAtualizados.map(a => a.categoria).filter(Boolean))].sort();

        return Response.json({
            atualizados,
            categoriasFinais: categoriasUsadas,
            totalAtivos: ativosAtualizados.length
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});