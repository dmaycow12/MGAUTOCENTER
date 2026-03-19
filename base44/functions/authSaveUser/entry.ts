import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { jwtVerify } from 'npm:jose@5.9.6';

function getTokenFromCookie(req) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.split(";").find(c => c.trim().startsWith("oficina_token="));
  return match ? match.split("=").slice(1).join("=").trim() : null;
}

async function verificarAdmin(req) {
  // Lê do cookie httpOnly (preferido) ou header Authorization (fallback)
  const token = getTokenFromCookie(req) || (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(Deno.env.get("AUTH_SECRET"));
    const { payload } = await jwtVerify(token, secret);
    if (payload.tipo !== "gerente") return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const admin = await verificarAdmin(req);
    if (!admin) {
      return Response.json({ erro: "Acesso negado. Apenas gerentes podem gerenciar usuários." }, { status: 403 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, _id, nome, usuario, senha, tipo } = body;

    if (action === "create") {
      if (!nome || !usuario || !senha) {
        return Response.json({ erro: "Nome, usuário e senha são obrigatórios." }, { status: 400 });
      }
      const hash = await bcrypt.hash(senha, 10);
      const novoValor = { nome, usuario, senha: hash, tipo: tipo || "gerente" };
      await base44.asServiceRole.entities.Configuracao.create({
        chave: "usuario_extra",
        valor: JSON.stringify(novoValor),
        descricao: `Usuário extra: ${nome}`,
      });
      return Response.json({ sucesso: true });
    }

    if (action === "update") {
      if (!_id) return Response.json({ erro: "ID obrigatório." }, { status: 400 });
      const atualizado = { nome, usuario, tipo };
      if (senha && senha.trim()) {
        atualizado.senha = await bcrypt.hash(senha, 10);
      } else {
        // Busca senha atual para manter
        const configs = await base44.asServiceRole.entities.Configuracao.list("-created_date", 200);
        const atual = configs.find(c => c.id === _id);
        if (atual) {
          try { atualizado.senha = JSON.parse(atual.valor).senha; } catch {}
        }
      }
      await base44.asServiceRole.entities.Configuracao.update(_id, {
        chave: "usuario_extra",
        valor: JSON.stringify(atualizado),
        descricao: `Usuário extra: ${nome}`,
      });
      return Response.json({ sucesso: true });
    }

    if (action === "delete") {
      if (!_id) return Response.json({ erro: "ID obrigatório." }, { status: 400 });
      await base44.asServiceRole.entities.Configuracao.delete(_id);
      return Response.json({ sucesso: true });
    }

    return Response.json({ erro: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});