import { gerarHtmlEtiquetas, gerarPrn, linhaAtacado, linhaInfo, partesPreco, sanitizarPrn } from './etiquetas';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runEtiquetasTests = (): void => {
  const rolamento = {
    nome: 'Rolamento 6005 ZZ "GBR"', sku: '17247A', preco: 13.275, unidade: 'PC', gtin: '7891000315507',
    atacado: { quantidadeMinima: 10, preco: 9.2925 }, copias: 2, validade: '2027-01-31',
  };

  assert(partesPreco(13.275).inteiro === '13' && partesPreco(13.275).centavos === '28', 'Preço arredonda para centavos.');
  assert(partesPreco(1234.5).inteiro === '1.234' && partesPreco(1234.5).centavos === '50', 'Milhar com ponto.');
  assert(sanitizarPrn('Ação "x"') === "ACAO 'X'", 'PRN sem acento, sem aspas duplas e em maiúsculas.');
  assert(linhaAtacado(rolamento) === 'A PARTIR DE 10 PC: R$ 9,29', 'Linha de atacado.');
  assert(linhaInfo(rolamento).includes('VAL: 31/01/2027'), 'Validade em formato brasileiro.');

  const prn = gerarPrn([rolamento], '105x27');
  assert((prn.match(/\nP1\n/g) || []).length === 2, 'Uma etiqueta por cópia no PRN.');
  assert(prn.includes(',E30,') && prn.includes('"7891000315507"'), 'GTIN válido sai como EAN-13 (E30).');
  assert(gerarPrn([{ ...rolamento, gtin: '' }], '60x40').includes(',1,2,4,50,N,"17247A"'), 'Sem GTIN, Code 128 com o SKU.');

  const html = gerarHtmlEtiquetas([rolamento], '105x27');
  assert((html.match(/class="pagina"/g) || []).length === 2 && html.includes('size: 105mm 27mm'), 'HTML: página do tamanho da etiqueta, uma por cópia.');
  assert(html.includes('&quot;GBR&quot;') && html.includes('<svg'), 'HTML escapa o texto e desenha o código de barras.');
};
