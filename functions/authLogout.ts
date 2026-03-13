Deno.serve(async (_req) => {
  return new Response(JSON.stringify({ sucesso: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "oficina_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict",
    }
  });
});