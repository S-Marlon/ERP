// Estrutura de rolamentos no catálogo, sempre pelas APIs do próprio catálogo (as regras do PIM continuam valendo):
// Rolamentos › subcategoria por tipo (Rígidos de esferas, Inserção (UC)...) › família por código (Rolamento 6205).
// Na família do código: código e medidas são DNA (iguais para toda a família); vedação, folga e marca são grade.
import { createFamilia, getAtributosGlobais, getCategorias, updateFamilia } from '../../../pages/Catalogo/pages/FamilyManager/FamilyManager.api';
import { createAtributoRapido, createCategory } from '../../../pages/Catalogo/pages/CategoryManager/categoryService';
import { createMarca, getMarcas } from '../../../pages/Catalogo/pages/MarcasManager/services/comercialMarcas.service';
import {
  CampoAtributo, ConfigRolamentos, NOME_MARCA_SEGUNDA_LINHA, nomeFamiliaDoCodigo, rolamentosApi, SIGLA_SEGUNDA_LINHA, TIPOS, TipoRolamento,
} from './rolamentosApi';

export const ATRIBUTOS_ROLAMENTO: Array<{ campo: CampoAtributo; nome: string; tipoDado: 'texto' | 'decimal' }> = [
  { campo: 'codigo', nome: 'Código do rolamento', tipoDado: 'texto' },
  { campo: 'vedacao', nome: 'Vedação', tipoDado: 'texto' },
  { campo: 'folga', nome: 'Folga', tipoDado: 'texto' },
  { campo: 'linha', nome: 'Linha (1ª/2ª)', tipoDado: 'texto' },
  { campo: 'diametroInterno', nome: 'Diâmetro interno (mm)', tipoDado: 'decimal' },
  { campo: 'diametroExterno', nome: 'Diâmetro externo (mm)', tipoDado: 'decimal' },
  { campo: 'largura', nome: 'Largura (mm)', tipoDado: 'decimal' },
];

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

/** Marca "2ª Linha" (sigla 2L), categoria Rolamentos, uma subcategoria por tipo e os atributos. Reaproveita pelo nome. */
export const montarEstrutura = async (atual: ConfigRolamentos, progresso: (texto: string) => void): Promise<ConfigRolamentos> => {
  progresso('Marca da 2ª linha...');
  const marcas = await getMarcas();
  let idMarcaSegundaLinha = atual.idMarcaSegundaLinha || null;
  if (!idMarcaSegundaLinha || !marcas.some(m => Number(m.id) === idMarcaSegundaLinha)) {
    const existente = marcas.find(m => norm(m.codigo) === norm(SIGLA_SEGUNDA_LINHA) || norm(m.nome) === norm(NOME_MARCA_SEGUNDA_LINHA));
    idMarcaSegundaLinha = existente ? Number(existente.id)
      : Number((await createMarca({ nome: NOME_MARCA_SEGUNDA_LINHA, codigo: SIGLA_SEGUNDA_LINHA, status: 'Ativo' })).id_marca);
  }

  progresso('Categoria Rolamentos...');
  let categorias = await getCategorias();
  let idCategoria = atual.idCategoria || null;
  if (!idCategoria || !categorias.some(c => Number(c.id) === idCategoria)) {
    const existente = categorias.find(c => norm(c.nome) === 'rolamentos' && !c.paiId);
    idCategoria = existente ? Number(existente.id) : Number((await createCategory({
      nome: 'Rolamentos', parentId: null, percentualMargemSugerida: null, modoExibicao: 'grade', atributosHeranca: [],
    } as never)).id);
    categorias = await getCategorias();
  }

  const subcategorias: Partial<Record<TipoRolamento, number>> = { ...(atual.subcategorias || {}) };
  for (const tipo of Object.keys(TIPOS) as TipoRolamento[]) {
    const configurada = subcategorias[tipo];
    if (configurada && categorias.some(c => Number(c.id) === configurada)) continue;
    const existente = categorias.find(c => Number(c.paiId) === idCategoria && norm(c.nome) === norm(TIPOS[tipo].subcategoria));
    if (existente) { subcategorias[tipo] = Number(existente.id); continue; }
    progresso(`Subcategoria ${TIPOS[tipo].subcategoria}...`);
    subcategorias[tipo] = Number((await createCategory({
      nome: TIPOS[tipo].subcategoria, parentId: String(idCategoria), percentualMargemSugerida: null, modoExibicao: 'grade', atributosHeranca: [],
    } as never)).id);
  }

  progresso('Atributos...');
  const pool = await getAtributosGlobais(1);
  const atributos: Partial<Record<CampoAtributo, number>> = {};
  for (const a of ATRIBUTOS_ROLAMENTO) {
    const doPool = pool.find(p => norm(p.nome) === norm(a.nome));
    atributos[a.campo] = doPool ? Number(doPool.id) : Number((await createAtributoRapido({ nome: a.nome, tipo: a.tipoDado })).id);
  }
  return { ...atual, idCategoria, idMarcaSegundaLinha, subcategorias, atributos };
};

/** Cria a família de um código (ex.: Rolamento 6205) na subcategoria do tipo, com código e medidas como DNA. */
export const criarFamiliaDoCodigo = async (
  config: ConfigRolamentos, tipo: TipoRolamento, codigo: string, medidas: { d: number | null; D: number | null; B: number | null },
): Promise<number> => {
  const sub = config.subcategorias?.[tipo];
  const a = config.atributos || {};
  if (!sub || !a.codigo) throw new Error('Monte a estrutura de rolamentos primeiro (Compras › Rolamentos).');
  const nomes = Object.fromEntries(ATRIBUTOS_ROLAMENTO.map(x => [x.campo, x]));
  const comVedacao = TIPOS[tipo].comVedacao;
  const r = await createFamilia({
    nome: nomeFamiliaDoCodigo(codigo), categoriaPai: String(sub), siglaSku: 'ROL', comportamentoMarca: 'grade', unidadeMedidaBase: 'PC',
    templateSku: comVedacao ? '{Código do rolamento}{S}{Vedação}{S}{Folga}/{MARCA}' : '{Código do rolamento}{S}{Folga}/{MARCA}',
    templateNomeComercial: 'ROLAMENTO {Código do rolamento} | {MARCA}',
  } as never);
  const id = String(r.id);
  let ordem = 0;
  const atributo = (campo: CampoAtributo, papel: 'dna' | 'grade' | 'ficha', valor?: unknown) => ({
    id: String(a[campo]), nome: nomes[campo].nome, tipoDado: nomes[campo].tipoDado, classificacao: papel,
    obrigatorio: papel !== 'ficha', compoeSku: papel === 'grade' || campo === 'codigo', ordemSku: ++ordem, origem: 'locais', pesquisavel: true,
    ...(papel === 'dna' ? { valorPadraoGrupo: String(valor) } : {}),
  });
  const medida = (campo: CampoAtributo, v: number | null) => (v ? atributo(campo, 'dna', v) : atributo(campo, 'ficha'));
  const atributos = [
    atributo('codigo', 'dna', codigo.trim().toUpperCase()),
    ...(comVedacao ? [atributo('vedacao', 'grade')] : []),
    atributo('folga', 'grade'),
    medida('diametroInterno', medidas.d), medida('diametroExterno', medidas.D), medida('largura', medidas.B),
    atributo('linha', 'ficha'),
  ].filter(x => x.id && x.id !== 'undefined');
  await updateFamilia(id, { atributos, status: 'ATIVO' } as never);
  return Number(id);
};

/** Família de cada (tipo, código): a que existe na subcategoria ou uma nova. Chave: TIPO|CODIGO. */
export const garantirFamilias = async (
  config: ConfigRolamentos,
  pares: Array<{ tipo: TipoRolamento; codigo: string; medidas: { d: number | null; D: number | null; B: number | null } }>,
  progresso?: (texto: string) => void,
): Promise<Record<string, number>> => {
  const unicos = new Map(pares.map(p => [`${p.tipo}|${p.codigo.trim().toUpperCase()}`, p]));
  const { familias } = await rolamentosApi.familias([...unicos.values()].map(p => ({ tipo: p.tipo, codigo: p.codigo.trim().toUpperCase() })));
  const resultado: Record<string, number> = {};
  for (const [chave, p] of unicos) {
    const existente = familias[chave];
    if (existente) { resultado[chave] = existente.id; continue; }
    progresso?.(`Família ${nomeFamiliaDoCodigo(p.codigo)}...`);
    resultado[chave] = await criarFamiliaDoCodigo(config, p.tipo, p.codigo, p.medidas);
  }
  return resultado;
};
