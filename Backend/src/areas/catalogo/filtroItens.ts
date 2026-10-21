// Filtro de itens das telas em lote (varejo e atacado, logística): categoria com as subcategorias, famílias, marcas
// (a do item ou a da família), tag (do item ou da família) e busca. Monta o WHERE com os aliases ic (itens_core),
// cpd (comercial_produtos_dados) e f (comercial_familias).
import { SQL_ITEM_TEM_TAG_ID } from './tags/tags';

export interface FiltroItens { idCategoria?: number | null; idsFamilias?: number[]; idsMarcas?: number[]; idTag?: number | null; busca?: string }

const lista = (n: number) => Array(n).fill('?').join(',');

/** A categoria e todas as que estão abaixo dela. */
export const comSubcategorias = async (conn: any, tenant: number, id: number) => {
  const [cats]: any = await conn.execute(`SELECT id, categoria_pai_id FROM comercial_categorias WHERE tenant_id = ?`, [tenant]);
  const filhos = new Map<number, number[]>();
  for (const c of cats) {
    const pai = Number(c.categoria_pai_id) || 0;
    if (!filhos.has(pai)) filhos.set(pai, []);
    filhos.get(pai)!.push(Number(c.id));
  }
  const saida = new Set<number>([id]);
  const fila = [id];
  while (fila.length) for (const f of filhos.get(fila.shift()!) || []) if (!saida.has(f)) { saida.add(f); fila.push(f); }
  return [...saida];
};

/** Condições do filtro; `vazio` = nenhum filtro escolhido (as telas recusam para não trazer o catálogo inteiro). */
export const condicoesDoFiltro = async (conn: any, tenant: number, filtro: FiltroItens) => {
  const where: string[] = [];
  const params: any[] = [];
  if (filtro.idCategoria) {
    const cats = await comSubcategorias(conn, tenant, Number(filtro.idCategoria));
    where.push(`COALESCE(f.categoria_id, cpd.categoria_id) IN (${lista(cats.length)})`); params.push(...cats);
  }
  const fams = (filtro.idsFamilias || []).map(Number).filter(n => n > 0);
  if (fams.length) { where.push(`cpd.familia_id IN (${lista(fams.length)})`); params.push(...fams); }
  const marcas = (filtro.idsMarcas || []).map(Number).filter(n => n > 0);
  if (marcas.length) { where.push(`COALESCE(cpd.id_marca, f.id_marca) IN (${lista(marcas.length)})`); params.push(...marcas); }
  if (filtro.idTag) { where.push(SQL_ITEM_TEM_TAG_ID); params.push(Number(filtro.idTag), Number(filtro.idTag)); }
  const busca = String(filtro.busca || '').trim();
  if (busca) {
    where.push(`(ic.sku LIKE ? OR cpd.sku_customizado LIKE ? OR ic.nome_item LIKE ? OR cpd.nome_comercial LIKE ? OR f.nome LIKE ?)`);
    params.push(...Array(5).fill(`%${busca}%`));
  }
  return { where, params, vazio: where.length === 0 };
};
