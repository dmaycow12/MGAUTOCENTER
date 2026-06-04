import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import JSZip from 'npm:jszip@3.10.1';

const ENTIDADES_VALIDAS = ["Cadastro", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];

const CAMPOS_INTERNOS = new Set(["id","created_date","updated_date","created_by","created_by_id","entity_name","app_id","is_sample","is_deleted","deleted_date","environment","_xml_arquivo","_pdf_arquivo","data"]);

const CHAVE_UNICA = {
  Cadastro:    (r) => r.cpf_cnpj || r.email || r.nome,
  Estoque:     (r) => r.codigo || r.descricao,
  Financeiro:  (r) => `${r.descricao}|${r.valor}|${r.data_vencimento}`,
  Configuracao:(r) => r.chave,
  Servico:     (r) => r.codigo || r.descricao,
  Ativo:       (r) => r.numero_serie || r.nome,
  Vendas:      (r) => r.numero,
  NotaFiscal:  (r) => r.chave_acesso || r.numero,
};

function limpar(item) {
  const d = {};
  for (const [k, v] of Object.entries(item)) {
    if (!CAMPOS_INTERNOS.has(k)) d[k] = v;
  }
  return d;
}

async function buscarChavesExistentes(entities, entidade, chaveFn) {
  const chaves = new Set();
  let skip = 0;
  const limit = 500;
  while (true) {
    const registros = await entities[entidade].list(null, limit, skip);
    for (const r of registros) {
      const ch = chaveFn(r);
      if (ch) chaves.add(String(ch).trim().toLowerCase());
    }
    if (registros.length < limit) break;
    skip += limit;
  }
  return chaves;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await req.json();
    const zip_url = body.zip_url;
    if (!zip_url) return Response.json({ error: 'zip_url é obrigatório' }, { status: 400 });

    // 1. Baixar o ZIP da URL
    const zipRes = await fetch(zip_url);
    if (!zipRes.ok) throw new Error(`Falha ao baixar ZIP: ${zipRes.status}`);
    const zipBuffer = await zipRes.arrayBuffer();

    // 2. Descompactar
    const zip = new JSZip();
    await zip.loadAsync(zipBuffer);

    const backup = {};

    // Entidades simples
    for (const entidade of ENTIDADES_VALIDAS) {
      if (entidade === "NotaFiscal") continue;
      const entry = zip.file(`${entidade}/${entidade}.json`);
      if (entry) {
        try { backup[entidade] = JSON.parse(await entry.async("string")); } catch (_) {}
      }
    }

    // NotaFiscal: parsear JSONs individuais + injetar XML
    const notasBackup = [];
    const xmlMap = {};
    zip.forEach((caminho, entry) => {
      if (caminho.startsWith("NotaFiscal/") && !entry.dir && caminho.endsWith(".xml")) {
        xmlMap[caminho.replace("NotaFiscal/", "")] = entry;
      }
    });
    const notaPromises = [];
    zip.forEach((caminho, entry) => {
      if (caminho.startsWith("NotaFiscal/") && !entry.dir && caminho.endsWith(".json") && !caminho.includes("_indice")) {
        notaPromises.push(
          entry.async("string").then(async (s) => {
            try {
              const nota = JSON.parse(s);
              if (nota._xml_arquivo && xmlMap[nota._xml_arquivo]) {
                const xmlTexto = await xmlMap[nota._xml_arquivo].async("string");
                if (xmlTexto.trim().startsWith("<")) nota.xml_original = xmlTexto;
              }
              delete nota._xml_arquivo;
              notasBackup.push(nota);
            } catch (_) {}
          })
        );
      }
    });
    await Promise.all(notaPromises);
    if (notasBackup.length > 0) backup["NotaFiscal"] = notasBackup;

    // 3. Importar entidade por entidade
    const entities = base44.asServiceRole.entities;
    const resultados = {};
    let totalImportados = 0;
    let totalPulados = 0;

    for (const entidade of ENTIDADES_VALIDAS) {
      const dados = backup[entidade];
      if (!Array.isArray(dados) || dados.length === 0) continue;

      const chaveFn = CHAVE_UNICA[entidade] || ((r) => r.id);
      const chavesExistentes = await buscarChavesExistentes(entities, entidade, chaveFn);

      const novos = dados.filter(item => {
        const ch = chaveFn(item);
        if (!ch) return true;
        return !chavesExistentes.has(String(ch).trim().toLowerCase());
      });

      const pulados = dados.length - novos.length;
      totalPulados += pulados;

      // Importar em lotes com bulkCreate
      const LOTE = 100;
      const dadosLimpos = novos.map(limpar);
      for (let i = 0; i < dadosLimpos.length; i += LOTE) {
        const lote = dadosLimpos.slice(i, i + LOTE);
        let tentativas = 0;
        while (true) {
          try {
            await entities[entidade].bulkCreate(lote);
            break;
          } catch (_) {
            tentativas++;
            if (tentativas >= 3) await new Promise(r => setTimeout(r, Math.min((tentativas - 2) * 300, 3000)));
          }
        }
      }

      totalImportados += novos.length;
      resultados[entidade] = { importados: novos.length, pulados };
    }

    return Response.json({ sucesso: true, totalImportados, totalPulados, resultados });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});