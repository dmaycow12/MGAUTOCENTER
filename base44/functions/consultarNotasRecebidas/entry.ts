import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOCUSNFE_BASE = 'https://api.focusnfe.com.br/v2';
const API_KEY = Deno.env.get('FOCUSNFE_API_KEY') || '';
const AUTH_HEADER = 'Basic ' + btoa(API_KEY + ':');
const CNPJ_EMITENTE = '54043647000120';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Busca notas recebidas / distribuição DFe
    const dfeResp = await fetch(
      `${FOCUSNFE_BASE}/distribuicao_nfe?cnpj=${CNPJ_EMITENTE}`,
      { headers: { 'Authorization': AUTH_HEADER } }
    );

    if (!dfeResp.ok) {
      const txt = await dfeResp.text();
      return Response.json({ sucesso: false, erro: `Erro ao consultar DFe: ${txt.substring(0, 300)}` });
    }

    const dfeData = await dfeResp.json();
    const notas = Array.isArray(dfeData) ? dfeData : (dfeData.notas || dfeData.data || []);

    if (!notas.length) {
      return Response.json({ sucesso: true, mensagem: 'Nenhuma nota recebida encontrada.', importadas: 0 });
    }

    // 2. Busca notas já salvas para evitar duplicatas
    const notasExistentes = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 500);
    const chavesSalvas = new Set(notasExistentes.map(n => n.chave_acesso).filter(Boolean));
    const speadyIdsSalvos = new Set(notasExistentes.map(n => n.spedy_id).filter(Boolean));

    let importadas = 0;
    const erros = [];

    for (const nf of notas) {
      const chave = nf.chave_nfe || nf.chave || nf.chave_acesso || '';
      const ref = nf.ref || nf.id || chave;

      // Pula se já existe
      if ((chave && chavesSalvas.has(chave)) || (ref && speadyIdsSalvos.has(String(ref)))) continue;

      // 3. Manifestação de Ciência da Operação para liberar download do XML
      if (ref && nf.status !== 'cancelado') {
        try {
          await fetch(`${FOCUSNFE_BASE}/nfe/${ref}/manifesto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': AUTH_HEADER },
            body: JSON.stringify({ tipo: 'ciencia_operacao' }),
          });
        } catch (_) {
          // Manifestação falhou, mas continuamos para salvar a nota
        }
      }

      // 4. Salva como nota importada (entrada)
      const emitente = nf.emitente || {};
      const total = nf.valor_total || nf.valor || 0;
      const dataEmissao = (nf.data_emissao || nf.data || '').split('T')[0] || new Date().toISOString().split('T')[0];

      const notaData = {
        tipo: 'NFe',
        status: 'Importada',
        spedy_id: String(ref),
        chave_acesso: chave,
        cliente_nome: emitente.nome || emitente.razao_social || 'Fornecedor',
        cliente_cpf_cnpj: emitente.cnpj || emitente.cpf || '',
        data_emissao: dataEmissao,
        valor_total: Number(total),
        numero: String(nf.numero || nf.numero_nfe || ''),
        serie: String(nf.serie || '1'),
        observacoes: `NF recebida via DFe. Chave: ${chave}`,
        mensagem_sefaz: nf.status || 'importada',
      };

      try {
        await base44.asServiceRole.entities.NotaFiscal.create(notaData);
        importadas++;
      } catch (e) {
        erros.push(`Chave ${chave}: ${e.message}`);
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: `${importadas} nota(s) importada(s) com sucesso.${erros.length ? ` ${erros.length} erro(s).` : ''}`,
      importadas,
      total_encontradas: notas.length,
      erros: erros.slice(0, 5),
    });

  } catch (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});