import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { nota_id } = await req.json();

    if (!nota_id) {
      return Response.json({ erro: 'nota_id é obrigatório' }, { status: 400 });
    }

    // Busca a nota
    const notas = await base44.asServiceRole.entities.NotaFiscal.filter(
      { id: nota_id },
      '-created_date',
      1
    );

    if (notas.length === 0) {
      return Response.json({ erro: 'Nota não encontrada' }, { status: 404 });
    }

    const nota = notas[0];

    // Garante que é nota importada
    if (nota.status !== 'Importada') {
      return Response.json({ 
        erro: 'Apenas notas com status "Importada" podem gerar relatório de conferência' 
      }, { status: 400 });
    }

    // Tenta parsear itens do xml_content
    let itens = [];
    if (nota.xml_content) {
      try {
        const parsed = JSON.parse(nota.xml_content);
        if (Array.isArray(parsed)) {
          itens = parsed;
        }
      } catch {}
    }

    // Cria PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    // Título
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('RELATÓRIO DE CONFERÊNCIA DE COMPRA', margin, y);
    y += 10;

    // Linha horizontal
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Informações principais
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    const dataEmissao = nota.data_emissao ? new Date(nota.data_emissao).toLocaleDateString('pt-BR') : '—';
    
    doc.text(`Fornecedor: ${nota.cliente_nome || '—'}`, margin, y);
    y += 6;
    doc.text(`Número da Nota: ${nota.numero || '—'} | Série: ${nota.serie || '1'}`, margin, y);
    y += 6;
    doc.text(`Data de Emissão: ${dataEmissao}`, margin, y);
    y += 6;
    doc.text(`Chave de Acesso: ${nota.chave_acesso || '—'}`, margin, y);
    y += 10;

    // Cabeçalho da tabela
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 5, contentWidth, 6, 'F');
    
    doc.text('Descrição', margin + 2, y);
    doc.text('Qtd.', margin + 120, y);
    doc.text('Conferido ☑', margin + 150, y);
    
    y += 8;

    // Linhas dos produtos
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const lineHeight = 6;
    let itemsYStart = y;

    if (itens.length > 0) {
      for (const item of itens) {
        // Quebra de página se necessário
        if (y > pageHeight - margin - 10) {
          doc.addPage();
          y = margin;
          // Repete cabeçalho
          doc.setFont(undefined, 'bold');
          doc.setFontSize(9);
          doc.setFillColor(240, 240, 240);
          doc.rect(margin, y - 5, contentWidth, 6, 'F');
          doc.text('Descrição', margin + 2, y);
          doc.text('Qtd.', margin + 120, y);
          doc.text('Conferido ☑', margin + 150, y);
          y += 8;
          doc.setFont(undefined, 'normal');
          doc.setFontSize(8);
        }

        const descricao = (item.descricao || 'Item sem descrição').substring(0, 50);
        const quantidade = Number(item.quantidade || 0).toFixed(2);

        doc.text(descricao, margin + 2, y);
        doc.text(quantidade, margin + 120, y);
        
        // Caixa para check
        doc.rect(margin + 150, y - 4, 4, 4);

        y += lineHeight;
      }
    } else {
      doc.text('[Nenhum produto registrado]', margin + 2, y);
      y += lineHeight;
    }

    // Rodapé
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(150, 150, 150);
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR');
    doc.text(`Gerado em ${dataAtual} às ${horaAtual}`, margin, pageHeight - 10);
    doc.text(`Nota ID: ${nota_id}`, margin, pageHeight - 5);

    // Retorna PDF como blob
    const pdfBytes = doc.output('arraybuffer');
    const filename = `conferencia_${nota.numero || 'nota'}_${nota.cliente_name || 'fornecedor'}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return Response.json(
      { erro: error.message },
      { status: 500 }
    );
  }
});