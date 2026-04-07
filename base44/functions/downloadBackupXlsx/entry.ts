import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const entidades = ["Cliente", "Estoque", "NotaFiscal", "Financeiro", "Configuracao", "Servico", "Ativo", "Vendas"];
    const backup = {};

    console.log("[BACKUP XLSX] Iniciando...");

    for (const entidade of entidades) {
      try {
        const dados = await base44.asServiceRole.entities[entidade].list('-created_date', 10000);
        backup[entidade] = Array.isArray(dados) ? dados : [];
      } catch (err) {
        backup[entidade] = [];
      }
    }

    const wb = XLSX.utils.book_new();
    
    for (const [entidade, dados] of Object.entries(backup)) {
      if (Array.isArray(dados) && dados.length > 0) {
        const ws = XLSX.utils.json_to_sheet(dados);
        XLSX.utils.book_append_sheet(wb, ws, entidade);
      }
    }

    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const xlsxBytes = new Uint8Array(xlsxBuffer);
    
    let base64 = '';
    for (let i = 0; i < xlsxBytes.length; i++) {
      base64 += String.fromCharCode(xlsxBytes[i]);
    }
    base64 = btoa(base64);

    return Response.json({ 
      file: base64,
      filename: `backup-${new Date().toISOString().split('T')[0]}.xlsx`
    });
  } catch (error) {
    console.error('[BACKUP XLSX] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});