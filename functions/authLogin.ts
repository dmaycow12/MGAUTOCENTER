import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { SignJWT } from 'npm:jose@5.9.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { usuario, senha } = await req.json();

    if (!usuario || !senha) {
      return Response.json({ erro: "Credenciais inválidas." }, { status: 400 });
    }

    const configs = await base44.asServiceRole.entities.Configuracao.list("-created_date", 200);
    const todosUsuarios = configs
      .filter(c => c.chave === "usuario_extra")
      .map(c => { try { return { ...JSON.parse(c.valor), _id: c.id }; } catch { return null; } })
      .filter(Boolean);

    const usuarioNorm = usuario.trim().toLowerCase();
    const encontrado = todosUsuarios.find(u => u.usuario?.toLowerCase() === usuarioNorm);

    if (!encontrado) {
      return Response.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
    }

    const senhaArmazenada = encontrado.senha || "";
    let senhaValida = false;

    if (senhaArmazenada.startsWith("$2")) {
      // Já está em bcrypt
      senhaValida = await bcrypt.compare(senha, senhaArmazenada);
    } else {
      // Texto puro — migração automática para bcrypt
      senhaValida = senhaArmazenada === senha;
      if (senhaValida) {
        const hash = await bcrypt.hash(senha, 10);
        const novoValor = { nome: encontrado.nome, usuario: encontrado.usuario, senha: hash, tipo: encontrado.tipo };
        await base44.asServiceRole.entities.Configuracao.update(encontrado._id, {
          chave: "usuario_extra",
          valor: JSON.stringify(novoValor),
          descricao: `Usuário extra: ${encontrado.nome}`
        });
      }
    }

    if (!senhaValida) {
      return Response.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
    }

    const secret = Deno.env.get("AUTH_SECRET");
    const secretKey = new TextEncoder().encode(secret);
    const tipo = encontrado.tipo || "gerente";

    const token = await new SignJWT({ usuario: encontrado.usuario, nome: encontrado.nome, tipo })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("12h")
      .setIssuedAt()
      .sign(secretKey);

    return Response.json({
      token,
      usuario: encontrado.usuario,
      nome: encontrado.nome,
      tipo,
      role: tipo === "gerente" ? "admin" : "user",
    });
  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});