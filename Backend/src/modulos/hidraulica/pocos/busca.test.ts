import assert from 'assert';
import { interpretarBusca, ordenarPorRelevancia, pontuar, relatorioPreenchido, tipoDoContrato } from './busca';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('busca: o que foi digitado', () => {
  assert.strictEqual(interpretarBusca(''), null);
  assert.strictEqual(interpretarBusca('a'), null);
  assert.deepStrictEqual(interpretarBusca('7'), { texto: '7', digitos: '', numero: 7 });
  assert.strictEqual(interpretarBusca('nº 12')!.numero, 12);
  assert.strictEqual(interpretarBusca('#12')!.numero, 12);
  assert.strictEqual(interpretarBusca('Contrato nº 45')!.numero, 45);
  assert.strictEqual(interpretarBusca('obra 3')!.numero, 3);
  const tel = interpretarBusca('(11) 99993-5060')!;
  assert.deepStrictEqual([tel.digitos, tel.numero], ['11999935060', null]);
  assert.deepStrictEqual(interpretarBusca('  José   Silva ')!, { texto: 'José Silva', digitos: '', numero: null });
});

teste('busca: relevância', () => {
  assert.strictEqual(pontuar('José da Silva', 'jose da silva'), 3);
  assert.strictEqual(pontuar('José da Silva', 'silva'), 2, 'palavra que começa com o termo');
  assert.strictEqual(pontuar('Atibaia', 'tiba'), 1);
  assert.strictEqual(pontuar(null, 'x'), 0);
  const lista = [{ n: 'Maria Atibaia' }, { n: 'Sítio Ana' }, { n: 'Ana Paula' }];
  assert.deepStrictEqual(ordenarPorRelevancia(lista, x => [x.n], interpretarBusca('ana')!).map(x => x.n), ['Sítio Ana', 'Ana Paula', 'Maria Atibaia']);
  // telefone gravado só com dígitos acha pelo número formatado
  const cli = [{ n: 'A', t: '11988887777' }, { n: 'B', t: '11999935060' }];
  assert.deepStrictEqual(ordenarPorRelevancia(cli, x => [x.n, x.t], interpretarBusca('99993-5060')!, 1).map(x => x.n), ['B']);
});

teste('busca: contrato formal ou informal', () => {
  assert.strictEqual(tipoDoContrato('EM_EXECUCAO', true), 'FORMAL');
  assert.strictEqual(tipoDoContrato('CONCLUIDA', false), 'INFORMAL');
  assert.strictEqual(tipoDoContrato('ORCAMENTO', false), 'ORCAMENTO');
  assert.strictEqual(tipoDoContrato('CANCELADA', true), 'CANCELADO');
  assert.strictEqual(tipoDoContrato('EM_EXECUCAO', false, 'ESCRITO'), 'FORMAL', 'o registrado ao fechar vale');
  assert.strictEqual(tipoDoContrato('CONCLUIDA', true, 'INFORMAL'), 'INFORMAL');
});

teste('busca: relatório preenchido', () => {
  assert.strictEqual(relatorioPreenchido(null), false);
  assert.strictEqual(relatorioPreenchido({ cliente: 'José', cidade: 'Atibaia', perfuracoes: [{}], revestimentos: [] }), false, 'só o cabeçalho');
  assert.strictEqual(relatorioPreenchido({ perfuracoes: [{ perfDe: 0, perfAte: 12 }] }), true);
  assert.strictEqual(relatorioPreenchido({ profundidade: 84 }), true);
});
