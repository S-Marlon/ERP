import assert from 'assert';
import { linhasDaComparacao, MesResultado } from './resultadoApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const l = (chave: string, rotulo: string, tipo: 'RECEITA' | 'DEDUCAO' | 'SUBTOTAL' | 'RESULTADO' = 'DEDUCAO') => ({ chave, rotulo, tipo, valor: 0, pct: null });

teste('resultado: linhas da comparação juntam as despesas de todos os meses', () => {
  const meses: MesResultado[] = [
    { mes: '2026-09', rotulo: 'set/26', comprasMercadoria: 0, linhas: [l('vendas', 'Vendas (3)', 'RECEITA'), l('margem', 'Margem', 'SUBTOTAL'), l('desp:Ocupação', 'Ocupação'), l('resultado', 'Resultado', 'RESULTADO')] },
    { mes: '2026-10', rotulo: 'out/26', comprasMercadoria: 0, linhas: [l('vendas', 'Vendas (19)', 'RECEITA'), l('margem', 'Margem', 'SUBTOTAL'), l('desp:Consumo', 'Consumo'), l('resultado', 'Resultado', 'RESULTADO')] },
  ];
  assert.deepStrictEqual(linhasDaComparacao(meses).map(x => x.rotulo), ['Vendas', 'Margem', 'Consumo', 'Ocupação', 'Resultado']);
});
