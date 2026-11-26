import assert from 'assert';
import { conclusaoDaProposta } from './conclusaoProposta';
import { lerCondicao } from './condicaoPagamento';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const linha = (x: Partial<{ quantidade: number; preco: number; precoTabela: number; custoUnitario: number }>) => ({ quantidade: 1, preco: 100, precoTabela: 100, custoUnitario: 60, ...x });

teste('conclusão da proposta: PIX com 10% e 1/3 antecipado', () => {
  // 2 itens: 1000 (tabela) vendido 1000 + 1 item de tabela 200 vendido 180; custo 600 + 100
  const linhas = [linha({ quantidade: 10, preco: 100, precoTabela: 100, custoUnitario: 60 }), linha({ quantidade: 1, preco: 180, precoTabela: 200, custoUnitario: 100 })];
  const c = lerCondicao({ forma: 'PIX', descontoPct: 0.1, entrada: 393.33 }, 1180)!;
  const r = conclusaoDaProposta(linhas, c, 0, 0.3, 0.1);
  // tabela 1200, itens 1180 (−20), PIX −118 → a pagar 1062; custo 700 → lucro 362 (34,1%)
  assert.deepStrictEqual([r.tabela, r.descontoPrecos, r.totalItens, r.descontoForma, r.aPagar, r.descontoTotal], [1200, 20, 1180, 118, 1062, 138]);
  assert.deepStrictEqual([r.custo, r.lucro, r.margem, r.nivel, r.faltaParaAlvo], [700, 362, 0.3409, 'NO_ALVO', 0]);
  assert.deepStrictEqual(r.etapas.map(e => [e.rotulo, e.valor]), [['Antecipado', 393.33], ['Na conclusão e entrega', 668.67]]);
  assert.ok(r.texto!.startsWith('No PIX com 10% de desconto'));
});

teste('conclusão da proposta: abaixo do alvo, abaixo da mínima, prejuízo e sem condição', () => {
  const pouco = conclusaoDaProposta([linha({ preco: 80, custoUnitario: 60 })], null, 0, 0.3, 0.1);
  // 80 − 60 = 20 (25%): abaixo do alvo; no alvo seria 60 ÷ 0,7 = 85,71 → faltam 5,71
  assert.deepStrictEqual([pouco.nivel, pouco.margem, pouco.faltaParaAlvo, pouco.etapas.length, pouco.texto], ['ABAIXO_ALVO', 0.25, 5.71, 0, null]);
  assert.strictEqual(conclusaoDaProposta([linha({ preco: 64, custoUnitario: 60 })], null, 0, 0.3, 0.1).nivel, 'ABAIXO_MINIMA');
  // a taxa entra no lucro: cartão com R$ 30 de taxa num pedido de 100 com custo 80 → prejuízo
  const cartao = conclusaoDaProposta([linha({ custoUnitario: 80 })], lerCondicao({ forma: 'CREDITO', parcelas: 3 }), 30, 0.3, 0.1);
  assert.deepStrictEqual([cartao.lucro, cartao.nivel, cartao.etapas[0].rotulo], [-10, 'PREJUIZO', 'Cartão 3x']);
  assert.strictEqual(conclusaoDaProposta([linha({ custoUnitario: 0 })], null, 0, 0.3, 0.1).semCusto, 1);
});
