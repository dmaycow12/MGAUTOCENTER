import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// id_tag da nota 603827
const ID_TAG = 'NFS31480042237075339000167000000000065726040861935164';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ erro: 'Acesso restrito a administradores' }, { status: 403 });

    const resultados = {};

    // Tenta endpoints diretos da SEFAZ Nacional (sem necessidade de certificado para DANFSe)
    const endpoints = [
      `https://adn.nfse.gov.br/danfse/${ID_TAG}`,
      `https://adn.nfse.gov.br/NFSe/${ID_TAG}`,
      `https://adn.nfse.gov.br/danfse/${ID_TAG}.pdf`,
      `https://www.nfse.gov.br/api/danfse/${ID_TAG}`,
      `https://sefin.nfse.gov.br/API/SefinNacional/danfse/${ID_TAG}`,
    ];

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          headers: {
            'Accept': 'application/pdf,text/html,*/*',
            'User-Agent': 'Mozilla/5.0',
          }
        });
        resultados[url] = {
          status: resp.status,
          contentType: resp.headers.get('content-type'),
        };
        if (resp.ok) {
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('pdf') || ct.includes('octet')) {
            resultados[url].resultado = 'PDF ENCONTRADO!';
          } else {
            const txt = await resp.text().catch(() => '');
            resultados[url].body = txt.substring(0, 500);
          }
        } else {
          const txt = await resp.text().catch(() => '');
          resultados[url].body = txt.substring(0, 300);
        }
      } catch (e) {
        resultados[url] = { erro: e.message };
      }
    }

    return Response.json({ resultados });
  } catch (error) {
    return Response.json({ erro: error.message }, { status: 500 });
  }
});