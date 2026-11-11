import assert from 'assert';
import { itensMenuPocos, secaoDaAba, secaoDoEndereco, SECOES_POCOS } from './secoesPocos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('barra lateral com um item por grupo', () => {
  const itens = itensMenuPocos();
  assert.deepStrictEqual(itens.map(i => i.label), ['Central', 'Atendimento e pós-venda', 'Obras e orçamentos', 'Clientes e poços', 'Agenda', 'Mais ferramentas']);
  assert.deepStrictEqual(itens[2].tambem, ['/modulos/hidraulica/pocos/receber', '/modulos/hidraulica/pocos/materiais']);
  // toda seção aparece uma vez: como item ou como "também" de um item
  const todas = itens.flatMap(i => [i.key, ...i.tambem]);
  assert.strictEqual(new Set(todas).size, SECOES_POCOS.length);
});

teste('endereços antigos continuam abrindo a mesma tela', () => {
  assert.strictEqual(secaoDoEndereco('pocos').vista, 'POCOS');
  assert.strictEqual(secaoDoEndereco('mapa').aba, 'mapa');
  assert.strictEqual(secaoDoEndereco('nao-existe').secao, '');
  assert.strictEqual(secaoDaAba('obras', 'RECEBER').secao, 'receber');
  assert.strictEqual(secaoDaAba('iot').secao, 'monitoramento');
});
