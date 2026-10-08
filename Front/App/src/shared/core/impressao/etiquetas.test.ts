import { gerarHtmlEtiquetas, linhaAtacado, linhaInfo, partesPreco } from './etiquetas';

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
  assert(linhaAtacado(rolamento) === 'A PARTIR DE 10 PC: R$ 9,29', 'Linha de atacado.');
  assert(linhaInfo(rolamento).includes('VAL: 31/01/2027'), 'Validade em formato brasileiro.');
  assert(!linhaInfo(rolamento).includes('COD') && !linhaInfo(rolamento).includes('17247A'), 'Rodapé sem o código (já sai nas barras).');
  assert(linhaInfo({ ...rolamento, validade: undefined }) === '', 'Sem lote e validade, rodapé vazio.');

  const html = gerarHtmlEtiquetas([rolamento], '105x27');
  assert((html.match(/class="pagina"/g) || []).length === 2 && html.includes('size: 105mm 25mm'), 'HTML: página do tamanho da etiqueta, uma por cópia.');
  assert(html.includes('&quot;GBR&quot;') && html.includes('<svg'), 'HTML escapa o texto e desenha o código de barras.');
};

runEtiquetasTests();
console.log('etiquetas: ok');
