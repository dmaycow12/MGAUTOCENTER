import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const itens = await base44.asServiceRole.entities.Estoque.list("-created_date", 2000);

  let totalCorrigidos = 0;
  let totalDuplicatasRemovidas = 0;

  for (const item of itens) {
    const historico = Array.isArray(item.historico) ? item.historico : [];
    if (historico.length === 0) continue;

    // Detecta duplicatas: mesma observacao (NF X), mesmo tipo, mesma quantidade, mesma data (dia)
    const vistos = new Map();
    const historicoLimpo = [];
    let removidas = 0;

    for (const mov of historico) {
      // Chave de unicidade: tipo + observacao + quantidade + dia
      const dia = mov.data ? mov.data.substring(0, 10) : "sem-data";
      const chave = `${mov.tipo}|${mov.observacao || ""}|${mov.quantidade}|${dia}`;

      if (vistos.has(chave)) {
        removidas++;
      } else {
        vistos.set(chave, true);
        historicoLimpo.push(mov);
      }
    }

    if (removidas > 0) {
      // Recalcula quantidade baseada no histórico limpo
      let qtdBase = 0;
      for (const mov of historicoLimpo) {
        if (mov.tipo === "entrada") qtdBase += Number(mov.quantidade || 0);
        else if (mov.tipo === "saida" || mov.tipo === "saída") qtdBase -= Number(mov.quantidade || 0);
      }

      await base44.asServiceRole.entities.Estoque.update(item.id, {
        historico: historicoLimpo,
        quantidade: Math.max(0, qtdBase),
      });

      totalCorrigidos++;
      totalDuplicatasRemovidas += removidas;
    }
  }

  return Response.json({
    sucesso: true,
    mensagem: `${totalCorrigidos} produto(s) corrigido(s), ${totalDuplicatasRemovidas} entrada(s) duplicada(s) removida(s).`,
    totalCorrigidos,
    totalDuplicatasRemovidas,
  });
});