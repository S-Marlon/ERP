// Marca no nome: itens sem marca cujo nome cita a marca do próprio produto (regra em marcaNoNome.ts), e aplicar em lote
// (cria a marca se ainda não existir). Itens novos que chegam sem marca aparecem aqui.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ehMarcaVazia, marcaNoNome, marcasParaBusca } from './marcaNoNome';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

/** GET /api/catalogo/marcas/sugestoes — itens sem marca com a marca achada no nome. */
export const sugestoesDeMarca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [[cadastradas], [sem]]: any = await Promise.all([
      pool.execute(`SELECT id, nome FROM comercial_marcas WHERE tenant_id = ?`, [tenant]),
      pool.execute(
        `SELECT ic.id_item, ic.nome_item, cpd.nome_comercial, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku, cat.nome AS categoria
         FROM itens_core ic
         INNER JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
         LEFT JOIN comercial_marcas m ON m.id = cpd.id_marca
         LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
         LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id)
         WHERE ic.tenant_id = ? AND ic.status = 'ATIVO' AND (cpd.id_marca IS NULL OR m.nome REGEXP '^sem ?marca$|^2. ?linha$')`, [tenant]),
    ]);
    const marcas = marcasParaBusca(cadastradas.map((m: any) => m.nome));
    const existe = new Set(cadastradas.filter((m: any) => !ehMarcaVazia(m.nome)).map((m: any) => String(m.nome).toUpperCase()));
    const sugestoes = sem.map((s: any) => ({ s, marca: marcaNoNome(s.nome_item, marcas) || (s.nome_comercial ? marcaNoNome(s.nome_comercial, marcas) : null) }))
      .filter((x: any) => x.marca)
      .map(({ s, marca }: any) => ({
        idItem: Number(s.id_item), sku: s.sku, nome: s.nome_comercial || s.nome_item, categoria: s.categoria ? String(s.categoria).replace(/^[^\p{L}\p{N}]+/u, '').trim() : null,
        marca, marcaNova: !existe.has(String(marca).toUpperCase()),
      }));
    return res.json({ sugestoes, semMarca: sem.length });
  } catch (error: any) {
    console.error('Erro nas sugestões de marca:', error);
    return res.status(500).json({ error: 'Erro ao procurar marcas nos nomes.', details: error?.message });
  }
};

/** POST /api/catalogo/marcas/sugestoes/aplicar { itens: [{ idItem, marca }] } — cria as marcas que faltam e atribui. */
export const aplicarSugestoesDeMarca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const itens: Array<{ idItem: number; marca: string }> = (Array.isArray(req.body?.itens) ? req.body.itens : [])
    .map((i: any) => ({ idItem: Number(i.idItem), marca: String(i.marca || '').trim().slice(0, 150) }))
    .filter((i: any) => i.idItem > 0 && i.marca && !ehMarcaVazia(i.marca));
  if (!itens.length) return res.status(400).json({ error: 'Nenhum item para aplicar.' });
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cadastradas]: any = await conn.execute(`SELECT id, nome FROM comercial_marcas WHERE tenant_id = ?`, [tenant]);
    const idDe = new Map<string, number>(cadastradas.map((m: any) => [String(m.nome).toUpperCase(), Number(m.id)]));
    const criadas: string[] = [];
    for (const m of [...new Set(itens.map(i => i.marca.toUpperCase()))]) {
      if (idDe.has(m)) continue;
      const nome = itens.find(i => i.marca.toUpperCase() === m)!.marca;
      const [r]: any = await conn.execute(`INSERT INTO comercial_marcas (tenant_id, nome, slug, status) VALUES (?, ?, ?, 'Ativo')`,
        [tenant, nome, nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')]);
      idDe.set(m, Number(r.insertId));
      criadas.push(nome);
    }
    let atribuidas = 0;
    for (const i of itens) {
      const [r]: any = await conn.execute(
        `UPDATE comercial_produtos_dados cpd LEFT JOIN comercial_marcas m ON m.id = cpd.id_marca
         SET cpd.id_marca = ? WHERE cpd.id_item = ? AND cpd.tenant_id = ? AND (cpd.id_marca IS NULL OR m.nome REGEXP '^sem ?marca$|^2. ?linha$')`,
        [idDe.get(i.marca.toUpperCase()), i.idItem, tenant]);
      atribuidas += r.affectedRows;
    }
    await conn.commit();
    return res.json({ success: true, atribuidas, criadas });
  } catch (error: any) {
    await conn.rollback().catch(() => undefined);
    console.error('Erro ao aplicar marcas:', error);
    return res.status(500).json({ error: 'Erro ao aplicar as marcas.', details: error?.message });
  } finally {
    conn.release();
  }
};
