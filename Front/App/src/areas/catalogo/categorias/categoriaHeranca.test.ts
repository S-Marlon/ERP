import { alterarAtributoNaCategoria, idsDescendentes, visaoAtributosCategoria } from './categoriaHeranca';
import { AtributoHerdavel, Categoria } from './CategoryManager.types';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const attr = (id: string, extra: Partial<AtributoHerdavel> = {}): AtributoHerdavel => ({
  id, nome: `A${id}`, tipoDado: 'texto', escopoComercial: 'ficha', obrigatorio: false, pesquisavel: true, ordem: 0, herdar: false, ...extra,
});

const cat = (id: string, parentId: string | null, atributosHeranca: AtributoHerdavel[]): Categoria => ({
  id, tenantId: 1, parentId, nome: `C${id}`, slug: id, ativa: true, ordem: 0, percentualMargemSugerida: null,
  modoExibicao: 'grade', descricao: '', atributosHeranca,
});

export const runCategoriaHerancaTests = (): void => {
  const categorias = [
    cat('1', null, [attr('10', { escopoComercial: 'dna' }), attr('11')]),
    cat('7', '1', [attr('10', { escopoComercial: 'dna', obrigatorio: true, sobrescreve: true }), attr('12', { escopoComercial: 'grade' })]),
    cat('9', '7', [attr('11', { bloqueado: true })]),
  ];

  const v9 = visaoAtributosCategoria(categorias, '9');
  assert(v9.atributos.map(a => a.id).sort().join() === '10,12', 'Neta herda 10 e 12 e não usa 11.');
  assert(v9.atributos.every(a => a.situacao === 'herdado'), 'Na neta tudo é herdado.');
  assert(v9.atributos.find(a => a.id === '10')!.obrigatorio, 'Ajuste da filha desce para a neta.');
  assert(v9.bloqueadosAqui.length === 1 && v9.bloqueadosAqui[0].origemNome === 'C1', 'Bloqueio mostra de onde vinha.');

  const v7 = visaoAtributosCategoria(categorias, '7');
  assert(v7.atributos.find(a => a.id === '10')!.situacao === 'ajustado', 'Vínculo local de atributo herdado é ajuste.');
  assert(v7.atributos.find(a => a.id === '12')!.situacao === 'proprio', 'Atributo que só existe aqui é próprio.');

  const novos = alterarAtributoNaCategoria(categorias, '9', '12', { obrigatorio: true });
  const ajuste = novos.find(a => a.id === '12')!;
  assert(ajuste.sobrescreve === true && ajuste.obrigatorio && ajuste.escopoComercial === 'grade', 'Mexer em herdado cria ajuste local copiando o papel.');
  assert(alterarAtributoNaCategoria(categorias, '7', '12', { obrigatorio: true }).length === 2, 'Mexer em próprio só altera.');

  assert([...idsDescendentes(categorias, '1')].sort().join() === '1,7,9', 'Descendentes incluem a própria e toda a subárvore.');
};
