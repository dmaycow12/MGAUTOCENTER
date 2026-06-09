import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca todas as NFSe
    const notas = await base44.asServiceRole.entities.NotaFiscal.list();
    
    // Filtra NFSe números 62-66
    const nfsePequena = notas.filter(n => 
      n.tipo === 'NFSe' && 
      parseInt(n.numero) >= 62 && 
      parseInt(n.numero) <= 66
    );

    // Diagnóstico detalhado
    const diagnostico = nfsePequena.map(n => ({
      numero: n.numero,
      cliente: n.cliente_nome,
      xml_original: {
        existe: !!n.xml_original,
        tipo: typeof n.xml_original,
        length: n.xml_original ? String(n.xml_original).length : 0,
        preview: n.xml_original ? String(n.xml_original).substring(0, 50) : null
      },
      xml_content: {
        existe: !!n.xml_content,
        tipo: typeof n.xml_content,
        length: n.xml_content ? String(n.xml_content).length : 0,
        preview: n.xml_content ? String(n.xml_content).substring(0, 50) : null
      },
      xml_url: {
        existe: !!n.xml_url,
        tipo: typeof n.xml_url,
        length: n.xml_url ? String(n.xml_url).length : 0,
        valor: n.xml_url || null
      }
    }));

    return Response.json({
      total: nfsePequena.length,
      notas: diagnostico
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});