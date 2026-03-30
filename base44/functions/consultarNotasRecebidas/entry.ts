import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    // versao: se informado, busca apenas notas mais novas que essa versão
    const versao = body.versao || null;

    let url = `${FOCUSNFE_BASE}/nfes_recebidas?cnpj=${CNPJ_EMITENTE}`;
    if (versao) url += `&versao=${versao}`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return Response.json({ sucesso: false, erro: `Erro Focus NFe (${resp.status}): ${txt.substring(0, 200)}` });
    }

    const notas = await resp.json();
    if (!Array.isArray(notas) || notas.length === 0) {
      return Response.json({ sucesso: true, mensagem: 'Nenhuma nota recebida encontrada.', importadas: 0 });
    }

    // Busca notas já existentes para evitar duplicatas
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 2000);
    const chavesExistentes = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));

    let importadas = 0;
    let maxVersao = 0;

    for (const nf of notas) {
      const chave = nf.chave_nfe;
      if (!chave) continue;

      // Rastreia a versão máxima para a próxima consulta
      if (nf.versao && nf.versao > maxVersao) maxVersao = nf.versao;

      if (chavesExistentes.has(chave)) continue;

      const data_emissao = (nf.data_emissao || '').substring(0, 10);
      const status_nf = nf.situacao === 'cancelada' ? 'Cancelada' : 'Importada';

      await base44.asServiceRole.entities.NotaFiscal.create({
        tipo: 'NFe',
        numero: '',
        serie: '1',
        status: status_nf,
        cliente_nome: nf.nome_emitente || 'Fornecedor',
        cliente_cpf_cnpj: nf.documento_emitente || '',
        chave_acesso: chave,
        valor_total: parseFloat(nf.valor_total || '0'),
        data_emissao,
        observacoes: `Nota recebida via SEFAZ | Manifesto: ${nf.manifestacao_destinatario || 'pendente'}`,
        mensagem_sefaz: nf.situacao || '',
      });

      importadas++;
      chavesExistentes.add(chave);
    }

    // Salva a versão máxima para próximas consultas incrementais
    if (maxVersao > 0) {
      const configs = await base44.asServiceRole.entities.Configuracao.filter({ chave: 'nfes_recebidas_versao' });
      const versaoAtual = parseInt(configs[0]?.valor || '0', 10);
      if (maxVersao > versaoAtual) {
        if (configs.length > 0) {
          await base44.asServiceRole.entities.Configuracao.update(configs[0].id, { valor: String(maxVersao) });
        } else {
          await base44.asServiceRole.entities.Configuracao.create({
            chave: 'nfes_recebidas_versao',
            valor: String(maxVersao),
            descricao: 'Versão máxima das NFes recebidas (MDe)',
          });
        }
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: importadas > 0
        ? `${importadas} nota(s) recebida(s) importada(s) da SEFAZ.`
        : `Nenhuma nota nova. Total consultado: ${notas.length}.`,
      importadas,
      total_consultadas: notas.length,
      max_versao: maxVersao,
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});