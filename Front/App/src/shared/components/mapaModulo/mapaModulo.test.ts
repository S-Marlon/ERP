import assert from 'assert';
import { etapaAtual, etapasDoPlano, Funcionalidade, mapaConsistente } from './mapaModulo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const f = (chave: string, etapa: number, situacao: Funcionalidade['situacao']): Funcionalidade =>
  ({ chave, titulo: chave, etapa, situacao, resumo: 'r', oQueFaz: ['x'], dados: [], ligaCom: [] });

teste('mapa do módulo: situação das etapas e a etapa atual', () => {
  const lista = [f('a', 1, 'PRONTA'), f('b', 2, 'EM_CONSTRUCAO'), f('c', 2, 'PLANEJADA'), f('d', 3, 'PLANEJADA')];
  assert.deepStrictEqual(etapasDoPlano(lista).map(e => [e.etapa, e.situacao]), [[1, 'PRONTA'], [2, 'EM_CONSTRUCAO'], [3, 'PLANEJADA']]);
  assert.strictEqual(etapaAtual(lista), 2);
  assert.strictEqual(etapaAtual([f('a', 1, 'PRONTA')]), null);
});

teste('mapa do módulo: consistência', () => {
  assert.strictEqual(mapaConsistente([f('a', 1, 'PRONTA'), f('b', 2, 'PLANEJADA')]), true);
  assert.strictEqual(mapaConsistente([f('a', 1, 'PRONTA'), f('a', 2, 'PLANEJADA')]), false);
  assert.strictEqual(mapaConsistente([{ ...f('a', 1, 'PRONTA'), oQueFaz: [] }]), false);
});
