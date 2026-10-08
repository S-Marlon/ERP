// Etiquetas de gôndola: registro da última etiqueta impressa e lista das que ficaram com preço/unidade antigos.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { dadosParaEtiqueta } from '../../vendas/pdv/pdv.controller';
import { CategoriaRegra, EtiquetaImpressa, lerImpressas, motivoDesatualizada, regraDaCategoria } from './etiquetasGondola';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const operadorDe = (req: Request) => String(req.body?.operador || req.headers['x-operador'] || 'ADM').trim().slice(0, 60) || 'ADM';

/**
 * POST /api/estoque/etiquetas/impressas  { itens: [{ idItem, unidade, preco }], operador? }
 * Guarda o preço que está na gôndola (uma linha por item e unidade; reimprimir sobrescreve).
 */
export const registrarImpressas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const itens = lerImpressas(req.body);
  if (itens.length === 0) return res.status(400).json({ error: 'Nenhuma etiqueta para registrar.' });
  try {
    const operador = operadorDe(req);
    for (let i = 0; i < itens.length; i += 200) {
      const lote = itens.slice(i, i + 200);
      await pool.execute(
        `INSERT INTO estoque_etiquetas_impressas (tenant_id, id_item, unidade, preco_impresso, operador)
         VALUES ${lote.map(() => '(?, ?, ?, ?, ?)').join(', ')}
         ON DUPLICATE KEY UPDATE preco_impresso = VALUES(preco_impresso), operador = VALUES(operador), impresso_em = NOW()`,
        lote.flatMap(e => [tenant, e.idItem, e.unidade, e.preco.toFixed(4), operador])
      );
    }
    return res.json({ registradas: itens.length });
  } catch (error: any) {
    console.error('Erro ao registrar etiquetas impressas:', error);
    return res.status(500).json({ error: 'Erro ao registrar as etiquetas impressas.', details: error.message });
  }
};

/**
 * GET /api/estoque/etiquetas/desatualizadas
 * Itens cuja etiqueta na gôndola ficou com preço ou unidade antigos (ou, em categoria "sempre", sem etiqueta).
 */
export const etiquetasDesatualizadas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [catRows]: any = await pool.execute(
      `SELECT id, categoria_pai_id, etiqueta_gondola FROM comercial_categorias WHERE tenant_id = ?`, [tenant]
    );
    const mapa = new Map<number, CategoriaRegra>((catRows as any[]).map(c => [Number(c.id), {
      id: Number(c.id), pai: c.categoria_pai_id ? Number(c.categoria_pai_id) : null,
      etiqueta: c.etiqueta_gondola === null ? null : Number(c.etiqueta_gondola),
    }]));
    const categoriasSempre = [...mapa.keys()].filter(id => regraDaCategoria(id, mapa) === 'SEMPRE');

    // Última etiqueta de cada item (se a unidade mudou, vale a mais recente)
    const [impRows]: any = await pool.execute(
      `SELECT id_item, unidade, preco_impresso, DATE_FORMAT(impresso_em, '%Y-%m-%dT%H:%i:%s') AS impresso_em
       FROM estoque_etiquetas_impressas WHERE tenant_id = ? ORDER BY impresso_em DESC`, [tenant]
    );
    const impressas = new Map<number, EtiquetaImpressa>();
    for (const r of impRows as any[]) {
      const id = Number(r.id_item);
      if (!impressas.has(id)) impressas.set(id, { unidade: r.unidade, preco: Number(r.preco_impresso), impressoEm: r.impresso_em });
    }

    // Candidatos: itens já etiquetados + itens de venda ativos das categorias "sempre"
    const candidatos = new Set<number>(impressas.keys());
    if (categoriasSempre.length) {
      const [sempreRows]: any = await pool.execute(
        `SELECT cpd.id_item FROM comercial_produtos_dados cpd
         INNER JOIN itens_core ic ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
         LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = cpd.tenant_id
         WHERE cpd.tenant_id = ? AND UPPER(COALESCE(ic.status, 'ATIVO')) <> 'INATIVO'
           AND UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) = 'PRODUTO'
           AND COALESCE(cpd.categoria_id, f.categoria_id) IN (${categoriasSempre.map(() => '?').join(',')})`,
        [tenant, ...categoriasSempre]
      );
      for (const r of sempreRows as any[]) candidatos.add(Number(r.id_item));
    }
    if (candidatos.size === 0) return res.json({ itens: [] });

    const ids = [...candidatos];
    const categoriaDe = new Map<number, number | null>();
    for (let i = 0; i < ids.length; i += 500) {
      const lote = ids.slice(i, i + 500);
      const [rows]: any = await pool.execute(
        `SELECT cpd.id_item, COALESCE(cpd.categoria_id, f.categoria_id) AS categoria_id
         FROM comercial_produtos_dados cpd
         LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = cpd.tenant_id
         WHERE cpd.tenant_id = ? AND cpd.id_item IN (${lote.map(() => '?').join(',')})`,
        [tenant, ...lote]
      );
      for (const r of rows as any[]) categoriaDe.set(Number(r.id_item), r.categoria_id ? Number(r.categoria_id) : null);
    }

    const atuais = await dadosParaEtiqueta(pool as any, tenant, ids);
    const itens = atuais.flatMap((p: any) => {
      const id = Number(p.id);
      const impressa = impressas.get(id) || null;
      const motivo = motivoDesatualizada(regraDaCategoria(categoriaDe.get(id) ?? null, mapa), impressa,
        { preco: Number(p.salePrice) || 0, unidade: p.unitOfMeasure || '' });
      if (!motivo) return [];
      return [{
        idItem: id, sku: p.sku, nome: p.name, unidade: p.unitOfMeasure || null, precoAtual: Number(p.salePrice) || 0,
        precoImpresso: impressa ? impressa.preco : null, unidadeImpressa: impressa ? impressa.unidade : null,
        impressoEm: impressa ? impressa.impressoEm : null, motivo,
      }];
    });
    itens.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    return res.json({ itens });
  } catch (error: any) {
    console.error('Erro ao listar etiquetas desatualizadas:', error);
    return res.status(500).json({ error: 'Erro ao listar as etiquetas desatualizadas.', details: error.message });
  }
};
