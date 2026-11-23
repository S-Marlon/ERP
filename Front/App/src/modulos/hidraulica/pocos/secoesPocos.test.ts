import assert from 'assert';
import { itensMenuPocos, secaoDaAba, secaoDoEndereco, SECOES_POCOS, trilhaDaSecao } from './secoesPocos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('barra lateral com um item por grupo', () => {
  const itens = itensMenuPocos();
  assert.deepStrictEqual(itens.map(i => i.label), ['Central', 'Atendimento e pós-venda', 'Obras e orçamentos', 'Clientes e poços', 'Agenda e manutenção', 'Documentos', 'Mais ferramentas']);
  assert.deepStrictEqual(itens[2].tambem, ['/modulos/hidraulica/pocos/receber', '/modulos/hidraulica/pocos/materiais']);
  // o que se usa todo dia fica à vista: mapa com os poços, manutenção com a agenda, documentos com item próprio
  assert.deepStrictEqual(itens[3].tambem, ['/modulos/hidraulica/pocos/pocos', '/modulos/hidraulica/pocos/mapa']);
  assert.deepStrictEqual(itens[4].tambem, ['/modulos/hidraulica/pocos/manutencao']);
  assert.strictEqual(itens[5].key, '/modulos/hidraulica/pocos/documentos');
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
  assert.strictEqual(secaoDaAba('documentos').secao, 'documentos');
  assert.deepStrictEqual([secaoDoEndereco('kit-visita').secao, secaoDoEndereco('kit-visita').subvista], ['documentos', 'KIT']);
  assert.deepStrictEqual([secaoDoEndereco('relatorio').aba, secaoDoEndereco('relatorio').subvista], ['documentos', 'RELATORIO']);
});

teste('trilha do topo (subir um nível)', () => {
  const t = (secao: string) => trilhaDaSecao(secaoDoEndereco(secao)).map(d => d.titulo).join(' › ');
  assert.strictEqual(t(''), 'Central');
  assert.strictEqual(t('obras'), 'Central › Obras e orçamentos');
  assert.strictEqual(t('receber'), 'Central › A receber', 'irmã do grupo sobe direto para a Central');
  assert.strictEqual(t('mapa'), 'Central › Mapa');
  assert.strictEqual(t('resultado'), 'Central › Mais ferramentas › Resultado');
  assert.strictEqual(t('ferramentas'), 'Central › Mais ferramentas');
  assert.strictEqual(trilhaDaSecao(secaoDoEndereco('resultado'))[1].secao, 'ferramentas');
});
