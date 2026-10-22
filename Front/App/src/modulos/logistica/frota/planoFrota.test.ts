import assert from 'assert';
import { etapaAtual, etapasDoPlano, Funcionalidade, FUNCIONALIDADES } from './planoFrota';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('frota: o mapa do módulo está consistente', () => {
  const chaves = FUNCIONALIDADES.map(f => f.chave);
  assert.strictEqual(new Set(chaves).size, chaves.length);                     // sem chave repetida
  assert.ok(FUNCIONALIDADES.every(f => f.oQueFaz.length && f.resumo));
  assert.deepStrictEqual(etapasDoPlano().map(e => e.etapa), [1, 2, 3, 4, 5, 6, 7]);
});

teste('frota: situação das etapas e a etapa atual', () => {
  const f = (chave: string, etapa: number, situacao: Funcionalidade['situacao']) => ({ ...FUNCIONALIDADES[0], chave, etapa, situacao });
  const lista = [f('a', 1, 'PRONTA'), f('b', 2, 'EM_CONSTRUCAO'), f('c', 2, 'PLANEJADA'), f('d', 3, 'PLANEJADA')];
  assert.deepStrictEqual(etapasDoPlano(lista).map(e => e.situacao), ['PRONTA', 'EM_CONSTRUCAO', 'PLANEJADA']);
  assert.strictEqual(etapaAtual(lista), 2);
  assert.strictEqual(etapaAtual([f('a', 1, 'PRONTA')]), null);
  assert.strictEqual(etapaAtual(), 1);
});
