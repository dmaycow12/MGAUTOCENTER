import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { SignJWT } from 'npm:jose@5.9.6';

// Rate limiting: username -> { count, firstAttempt }
const rateLimitMap = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, firstAttempt: now });
    return { allowed: true };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const retryMin = Math.ceil((WINDOW_MS - (now - entry.firstAttempt)) / 60000);
    return { allowed: false, retryMin };
  }
  entry.count++;
  return { allowed: true };
}

function clearRateLimit(key) {
  rateLimitMap.delete(key);
}

Deno.serve(async (req) => {
   try {
     const base44 = createClientFromRequest(req);
     const body = await req.json();
     const { usuario, senha } = body;

     if (!usuario || !senha) {
       return Response.json({ erro: "Usuário e senha são obrigatórios." }, { status: 400 });
     }

     const usuarioNorm = String(usuario || "").trim().toLowerCase();
     const senhaInput = String(senha || "").trim();

    // Verifica rate limit
    const rateCheck = checkRateLimit(usuarioNorm);
    if (!rateCheck.allowed) {
      return Response.json({
        erro: `Muitas tentativas. Tente novamente em ${rateCheck.retryMin} minuto(s).`
      }, { status: 429 });
    }

    // Busca usuários
    const configs = await base44.asServiceRole.entities.Configuracao.list("-created_date", 200);
    const usuarios = configs
      .filter(c => c.chave === "usuario_extra")
      .map(c => { try { return { ...JSON.parse(c.valor), _id: c.id }; } catch { return null; } })
      .filter(Boolean);

    console.log(`[LOGIN] Procurando usuário: ${usuarioNorm}, Total de usuários: ${usuarios.length}`);
    usuarios.forEach(u => console.log(`  - ${u.usuario?.toLowerCase()}`));

    const encontrado = usuarios.find(u => u.usuario?.toLowerCase() === usuarioNorm);
    console.log(`[LOGIN] Usuário encontrado: ${encontrado ? "SIM" : "NÃO"}`);
    if (!encontrado) {
      return Response.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
    }

    // Verifica senha (com migração automática de texto plano para bcrypt)
    let senhaOk = false;
    const isBcrypt = encontrado.senha?.startsWith("$2");
    if (isBcrypt) {
      senhaOk = await bcrypt.compare(senha, encontrado.senha);
    } else {
      senhaOk = encontrado.senha === senha;
      if (senhaOk) {
        const hash = await bcrypt.hash(senha, 10);
        const { _id, ...rest } = encontrado;
        await base44.asServiceRole.entities.Configuracao.update(_id, {
          chave: "usuario_extra",
          valor: JSON.stringify({ ...rest, senha: hash }),
          descricao: `Usuário extra: ${encontrado.nome}`,
        });
      }
    }

    if (!senhaOk) {
      return Response.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
    }

    clearRateLimit(usuarioNorm);

    // Gera JWT
    const secret = new TextEncoder().encode(Deno.env.get("AUTH_SECRET"));
    const token = await new SignJWT({
      usuario: encontrado.usuario,
      nome: encontrado.nome,
      tipo: encontrado.tipo || "gerente",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("12h")
      .sign(secret);

    // SameSite=None; Secure é necessário para funcionar em iframes (ex: preview Base44)
    const cookieValue = `oficina_token=${token}; HttpOnly; Path=/; Max-Age=43200; SameSite=None; Secure`;

    return new Response(JSON.stringify({
      sucesso: true,
      nome: encontrado.nome,
      usuario: encontrado.usuario,
      tipo: encontrado.tipo || "gerente",
      token, // fallback para ambientes que bloqueiam cookies (ex: iframe)
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