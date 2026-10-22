import assert from 'assert';
import { resumoFrota, Veiculo } from './frotaApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const v = (situacao: Veiculo['situacao'], kmAtual: number) => ({ situacao, kmAtual }) as Veiculo;

teste('frota: resumo por situação (vendido fora do total)', () => {
  assert.deepStrictEqual(resumoFrota([v('EM_USO', 1000), v('EM_USO', 500), v('MANUTENCAO', 200), v('VENDIDO', 9999)]),
    { total: 3, emUso: 2, manutencao: 1, parados: 0, kmTotal: 1700 });
});
