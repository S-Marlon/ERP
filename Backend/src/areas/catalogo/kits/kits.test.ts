import assert from 'assert';
import {
  componenteLimitante, custoDoKit, DadosComponente, diasDeCobertura, ErroKit, estoqueDoKit, margemDoKit,
  ItemDaEscolha, nomeComTrocas, normalizarComponentes, resolverEscolhasKit, saidaDosComponentes, skuSugeridoKit, voltaDaDevolucao,
} from './kits';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const dados = new Map<number, DadosComponente>([
  [1, { idItem: 1, saldo: 10, custo: 12.5 }],      // terminal
  [2, { idItem: 2, saldo: 3.5, custo: 30.3333 }],  // mangueira (metro)
  [3, { idItem: 3, saldo: 0, custo: 5, servico: true }], // prensagem
]);

teste('normaliza: soma repetidos', () => {
  const r = normalizarComponentes([{ idItem: 1, quantidade: 1 }, { idItem: 2, quantidade: '1.5' }, { idItem: 1, quantidade: 1 }], 99);
  assert.deepStrictEqual(r.map(c => ({ idItem: c.idItem, quantidade: c.quantidade })), [{ idItem: 1, quantidade: 2 }, { idItem: 2, quantidade: 1.5 }]);
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

const item = (idItem: number, preco: number, familiaId: number | null, extra: Partial<ItemDaEscolha> = {}): ItemDaEscolha =>
  ({ idItem, sku: `S${idItem}`, nome: `Item ${idItem}`, familiaId, ativo: true, ehKit: false, preco, ...extra });
const itensKit = new Map<number, ItemDaEscolha>([
  [10, item(10, 900, 1)],   // bomba 1 CV
  [11, item(11, 1200, 1)],  // bomba 2 CV
  [12, item(12, 1000, 2)],  // outra família
  [13, item(13, 950, 1, { ativo: false })],
  [20, item(20, 3.5, 3)],   // fio 2,5 mm (metro)
  [21, item(21, 5.25, 3)],  // fio 4 mm
  [30, item(30, 50, null)], // fixo
]);
const composicao = [
  { idComposicao: 1, idItem: 10, quantidade: 1, permiteTrocar: true },
  { idComposicao: 2, idItem: 20, quantidade: 50, permiteTrocar: true, permiteAlterarQtd: true },
  { idComposicao: 3, idItem: 30, quantidade: 1 },
];

teste('kit configurável: sem escolha fica no padrão', () => {
  const r = resolverEscolhasKit(composicao, undefined, itensKit);
  assert.strictEqual(r.ajuste, 0);
  assert.strictEqual(r.alterado, false);
  assert.deepStrictEqual(r.componentes.map(c => c.idItem), [10, 20, 30]);
  assert.strictEqual(nomeComTrocas('KIT', r), 'KIT');
});

teste('kit configurável: troca e quantidade somam a diferença', () => {
  const r = resolverEscolhasKit(composicao, [{ slot: 1, idItem: 11, quantidade: 1 }, { slot: 2, idItem: 21, quantidade: 80 }], itensKit);
  // bomba +300; fio 80 × 5,25 − 50 × 3,5 = 420 − 175 = +245
  assert.strictEqual(r.ajuste, 545);
  assert.deepStrictEqual(r.componentes, [{ idItem: 11, quantidade: 1 }, { idItem: 21, quantidade: 80 }, { idItem: 30, quantidade: 1 }]);
  assert.strictEqual(r.resumo, 'S11; S21 x80');
  assert.strictEqual(nomeComTrocas('KIT MOTOBOMBA', r), 'KIT MOTOBOMBA [S11; S21 x80]');
  // trocar para menos desconta
  assert.strictEqual(resolverEscolhasKit(composicao, [{ slot: 2, idItem: 20, quantidade: 30 }], itensKit).ajuste, -70);
  // a assinatura não depende da ordem das escolhas
  const r2 = resolverEscolhasKit(composicao, [{ slot: 2, idItem: 21, quantidade: 80 }, { slot: 1, idItem: 11, quantidade: 1 }], itensKit);
  assert.strictEqual(r2.assinatura, r.assinatura);
});

teste('kit configurável: bloqueios', () => {
  assert.throws(() => resolverEscolhasKit(composicao, [{ slot: 3, idItem: 10, quantidade: 1 }], itensKit), /fixo/);
  assert.throws(() => resolverEscolhasKit(composicao, [{ slot: 1, idItem: 12, quantidade: 1 }], itensKit), /mesma família/);
  assert.throws(() => resolverEscolhasKit(composicao, [{ slot: 1, idItem: 13, quantidade: 1 }], itensKit), /inativo/);
  assert.throws(() => resolverEscolhasKit(composicao, [{ slot: 1, idItem: 10, quantidade: 2 }], itensKit), /quantidade .* é fixa/);
  assert.throws(() => resolverEscolhasKit(composicao, [{ slot: 2, idItem: 20, quantidade: 0 }], itensKit), /maior que zero/);
  assert.throws(() => resolverEscolhasKit(composicao, [{ slot: 9, idItem: 10, quantidade: 1 }], itensKit), /mudou/);
});

teste('normaliza guarda as marcações', () => {
  const r = normalizarComponentes([{ idItem: 1, quantidade: 1, permiteTrocar: true }, { idItem: 2, quantidade: 5, permiteAlterarQtd: 1 }], 9);
  assert.deepStrictEqual(r, [
    { idItem: 1, quantidade: 1, permiteTrocar: true, permiteAlterarQtd: false },
    { idItem: 2, quantidade: 5, permiteTrocar: false, permiteAlterarQtd: true },
  ]);
});
