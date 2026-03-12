export function gerarHTMLImpressao(os) {
  const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  function fmtD(d) {
    if (!d) return "—";
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    return parts[2] + "/" + parts[1] + "/" + String(parts[0]).slice(2);
  }

  const servicosRows = (os.servicos || []).map((s, i) =>
    "<tr><td style='text-align:center'>" + (i+1) + "</td><td>" + (s.descricao||"") + "</td><td style='text-align:right'>R$ " + fmt(s.valor) + "</td><td style='text-align:right'>R$ " + fmt(Number(s.valor||0)*Number(s.quantidade||1)) + "</td></tr>"
  ).join("");

  const pecasRows = (os.pecas || []).map((p, i) =>
    "<tr><td style='text-align:center'>" + (i+1) + "</td><td>" + (p.descricao||"") + "</td><td style='text-align:center'>" + (p.quantidade||1) + "</td><td style='text-align:right'>R$ " + fmt(p.valor_unitario) + "</td><td style='text-align:right'>R$ " + fmt(p.valor_total) + "</td></tr>"
  ).join("");

  const totalProdutos = Number(os.valor_pecas || 0);
  const totalServicos = Number(os.valor_servicos || 0);
  const desconto = Number(os.desconto || 0);
  const totalGeral = Number(os.valor_total || 0);

  const parcelas = os.parcelas_detalhes && os.parcelas_detalhes.length > 0
    ? os.parcelas_detalhes
    : [{ numero: 1, vencimento: os.data_entrada, valor: totalGeral, forma_pagamento: os.forma_pagamento || "Dinheiro" }];

  const parcelasRows = parcelas.map(p =>
    "<tr><td style='text-align:center'>" + p.numero + "/" + parcelas.length + "</td><td>" + fmtD(p.vencimento) + "</td><td>R$ " + fmt(p.valor) + "</td><td>" + (p.forma_pagamento || os.forma_pagamento || "—") + "</td></tr>"
  ).join("");

  const enderecoRow = (os.cliente_endereco || os.cliente_bairro || os.cliente_cidade)
    ? "<div class='info-row'><div class='info-cell' style='flex:1'><div class='label'>Endereço</div><div class='value'>" + [os.cliente_endereco, os.cliente_bairro, os.cliente_cidade, os.cliente_estado].filter(Boolean).join(" — ") + "</div></div></div>"
    : "";

  const obsSection = os.observacoes
    ? "<div class='section' style='margin-top:8px'><div class='section-title'>Observações</div><div class='info-grid'><div class='info-row'><div class='info-cell' style='min-height:50px'><div class='value' style='font-weight:normal;font-size:9pt;white-space:pre-wrap'>" + os.observacoes + "</div></div></div></div></div>"
    : "";

  const tecSection = (os.defeito_relatado || os.diagnostico)
    ? "<div class='section'><div class='section-title'>Observações Técnicas</div><div class='info-grid'>" +
      (os.defeito_relatado ? "<div class='info-row'><div class='info-cell'><div class='label'>Defeito Relatado</div><div class='value'>" + os.defeito_relatado + "</div></div></div>" : "") +
      (os.diagnostico ? "<div class='info-row'><div class='info-cell'><div class='label'>Diagnóstico</div><div class='value'>" + os.diagnostico + "</div></div></div>" : "") +
      "</div></div>"
    : "";

  const descontoDiv = desconto > 0
    ? "<div class='total-item'><div class='tl'>Desconto</div><div class='tv'>- R$ " + fmt(desconto) + "</div></div>"
    : "";

  const css = [
    "* { box-sizing: border-box; margin: 0; padding: 0; }",
    "body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; background: #fff; padding-top: 56px; }",
    ".page { max-width: 210mm; margin: 0 auto; padding: 6mm 12mm; }",
    ".header { text-align: center; padding-bottom: 6px; margin-bottom: 6px; }",
    ".company-info { font-size: 8.5pt; color: #444; line-height: 1.7; }",
    ".os-title { display: flex; justify-content: space-between; align-items: center; background: #222; color: #fff; padding: 5px 10px; margin: 8px 0; border-radius: 2px; }",
    ".os-title .title { font-size: 11pt; font-weight: bold; letter-spacing: 1px; }",
    ".periodo { display: flex; gap: 20px; font-size: 8pt; padding: 4px 0 8px; border-bottom: 1px solid #ddd; margin-bottom: 6px; }",
    ".periodo span { color: #555; } .periodo b { color: #111; }",
    ".section { margin-bottom: 8px; }",
    ".section-title { background: #555; color: #fff; padding: 3px 8px; font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0; }",
    ".info-grid { display: grid; border: 1px solid #ddd; border-top: none; }",
    ".info-row { display: flex; border-bottom: 1px solid #ddd; } .info-row:last-child { border-bottom: none; }",
    ".info-cell { flex: 1; padding: 3px 6px; border-right: 1px solid #ddd; } .info-cell:last-child { border-right: none; }",
    ".info-cell .label { font-size: 7pt; color: #888; text-transform: uppercase; }",
    ".info-cell .value { font-size: 8.5pt; font-weight: bold; color: #111; min-height: 14px; }",
    "table { width: 100%; border-collapse: collapse; font-size: 8pt; }",
    "table th { background: #f0f0f0; border: 1px solid #ccc; padding: 3px 6px; text-align: left; font-size: 7.5pt; font-weight: bold; text-transform: uppercase; }",
    "table td { border: 1px solid #ddd; padding: 3px 6px; }",
    "table tr:nth-child(even) td { background: #fafafa; }",
    ".col-num { width: 30px; text-align: center; } .col-qty { width: 40px; text-align: center; } .col-val { width: 80px; text-align: right; } .col-sub { width: 80px; text-align: right; }",
    ".totals-row { display: flex; justify-content: flex-end; gap: 0; margin-top: 4px; }",
    ".total-item { border: 1px solid #ddd; padding: 4px 10px; text-align: right; min-width: 160px; }",
    ".total-item .tl { font-size: 7.5pt; color: #666; } .total-item .tv { font-size: 9pt; font-weight: bold; }",
    ".total-geral { background: #222; color: #fff; border-color: #222; } .total-geral .tl { color: #ccc; } .total-geral .tv { font-size: 11pt; color: #fff; }",
    ".pag-table th, .pag-table td { font-size: 8pt; }",
    ".assinaturas { display: flex; justify-content: space-between; margin-top: 16px; gap: 20px; }",
    ".assinatura { flex: 1; text-align: center; } .assinatura .linha { border-top: 1px solid #999; margin-bottom: 4px; } .assinatura .nome { font-size: 10pt; color: #111; font-weight: bold; }",
    ".toolbar { position: fixed; top: 0; left: 0; right: 0; height: 48px; background: #1e1e1e; color: #fff; display: flex; align-items: center; padding: 0 16px; gap: 12px; z-index: 999; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }",
    ".tb-title { font-size: 13pt; font-weight: bold; letter-spacing: 1px; margin-right: 24px; }",
    ".tb-sep { width: 1px; height: 24px; background: #444; }",
    ".tb-btn { background: none; border: none; color: #ccc; cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 10pt; display: flex; align-items: center; gap: 6px; transition: background 0.15s; font-family: Arial, sans-serif; }",
    ".tb-btn:hover { background: #333; color: #fff; }",
    ".tb-zoom { display: flex; align-items: center; gap: 4px; }",
    ".tb-zoom span { font-size: 10pt; color: #ccc; min-width: 42px; text-align: center; }",
    ".tb-spacer { flex: 1; }",
    "@media print { @page { size: A4; margin: 8mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding-top: 0; } .toolbar { display: none; } }",
  ].join(" ");

  return "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'/><title>OS #" + (os.numero||"") + "</title><style>" + css + "</style></head><body>" +
    "<div class='toolbar'>" +
    "<span class='tb-title'>IMPRESSAO</span>" +
    "<div class='tb-sep'></div>" +
    "<div class='tb-zoom'>" +
    "<button class='tb-btn' onclick='zoomOut()'>- Zoom</button>" +
    "<span id='zoom-label'>100%</span>" +
    "<button class='tb-btn' onclick='zoomIn()'>+ Zoom</button>" +
    "</div>" +
    "<div class='tb-sep'></div><div class='tb-spacer'></div>" +
    "<button class='tb-btn' onclick='window.print()'>Imprimir</button>" +
    "<button class='tb-btn' onclick='window.print()'>Salvar</button>" +
    "<button class='tb-btn' onclick='window.close()'>Fechar</button>" +
    "</div>" +
    "<script>var z=1;function applyZoom(){document.querySelector('.page').style.transform='scale('+z+')';document.querySelector('.page').style.transformOrigin='top center';document.getElementById('zoom-label').textContent=Math.round(z*100)+'%';}function zoomIn(){if(z<2){z=Math.round((z+0.1)*10)/10;applyZoom();}}function zoomOut(){if(z>0.5){z=Math.round((z-0.1)*10)/10;applyZoom();}}<\/script>" +
    "<div class='page'>" +
    "<div class='header'><img src='https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6997c92e6dd9fc3c5e8a6579/3fff287a0_LOGO.png' style='width:120px;height:120px;object-fit:contain;' alt='MG Autocenter'/>" +
    "<div class='company-info' style='margin-top:6px;'>Rua Rui Barbosa, 1355 — Santa Terezinha — Patos de Minas/MG<br>CNPJ: 54.043.647/0001-20 | (34) 99879-1260</div></div>" +
    "<div class='os-title'><span class='title'>ORDEM DE VENDA N " + (os.numero||"—") + "</span></div>" +
    "<div class='periodo'><span>Entrada: <b>" + fmtD(os.data_entrada) + "</b></span><span>Status: <b>" + (os.status||"—") + "</b></span></div>" +
    "<div class='section'><div class='section-title'>Dados do Cliente</div><div class='info-grid'>" +
    "<div class='info-row'><div class='info-cell' style='flex:3'><div class='label'>Cliente</div><div class='value'>" + (os.cliente_nome||"—") + "</div></div><div class='info-cell' style='flex:2'><div class='label'>CPF/CNPJ</div><div class='value'>" + (os.cliente_cpf_cnpj||"") + "</div></div></div>" +
    enderecoRow +
    "<div class='info-row'><div class='info-cell' style='flex:2'><div class='label'>Telefone</div><div class='value'>" + (os.cliente_telefone||"—") + "</div></div><div class='info-cell' style='flex:3'><div class='label'>E-mail</div><div class='value'>" + (os.cliente_email||"") + "</div></div></div>" +
    "</div></div>" +
    "<div class='section'><div class='section-title'>Veiculo</div><div class='info-grid'><div class='info-row'>" +
    "<div class='info-cell' style='flex:3'><div class='label'>Veiculo</div><div class='value'>" + (os.veiculo_modelo||"—") + "</div></div>" +
    "<div class='info-cell' style='flex:2'><div class='label'>Placa</div><div class='value'>" + (os.veiculo_placa||"—") + "</div></div>" +
    "<div class='info-cell' style='flex:2'><div class='label'>Quilometragem</div><div class='value'>" + (os.quilometragem ? Number(os.quilometragem).toLocaleString("pt-BR") + " km" : "—") + "</div></div>" +
    "</div></div></div>" +
    tecSection +
    "<div class='section'><div class='section-title'>Servicos</div><table><thead><tr><th class='col-num'>Item</th><th>Nome</th><th class='col-val'>Vl. Unit.</th><th class='col-sub'>Subtotal</th></tr></thead><tbody>" +
    (servicosRows || "<tr><td colspan='4' style='text-align:center;color:#999'>Nenhum servico</td></tr>") +
    "<tr style='font-weight:bold;background:#f0f0f0'><td colspan='3' style='text-align:right'>TOTAL</td><td style='text-align:right'>R$ " + fmt(os.valor_servicos) + "</td></tr></tbody></table></div>" +
    "<div class='section'><div class='section-title'>Pecas / Produtos</div><table><thead><tr><th class='col-num'>Item</th><th>Nome</th><th class='col-qty'>Qtd.</th><th class='col-val'>Vl. Unit.</th><th class='col-sub'>Subtotal</th></tr></thead><tbody>" +
    (pecasRows || "<tr><td colspan='5' style='text-align:center;color:#999'>Nenhuma peca</td></tr>") +
    "<tr style='font-weight:bold;background:#f0f0f0'><td colspan='4' style='text-align:right'>TOTAL</td><td style='text-align:right'>R$ " + fmt(os.valor_pecas) + "</td></tr></tbody></table></div>" +
    "<div class='totals-row'>" +
    "<div class='total-item'><div class='tl'>Produtos</div><div class='tv'>R$ " + fmt(totalProdutos) + "</div></div>" +
    "<div class='total-item'><div class='tl'>Servicos</div><div class='tv'>R$ " + fmt(totalServicos) + "</div></div>" +
    descontoDiv +
    "<div class='total-item total-geral'><div class='tl'>TOTAL GERAL</div><div class='tv'>R$ " + fmt(totalGeral) + "</div></div></div>" +
    "<div class='section' style='margin-top:10px'><div class='section-title'>Dados do Pagamento</div><table class='pag-table'><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Forma de Pagamento</th></tr></thead><tbody>" +
    parcelasRows +
    "</tbody></table></div>" +
    obsSection +
    "<div class='assinaturas' style='margin-top:40px'>" +
    "<div class='assinatura'><div class='linha'></div><div class='nome'>Assinatura do cliente</div></div>" +
    "<div class='assinatura'><div class='linha'></div><div class='nome'>Assinatura do tecnico</div></div>" +
    "</div></div></body></html>";
}