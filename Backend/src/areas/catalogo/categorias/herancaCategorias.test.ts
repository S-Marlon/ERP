import { atributosEfetivosDaCategoria, cadeiaCategorias, criaCiclo, resolverHeranca, slugUnico, gerarSlug } from './herancaCategorias';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runHerancaCategoriasTests = (): void => {
  // Hidráulica (1) > Mangueiras (7) > Alta Pressão (9)
  const arvore = [
    { id: '1', pai: null, nome: 'Hidráulica' },
    { id: '7', pai: '1', nome: 'Mangueiras' },
    { id: '9', pai: '7', nome: 'Alta Pressão' },
    { id: '3', pai: null, nome: 'Rolamentos' },
  ];

  assert(cadeiaCategorias(arvore, '9').join() === '1,7,9', 'Cadeia vai da raiz até a categoria.');
  assert(criaCiclo(arvore, '1', '9'), 'Mover a raiz para baixo da neta cria ciclo.');
  assert(criaCiclo(arvore, '7', '7'), 'Categoria não pode ser pai dela mesma.');
  assert(!criaCiclo(arvore, '9', '3'), 'Mover para outro ramo não cria ciclo.');
  assert(cadeiaCategorias([{ id: 'a', pai: 'b' }, { id: 'b', pai: 'a' }], 'a').length === 2, 'Ciclo existente no banco não trava a leitura.');

  const vinc = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `A${id}`, classificacao: 'ficha', obrigatorio: 0, bloqueado: 0, ...extra });
  const porCategoria = new Map<string, any[]>([
    ['1', [vinc('10', { classificacao: 'dna' }), vinc('11')]],
    ['7', [vinc('10', { classificacao: 'dna', obrigatorio: 1, sobrescreve: 1 }), vinc('12', { classificacao: 'grade' })]],
    ['9', [vinc('11', { bloqueado: 1 })]],
  ]);

  const efetivos9 = atributosEfetivosDaCategoria(arvore, porCategoria, '9');
  const ids9 = efetivos9.map(a => a.atributoId).sort().join();
  assert(ids9 === '10,12', 'Alta Pressão herda 10 (ajustado) e 12, e bloqueia 11.');
  const a10 = efetivos9.find(a => a.atributoId === '10');
  assert(a10.obrigatorio === 1 && a10.origemCategoriaNome === 'Mangueiras', 'O ajuste feito em Mangueiras vale para baixo.');

  const efetivos1 = atributosEfetivosDaCategoria(arvore, porCategoria, '1');
  assert(efetivos1.map(a => a.atributoId).sort().join() === '10,11', 'A raiz vê só os próprios atributos.');
  assert(atributosEfetivosDaCategoria(arvore, porCategoria, null).length === 0, 'Sem categoria, sem atributos.');

  const r = resolverHeranca([[{ atributoId: 'x', bloqueado: true }], [{ atributoId: 'x', bloqueado: false }]]);
  assert(r.length === 1 && r[0].nivel === 1, 'Um ramo abaixo pode voltar a usar um atributo bloqueado acima.');

  assert(gerarSlug('Óleos & Lubrificantes') === 'oleos-lubrificantes', 'Slug sem acento e sem símbolos.');
  assert(slugUnico('oleos', new Set(['oleos', 'oleos-2'])) === 'oleos-3', 'Slug repetido ganha sufixo numérico.');
};
