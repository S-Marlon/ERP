// Tags do catálogo (comercial_tags + _familias + _itens): cadastro (criar, renomear, cor, juntar, excluir), a lista de
// famílias com as tags (filtro por categoria com as subcategorias, busca e tag) e a aplicação em lote.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ErroTag, juntarTags, slugTag, validarTag } from './tags';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const lista = (n: number) => Array(n).fill('?').join(',');
const MAX_FAMILIAS = 500;

const erro = (res: Response, e: any, padrao: string) => {
  if (e instanceof ErroTag) return res.status(e.status).json({ error: e.message });
  if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma tag com esse nome.' });
  console.error(padrao, e);
  return res.status(500).json({ error: padrao, details: e?.message });
};

const idsDe = (v: unknown) => [...new Set<number>((Array.isArray(v) ? v : []).map(Number).filter(n => Number.isInteger(n) && n > 0))];

/** A categoria e as que estão abaixo dela. */
const comSubcategorias = async (tenant: number, id: number) => {
  const [cats]: any = await pool.execute(`SELECT id, categoria_pai_id FROM comercial_categorias WHERE tenant_id = ?`, [tenant]);
  const saida = new Set<number>([id]);
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const c of cats) if (c.categoria_pai_id && saida.has(Number(c.categoria_pai_id)) && !saida.has(Number(c.id))) { saida.add(Number(c.id)); cresceu = true; }
  }
  return [...saida];
};

const carregarTag = async (tenant: number, id: number) => {
  const [[t]]: any = await pool.execute(`SELECT * FROM comercial_tags WHERE id_tag = ? AND tenant_id = ?`, [id, tenant]);
  if (!t) throw new ErroTag('Tag não encontrada.', 404);
  return t;
};

// GET /api/catalogo/tags — todas, com quantas famílias e itens têm cada uma (o item conta a herdada da família)
export const listarTags = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [rows]: any = await pool.execute(
      `SELECT t.*, (SELECT COUNT(*) FROM comercial_tags_familias tf WHERE tf.id_tag = t.id_tag) AS familias,
              (SELECT COUNT(DISTINCT cpd.id_item) FROM comercial_produtos_dados cpd
                WHERE cpd.tenant_id = t.tenant_id
                  AND (EXISTS (SELECT 1 FROM comercial_tags_familias tf WHERE tf.id_tag = t.id_tag AND tf.id_familia = cpd.familia_id)
                    OR EXISTS (SELECT 1 FROM comercial_tags_itens ti WHERE ti.id_tag = t.id_tag AND ti.id_item = cpd.id_item))) AS itens
       FROM comercial_tags t WHERE t.tenant_id = ? ORDER BY t.ativo DESC, t.grupo IS NULL, t.grupo, t.nome`,
      [tenant]
    );
    return res.json(rows.map((t: any) => ({
      idTag: Number(t.id_tag), nome: t.nome, grupo: t.grupo || null, cor: t.cor, ativo: !!Number(t.ativo),
      familias: Number(t.familias) || 0, itens: Number(t.itens) || 0,
    })));
  } catch (e) { return erro(res, e, 'Erro ao listar as tags.'); }
};

// POST /api/catalogo/tags { nome, grupo, cor } — nome repetido (mesmo sem acento/maiúscula): 409 com a que existe
export const criarTag = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const t = validarTag(req.body);
    const [[existe]]: any = await pool.execute(`SELECT id_tag, nome FROM comercial_tags WHERE tenant_id = ? AND slug = ?`, [tenant, t.slug]);
    if (existe) return res.status(409).json({ error: `Já existe a tag "${existe.nome}".`, idTag: Number(existe.id_tag) });
    const [ins]: any = await pool.execute(
      `INSERT INTO comercial_tags (tenant_id, nome, slug, grupo, cor) VALUES (?, ?, ?, ?, ?)`, [tenant, t.nome, t.slug, t.grupo, t.cor]
    );
    return res.status(201).json({ idTag: Number(ins.insertId) });
  } catch (e) { return erro(res, e, 'Erro ao criar a tag.'); }
};

// PUT /api/catalogo/tags/:id { nome, grupo, cor, ativo }
export const salvarTag = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    await carregarTag(tenant, Number(req.params.id));
    const t = validarTag(req.body);
    await pool.execute(
      `UPDATE comercial_tags SET nome = ?, slug = ?, grupo = ?, cor = ?, ativo = ? WHERE id_tag = ? AND tenant_id = ?`,
      [t.nome, t.slug, t.grupo, t.cor, req.body?.ativo === false ? 0 : 1, Number(req.params.id), tenant]
    );
    return res.json({ success: true });
  } catch (e) { return erro(res, e, 'Erro ao salvar a tag.'); }
};

// POST /api/catalogo/tags/:id/juntar { idDestino } — passa as famílias e itens desta tag para a outra e apaga esta
export const juntarTag = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const origem = Number(req.params.id);
  const destino = Number(req.body?.idDestino);
  const conn: any = await pool.getConnection();
  try {
    if (!destino || destino === origem) throw new ErroTag('Escolha outra tag para juntar.');
    await carregarTag(tenant, origem);
    await carregarTag(tenant, destino);
    await conn.beginTransaction();
    await conn.execute(`INSERT IGNORE INTO comercial_tags_familias (id_tag, id_familia, tenant_id) SELECT ?, id_familia, tenant_id FROM comercial_tags_familias WHERE id_tag = ?`, [destino, origem]);
    await conn.execute(`INSERT IGNORE INTO comercial_tags_itens (id_tag, id_item, tenant_id) SELECT ?, id_item, tenant_id FROM comercial_tags_itens WHERE id_tag = ?`, [destino, origem]);
    await conn.execute(`DELETE FROM comercial_tags WHERE id_tag = ? AND tenant_id = ?`, [origem, tenant]);
    await conn.commit();
    return res.json({ success: true });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return erro(res, e, 'Erro ao juntar as tags.');
  } finally { conn.release(); }
};

// DELETE /api/catalogo/tags/:id — tira a tag de todas as famílias e itens
export const excluirTag = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    await carregarTag(tenant, Number(req.params.id));
    await pool.execute(`DELETE FROM comercial_tags WHERE id_tag = ? AND tenant_id = ?`, [Number(req.params.id), tenant]);
    return res.json({ success: true });
  } catch (e) { return erro(res, e, 'Erro ao excluir a tag.'); }
};

/**
 * GET /api/catalogo/tags/familias?idCategoria=&busca=&idTag=&semTag= — famílias com a categoria, quantos itens e as
 * tags. semTag=1 traz só as que ainda não têm nenhuma.
 */
export const familiasComTags = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const where = [`f.tenant_id = ?`, `f.status <> 'INATIVO'`];
    const params: any[] = [tenant];
    const idCategoria = Number(req.query.idCategoria) || null;
    if (idCategoria) {
      const cats = await comSubcategorias(tenant, idCategoria);
      where.push(`(f.categoria_id IN (${lista(cats.length)}) OR EXISTS (SELECT 1 FROM comercial_produtos_dados c2 WHERE c2.familia_id = f.id AND c2.categoria_id IN (${lista(cats.length)})))`);
      params.push(...cats, ...cats);
    }
    const busca = String(req.query.busca || '').trim();
    if (busca) { where.push(`f.nome LIKE ?`); params.push(`%${busca}%`); }
    const idTag = Number(req.query.idTag) || null;
    if (idTag) { where.push(`EXISTS (SELECT 1 FROM comercial_tags_familias tf WHERE tf.id_familia = f.id AND tf.id_tag = ?)`); params.push(idTag); }
    if (req.query.semTag === '1') where.push(`NOT EXISTS (SELECT 1 FROM comercial_tags_familias tf WHERE tf.id_familia = f.id)`);
    const [fams]: any = await pool.execute(
      `SELECT f.id, f.nome, cat.nome AS categoria,
              (SELECT COUNT(*) FROM comercial_produtos_dados cpd WHERE cpd.familia_id = f.id AND cpd.tenant_id = f.tenant_id) AS itens
       FROM comercial_familias f LEFT JOIN comercial_categorias cat ON cat.id = f.categoria_id
       WHERE ${where.join(' AND ')} ORDER BY f.nome LIMIT ${MAX_FAMILIAS}`,
      params
    );
    const ids = fams.map((f: any) => Number(f.id));
    const [tags]: any = ids.length
      ? await pool.execute(
        `SELECT tf.id_familia, t.id_tag, t.nome, t.cor FROM comercial_tags_familias tf INNER JOIN comercial_tags t ON t.id_tag = tf.id_tag
         WHERE tf.id_familia IN (${lista(ids.length)}) ORDER BY t.nome`, ids)
      : [[]];
    return res.json(fams.map((f: any) => ({
      idFamilia: Number(f.id), nome: f.nome, categoria: f.categoria || null, itens: Number(f.itens) || 0,
      tags: tags.filter((t: any) => Number(t.id_familia) === Number(f.id)).map((t: any) => ({ idTag: Number(t.id_tag), nome: t.nome, cor: t.cor })),
    })));
  } catch (e) { return erro(res, e, 'Erro ao listar as famílias.'); }
};

// GET /api/catalogo/tags/familias/:id/itens — itens da família com as tags (herdadas da família e as próprias)
export const itensDaFamilia = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idFamilia = Number(req.params.id);
    const [itens]: any = await pool.execute(
      `SELECT ic.id_item, COALESCE(cpd.sku_customizado, ic.sku) AS sku, COALESCE(cpd.nome_comercial, ic.nome_item) AS nome
       FROM comercial_produtos_dados cpd INNER JOIN itens_core ic ON ic.id_item = cpd.id_item
       WHERE cpd.tenant_id = ? AND cpd.familia_id = ? ORDER BY nome`, [tenant, idFamilia]
    );
    const [daFamilia]: any = await pool.execute(
      `SELECT t.id_tag, t.nome, t.cor FROM comercial_tags_familias tf INNER JOIN comercial_tags t ON t.id_tag = tf.id_tag WHERE tf.id_familia = ?`, [idFamilia]
    );
    const ids = itens.map((i: any) => Number(i.id_item));
    const [proprias]: any = ids.length
      ? await pool.execute(
        `SELECT ti.id_item, t.id_tag, t.nome, t.cor FROM comercial_tags_itens ti INNER JOIN comercial_tags t ON t.id_tag = ti.id_tag
         WHERE ti.id_item IN (${lista(ids.length)})`, ids)
      : [[]];
    const fmt = (t: any) => ({ idTag: Number(t.id_tag), nome: t.nome, cor: t.cor });
    return res.json(itens.map((i: any) => ({
      idItem: Number(i.id_item), sku: i.sku, nome: i.nome,
      tags: juntarTags(daFamilia.map(fmt), proprias.filter((p: any) => Number(p.id_item) === Number(i.id_item)).map(fmt)),
    })));
  } catch (e) { return erro(res, e, 'Erro ao listar os itens da família.'); }
};

/** POST /api/catalogo/tags/:id/aplicar { acao: ADICIONAR | REMOVER, idsFamilias?, idsItens? } */
export const aplicarTag = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idTag = Number(req.params.id);
  const acao = String(req.body?.acao || '').toUpperCase();
  const familias = idsDe(req.body?.idsFamilias);
  const itens = idsDe(req.body?.idsItens);
  const conn: any = await pool.getConnection();
  try {
    if (!['ADICIONAR', 'REMOVER'].includes(acao)) throw new ErroTag('Ação inválida.');
    if (!familias.length && !itens.length) throw new ErroTag('Escolha as famílias ou os itens.');
    await carregarTag(tenant, idTag);
    await conn.beginTransaction();
    let mudou = 0;
    if (familias.length) {
      // só famílias desta loja
      const [ok]: any = await conn.execute(`SELECT id FROM comercial_familias WHERE tenant_id = ? AND id IN (${lista(familias.length)})`, [tenant, ...familias]);
      for (const f of ok) {
        const [r]: any = acao === 'ADICIONAR'
          ? await conn.execute(`INSERT IGNORE INTO comercial_tags_familias (id_tag, id_familia, tenant_id) VALUES (?, ?, ?)`, [idTag, f.id, tenant])
          : await conn.execute(`DELETE FROM comercial_tags_familias WHERE id_tag = ? AND id_familia = ?`, [idTag, f.id]);
        mudou += Number(r.affectedRows) || 0;
      }
    }
    if (itens.length) {
      const [ok]: any = await conn.execute(`SELECT id_item FROM itens_core WHERE tenant_id = ? AND id_item IN (${lista(itens.length)})`, [tenant, ...itens]);
      for (const i of ok) {
        const [r]: any = acao === 'ADICIONAR'
          ? await conn.execute(`INSERT IGNORE INTO comercial_tags_itens (id_tag, id_item, tenant_id) VALUES (?, ?, ?)`, [idTag, i.id_item, tenant])
          : await conn.execute(`DELETE FROM comercial_tags_itens WHERE id_tag = ? AND id_item = ?`, [idTag, i.id_item]);
        mudou += Number(r.affectedRows) || 0;
      }
    }
    await conn.commit();
    return res.json({ mudou });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return erro(res, e, 'Erro ao aplicar a tag.');
  } finally { conn.release(); }
};

export { slugTag };
