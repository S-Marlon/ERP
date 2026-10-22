import assert from 'assert';
import { etapaAtual, etapasDoPlano, mapaConsistente } from '../../../shared/components/mapaModulo/mapaModulo';
import { FUNCIONALIDADES } from './planoObras';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('obras de poços: o mapa do módulo está consistente', () => {
  assert.ok(mapaConsistente(FUNCIONALIDADES));
  assert.deepStrictEqual(etapasDoPlano(FUNCIONALIDADES).map(e => e.etapa), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.strictEqual(etapaAtual(FUNCIONALIDADES), 6);   // etapas 0 a 5 prontas (relatório, obras, mapa, cobrança, materiais, agenda)
});
