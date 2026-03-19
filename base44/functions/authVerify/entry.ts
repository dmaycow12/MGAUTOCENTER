import { jwtVerify } from 'npm:jose@5.9.6';

function getTokenFromCookie(req) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.split(";").find(c => c.trim().startsWith("oficina_token="));
  return match ? match.split("=").slice(1).join("=").trim() : null;
}

Deno.serve(async (req) => {
  try {
    // Lê token do cookie httpOnly (preferido) ou do body (fallback)
    let token = getTokenFromCookie(req);
    if (!token) {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }

    if (!token) {
      return Response.json({ valido: false, erro: "Token não encontrado." }, { status: 401 });
    }

    const secret = new TextEncoder().encode(Deno.env.get("AUTH_SECRET"));
    const { payload } = await jwtVerify(token, secret);

    return Response.json({
      valido: true,
      usuario: payload.usuario,
      nome: payload.nome,
      tipo: payload.tipo || "gerente",
    });

  } catch {
    return Response.json({ valido: false, erro: "Token inválido ou expirado." }, { status: 401 });
  }
});