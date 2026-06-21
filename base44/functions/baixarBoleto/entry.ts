import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ erro: 'Não autorizado' }, { status: 401 });

    const { url } = await req.json();
    if (!url) return Response.json({ erro: 'URL não informada' }, { status: 400 });

    const resp = await fetch(url);
    if (!resp.ok) return Response.json({ erro: 'Falha ao buscar boleto' }, { status: 502 });

    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || 'application/pdf';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="boleto.pdf"',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});