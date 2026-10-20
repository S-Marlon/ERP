// Categorias das contas (financeiro_categorias): plano de contas simples, por grupo. Montado em /api/financeiro/categorias.
import express, { Request, Response } from 'express';
import pool from '../../infra/db';

const router = express.Router();
const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const erro = (res: Response, e: any, padrao: string) => {
  if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' });
  console.error(padrao, e);
  return res.status(500).json({ error: padrao, details: e?.message });
};

// GET /api/financeiro/categorias — todas, com quantas contas usam cada uma
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT c.*, (SELECT COUNT(*) FROM financeiro_contas_pagar t WHERE t.id_categoria = c.id_categoria) +
                   (SELECT COUNT(*) FROM financeiro_contas_recorrentes r WHERE r.id_categoria = c.id_categoria) AS uso
       FROM financeiro_categorias c WHERE c.tenant_id = ? ORDER BY c.tipo, c.grupo, c.nome`,
      [tenantDe(req)]
    );
    return res.json(rows.map((r: any) => ({
      idCategoria: Number(r.id_categoria), tipo: r.tipo, grupo: r.grupo, nome: r.nome, ativo: !!Number(r.ativo), uso: Number(r.uso) || 0,
    })));
  } catch (e) { return erro(res, e, 'Erro ao listar as categorias.'); }
});

const validar = (b: any) => {
  const grupo = texto(b?.grupo, 40), nome = texto(b?.nome, 60);
  const tipo = String(b?.tipo || 'DESPESA').toUpperCase();
  if (!grupo || !nome) return { erro: 'Informe o grupo e o nome da categoria.' };
  if (!['DESPESA', 'RECEITA'].includes(tipo)) return { erro: 'Tipo inválido.' };
  return { grupo, nome, tipo };
};

// POST /api/financeiro/categorias { tipo, grupo, nome }
router.post('/', async (req: Request, res: Response) => {
  const v = validar(req.body);
  if ('erro' in v) return res.status(400).json({ error: v.erro });
  try {
    const [ins]: any = await pool.execute(`INSERT INTO financeiro_categorias (tenant_id, tipo, grupo, nome) VALUES (?, ?, ?, ?)`, [tenantDe(req), v.tipo, v.grupo, v.nome]);
    return res.status(201).json({ idCategoria: Number(ins.insertId) });
  } catch (e) { return erro(res, e, 'Erro ao criar a categoria.'); }
});

// PUT /api/financeiro/categorias/:id { tipo, grupo, nome, ativo } — desativar só esconde das novas contas
router.put('/:id', async (req: Request, res: Response) => {
  const v = validar(req.body);
  if ('erro' in v) return res.status(400).json({ error: v.erro });
  try {
    const [r]: any = await pool.execute(
      `UPDATE financeiro_categorias SET tipo = ?, grupo = ?, nome = ?, ativo = ? WHERE id_categoria = ? AND tenant_id = ?`,
      [v.tipo, v.grupo, v.nome, req.body?.ativo === false ? 0 : 1, Number(req.params.id), tenantDe(req)]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Categoria não encontrada.' });
    return res.json({ success: true });
  } catch (e) { return erro(res, e, 'Erro ao salvar a categoria.'); }
});

export default router;
