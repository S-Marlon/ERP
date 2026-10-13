import assert from 'assert';
import { compararAtributos, conferirCandidato, lerDisputa, ordenarCandidatos } from './catalogo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('disputa do botão de compra traduzida', () => {
  const d = lerDisputa({
    current_price: 42.9, price_to_win: 42.9, status: 'listed', reason: ['reputation_below_threshold'], catalog_product_id: 'MLB75272477', winner: null,
    boosts: [{ id: 'fulfillment', status: 'opportunity' }, { id: 'free_installments', status: 'opportunity' }, { id: 'free_shipping', status: 'not_apply' }, { id: 'shipping_collect', status: 'boosted' }],
  })!;
  assert.strictEqual(d.status, 'listed');
  assert.strictEqual(d.precoParaGanhar, 42.9);
  assert.ok(d.motivos[0].startsWith('reputação abaixo do mínimo'));
  assert.deepStrictEqual(d.oportunidades, ['Mercado Envios Full', 'parcelamento sem juros']);
  assert.deepStrictEqual(d.vantagens, ['envio com coleta']);
  assert.strictEqual(lerDisputa(null), null);
});

teste('candidato do catálogo: marca e código de barras', () => {
  const tradestar = { id: 'MLB77123880', name: 'Abraçadeira Nylon 3,6 X 150 Mm Preta 100 Unidades Tradestar', attributes: [{ id: 'BRAND', value_name: 'Tradestar' }, { id: 'MODEL', value_name: '49051' }] };
  const gadan = { id: 'MLB1', name: 'Abraçadeira Gadan', attributes: [{ id: 'BRAND', value_name: 'GADAN' }, { id: 'GTIN', values: [{ name: '7891234567890' }] }] };
  const c1 = conferirCandidato(tradestar, { marca: 'Gadan', gtin: null });
  assert.deepStrictEqual([c1.marcaConfere, c1.gtinConfere, c1.podeEntrar], [false, false, false]);
  const c2 = conferirCandidato(gadan, { marca: 'Gadan', gtin: null });
  assert.deepStrictEqual([c2.marcaConfere, c2.podeEntrar], [true, true]);
  const c3 = conferirCandidato(gadan, { marca: 'Outra', gtin: '789-1234567890' });
  assert.deepStrictEqual([c3.gtinConfere, c3.podeEntrar], [true, true]);
  // item sem marca nunca "confere" por marca
  assert.strictEqual(conferirCandidato({ attributes: [{ id: 'BRAND', value_name: 'Genérica' }] }, { marca: 'Genérica', gtin: null }).podeEntrar, false);
  assert.deepStrictEqual(ordenarCandidatos([c1, c2, c3]).map(c => c.produtoId), ['MLB1', 'MLB1', 'MLB77123880']);
});

teste('medidas do catálogo x do item (a mesma marca não basta)', () => {
  const gadan250 = { id: 'MLB55970810', name: 'Abraçadeira Nylon Preta Gadan 250x3.6mm 100 Peças', attributes: [
    { id: 'BRAND', name: 'Marca', value_name: 'Gadan' }, { id: 'LENGTH', name: 'Comprimento', value_name: '25 cm' },
    { id: 'WIDTH', name: 'Largura', value_name: '3.6 mm' }, { id: 'UNITS_PER_PACKAGE', name: 'Unidades por pacote', value_name: '100' },
    { id: 'COLOR', name: 'Cor', value_name: 'Preto' }, { id: 'MODEL', name: 'Modelo', value_name: 'X' },
  ] };
  const valores = (comprimento: string) => ({
    LENGTH: { valor: comprimento, unidade: null }, WIDTH: { valor: '3.6', unidade: 'mm' }, UNITS_PER_PACKAGE: { valor: '100', unidade: null },
    COLOR: { valor: 'preto', unidade: null }, MODEL: { valor: 'ABR', unidade: null },
  });
  const certo = conferirCandidato(gadan250, { marca: 'Gadan', gtin: null, valores: valores('250mm') });
  assert.deepStrictEqual(certo.diferentes, []);
  assert.deepStrictEqual(certo.conferem, ['Comprimento', 'Largura', 'Unidades por pacote', 'Cor']);
  assert.strictEqual(certo.podeEntrar, true);
  const errado = conferirCandidato(gadan250, { marca: 'Gadan', gtin: null, valores: valores('100mm') });
  assert.deepStrictEqual(errado.diferentes, [{ nome: 'Comprimento', catalogo: '25 cm', item: '100mm' }]);
  assert.strictEqual(errado.podeEntrar, false);
  assert.deepStrictEqual(compararAtributos([{ id: 'LENGTH', name: 'C', value_name: '1,5 m' }], { LENGTH: { valor: '1500', unidade: 'mm' } }).conferem, ['C']);
});

teste('texto diferente não trava, grafia parecida conta como igual', () => {
  const r = compararAtributos([
    { id: 'MATERIAL', name: 'Material', value_name: 'Nilon' }, { id: 'COLOR', name: 'Cor', value_name: 'Preto' }, { id: 'UNITS', name: 'Unidades', value_name: '100' },
  ], { MATERIAL: { valor: 'NYLON', unidade: null }, COLOR: { valor: 'Branco', unidade: null }, UNITS: { valor: '50', unidade: null } });
  assert.deepStrictEqual(r.conferem, ['Material']);
  assert.deepStrictEqual(r.conferir.map(x => x.nome), ['Cor']);
  assert.deepStrictEqual(r.diferentes.map(x => x.nome), ['Unidades']);
});
