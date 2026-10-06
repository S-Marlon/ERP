// Monta a estrutura de rolamentos no catálogo usando as APIs do próprio catálogo (as regras de família continuam
// valendo): marca genérica "2ª Linha" (sigla 2L), categoria Rolamentos, uma família por tipo com a marca na grade
// e os atributos do módulo. O que já existe (pelo nome) é reaproveitado, nada é apagado.
import { createFamilia, getAtributosGlobais, getCategorias, getFamilies, updateFamilia } from '../../../pages/Catalogo/pages/FamilyManager/FamilyManager.api';
import { createCategory } from '../../../pages/Catalogo/pages/CategoryManager/categoryService';
import { createMarca, getMarcas } from '../../../pages/Catalogo/pages/MarcasManager/services/comercialMarcas.service';
import { CampoAtributo, ConfigRolamentos, NOME_MARCA_SEGUNDA_LINHA, SIGLA_SEGUNDA_LINHA, TIPOS, TipoRolamento } from './rolamentosApi';

export const ATRIBUTOS_ROLAMENTO: Array<{ campo: CampoAtributo; nome: string; tipoDado: 'texto' | 'decimal'; papel: 'grade' | 'ficha' }> = [
  { campo: 'codigo', nome: 'Código do rolamento', tipoDado: 'texto', papel: 'grade' },
  { campo: 'vedacao', nome: 'Vedação', tipoDado: 'texto', papel: 'grade' },
  { campo: 'folga', nome: 'Folga', tipoDado: 'texto', papel: 'ficha' },
  { campo: 'linha', nome: 'Linha (1ª/2ª)', tipoDado: 'texto', papel: 'ficha' },
  { campo: 'diametroInterno', nome: 'Diâmetro interno (mm)', tipoDado: 'decimal', papel: 'ficha' },
  { campo: 'diametroExterno', nome: 'Diâmetro externo (mm)', tipoDado: 'decimal', papel: 'ficha' },
  { campo: 'largura', nome: 'Largura (mm)', tipoDado: 'decimal', papel: 'ficha' },
];

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const templates = (tipo: TipoRolamento) => (TIPOS[tipo].comVedacao
  ? { templateSku: '{Código do rolamento}{S}{Vedação}{S}{MARCA}', templateNomeComercial: `${TIPOS[tipo].nomeCurto} {Código do rolamento} {Vedação} {MARCA}` }
  : { templateSku: '{Código do rolamento}{S}{MARCA}', templateNomeComercial: `${TIPOS[tipo].nomeCurto} {Código do rolamento} {MARCA}` });

export const montarEstrutura = async (atual: ConfigRolamentos, progresso: (texto: string) => void): Promise<ConfigRolamentos> => {
  // 1. Marca genérica da 2ª linha
  progresso('Marca da 2ª linha...');
  const marcas = await getMarcas();
  let idMarcaSegundaLinha = atual.idMarcaSegundaLinha || null;
  if (!idMarcaSegundaLinha || !marcas.some(m => Number(m.id) === idMarcaSegundaLinha)) {
    const existente = marcas.find(m => norm(m.codigo) === norm(SIGLA_SEGUNDA_LINHA) || norm(m.nome) === norm(NOME_MARCA_SEGUNDA_LINHA));
    idMarcaSegundaLinha = existente ? Number(existente.id)
      : Number((await createMarca({ nome: NOME_MARCA_SEGUNDA_LINHA, codigo: SIGLA_SEGUNDA_LINHA, status: 'Ativo' })).id_marca);
  }

  // 2. Categoria Rolamentos
  progresso('Categoria Rolamentos...');
  const categorias = await getCategorias();
  let idCategoria = atual.idCategoria || null;
  if (!idCategoria || !categorias.some(c => Number(c.id) === idCategoria)) {
    const existente = categorias.find(c => norm(c.nome) === 'rolamentos');
    idCategoria = existente ? Number(existente.id) : Number((await createCategory({
      nome: 'Rolamentos', parentId: null, percentualMargemSugerida: null, modoExibicao: 'grade', atributosHeranca: [],
    } as never)).id);
  }

  // 3. Uma família por tipo (marca na grade); atributos reaproveitados do pool pelo nome
  const familias = await getFamilies();
  const idsFamilias: Partial<Record<TipoRolamento, number>> = { ...(atual.familias || {}) };
  let pool = await getAtributosGlobais(1);
  for (const tipo of Object.keys(TIPOS) as TipoRolamento[]) {
    const configurada = idsFamilias[tipo];
    if (configurada && familias.some(f => Number(f.id) === configurada)) continue;
    const pelaNome = familias.find(f => norm(f.nome) === norm(TIPOS[tipo].familia));
    if (pelaNome) { idsFamilias[tipo] = Number(pelaNome.id); continue; }

    progresso(`Família ${TIPOS[tipo].familia}...`);
    const r = await createFamilia({
      nome: TIPOS[tipo].familia, categoriaPai: String(idCategoria), siglaSku: 'ROL', comportamentoMarca: 'grade',
      unidadeMedidaBase: 'PC', ...templates(tipo),
    } as never);
    const id = String(r.id);
    const atributos = ATRIBUTOS_ROLAMENTO
      .filter(a => a.campo !== 'vedacao' || TIPOS[tipo].comVedacao)
      .map((a, i) => {
        const doPool = pool.find(p => norm(p.nome) === norm(a.nome));
        return {
          id: doPool ? doPool.id : `novo-${i}-${a.campo}`, nome: a.nome, tipoDado: a.tipoDado, classificacao: a.papel,
          obrigatorio: a.papel === 'grade', compoeSku: a.papel === 'grade', ordemSku: i + 1, origem: 'locais', pesquisavel: true,
        };
      });
    await updateFamilia(id, { atributos, status: 'ATIVO' } as never);
    idsFamilias[tipo] = Number(id);
    pool = await getAtributosGlobais(1); // a primeira família cria os atributos; as demais reaproveitam
  }

  // 4. Ids dos atributos que o módulo preenche
  const atributos: Partial<Record<CampoAtributo, number>> = { ...(atual.atributos || {}) };
  for (const a of ATRIBUTOS_ROLAMENTO) {
    const doPool = pool.find(p => norm(p.nome) === norm(a.nome));
    if (doPool) atributos[a.campo] = Number(doPool.id);
  }
  return { ...atual, idCategoria, idMarcaSegundaLinha, familias: idsFamilias, atributos };
};
