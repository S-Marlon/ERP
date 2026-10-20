import assert from 'assert';
import type { TituloPainel } from './painelFinanceiroApi';
import { vencimentosPorDia } from './vencimentosPorDia';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const t = (tipo: TituloPainel['tipo'], vencimento: string, valor: number): TituloPainel =>
  ({ tipo, idTitulo: 1, nome: 'x', descricao: null, vencimento, valor, parcela: 1, totalParcelas: 1, forma: null });

teste('painel financeiro: vencimentos por dia', () => {
  const d = vencimentosPorDia([
    t('PAGAR', '2026-10-27', 444), t('RECEBER', '2026-10-20', 50), t('PAGAR', '2026-10-21', 10.1), t('PAGAR', '2026-10-21', 0.2), t('RECEBER', '2026-10-21', 5),
  ], '2026-10-20');
  assert.deepStrictEqual(d.map(x => [x.rotulo, x.entra, x.sai, x.titulos.length]), [
    ['hoje, 20/10', 50, 0, 1], ['amanhã, 21/10', 5, 10.3, 3], ['terça, 27/10', 0, 444, 1],
  ]);
});
