import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const norm = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const mapearForma = (fp) => {
  const f = (fp || "").toUpperCase();
  if (f.includes("DINHEIRO")) return "Dinheiro";
  if (f.includes("CRÉDITO") || f.includes("CREDITO")) return "Cartão";
  if (f.includes("DÉBITO") || f.includes("DEBITO")) return "Cartão";
  if (f.includes("PIX")) return "PIX";
  if (f.includes("BOLETO")) return "Boleto";
  return "PIX";
};

async function montarRelatorio(base44) {
  const [notas, fins] = await Promise.all([
    base44.entities.NotaFiscal.list("-created_date", 9999),
    base44.entities.Financeiro.list("-created_date", 9999),
  ]);

  // 1) Notas de entrada com status "Lançada" que não têm lançamento financeiro correspondente
  const finKeys = new Set(fins.map((f) => norm(f.descricao).slice(0, 30)));
  const faltantes = notas
    .filter((n) =>
      n.status === "Lançada" &&
      n.tipo === "NFe" &&
      !finKeys.has(norm(`NF ${n.numero} — ${n.cliente_nome}`).slice(0, 30))
    )
    .map((n) => ({
      id: n.id,
      numero: n.numero || "",
      cliente: n.cliente_nome || "",
      valor: Number(n.valor_total || 0),
      data_emissao: n.data_emissao || "",
      forma_pagamento: n.forma_pagamento || "",
      observacoes: n.observacoes || "",
    }));

  // 2) Lançamentos financeiros duplicados (mesma descrição + valor + vencimento)
  const grupos = new Map();
  for (const f of fins) {
    if (f.status === "Cancelado") continue;
    const chave = `${norm(f.descricao)}|${Math.round(Number(f.valor || 0) * 100)}|${f.data_vencimento || ""}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(f);
  }
  const duplicatas = [];
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    grupo.sort((a, b) => String(a.created_date || "").localeCompare(String(b.created_date || "")));
    for (const dup of grupo.slice(1)) {
      duplicatas.push({
        id: dup.id,
        descricao: dup.descricao || "",
        tipo: dup.tipo || "",
        valor: Number(dup.valor || 0),
        data_vencimento: dup.data_vencimento || "",
      });
    }
  }

  const soma = (arr) => Math.round(arr.reduce((s, x) => s + Number(x.valor || 0), 0) * 100) / 100;

  return {
    total_lancadas: notas.filter((n) => n.status === "Lançada" && n.tipo === "NFe").length,
    total_financeiro: fins.length,
    faltantes,
    duplicatas,
    faltantes_valor: soma(faltantes),
    duplicatas_valor: soma(duplicatas),
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const acao = String((body && body.acao) || "verificar");

    if (acao === "lancar_faltantes") {
      const rel = await montarRelatorio(base44);
      if (rel.faltantes.length > 0) {
        const registros = rel.faltantes.map((n) => {
          const isDev = /devolu/i.test(n.observacoes || "");
          return {
            tipo: isDev ? "Receita" : "Despesa",
            categoria: isDev ? "Devolução de Compra" : "Compra de Peças / Materiais",
            descricao: `NF ${n.numero} — ${n.cliente}${isDev ? " (Devolução)" : ""}`,
            valor: n.valor,
            forma_pagamento: mapearForma(n.forma_pagamento),
            data_vencimento: n.data_emissao,
            data_pagamento: "",
            status: "Pendente",
            observacoes: "Lançado pelo verificador de lançamentos",
          };
        });
        await base44.entities.Financeiro.bulkCreate(registros);
      }
      const novo = await montarRelatorio(base44);
      return Response.json({ ...novo, mensagem: `${rel.faltantes.length} lançamento(s) criado(s) com sucesso` });
    }

    if (acao === "excluir_duplicatas") {
      const rel = await montarRelatorio(base44);
      if (rel.duplicatas.length > 0) {
        const ids = rel.duplicatas.map((d) => d.id);
        await base44.entities.Financeiro.deleteMany({ id: { $in: ids } });
      }
      const novo = await montarRelatorio(base44);
      return Response.json({ ...novo, mensagem: `${rel.duplicatas.length} duplicata(s) removida(s) com sucesso` });
    }

    const rel = await montarRelatorio(base44);
    return Response.json(rel);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}