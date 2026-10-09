import assert from 'assert';
import {
  componenteLimitante, custoDoKit, DadosComponente, diasDeCobertura, ErroKit, estoqueDoKit, margemDoKit,
  normalizarComponentes, saidaDosComponentes, skuSugeridoKit, voltaDaDevolucao,
} from './kits';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const dados = new Map<number, DadosComponente>([
  [1, { idItem: 1, saldo: 10, custo: 12.5 }],      // terminal
  [2, { idItem: 2, saldo: 3.5, custo: 30.3333 }],  // mangueira (metro)
  [3, { idItem: 3, saldo: 0, custo: 5, servico: true }], // prensagem
]);

teste('normaliza: soma repetidos', () => {
  const r = normalizarComponentes([{ idItem: 1, quantidade: 1 }, { idItem: 2, quantidade: '1.5' }, { idItem: 1, quantidade: 1 }], 99);
  assert.deepStrictEqual(r, [{ idItem: 1, quantidade: 2 }, { idItem: 2, quantidade: 1.5 }]);
});

teste('normaliza: bloqueios', () => {
  assert.throws(() => normalizarComponentes([], 9), ErroKit);
  assert.throws(() => normalizarComponentes([{ idItem: 1, quantidade: 0 }], 9), /maior que zero/);
  assert.throws(() => normalizarComponentes([{ idItem: 9, quantidade: 1 }], 9), /ele mesmo/);
  assert.throws(() => normalizarComponentes([{ idItem: 5, quantidade: 1 }], 9, id => id === 5), /Kit dentro de kit/);
});

teste('custo do kit arredonda por linha', () => {
  // 2 × 12,5 + 1,5 × 30,3333 + 1 × 5 = 25 + 45,5 + 5
  assert.strictEqual(custoDoKit([{ idItem: 1, quantidade: 2 }, { idItem: 2, quantidade: 1.5 }, { idItem: 3, quantidade: 1 }], dados), 75.5);
});

teste('estoque do kit: componente mais escasso, serviço não limita', () => {
  const comp = [{ idItem: 1, quantidade: 2 }, { idItem: 2, quantidade: 1.5 }, { idItem: 3, quantidade: 1 }];
  assert.strictEqual(estoqueDoKit(comp, dados), 2); // mangueira: 3,5 / 1,5 = 2
  assert.strictEqual(componenteLimitante(comp, dados), 2);
  assert.strictEqual(estoqueDoKit([{ idItem: 3, quantidade: 1 }], dados), null);
  assert.strictEqual(estoqueDoKit([{ idItem: 7, quantidade: 1 }], dados), 0);
  // saldo negativo não vira kit negativo
  assert.strictEqual(estoqueDoKit([{ idItem: 8, quantidade: 1 }], new Map([[8, { idItem: 8, saldo: -2, custo: 0 }]])), 0);
});

teste('saída dos componentes por quantidade de kits', () => {
  assert.deepStrictEqual(saidaDosComponentes([{ idItem: 1, quantidade: 2 }, { idItem: 2, quantidade: 1.5 }], 3),
    [{ idItem: 1, quantidade: 6 }, { idItem: 2, quantidade: 4.5 }]);
});

teste('devolução parcial é proporcional ao que saiu', () => {
  const r = voltaDaDevolucao([{ idItem: 1, quantidade: 6, custo: 12.5 }, { idItem: 2, quantidade: 4.5, custo: 30 }], 3, 1);
  assert.deepStrictEqual(r, [{ idItem: 1, quantidade: 2, custo: 12.5 }, { idItem: 2, quantidade: 1.5, custo: 30 }]);
  assert.deepStrictEqual(voltaDaDevolucao([{ idItem: 1, quantidade: 6, custo: 1 }], 3, 5), [{ idItem: 1, quantidade: 6, custo: 1 }]);
  assert.deepStrictEqual(voltaDaDevolucao([{ idItem: 1, quantidade: 6, custo: 1 }], 0, 1), []);
});

teste('margem, cobertura e SKU sugerido', () => {
  assert.deepStrictEqual(margemDoKit(100, 75.5), { lucro: 24.5, margemPct: 24.5 });
  assert.deepStrictEqual(margemDoKit(0, 10), { lucro: -10, margemPct: 0 });
  assert.strictEqual(diasDeCobertura(10, 30, 90), 30); // 1/3 por dia
  assert.strictEqual(diasDeCobertura(10, 0, 90), null);
  assert.strictEqual(skuSugeridoKit(42), 'KIT-0042');
});
