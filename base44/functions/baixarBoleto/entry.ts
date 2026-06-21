import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ erro: 'Não autorizado' }, { status: 401 });

    const { paymentId } = await req.json();
    if (!paymentId) return Response.json({ erro: 'paymentId não informado' }, { status: 400 });

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) return Response.json({ erro: 'ASAAS_API_KEY não configurada' }, { status: 500 });

    // Busca a URL do boleto em PDF via API Asaas
    const resp = await fetch(`https://api.asaas.com/v3/payments/${paymentId}/bankSlipUrl`, {
      headers: { "access_token": apiKey },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return Response.json({ erro: `Asaas retornou ${resp.status}: ${txt}` }, { status: 502 });
    }

    const data = await resp.json();
    const pdfUrl = data?.bankSlipUrl;

    if (!pdfUrl) {
      return Response.json({ erro: 'URL do PDF não encontrada na resposta do Asaas' }, { status: 502 });
    }

    // Baixa o PDF da URL retornada
    const pdfResp = await fetch(pdfUrl, { redirect: "follow" });

    if (!pdfResp.ok) {
      return Response.json({ erro: `Falha ao baixar PDF: ${pdfResp.status}` }, { status: 502 });
    }

    const buffer = await pdfResp.arrayBuffer();
    const contentType = pdfResp.headers.get("content-type") || "application/pdf";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'attachment; filename="boleto.pdf"',
      },
    });
  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});