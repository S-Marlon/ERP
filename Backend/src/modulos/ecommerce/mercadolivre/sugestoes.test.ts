import assert from 'assert';
import {
  caixaQueCobraPeloPeso, faixasAbaixo, lerMedidaMl, ordenarSugestoes, pesoVolumetrico, sugestaoCadastro, sugestaoCaixa, sugestaoFreteGratis,
  sugestaoKit, sugestaoPeso, sugestaoPreco, unidadesParaPassar79,
} from './sugestoes';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const b = { idAnuncio: 4, idLinha: 1, sku: 'ABR-7.2-500' };

teste('sugestões: medidas, volume e caixa (números das abraçadeiras)', () => {
  assert.strictEqual(lerMedidaMl('43 cm'), 43);
  assert.strictEqual(lerMedidaMl('425 g'), 425);
  assert.strictEqual(lerMedidaMl('0,4 kg'), 400);
  assert.strictEqual(lerMedidaMl(''), null);
  const caixa = { comprimento: 43, largura: 19, altura: 4 };
  assert.strictEqual(pesoVolumetrico(caixa), 545);
  assert.deepStrictEqual(caixaQueCobraPeloPeso(caixa, 425), { comprimento: 33, largura: 19, altura: 4 });
  assert.strictEqual(caixaQueCobraPeloPeso({ comprimento: 33, largura: 10, altura: 3 }, 400), null);
  assert.deepStrictEqual(faixasAbaixo(438), [250, 300]);
});

teste('sugestões: frete grátis abaixo de 79, caixa e faixa de peso', () => {
  const fg = sugestaoFreteGratis(b, { preco: 23.4, freteComGratis: 13.85, freteSemGratis: 6.95 });
  assert.strictEqual(fg?.economia, 6.9);
  assert.strictEqual(sugestaoFreteGratis(b, { preco: 99, freteComGratis: 16, freteSemGratis: 6 }), null);
  const cx = sugestaoCaixa(b, { caixa: { comprimento: 43, largura: 19, altura: 4 }, pesoRealG: 425, freteNoVolume: 14.45, freteNoPeso: 13.85 });
  assert.strictEqual(cx?.economia, 0.6);
  assert.ok(cx?.texto.includes('33×19×4'));
  const p = sugestaoPeso(b, { pesoG: 438, frete: 13.85, faixas: [{ pesoG: 250, frete: 12.95 }, { pesoG: 300, frete: 12.95 }] });
  assert.strictEqual(p?.economia, 0.9);
  assert.ok(p?.texto.includes('até 300 g'));
  assert.strictEqual(sugestaoPeso(b, { pesoG: 438, frete: 13.85, faixas: [{ pesoG: 300, frete: 13.75 }] }), null);
});

teste('sugestões: kit, preço e cadastro', () => {
  assert.strictEqual(unidadesParaPassar79(23.4), 4);
  assert.strictEqual(unidadesParaPassar79(5), null);
  assert.strictEqual(unidadesParaPassar79(80), null);
  const k = sugestaoKit(b, { preco: 23.4, unidades: 4, lucroUnitario: -1.76, lucroDoKit: 20, precoKit: 93.6 });
  assert.strictEqual(k?.economia, 6.76);
  const pr = sugestaoPreco(b, { preco: 23.4, lucro: -1.76, pct: -20.7, nivel: 'PREJUIZO', precoAlvo: 39.9, lucroNoAlvo: 2.55, alvoPct: 30 });
  assert.strictEqual(pr?.titulo, 'Vendendo com prejuízo');
  assert.strictEqual(sugestaoPreco(b, { preco: 23.4, lucro: 5, pct: 60, nivel: 'ALTO', precoAlvo: 20, lucroNoAlvo: 4, alvoPct: 30 }), null);
  assert.ok(sugestaoCadastro(b, { pesoErpG: null, caixaErp: null, pesoMlG: 425, caixaMl: { comprimento: 43, largura: 19, altura: 4 } }));
  assert.strictEqual(sugestaoCadastro(b, { pesoErpG: 425, caixaErp: { comprimento: 43, largura: 19, altura: 4 }, pesoMlG: 430, caixaMl: { comprimento: 43, largura: 19, altura: 4 } }), null);
  assert.ok(sugestaoCadastro(b, { pesoErpG: 120, caixaErp: { comprimento: 20, largura: 10, altura: 3 }, pesoMlG: 425, caixaMl: { comprimento: 43, largura: 19, altura: 4 } }));
  const fg = sugestaoFreteGratis(b, { preco: 23.4, freteComGratis: 13.85, freteSemGratis: 6.95 })!;
  const cx = sugestaoCaixa(b, { caixa: { comprimento: 43, largura: 19, altura: 4 }, pesoRealG: 425, freteNoVolume: 14.45, freteNoPeso: 13.85 })!;
  const ordem = ordenarSugestoes([sugestaoCadastro(b, { pesoErpG: null, caixaErp: null, pesoMlG: 425, caixaMl: null })!, cx, fg]);
  assert.deepStrictEqual(ordem.map(s => s.tipo), ['FRETE_GRATIS', 'CAIXA', 'CADASTRO']);
});
