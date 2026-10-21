import assert from 'assert';
import { ehCompraDeMercadoria, montarResultado } from './resultadoMes';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('resultado do mês: a conta em cascata', () => {
  const l = montarResultado({
    vendas: 10000, qtdVendas: 40, devolucoes: 200, custoVendas: 6000, custoRecuperado: 120, taxasCartao: 150, taxasMl: 350,
    despesas: [
      { grupo: 'Ocupação', categoria: 'Aluguel', valor: 1500 },
      { grupo: 'Consumo', categoria: 'Energia elétrica', valor: 300 },
      { grupo: 'Consumo', categoria: 'Água', valor: 80.5 },
      { grupo: 'Ocupação', categoria: 'Seguro', valor: 100 },
    ],
  });
  const v = Object.fromEntries(l.map(x => [x.chave, x.valor]));
  assert.strictEqual(v.receita, 9800);
  assert.strictEqual(v.cmv, -5880);                      // 6000 − 120 que voltou ao estoque
  assert.strictEqual(v.bruto, 3920);
  assert.strictEqual(v.margem, 3420);                    // − 150 cartão − 350 ML
  assert.strictEqual(v.resultado, 1439.5);               // − 1600 ocupação − 380,50 consumo
  assert.deepStrictEqual(l.filter(x => x.chave.startsWith('desp:')).map(x => x.rotulo), ['Ocupação', 'Consumo']);   // maior antes
  assert.deepStrictEqual(l.find(x => x.chave === 'desp:Consumo')?.detalhe, [{ nome: 'Energia elétrica', valor: 300 }, { nome: 'Água', valor: 80.5 }]);
  assert.strictEqual(l.find(x => x.chave === 'margem')?.pct, 34.9);
  assert.strictEqual(l[l.length - 1].tipo, 'RESULTADO');
});

teste('resultado do mês: mês sem venda', () => {
  const l = montarResultado({ vendas: 0, qtdVendas: 0, devolucoes: 0, custoVendas: 0, custoRecuperado: 0, taxasCartao: 0, taxasMl: 0, despesas: [{ grupo: 'Ocupação', categoria: 'Aluguel', valor: 1500 }] });
  assert.strictEqual(l[l.length - 1].valor, -1500);
  assert.strictEqual(l[0].pct, null);
});

teste('resultado do mês: compra de mercadoria não é despesa', () => {
  assert.strictEqual(ehCompraDeMercadoria({ idLote: 7, grupo: null }), true);        // boleto de NF sem categoria
  assert.strictEqual(ehCompraDeMercadoria({ idLote: null, grupo: 'Mercadoria' }), true);
  assert.strictEqual(ehCompraDeMercadoria({ idLote: 7, grupo: 'Operação' }), false);  // NF de material de limpeza com categoria
  assert.strictEqual(ehCompraDeMercadoria({ idLote: null, grupo: null }), false);     // conta avulsa sem categoria é despesa
});
