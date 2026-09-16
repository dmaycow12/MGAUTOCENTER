/**
 * Espelho (frontend) das regras de base44/shared/ajustarCfopSimples.ts
 *
 * Simples Nacional: CFOPs de substituição tributária (5405/6405/5655/6655)
 * exigem CEST, que não é cadastrado nos produtos — a SEFAZ rejeita com
 * "Operação com ICMS-ST sem informação do CEST". Convertemos sempre para
 * venda simples (5102/6102) e CSOSN sem ST (102).
 *
 * NFCe: SEFAZ só aceita CFOP de venda ao consumidor (5102/6102).
 */
export function ajustarCfopSimples(cfop, tipo) {
  const c = (cfop || '').replace(/\D/g, '');
  const ehVenda = (x) => x === '5102' || x === '6102';

  if (tipo === 'NFCe') {
    if (ehVenda(c)) return c;
    return c.startsWith('6') ? '6102' : '5102';
  }

  if (c.startsWith('54') || c === '5655') return '5102';
  if (c.startsWith('64') || c === '6655') return '6102';
  return c || '5102';
}

export function ajustarCsosnSimples(csosn, tipo) {
  const c = (csosn || '102').replace(/\D/g, '');
  if (tipo !== 'NFCe' && tipo !== 'NFe') return c || '102';
  if (['500', '201', '202', '203'].includes(c)) return '102';
  return c || '102';
}