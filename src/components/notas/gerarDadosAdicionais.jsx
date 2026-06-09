export function gerarDadosAdicionaisDaVenda(venda) {
  const partesAdicionais = [];
  
  if (venda?.numero) partesAdicionais.push(`Venda nº ${venda.numero}`);
  if (venda?.veiculo_modelo) partesAdicionais.push(`Veículo: ${venda.veiculo_modelo}`);
  if (venda?.veiculo_placa) partesAdicionais.push(`Placa: ${venda.veiculo_placa}`);
  if (venda?.quilometragem) partesAdicionais.push(`KM: ${venda.quilometragem}`);
  
  // Adiciona parcelas com forma de pagamento e vencimento
  if (venda?.parcelas_detalhes && venda.parcelas_detalhes.length > 0) {
    const parcelasStr = venda.parcelas_detalhes
      .map((p, i) => {
        const data = p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '';
        return `Parc. ${p.numero || i + 1}: ${p.forma_pagamento || venda.forma_pagamento} - Venc.: ${data}`;
      })
      .join(' | ');
    if (parcelasStr) partesAdicionais.push(parcelasStr);
  }
  
  return partesAdicionais.join(' | ');
}