import assert from 'assert';
import { etapaAtual, etapasDoPlano, mapaConsistente } from '../../../shared/components/mapaModulo/mapaModulo';
import { FUNCIONALIDADES } from './planoFrota';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('frota: o mapa do módulo está consistente', () => {
  assert.ok(mapaConsistente(FUNCIONALIDADES));
  assert.deepStrictEqual(etapasDoPlano(FUNCIONALIDADES).map(e => e.etapa), [1, 2, 3, 4, 5, 6, 7]);
  assert.strictEqual(etapaAtual(FUNCIONALIDADES), 2);   // a etapa 1 (veículos) está pronta
});
