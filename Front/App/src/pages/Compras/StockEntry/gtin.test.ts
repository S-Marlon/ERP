import { gtinEfetivo, situacaoGtin, validarGtin } from './gtin';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runGtinTests = (): void => {
  assert(validarGtin('7891000315507'), 'EAN-13 válido (Nescau) deveria passar.');
  assert(validarGtin('96385074'), 'EAN-8 válido deveria passar.');
  assert(validarGtin('036000291452'), 'UPC-A (GTIN-12) válido deveria passar.');
  assert(validarGtin('17891000315504'), 'GTIN-14 válido deveria passar.');
  assert(!validarGtin('7891000315508'), 'Dígito verificador errado deveria falhar.');
  assert(!validarGtin('12345'), 'Tamanho inválido deveria falhar.');
  assert(situacaoGtin('SEM GTIN') === 'AUSENTE', '"SEM GTIN" deveria ser ausente.');
  assert(situacaoGtin('1200106151968') === 'VALIDO', 'EAN real do XML do lote 5 deveria ser válido.');
  assert(situacaoGtin('1200106151967') === 'INVALIDO', 'Mesmo EAN com dígito errado deveria ser inválido.');
  assert(gtinEfetivo('7891000315507', 'SEM GTIN') === '7891000315507', 'GTIN manual tem prioridade.');
  assert(gtinEfetivo('', '789-1000-315507') === '7891000315507', 'Sem manual, usa o do XML normalizado.');
  assert(gtinEfetivo(null, 'SEM GTIN') === null, 'Sem nenhum GTIN, retorna null.');
};
