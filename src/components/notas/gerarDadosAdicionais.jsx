export function gerarInfoBaseVenda(venda) {
  const partes = [];
  if (venda?.numero) partes.push(`Venda nº ${venda.numero}`);
  if (venda?.veiculo_modelo) partes.push(`Veículo: ${venda.veiculo_modelo}`);
  if (venda?.veiculo_placa) partes.push(`Placa: ${venda.veiculo_placa}`);
  if (venda?.quilometragem) partes.push(`KM: ${venda.quilometragem}`);
  return partes.join(' | ');
}

export function gerarInfoParcelas(parcelas_detalhes, forma_pagamento_padrao) {
  if (!parcelas_detalhes || parcelas_detalhes.length === 0) return '';
  return parcelas_detalhes
    .map((p, i) => {
      // Evita shift de fuso: parseia "YYYY-MM-DD" diretamente sem conversão UTC
      const data = p.vencimento ? (() => {
        const [y, m, d] = p.vencimento.split('-');
        return `${d}/${m}/${y}`;
      })() : '';
      return `Parc. ${p.numero || i + 1}: ${p.forma_pagamento || forma_pagamento_padrao} - Venc.: ${data}`;
    })
    .join(' | ');
}

export function gerarDadosAdicionaisDaVenda(venda) {
  const base = gerarInfoBaseVenda(venda);
  const parcelas = gerarInfoParcelas(venda?.parcelas_detalhes, venda?.forma_pagamento);
  return [base, parcelas].filter(Boolean).join(' | ');
}