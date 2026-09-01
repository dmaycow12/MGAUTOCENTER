import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CAMPOS = [
  'id', 'created_date', 'updated_date', 'ordem_venda_id', 'tipo', 'numero', 'serie', 'status',
  'valor_total', 'data_emissao', 'chave_acesso', 'cliente_nome', 'cliente_cpf_cnpj',
  'pdf_url', 'xml_url', 'xml_original_url'
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const notas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 9999);

    // Retorna apenas os campos leves usados nas listagens (sem XML — evita ~6MB por carregamento).
    const notasLeves = notas.map(n => {
      const leve = {};
      for (const c of CAMPOS) { if (n[c] !== undefined) leve[c] = n[c]; }
      return leve;
    });

    return Response.json({ notas: notasLeves });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}