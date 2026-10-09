import assert from 'assert';
import { adicionarLinha, corCobertura, custoDoKit, podeMontar, precoPorMarkup } from './kitsCalculo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const linhas = [
  { idItem: 1, quantidade: 2, saldo: 10, custoUnitario: 12.5, servico: false },
  { idItem: 2, quantidade: 1.5, saldo: 3.5, custoUnitario: 30.3333, servico: false },
  { idItem: 3, quantidade: 1, saldo: 0, custoUnitario: 5, servico: true },
];

teste('custo soma linhas arredondadas', () => assert.strictEqual(custoDoKit(linhas), 75.5));

teste('pode montar: mais escasso, serviço não limita', () => {
  assert.strictEqual(podeMontar(linhas), 2);
  assert.strictEqual(podeMontar([linhas[2]]), null);
  assert.strictEqual(podeMontar([]), null);
});

teste('preço por markup com taxa', () => {
  assert.strictEqual(precoPorMarkup(75.5, 2, 1), 151);
  assert.strictEqual(precoPorMarkup(100, 1.5, 1 / (1 - 0.05)), 157.89);
});

teste('adicionar soma repetido', () => {
  const r = adicionarLinha(linhas, { ...linhas[0], quantidade: 1 });
  assert.strictEqual(r.length, 3);
  assert.strictEqual(r[0].quantidade, 3);
  assert.strictEqual(adicionarLinha(linhas, { ...linhas[0], idItem: 9 }).length, 4);
});

teste('cor da cobertura', () => {
  assert.strictEqual(corCobertura(null), 'default');
  assert.strictEqual(corCobertura(10), 'red');
  assert.strictEqual(corCobertura(20), 'orange');
  assert.strictEqual(corCobertura(60), 'green');
});
