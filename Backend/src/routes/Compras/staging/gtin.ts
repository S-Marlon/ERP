// Cópia de Front/App/src/pages/Compras/StockEntry/gtin.ts (mesma regra nos dois lados)
// GTIN (EAN-8, UPC-A/GTIN-12, EAN-13, GTIN-14): normalização e validação do dígito verificador (módulo 10 GS1)

export const TAMANHOS_GTIN = [8, 12, 13, 14];

export const normalizarGtin = (valor: unknown): string => String(valor ?? '').replace(/\D/g, '');

// XML da NF-e usa "SEM GTIN" quando o produto não tem código de barras
export const isSemGtin = (valor: unknown): boolean => {
  const texto = String(valor ?? '').trim().toUpperCase();
  return texto === '' || texto === 'SEM GTIN' || /^0+$/.test(normalizarGtin(valor));
};

export const digitoVerificadorGtin = (semDigito: string): number => {
  // Da direita para a esquerda, pesos 3,1,3,1...
  const soma = semDigito
    .split('')
    .reverse()
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10;
};

export const validarGtin = (valor: unknown): boolean => {
  if (isSemGtin(valor)) return false;
  const gtin = normalizarGtin(valor);
  if (!TAMANHOS_GTIN.includes(gtin.length)) return false;
  return digitoVerificadorGtin(gtin.slice(0, -1)) === Number(gtin.slice(-1));
};

export type SituacaoGtin = 'VALIDO' | 'INVALIDO' | 'AUSENTE';

export const situacaoGtin = (valor: unknown): SituacaoGtin =>
  isSemGtin(valor) ? 'AUSENTE' : validarGtin(valor) ? 'VALIDO' : 'INVALIDO';

// GTIN efetivo do item: o informado manualmente tem prioridade sobre o do XML
export const gtinEfetivo = (manual: unknown, xml: unknown): string | null => {
  if (!isSemGtin(manual)) return normalizarGtin(manual);
  if (!isSemGtin(xml)) return normalizarGtin(xml);
  return null;
};
