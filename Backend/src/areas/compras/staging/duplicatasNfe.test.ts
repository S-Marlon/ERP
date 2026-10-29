import assert from 'assert';
import { duplicatasDoXml, passaFiltroDuplicatas } from './duplicatasNfe';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('duplicatas do XML', () => {
  const xml = `<cobr><fat><nFat>123</nFat><vOrig>300.00</vOrig></fat>
    <dup><nDup>001</nDup><dVenc>2026-11-10</dVenc><vDup>100.00</vDup></dup>
    <dup><nDup>002</nDup><dVenc>2026-12-10</dVenc><vDup>100.005</vDup></dup>
    <dup><dVenc>xx</dVenc><vDup>99.99</vDup></dup></cobr>`;
  assert.deepStrictEqual(duplicatasDoXml(xml), [
    { numero: '001', vencimento: '2026-11-10', valor: 100 },
    { numero: '002', vencimento: '2026-12-10', valor: 100.01 },
    { numero: '003', vencimento: null, valor: 99.99 },
  ]);
  assert.deepStrictEqual(duplicatasDoXml('<nfe:dup><nfe:nDup>1</nfe:nDup><nfe:vDup>5</nfe:vDup></nfe:dup>'), [{ numero: '1', vencimento: null, valor: 5 }]);
  assert.deepStrictEqual(duplicatasDoXml(null), []);
  assert.deepStrictEqual(duplicatasDoXml('<cobr><fat><nFat>1</nFat></fat></cobr>'), []);
});

teste('filtro de duplicatas', () => {
  assert.deepStrictEqual([passaFiltroDuplicatas('com', 2), passaFiltroDuplicatas('com', 0), passaFiltroDuplicatas('sem', 0), passaFiltroDuplicatas('sem', 1), passaFiltroDuplicatas('', 0)],
    [true, false, true, false, true]);
});
