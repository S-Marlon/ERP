import assert from 'assert';
import { faltasLogistica, pacoteDoEnvio, regraParaQuantidade, regrasEfetivas, validarLogistica, validarRegras } from './logistica';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('logística: peso e medidas', () => {
  assert.deepStrictEqual(validarLogistica({ pesoKg: '0,025', altura: 2, largura: '7', comprimento: 7 }), { pesoKg: 0.025, medidas: { altura: 2, largura: 7, comprimento: 7 } });
  assert.deepStrictEqual(validarLogistica({ pesoKg: '', altura: null }), { pesoKg: null, medidas: null });
  assert.throws(() => validarLogistica({ altura: 2, largura: 7 }), /três medidas/);
  assert.throws(() => validarLogistica({ pesoKg: -1 }), /maior que zero/);
  assert.throws(() => validarLogistica({ altura: 500, largura: 1, comprimento: 1 }), /no máximo 300/);
});

teste('logística: regras de embalagem', () => {
  const regras = validarRegras([{ quantidadeAte: 10, idEmbalagem: 2 }, { quantidadeAte: 2, idEmbalagem: 1 }]);
  assert.deepStrictEqual(regras.map(r => r.quantidadeAte), [2, 10]);                     // em ordem
  assert.throws(() => validarRegras([{ quantidadeAte: 2, idEmbalagem: 1 }, { quantidadeAte: 2, idEmbalagem: 3 }]), /mesma quantidade/);
  assert.throws(() => validarRegras([{ quantidadeAte: 0, idEmbalagem: 1 }]), /maior que zero/);
  assert.deepStrictEqual(validarRegras([]), []);                                         // vazio = tira a embalagem
  assert.strictEqual(regraParaQuantidade(regras, 1)?.idEmbalagem, 1);
  assert.strictEqual(regraParaQuantidade(regras, 2)?.idEmbalagem, 1);
  assert.strictEqual(regraParaQuantidade(regras, 3)?.idEmbalagem, 2);                     // kit c/3 já vai na caixa
  assert.strictEqual(regraParaQuantidade(regras, 11), null);                              // não cabe em nenhuma
  assert.strictEqual(regrasEfetivas([], regras).origem, 'FAMILIA');
  assert.strictEqual(regrasEfetivas([{ quantidadeAte: 1, idEmbalagem: 9 }], regras).regras[0].idEmbalagem, 9);   // a do item vence
  assert.strictEqual(regrasEfetivas([], []).origem, null);
});

teste('logística: pacote do envio e o que falta', () => {
  const caixa = { idEmbalagem: 2, nome: 'Caixa nº 1', pesoKg: 0.05, medidas: { altura: 6, largura: 10, comprimento: 15 }, custo: 0.8 };
  assert.deepStrictEqual(pacoteDoEnvio({ pesoProdutoKg: 0.02, quantidade: 10, embalagem: caixa }), { medidas: caixa.medidas, pesoKg: 0.25, custo: 0.8 });
  assert.strictEqual(pacoteDoEnvio({ pesoProdutoKg: null, quantidade: 1, embalagem: caixa })?.pesoKg, null);
  assert.strictEqual(pacoteDoEnvio({ pesoProdutoKg: 0.02, quantidade: 1, embalagem: null }), null);
  assert.deepStrictEqual(faltasLogistica({ pesoKg: null, medidas: null, temEmbalagem: false, fotos: 0 }), ['PESO', 'MEDIDAS', 'EMBALAGEM', 'FOTO']);
  assert.deepStrictEqual(faltasLogistica({ pesoKg: 0.1, medidas: caixa.medidas, temEmbalagem: true, fotos: 2 }), []);
});
