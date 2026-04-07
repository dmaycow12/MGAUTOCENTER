import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import JSZip from 'npm:jszip@3.10.1';
import XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const entidades = ["Cliente", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
    const backup = {};

    for (const entidade of entidades) {
      try {
        const dados = await base44.asServiceRole.entities[entidade].list('-created_date', 10000);
        backup[entidade] = dados;
      } catch (err) {
        backup[entidade] = [];
      }
    }

    const dataStr = new Date().toISOString().split("T")[0];

    // Criar XLSX
    const wb = XLSX.utils.book_new();
    for (const [entidade, dados] of Object.entries(backup)) {
      if (dados && dados.length > 0) {
        const ws = XLSX.utils.json_to_sheet(dados);
        XLSX.utils.book_append_sheet(wb, ws, entidade);
      }
    }
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Criar ZIP
    const zip = new JSZip();
    zip.file(`backup-${dataStr}.json`, JSON.stringify(backup, null, 2));
    zip.file(`backup-${dataStr}.xlsx`, new Uint8Array(xlsxBuffer));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipBuffer = await zipBlob.arrayBuffer();

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="backup-${dataStr}.zip"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});