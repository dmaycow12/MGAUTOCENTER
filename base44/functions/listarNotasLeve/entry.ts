import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const notas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 9999);

    // Remove os campos de XML (pesados) — a tela só precisa dos metadados.
    // O XML completo continua disponível na entidade e é buscado sob demanda.
    const notasLeves = notas.map(n => {
      const { xml_content, xml_original, ...resto } = n;
      return resto;
    });

    return Response.json({ notas: notasLeves });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}