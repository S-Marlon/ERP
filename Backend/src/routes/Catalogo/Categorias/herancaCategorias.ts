// Herança de atributos na árvore de categorias (regra única usada por família, ficha técnica, publicação e saúde).
//
// Regra (raiz -> folha):
//  - atributo próprio de uma categoria desce para todas as subcategorias e famílias abaixo;
//  - um vínculo na subcategoria para um atributo herdado "ajusta" a configuração (papel/obrigatório) dali para baixo;
//  - um vínculo com bloqueado = 1 tira o atributo daquele ramo para baixo.

export interface NoCategoria {
  id: string | number;
  pai: string | number | null;
  nome?: string;
}

const chave = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));

// Ids da raiz até a categoria alvo (protegido contra ciclo)
export const cadeiaCategorias = (categorias: NoCategoria[], alvo: string | number | null | undefined): string[] => {
  const porId = new Map(categorias.map(c => [chave(c.id), c]));
  const cadeia: string[] = [];
  const vistos = new Set<string>();
  let atual = porId.get(chave(alvo));
  while (atual && !vistos.has(chave(atual.id))) {
    vistos.add(chave(atual.id));
    cadeia.unshift(chave(atual.id));
    atual = atual.pai !== null && atual.pai !== undefined ? porId.get(chave(atual.pai)) : undefined;
  }
  return cadeia;
};

// Mover "idCategoria" para baixo de "novoPai" criaria ciclo? (pai = ela mesma ou uma descendente)
export const criaCiclo = (categorias: NoCategoria[], idCategoria: string | number, novoPai: string | number | null): boolean => {
  if (novoPai === null || novoPai === undefined || chave(novoPai) === '') return false;
  return cadeiaCategorias(categorias, novoPai).includes(chave(idCategoria));
};

export interface VinculoHeranca {
  atributoId: string;
  bloqueado: boolean;
}

/**
 * Resolve os atributos efetivos a partir dos vínculos de cada nível (do mais alto ao mais baixo).
 * Nível mais baixo sobrescreve o mais alto; bloqueado remove o atributo do ramo.
 */
export const resolverHeranca = <T extends VinculoHeranca>(niveis: T[][]): Array<T & { nivel: number }> => {
  const efetivos = new Map<string, T & { nivel: number }>();
  niveis.forEach((vinculos, nivel) => {
    for (const v of vinculos) {
      if (v.bloqueado) efetivos.delete(v.atributoId);
      else efetivos.set(v.atributoId, { ...v, nivel });
    }
  });
  return Array.from(efetivos.values());
};

// Slug único dentro do tenant ("oleos", "oleos-2", ...)
export const gerarSlug = (texto: string): string => String(texto || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'categoria';

export const slugUnico = (base: string, existentes: Set<string>): string => {
  if (!existentes.has(base)) return base;
  let n = 2;
  while (existentes.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

// ---------------------------------------------------------------------------
// Carga do banco
// ---------------------------------------------------------------------------

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

// Mesmos aliases usados pelas famílias (getFamilias), para todos os consumidores lerem o mesmo formato
export const SELECT_VINCULO = `
  SELECT core.id_entidade, core.tipo_entidade, a.id AS id, a.nome AS nome, a.codigo AS codigo,
         core.escopo_comercial AS classificacao, a.tipo AS tipoDado, a.tipo AS tipoBanco,
         core.separador_sufixo AS separadorSufixo, core.obrigatorio, core.gera_variacao AS geraVariacao,
         core.compoe_sku AS compoeSku, core.pesquisavel, core.ordem AS ordemSku, core.exemplos,
         core.herdar AS valorHerdadoDoGrupo, core.valor_padrao_grupo AS valorPadraoGrupo,
         core.bloqueado, core.retransmitir, core.sobrescreve, core.unidade_id, core.formato_sufixo,
         u.simbolo AS unidade_simbolo
  FROM atributos_core_entidades core
  INNER JOIN atributos_comercial a ON a.id = core.atributo_id AND a.tenant_id = core.tenant_id
  LEFT JOIN atributos_comercial_unidades u ON u.id = COALESCE(core.unidade_id, a.unidade_id)`;

export const carregarArvore = async (conn: Conn, tenant: number): Promise<NoCategoria[]> => {
  const [rows] = await conn.execute(
    `SELECT id, categoria_pai_id AS pai, nome FROM comercial_categorias WHERE tenant_id = ?`,
    [tenant]
  );
  return (rows as any[]).map(r => ({ id: String(r.id), pai: r.pai !== null ? String(r.pai) : null, nome: r.nome }));
};

// Vínculos próprios de todas as categorias (inclusive os de bloqueio), agrupados por categoria
export const carregarVinculosCategorias = async (conn: Conn, tenant: number): Promise<Map<string, any[]>> => {
  const [rows] = await conn.execute(
    `${SELECT_VINCULO}
     WHERE core.tenant_id = ? AND core.ativo = 1 AND core.tipo_entidade = 'categoria'
     ORDER BY core.ordem ASC, a.nome ASC`,
    [tenant]
  );
  const mapa = new Map<string, any[]>();
  for (const r of rows as any[]) {
    const k = String(r.id_entidade);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push(r);
  }
  return mapa;
};

/**
 * Atributos efetivos de uma categoria (herdados dos pais + próprios), no formato de SELECT_VINCULO,
 * com origemCategoriaId/origemCategoriaNome de onde a configuração vale.
 */
export const atributosEfetivosDaCategoria = (
  arvore: NoCategoria[],
  vinculosPorCategoria: Map<string, any[]>,
  categoriaId: string | number | null | undefined
): any[] => {
  if (categoriaId === null || categoriaId === undefined || chave(categoriaId) === '') return [];
  const cadeia = cadeiaCategorias(arvore, categoriaId);
  const nomes = new Map(arvore.map(c => [chave(c.id), c.nome]));
  const niveis = cadeia.map(idCat => (vinculosPorCategoria.get(idCat) || []).map(r => ({
    ...r,
    atributoId: String(r.id),
    bloqueado: Boolean(Number(r.bloqueado)),
    origemCategoriaId: idCat,
    origemCategoriaNome: nomes.get(idCat),
  })));
  return resolverHeranca(niveis);
};

// Atalho para quem precisa de uma única categoria
export const carregarAtributosDaCategoria = async (conn: Conn, tenant: number, categoriaId: string | number | null | undefined) => {
  if (categoriaId === null || categoriaId === undefined || chave(categoriaId) === '') return [];
  const [arvore, vinculos] = await Promise.all([carregarArvore(conn, tenant), carregarVinculosCategorias(conn, tenant)]);
  return atributosEfetivosDaCategoria(arvore, vinculos, categoriaId);
};
