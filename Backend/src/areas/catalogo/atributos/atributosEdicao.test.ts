import assert from 'assert';
import { impactoDoLote, impactoEdicaoOpcao, planoConversaoLista, travasDoAtributo, usoNoTemplate, validarOpcao } from './atributosEdicao';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('uso no template: texto e código', () => {
  assert.deepStrictEqual(usoNoTemplate('{SIGLA}-{Bitola:cod}', ['Bitola', 'bitola_nominal', 7]), { texto: false, codigo: true });
  assert.deepStrictEqual(usoNoTemplate('{FAMILIA} {bitola_nominal} [Bitola:cod]', ['Bitola', 'bitola_nominal']), { texto: true, codigo: true });
  assert.deepStrictEqual(usoNoTemplate('{FAMILIA}', ['Bitola']), { texto: false, codigo: false });
});

const fams = [
  { nome: 'Mangueira R2', noNome: { texto: true, codigo: false }, noSku: { texto: false, codigo: true } },
  { nome: 'Capa', noNome: { texto: false, codigo: false }, noSku: { texto: true, codigo: false } },
];

teste('impacto de renomear e de mudar o código', () => {
  const ren = impactoEdicaoOpcao({ itens: 5, familias: fams, mudaValor: true, mudaCodigo: false });
  assert.deepStrictEqual(ren.afetaNome, ['Mangueira R2']);
  assert.deepStrictEqual(ren.afetaSku, ['Capa']);
  assert.strictEqual(ren.nivel, 'aviso');
  const cod = impactoEdicaoOpcao({ itens: 5, familias: fams, mudaValor: false, mudaCodigo: true });
  assert.deepStrictEqual(cod.afetaSku, ['Mangueira R2']);
  assert.deepStrictEqual(cod.afetaNome, []);
  assert.strictEqual(impactoEdicaoOpcao({ itens: 0, familias: [], mudaValor: true, mudaCodigo: true }).nivel, 'livre');
});

teste('validar opção', () => {
  const ops = [{ id: 1, valor: '1/2"', codigo: '08' }, { id: 2, valor: '3/8"', codigo: '06' }];
  assert.strictEqual(validarOpcao(ops, null, '5/8"', '10'), null);
  assert.match(String(validarOpcao(ops, null, ' 1/2" ', null)), /Já existe/);
  assert.match(String(validarOpcao(ops, null, '5/8"', '08')), /código 08/);
  assert.strictEqual(validarOpcao(ops, 1, '1/2 pol', '08'), null); // a própria opção pode manter o código
  assert.match(String(validarOpcao(ops, null, '', null)), /Informe/);
  assert.match(String(validarOpcao(ops, null, 'x', 'a b')), /Código inválido/);
});

teste('travas conforme o uso', () => {
  const livre = travasDoAtributo({ itens: 0, vinculos: 0, familiasTemplate: [], tipo: 'texto' });
  assert.ok(Object.values(livre).every(t => t.nivel === 'livre'));
  const emUso = travasDoAtributo({ itens: 3, vinculos: 1, familiasTemplate: [fams[0]], tipo: 'lista' });
  assert.strictEqual(emUso.tipo.nivel, 'bloqueado');
  assert.strictEqual(emUso.nome.nivel, 'bloqueado');
  assert.strictEqual(emUso.codigo.nivel, 'bloqueado');
  assert.strictEqual(emUso.excluir.nivel, 'bloqueado');
  assert.strictEqual(emUso.unidade.nivel, 'aviso');
  const soVinculo = travasDoAtributo({ itens: 0, vinculos: 2, familiasTemplate: [], tipo: 'texto' });
  assert.strictEqual(soVinculo.tipo.nivel, 'livre');
  assert.strictEqual(soVinculo.codigo.nivel, 'aviso');
});

teste('plano de conversão texto → lista', () => {
  const p = planoConversaoLista([
    { texto: 'C3', qtd: 50 }, { texto: 'c3', qtd: 3 }, { texto: ' C3 ', qtd: 1 }, { texto: 'CN', qtd: 60 }, { texto: '', qtd: 9 },
  ]);
  assert.deepStrictEqual(p.opcoes.map(o => [o.valor, o.qtd]), [['CN', 60], ['C3', 54]]);
  assert.deepStrictEqual(p.opcoes[1].variantes, ['c3']);
  assert.strictEqual(p.opcoes[0].codigo, 'CN');
  assert.strictEqual(p.aviso, null);
  assert.ok(planoConversaoLista(Array.from({ length: 61 }, (_, i) => ({ texto: `V${i}`, qtd: 1 }))).aviso);
});

teste('impacto do lote soma sem repetir família', () => {
  const r = impactoDoLote([
    { itens: 3, afetaNome: ['A'], afetaSku: [] },
    { itens: 2, afetaNome: ['A', 'B'], afetaSku: ['C'] },
  ]);
  assert.deepStrictEqual(r.afetaNome, ['A', 'B']);
  assert.deepStrictEqual(r.afetaSku, ['C']);
  assert.strictEqual(r.nivel, 'aviso');
  assert.match(r.mensagens[0], /2 opção\(ões\) alterada\(s\), usadas por 5 item/);
  assert.strictEqual(impactoDoLote([{ itens: 0, afetaNome: [], afetaSku: [] }]).nivel, 'livre');
});
