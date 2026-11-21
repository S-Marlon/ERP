import assert from 'assert';
import { classeExibida, classificar, classificarItens, frequencia, ItemCurva, resumir } from './curvaAbc';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const item = (x: Partial<ItemCurva>): ItemCurva => ({
  idItem: 1, categoriaTopo: 1, receita: 0, lucro: 0, quantidade: 0, vendas: 0, semanasComVenda: 0, estoque: 0, custoUnitario: 1,
  diasDesdeEntrada: 200, ultimaVenda: null, ...x,
});

teste('abc: classificação pelo acumulado', () => {
  const c = classificar(new Map([[1, 700], [2, 150], [3, 100], [4, 50], [5, 0]]));
  assert.deepStrictEqual([...c.entries()], [[1, 'A'], [2, 'A'], [3, 'B'], [4, 'C']]);   // quem cruza os 80% é A; zero fica fora
  assert.strictEqual(classificar(new Map()).size, 0);
});

teste('abc: frequência (XYZ)', () => {
  assert.strictEqual(frequencia(0, 13), null);
  assert.strictEqual(frequencia(1, 13), 'Z');
  assert.strictEqual(frequencia(3, 13), 'Y');
  assert.strictEqual(frequencia(6, 13), 'X');
  assert.strictEqual(frequencia(1, 1), 'Z');   // uma semana só nunca é X
});

teste('abc: situações, curva na categoria e recomendações', () => {
  const itens = classificarItens([
    item({ idItem: 1, receita: 1000, lucro: 100, quantidade: 90, semanasComVenda: 8, estoque: 5, custoUnitario: 10 }),     // A, margem 10%
    item({ idItem: 2, receita: 300, lucro: 150, quantidade: 3, semanasComVenda: 1, estoque: 100, custoUnitario: 50 }),   // pontual, estoque alto
    item({ idItem: 3, estoque: 200, custoUnitario: 30 }),                                                                // parado (R$ 6.000)
    item({ idItem: 4, estoque: 10, custoUnitario: 2, diasDesdeEntrada: 10 }),                                            // novo
    item({ idItem: 5 }),                                                                                                 // sem giro
    item({ idItem: 6, categoriaTopo: 2, receita: 50, lucro: -5, quantidade: 1, semanasComVenda: 1, estoque: 1 }),        // prejuízo; A na categoria dele
  ], 91);
  const p = (id: number) => itens.find(i => i.idItem === id)!;
  assert.deepStrictEqual([p(1).venda, p(1).xyz, p(1).coberturaDias], ['A', 'X', 5]);
  assert.strictEqual(p(1).recomendacao, 'Pode faltar: estoque para ~5 dias');
  assert.strictEqual(p(2).xyz, 'Z');
  assert.strictEqual(p(2).coberturaDias, 3033);
  assert.strictEqual(p(3).situacao, 'PARADO');
  assert.strictEqual(p(3).estoqueClasse, 'A');
  assert.match(p(3).recomendacao!, /Dinheiro parado/);
  assert.strictEqual(p(4).situacao, 'NOVO');
  assert.strictEqual(p(5).situacao, 'SEM_GIRO');
  assert.strictEqual(p(6).vendaNaCategoria, 'A');
  assert.strictEqual(p(6).venda, 'C');
  assert.match(p(6).recomendacao!, /prejuízo/);
  assert.deepStrictEqual(['VENDA', 'LUCRO', 'ESTOQUE'].map(c => classeExibida(p(3), c as any)), ['P', 'P', 'A']);
  assert.strictEqual(classeExibida(p(4), 'VENDA'), 'N');
  assert.strictEqual(classeExibida(p(5), 'VENDA'), '-');
  // histórico curto (49 dias): a carga inicial (entrou há 53 dias) não é "novo"; o ritmo usa os 49 dias
  const curto = classificarItens([
    item({ idItem: 1, estoque: 10, diasDesdeEntrada: 53 }),
    item({ idItem: 2, estoque: 10, diasDesdeEntrada: 20 }),
    item({ idItem: 3, receita: 100, lucro: 30, quantidade: 49, semanasComVenda: 7, estoque: 10 }),
    item({ idItem: 4, receita: 900, lucro: 300, quantidade: 5, semanasComVenda: 3, estoque: 0 }),
  ], 90, undefined, 49);
  assert.deepStrictEqual(curto.map(i => i.situacao), ['PARADO', 'NOVO', 'NORMAL', 'NORMAL']);
  assert.strictEqual(curto[2].coberturaDias, 10);
  assert.strictEqual(curto[2].xyz, 'X');
  assert.strictEqual(curto[3].recomendacao, 'Sem estoque: repor');
  // margem baixa sem risco de faltar
  const baixa = classificarItens([item({ idItem: 1, receita: 1000, lucro: 50, quantidade: 10, semanasComVenda: 6, estoque: 100 })], 91)[0];
  assert.strictEqual(baixa.recomendacao, 'Vende muito e lucra pouco: revisar preço');
});

teste('abc: resumo e matriz', () => {
  const itens = classificarItens([
    item({ idItem: 1, receita: 800, quantidade: 8, semanasComVenda: 7 }),
    item({ idItem: 2, receita: 150, quantidade: 2, semanasComVenda: 2 }),
    item({ idItem: 3, receita: 50, quantidade: 1, semanasComVenda: 1 }),
    item({ idItem: 4, estoque: 10, custoUnitario: 5 }),
  ], 91);
  const r = resumir(itens, 'VENDA');
  assert.strictEqual(r.total, 1000);
  assert.deepStrictEqual(r.porClasse.filter(c => c.itens).map(c => [c.classe, c.itens, c.valor]), [['A', 1, 800], ['B', 1, 150], ['C', 1, 50], ['P', 1, 50]]);
  assert.deepStrictEqual(r.matriz, { AX: 1, BY: 1, CZ: 1 });
});
