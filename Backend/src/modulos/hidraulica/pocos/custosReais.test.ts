import assert from 'assert';
import { validarCustoReal } from './custosReais';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('custos reais da obra: lançamento', () => {
  assert.deepStrictEqual(validarCustoReal({ tipo: 'equipe', data: '2026-11-20', quantidade: '12,5', valorUnitario: 85.333 }),
    { data: '2026-11-20', tipo: 'EQUIPE', descricao: null, quantidade: 12.5, valorUnitario: 85.333, valor: 1066.66 });
  assert.deepStrictEqual(validarCustoReal({ tipo: 'COMBUSTIVEL', data: '2026-11-20', descricao: '  diesel   sonda ', valor: '450,9', quantidade: 9 }),
    { data: '2026-11-20', tipo: 'COMBUSTIVEL', descricao: 'diesel sonda', quantidade: null, valorUnitario: null, valor: 450.9 });
  assert.throws(() => validarCustoReal({ tipo: 'KM', data: '2026-11-20', valorUnitario: 1.2 }), /Informe os km/);
  assert.throws(() => validarCustoReal({ tipo: 'EQUIPE', data: '2026-11-20', quantidade: 3 }), /custo da hora/);
  assert.throws(() => validarCustoReal({ tipo: 'DESPESA', data: '2026-11-20', valor: 0 }), /Informe o valor/);
  assert.throws(() => validarCustoReal({ tipo: 'OUTRO', data: '2026-11-20', valor: 10 }), /Diga o que/);
  assert.throws(() => validarCustoReal({ tipo: 'PIZZA', data: '2026-11-20', valor: 10 }), /Tipo de custo/);
  assert.throws(() => validarCustoReal({ tipo: 'DESPESA', data: '20/11/2026', valor: 10 }), /Data/);
});
