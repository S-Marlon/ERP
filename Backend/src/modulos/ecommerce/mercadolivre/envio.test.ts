import assert from 'assert';
import { faltasDoEnvio, situacaoDoPacote } from './envio';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const caixa = { altura: 6, largura: 10, comprimento: 15 };

teste('envio: pacote do ML contra o do ERP', () => {
  const erp = { pesoG: 250, caixa };
  assert.strictEqual(situacaoDoPacote({ pesoG: 255, caixa: { altura: 15, largura: 6, comprimento: 10.3 } }, erp, true), 'IGUAL');   // lados em outra ordem, peso dentro dos 5%
  assert.strictEqual(situacaoDoPacote({ pesoG: 400, caixa }, erp, true), 'DIFERENTE');
  assert.strictEqual(situacaoDoPacote({ pesoG: 250, caixa: { altura: 6, largura: 10, comprimento: 20 } }, erp, true), 'DIFERENTE');
  assert.strictEqual(situacaoDoPacote({ pesoG: 250, caixa: null }, erp, true), 'FALTA_NO_ML');
  assert.strictEqual(situacaoDoPacote(null, erp, false), 'NAO_PUBLICADO');
  assert.strictEqual(situacaoDoPacote({ pesoG: 250, caixa }, { pesoG: null, caixa }, true), 'SEM_ERP');   // embalagem sem o peso do produto
  assert.strictEqual(situacaoDoPacote({ pesoG: 10, caixa }, { pesoG: 12, caixa }, true), 'IGUAL');     // até 5 g de folga
});

teste('envio: o que falta', () => {
  assert.deepStrictEqual(faltasDoEnvio({ pesoKg: null, medidas: null, temEmbalagem: false, fotos: 0, fotoFamilia: false }), ['PESO', 'MEDIDAS', 'EMBALAGEM', 'FOTO']);
  assert.deepStrictEqual(faltasDoEnvio({ pesoKg: 0.02, medidas: caixa, temEmbalagem: true, fotos: 0, fotoFamilia: true }), []);   // foto da família vale
});
