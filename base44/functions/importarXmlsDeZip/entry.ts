import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import JSZip from 'npm:jszip@3.10.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { zip_url } = await req.json();
    if (!zip_url) return Response.json({ error: 'zip_url é obrigatório' }, { status: 400 });

    // Baixar o ZIP
    const resp = await fetch(zip_url);
    if (!resp.ok) return Response.json({ error: `Erro ao baixar ZIP: HTTP ${resp.status}` }, { status: 400 });
    const arrayBuffer = await resp.arrayBuffer();

    // Extrair ZIP
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Coletar XMLs de NFSe (qualquer caminho que contenha "nfse" case-insensitive)
    const xmlFiles = [];
    zip.forEach((relativePath, file) => {
      if (!file.dir && relativePath.toLowerCase().includes('nfse') && relativePath.toLowerCase().endsWith('.xml')) {
        xmlFiles.push({ path: relativePath, file });
      }
    });

    if (xmlFiles.length === 0) {
      return Response.json({ error: 'Nenhum XML de NFSe encontrado no ZIP (busca em pastas contendo "nfse")' }, { status: 400 });
    }

    // Buscar notas existentes
    const notas = await base44.asServiceRole.entities.NotaFiscal.list('-created_date', 500);
    const notasPorChave = {};
    const notasPorNumero = {};
    for (const n of notas) {
      if (n.chave_acesso) notasPorChave[n.chave_acesso] = n;
      if (n.tipo === 'NFSe' && n.numero) notasPorNumero[n.numero] = n;
    }

    let atualizados = 0;
    let semMatch = 0;
    const semMatchList = [];

    for (const { path, file } of xmlFiles) {
      const xmlContent = await file.async('text');

      // Tentar extrair chave_acesso do nome do arquivo
      // Padrão: NFS3148004...{44 dígitos}-nfse.xml ou similar
      const fileName = path.split('/').pop() || '';
      let chaveAcesso = null;

      // Remove prefixo NFS e sufixo -nfse.xml ou .xml
      const match44 = fileName.match(/(\d{44})/);
      if (match44) chaveAcesso = match44[1];

      // Também tenta extrair do XML via regex
      if (!chaveAcesso) {
        const xmlMatch = xmlContent.match(/Id="NFS(\d+)"/);
        if (xmlMatch) chaveAcesso = xmlMatch[1];
      }

      // Tenta pelo nNFSe do XML
      const nNFSeMatch = xmlContent.match(/<nNFSe>(\d+)<\/nNFSe>/);
      const numero = nNFSeMatch ? nNFSeMatch[1] : null;

      // Encontrar nota correspondente
      let nota = chaveAcesso ? notasPorChave[chaveAcesso] : null;
      if (!nota && numero) nota = notasPorNumero[numero];

      if (!nota) {
        semMatch++;
        semMatchList.push(fileName);
        continue;
      }

      // Atualizar xml_original e xml_url com o conteúdo real
      await base44.asServiceRole.entities.NotaFiscal.update(nota.id, {
        xml_original: xmlContent,
      });
      atualizados++;
    }

    return Response.json({
      sucesso: true,
      mensagem: `${atualizados} XML(s) salvos com sucesso. ${semMatch} sem correspondência no banco.`,
      atualizados,
      sem_match: semMatch,
      sem_match_arquivos: semMatchList,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});