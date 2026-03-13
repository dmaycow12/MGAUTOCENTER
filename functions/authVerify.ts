import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jwtVerify } from 'npm:jose@5.9.6';

Deno.serve(async (req) => {
  try {
    const { token } = await req.json();
    if (!token) return Response.json({ valido: false }, { status: 401 });

    const secret = Deno.env.get("AUTH_SECRET");
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jwtVerify(token, secretKey);

    return Response.json({
      valido: true,
      usuario: payload.usuario,
      nome: payload.nome,
      tipo: payload.tipo,
      role: payload.tipo === "gerente" ? "admin" : "user",
    });
  } catch (error) {
    return Response.json({ valido: false, erro: "Token inválido ou expirado." }, { status: 401 });
  }
});