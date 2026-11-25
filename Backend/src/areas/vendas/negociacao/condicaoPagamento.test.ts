import assert from 'assert';
import {
  condicaoDaLinha, custoDaCondicao, custoDosPagamentos, lerCondicao, pagamentoMaisCaro, pagamentosDaCondicao, prazoMedioDias, textoDaCondicao, totalComDesconto,
} from './condicaoPagamento';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

// Taxas de exemplo: PIX 0, débito 1,5%, crédito 1x 3%, 2-6x 5%, 7-12x 9%; a prazo sem taxa
const taxaDe = (forma: string, parcelas: number) => ({
  percentual: forma === 'DEBITO' ? 1.5 : forma === 'CREDITO' ? (parcelas === 1 ? 3 : parcelas <= 6 ? 5 : 9) : 0, fixa: 0,
});

teste('condição: leitura e texto', () => {
  assert.strictEqual(lerCondicao(null), null);
  assert.strictEqual(lerCondicao({ forma: '' }), null);
  // PIX: parcelas não valem; a entrada vale (é o antecipado, com o saldo na conclusão e entrega)
  assert.deepStrictEqual(lerCondicao({ forma: 'pix', parcelas: 5, entrada: 50 }), { forma: 'PIX', parcelas: 1, intervaloDias: null, entrada: 50 });
  const prazo = lerCondicao({ forma: 'PRAZO', parcelas: 2, intervaloDias: 28 })!;
  assert.strictEqual(textoDaCondicao(prazo), 'A prazo 28/56 dias (2 parcelas)');
  assert.strictEqual(textoDaCondicao(lerCondicao({ forma: 'CREDITO', parcelas: 3, entrada: 100 })!), 'Entrada de R$ 100,00 + cartão de crédito em 3x');
  assert.strictEqual(textoDaCondicao(lerCondicao({ forma: 'PRAZO', parcelas: 1, intervaloDias: 21 })!), 'A prazo 21 dias (1 parcela)');
  assert.strictEqual(textoDaCondicao(lerCondicao({ forma: 'DINHEIRO' })!), 'À vista em dinheiro');
  assert.throws(() => lerCondicao({ forma: 'BOLETO' }), /inválida/);
  assert.throws(() => lerCondicao({ forma: 'CREDITO', parcelas: 30 }), /1 a 24/);
  assert.throws(() => lerCondicao({ forma: 'PRAZO', parcelas: 2, entrada: 500 }, 500), /entrada/);
});

teste('condição: custo e pagamentos', () => {
  const c = lerCondicao({ forma: 'CREDITO', parcelas: 3, entrada: 100 })!;
  assert.deepStrictEqual(pagamentosDaCondicao(c, 600), [{ forma: 'PIX', valor: 100, parcelas: 1 }, { forma: 'CREDITO', valor: 500, parcelas: 3 }]);
  assert.deepStrictEqual(custoDaCondicao(taxaDe, c, 600), { taxa: 25, prazoMedioDias: 0 });
  assert.strictEqual(prazoMedioDias({ forma: 'PRAZO', parcelas: 3, intervaloDias: 30 }), 60);
  assert.strictEqual(prazoMedioDias({ forma: 'PRAZO', semPrazo: true }), Infinity);
  assert.deepStrictEqual(custoDaCondicao(taxaDe, lerCondicao({ forma: 'PRAZO', parcelas: 2, intervaloDias: 28 })!, 1000), { taxa: 0, prazoMedioDias: 42 });
  // cliente pagou o acréscimo do parcelamento: abate a taxa
  assert.deepStrictEqual(custoDosPagamentos(taxaDe, [{ forma: 'CREDITO', valor: 1090, parcelas: 12 }], 1000), { taxa: 8.1, prazoMedioDias: 0 });
});

teste('condição: pagamento mais caro que o combinado', () => {
  const pix = lerCondicao({ forma: 'PIX' })!;
  assert.strictEqual(pagamentoMaisCaro(taxaDe, pix, 600, [{ forma: 'PIX', valor: 600 }]), null);
  assert.strictEqual(pagamentoMaisCaro(taxaDe, pix, 600, [{ forma: 'DINHEIRO', valor: 600 }]), null);
  assert.match(pagamentoMaisCaro(taxaDe, pix, 600, [{ forma: 'CREDITO', valor: 600, parcelas: 3 }])!, /taxa de R\$ 30,00 contra R\$ 0,00/);
  // combinado 3x no cartão: pagar no PIX ou em 2x é mais barato
  const cartao = lerCondicao({ forma: 'CREDITO', parcelas: 3 })!;
  assert.strictEqual(pagamentoMaisCaro(taxaDe, cartao, 600, [{ forma: 'PIX', valor: 600 }]), null);
  assert.strictEqual(pagamentoMaisCaro(taxaDe, cartao, 600, [{ forma: 'CREDITO', valor: 600, parcelas: 2 }]), null);
  assert.ok(pagamentoMaisCaro(taxaDe, cartao, 600, [{ forma: 'CREDITO', valor: 600, parcelas: 10 }]));
  // 10x com o acréscimo pago pelo cliente cobrindo a taxa a mais: não é mais caro
  assert.strictEqual(pagamentoMaisCaro(taxaDe, cartao, 600, [{ forma: 'CREDITO', valor: 627, parcelas: 10 }]), null);
  // combinado 28/56: 30/60/90 recebe mais tarde; sem data também
  const prazo = lerCondicao({ forma: 'PRAZO', parcelas: 2, intervaloDias: 28 })!;
  assert.strictEqual(pagamentoMaisCaro(taxaDe, prazo, 1000, [{ forma: 'PRAZO', valor: 1000, parcelas: 2, intervaloDias: 28 }]), null);
  assert.match(pagamentoMaisCaro(taxaDe, prazo, 1000, [{ forma: 'PRAZO', valor: 1000, parcelas: 3, intervaloDias: 30 }])!, /60 dias em média contra 42/);
  assert.match(pagamentoMaisCaro(taxaDe, prazo, 1000, [{ forma: 'PRAZO', valor: 1000, semPrazo: true }])!, /sem data/);
});

teste('condição: PIX em duas etapas (antecipado + saldo na conclusão e entrega)', () => {
  const c = lerCondicao({ forma: 'PIX', entrada: 70 }, 210)!;
  assert.strictEqual(c.entrada, 70);
  const txt = (x: string) => x.replace(/\s/g, ' ');
  assert.strictEqual(txt(textoDaCondicao(c, 210)), '1/3 antecipado no PIX (R$ 70,00) + 2/3 na conclusão e entrega (R$ 140,00)');
  assert.strictEqual(txt(textoDaCondicao(c)), 'R$ 70,00 antecipado no PIX + o saldo no PIX na conclusão e entrega');
  assert.strictEqual(txt(textoDaCondicao(lerCondicao({ forma: 'DINHEIRO', entrada: 300 }, 1000)!, 1000)), '30% antecipado em dinheiro (R$ 300,00) + 70% na conclusão e entrega (R$ 700,00)');
  assert.deepStrictEqual(pagamentosDaCondicao(c, 210).map(p => [p.forma, p.valor]), [['PIX', 70], ['PIX', 140]]);
  assert.deepStrictEqual(pagamentosDaCondicao(lerCondicao({ forma: 'DINHEIRO', entrada: 50 }, 100)!, 100).map(p => p.forma), ['DINHEIRO', 'DINHEIRO']);
  // débito continua sem entrada; antecipado do tamanho do total não vale
  assert.strictEqual(lerCondicao({ forma: 'DEBITO', entrada: 50 }, 100)!.entrada, 0);
  assert.throws(() => lerCondicao({ forma: 'PIX', entrada: 210 }, 210), /entrada precisa ser menor/);
});

teste('condição: desconto por pagar no PIX (com e sem etapas)', () => {
  const txt = (x: string) => x.replace(/\s/g, ' ');
  const c = lerCondicao({ forma: 'PIX', descontoPct: 0.1 }, 210)!;
  assert.strictEqual(c.descontoPct, 0.1);
  assert.strictEqual(totalComDesconto(c, 210), 189);
  assert.strictEqual(txt(textoDaCondicao(c, 210)), 'No PIX com 10% de desconto: R$ 189,00');
  // 1/3 antecipado sobre o total com desconto (189 → 63 + 126)
  const etapas = lerCondicao({ forma: 'PIX', descontoPct: 0.1, entrada: 63 }, 210)!;
  assert.strictEqual(txt(textoDaCondicao(etapas, 210)), 'No PIX com 10% de desconto: R$ 189,00 — 1/3 antecipado (R$ 63,00) + 2/3 na conclusão e entrega (R$ 126,00)');
  assert.deepStrictEqual(pagamentosDaCondicao(etapas, totalComDesconto(etapas, 210)).map(p => p.valor), [63, 126]);
  // só no PIX e no dinheiro; até 50%; o antecipado tem de caber no total com desconto
  assert.strictEqual(lerCondicao({ forma: 'CREDITO', parcelas: 3, descontoPct: 0.1 })!.descontoPct, undefined);
  assert.throws(() => lerCondicao({ forma: 'PIX', descontoPct: 0.6 }), /até 50%/);
  assert.throws(() => lerCondicao({ forma: 'PIX', descontoPct: 0.1, entrada: 190 }, 210), /entrada precisa ser menor/);
  // gravado no orçamento e lido de volta
  assert.deepStrictEqual(condicaoDaLinha({ condicao_forma: 'PIX', condicao_parcelas: 1, condicao_entrada: '63.0000', condicao_desconto_pct: '0.1000' }),
    { forma: 'PIX', parcelas: 1, intervaloDias: null, entrada: 63, descontoPct: 0.1 });
});
