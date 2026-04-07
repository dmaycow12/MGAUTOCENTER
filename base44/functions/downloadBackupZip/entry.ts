import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import JSZip from 'npm:jszip@3.10.1';
import XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const entidades = ["Cliente", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
    const backup = {};

    console.log("[BACKUP] Iniciando backup de entidades...");

    for (const entidade of entidades) {
      try {
        console.log(`[BACKUP] Buscando ${entidade}...`);
        const dados = await base44.asServiceRole.entities[entidade].list('-created_date', 10000);
        backup[entidade] = Array.isArray(dados) ? dados : [];
        console.log(`[BACKUP] ${entidade}: ${backup[entidade].length} registros`);
      } catch (err) {
        console.error(`[BACKUP] Erro ao buscar ${entidade}:`, err.message);
        backup[entidade] = [];
      }
    }

    const dataStr = new Date().toISOString().split("T")[0];

    // Criar XLSX
    console.log("[BACKUP] Criando arquivo XLSX...");
    const wb = XLSX.utils.book_new();
    for (const [entidade, dados] of Object.entries(backup)) {
      if (Array.isArray(dados) && dados.length > 0) {
        const ws = XLSX.utils.json_to_sheet(dados);
        XLSX.utils.book_append_sheet(wb, ws, entidade);
      }
    }
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    console.log(`[BACKUP] XLSX criado: ${xlsxBuffer.length} bytes`);

    // Criar ZIP
    console.log("[BACKUP] Criando arquivo ZIP...");
    const zip = new JSZip();
    zip.file(`backup-${dataStr}.json`, JSON.stringify(backup, null, 2));
    zip.file(`backup-${dataStr}.xlsx`, new Uint8Array(xlsxBuffer));

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    console.log(`[BACKUP] ZIP criado: ${zipBuffer.byteLength} bytes`);

    const zipBytes = new Uint8Array(zipBuffer);
    
    return new Response(zipBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="backup-${dataStr}.zip"`,
        'Content-Length': zipBytes.byteLength.toString()
      }
    });
  } catch (error) {
    console.error('[BACKUP] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});