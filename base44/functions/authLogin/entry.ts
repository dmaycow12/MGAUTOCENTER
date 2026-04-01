import { SignJWT } from 'npm:jose@5.9.6';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const usuario = (body.usuario || "").trim().toLowerCase();
    const senha = body.senha || "";

    if (!usuario || !senha) {
      return Response.json({ erro: "Usuário e senha são obrigatórios." }, { status: 400 });
    }

    const usuariosPadrão = [
      { usuario: "admin", nome: "Administrador", tipo: "admin", senha: "admin" }
    ];

    const encontrado = usuariosPadrão.find(u => u.usuario === usuario);

    if (!encontrado || encontrado.senha !== senha) {
      return Response.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
    }

    const secret = new TextEncoder().encode(Deno.env.get("AUTH_SECRET") || "SECRET");
    const token = await new SignJWT({
      usuario: encontrado.usuario,
      nome: encontrado.nome,
      tipo: encontrado.tipo,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("12h")
      .sign(secret);

    const cookieValue = "oficina_token=" + token + "; HttpOnly; Path=/; Max-Age=43200; SameSite=None; Secure";

    return new Response(JSON.stringify({
      sucesso: true,
      nome: encontrado.nome,
      usuario: encontrado.usuario,
      tipo: encontrado.tipo,
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