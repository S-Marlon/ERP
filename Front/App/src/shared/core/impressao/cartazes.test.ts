import { gerarHtmlCartazes, linhasDoCartaz, OPCOES_CARTAZ_PADRAO, tamanhoPreco } from './cartazes';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const abracadeira = {
  nome: 'Abraçadeira de nylon 3,6 x 300 mm <C/100>', sku: 'ABR-3.6-300', marca: 'Vonder', preco: 20, unidade: 'PCT',
  faixas: [
    { quantidadeMinima: 50, preco: 15 },
    { quantidadeMinima: 10, preco: 17.9 },
    { quantidadeMinima: 10, preco: 17.5 },   // quantidade repetida: fica a primeira depois de ordenar
    { quantidadeMinima: 100, preco: 14.2 },
    { quantidadeMinima: 5, preco: 21 },      // mais cara que o varejo: fora
  ],
  copias: 2,
};

export const runCartazesTests = (): void => {
  const dois = linhasDoCartaz(abracadeira, 2);
  assert(dois.atacado.length === 2, 'Modelo de 2 faixas mostra só 2.');
  assert(dois.atacado[0].rotulo === '10 a 49 PCT' && dois.atacado[1].rotulo === 'A partir de 50 PCT', 'Faixa vai até a próxima; a última fica em aberto.');
  assert(dois.varejo.rotulo === '1 a 9 PCT', 'Varejo vai até a primeira faixa.');
  assert(dois.atacado[0].economiaPct === 10 && dois.atacado[1].economiaPct === 25, 'Economia sobre o varejo, para baixo (17,90 de 20 = 10,5% → 10%).');
  console.log('faixas: ok');

  const tres = linhasDoCartaz(abracadeira, 3);
  assert(tres.atacado.length === 3 && tres.atacado[2].preco === 14.2, 'Modelo de 3 faixas chega na de 100.');
  // Caso real (HID-68-BD): varejo 1 a 2, atacado 3 a 10 e 11+
  const balde = linhasDoCartaz({ preco: 319, unidade: 'BD', faixas: [{ quantidadeMinima: 3, quantidadeMaxima: 10, preco: 295 }, { quantidadeMinima: 11, preco: 280 }] }, 3);
  assert(balde.varejo.rotulo === '1 a 2 BD' && balde.atacado.map(l => l.rotulo).join('|') === '3 a 10 BD|A partir de 11 BD', 'Faixas do balde como configuradas.');
  const semDez = linhasDoCartaz({ ...abracadeira, faixasOcultas: [10] }, 2);
  assert(semDez.atacado[0].rotulo === '50 a 99 PCT' && semDez.varejo.rotulo === '1 a 49 PCT', 'Faixa oculta sai e o varejo acompanha.');
  console.log('ocultas: ok');

  assert(tamanhoPreco(9.9, 40) === 40 && tamanhoPreco(1234.5, 40) < tamanhoPreco(123.4, 40), 'Preço grande diminui a fonte.');
  console.log('tamanhos: ok');

  const html = gerarHtmlCartazes([abracadeira], 'A4_ATACADO_2_IMG', { ...OPCOES_CARTAZ_PADRAO, validade: '2026-12-31' });
  assert((html.match(/class="cartaz/g) || []).length === 2, 'Uma folha por cópia.');
  assert(html.includes('&lt;C/100&gt;') && !html.includes('<C/100>'), 'Nome escapado.');
  assert(!html.includes('<img'), 'Sem foto o modelo com imagem sai como o simples.');
  assert(html.includes('31/12/2026') && html.includes('ECONOMIZE'.toLowerCase()), 'Validade e economia no cartaz.');
  const comFoto = gerarHtmlCartazes([{ ...abracadeira, imagemUrl: 'javascript:alert(1)' }], 'A4_ATACADO_2_IMG', OPCOES_CARTAZ_PADRAO);
  assert(!comFoto.includes('javascript:'), 'Endereço de imagem inválido é ignorado.');
  const semVarejo = gerarHtmlCartazes([{ ...abracadeira, mostrarVarejo: false, mostrarCodigo: false, observacao: 'Caixa com 50' }], 'A4_ATACADO_2', OPCOES_CARTAZ_PADRAO);
  assert(!semVarejo.includes('linha varejo') && !semVarejo.includes('<svg') && semVarejo.includes('Caixa com 50'), 'Ajustes do editor valem no cartaz.');
  console.log('html: ok');
};

runCartazesTests();
