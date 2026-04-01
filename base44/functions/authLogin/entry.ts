import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { SignJWT } from 'npm:jose@5.9.6';

const rateLimitMap = new Map();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const usuario = body.usuario;
    const senha = body.senha;

    if (!usuario || !senha) {
      return Response.json({ erro: "Usuário e senha são obrigatórios." }, { status: 400 });
    }

    const usuarioNorm = usuario.trim().toLowerCase();
    
    const usuariosPadrão = [
      { usuario: "admin", nome: "Administrador", tipo: "admin", senha: "admin", _fallback: true }
    ];

    let usuarios = usuariosPadrão;

    try {
      const configs = await base44.asServiceRole.entities.Configuracao.list("-created_date", 200);
      const usuariosExtras = [];
      for (let i = 0; i < configs.length; i++) {
        const c = configs[i];
        if (c.chave === "usuario_extra") {
          try {
            const parsed = JSON.parse(c.valor);
            parsed._id = c.id;
            usuariosExtras.push(parsed);
          } catch (e) {}
        }
      }
      if (usuariosExtras.length > 0) {
        usuarios = usuariosExtras;
      }
    } catch (e) {}

    let encontrado = null;
    for (let i = 0; i < usuarios.length; i++) {
      const u = usuarios[i];
      if (u.usuario && u.usuario.toLowerCase() === usuarioNorm) {
        encontrado = u;
        break;
      }
    }

    if (!encontrado) {
      return Response.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
    }

    let senhaOk = false;
    if (encontrado.senha && encontrado.senha.startsWith("$2")) {
      senhaOk = await bcrypt.compare(senha, encontrado.senha);
    } else {
      senhaOk = encontrado.senha === senha;
    }

    if (!senhaOk) {
      return Response.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
    }

    const secret = new TextEncoder().encode(Deno.env.get("AUTH_SECRET"));
    const token = await new SignJWT({
      usuario: encontrado.usuario,
      nome: encontrado.nome,
      tipo: encontrado.tipo || "gerente",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("12h")
      .sign(secret);

    const cookieValue = "oficina_token=" + token + "; HttpOnly; Path=/; Max-Age=43200; SameSite=None; Secure";

    return new Response(JSON.stringify({
      sucesso: true,
      nome: encontrado.nome,
      usuario: encontrado.usuario,
      tipo: encontrado.tipo || "gerente",
      token: token,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieValue,
      }
    });

  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});