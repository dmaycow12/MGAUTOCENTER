import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { autenticarRequisicao } from '../../shared/portaoAutenticacao.ts';

const ENTIDADES = ['Vendas', 'Cadastro', 'Estoque', 'Servico', 'Ativo', 'Financeiro', 'NotaFiscal'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { autenticado, authErro } = await autenticarRequisicao(base44);
    if (!autenticado) {
      return Response.json(
        { error: `Não autenticado (${authErro || "token ausente"}). Faça login novamente.` },
        { status: 401 }
      );
    }

    const svc = base44.asServiceRole;
    const resultado = {};
    for (const entidade of ENTIDADES) {
      const registros = await svc.entities[entidade].list('-created_date', 9999);
      const info = {
        total: registros.length,
        ultimo: registros.length > 0 ? String(registros[0].created_date || '') : '',
      };
      if (entidade === 'NotaFiscal') {
        const porTipo = {};
        for (const n of registros) {
          const t = n.tipo || '—';
          porTipo[t] = (porTipo[t] || 0) + 1;
        }
        info.por_tipo = porTipo;
      }
      resultado[entidade] = info;
    }

    return Response.json(resultado);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}