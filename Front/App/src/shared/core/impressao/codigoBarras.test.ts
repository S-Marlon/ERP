import { CODE128_PADROES, codificarCode128, codificarEan13, eanValido, escolherCodigo, valoresCode128B , valoresCode128C, codificarCode128C} from './codigoBarras';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runCodigoBarrasTests = (): void => {
  // Code 128-C: pares de dígitos; checksum = (105 + 12*1 + 34*2) % 103 = 185 % 103 = 82
  const c = valoresCode128C('1234');
  if (c.join(',') !== '105,12,34,82,106') throw new Error(`Code128C: ${c.join(',')}`);
  if (codificarCode128C('00').length !== 11 * 3 + 13) throw new Error('Code128C: largura em módulos');
  let impar = false; try { valoresCode128C('123'); } catch { impar = true; }
  if (!impar) throw new Error('Code128C deveria recusar quantidade ímpar');
  // Tabela Code 128: 107 símbolos distintos, cada um com 11 módulos (STOP com 13)
  assert(CODE128_PADROES.length === 107 && new Set(CODE128_PADROES).size === 107, 'Tabela Code 128 completa e sem repetição.');
  assert(CODE128_PADROES.slice(0, 106).every(p => p.length === 6 && p.split('').reduce((a, w) => a + Number(w), 0) === 11), 'Símbolos com 11 módulos.');
  assert(CODE128_PADROES[106].split('').reduce((a, w) => a + Number(w), 0) === 13, 'STOP com 13 módulos.');

  // "PJJ123C" em Code 128-B: 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879; 879 mod 103 = 55
  const v = valoresCode128B('PJJ123C');
  assert(v[0] === 104 && v[v.length - 2] === 55 && v[v.length - 1] === 106, 'Checksum do Code 128 (PJJ123C = 55).');
  assert(codificarCode128('AB').length === 11 * 4 + 13, 'Start + 2 dados + checksum + stop.');

  // EAN-13 (7891000315507 é válido)
  assert(eanValido('7891000315507') && !eanValido('7891000315508') && !eanValido('123'), 'Validação do EAN-13.');
  const ean = codificarEan13('7891000315507');
  assert(ean.length === 95 && ean.startsWith('101') && ean.endsWith('101') && ean.slice(45, 50) === '01010', 'EAN-13 com 95 módulos e guardas.');

  assert(escolherCodigo('7891000315507', 'X')?.tipo === 'EAN13', 'GTIN válido usa EAN-13.');
  assert(escolherCodigo('', 'ROL-6005')?.tipo === 'CODE128', 'Sem GTIN, usa o SKU em Code 128.');
  assert(escolherCodigo('', 'AÇO')?.valor === 'ACO', 'Acentos são removidos.');
  assert(escolherCodigo('', '') === null, 'Sem GTIN e sem SKU, sem código.');
};
