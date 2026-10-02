// Resumo do catálogo para o painel do PIM: quantidade de itens, publicação no PDV, estrutura (famílias,
// categorias, atributos, marcas), lacunas de cadastro e entradas de NF aguardando aprovação.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { avaliarPublicacaoItens } from './publicacaoProdutos';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Number(v) || 0;
const TIPOS_FORA_DA_VENDA = ['CONSUMO', 'INSUMO', 'ATIVO'];

/**
 * GET /catalogo/resumo
 */
export const resumoCatalogo = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);

    const [itens]: any = await pool.execute(
      `SELECT ic.id_item, UPPER(COALESCE(ic.status, 'ATIVO')) AS status, UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) AS tipo,
              cpd.familia_id, COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id,
              EXISTS (SELECT 1 FROM comercial_precos_faixas pf WHERE pf.tenant_id = ic.tenant_id AND pf.id_item = ic.id_item AND pf.preco_unitario > 0) AS tem_preco,
              EXISTS (SELECT 1 FROM comercial_unidades_venda uv WHERE uv.tenant_id = ic.tenant_id AND uv.id_item = ic.id_item AND NULLIF(TRIM(uv.gtin), '') IS NOT NULL) AS tem_gtin
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
       WHERE ic.tenant_id = ?`,
      [tenant]
    );
    const ativos = itens.filter((i: any) => i.status !== 'INATIVO');
    const porTipo: Record<string, number> = {};
    for (const i of ativos) porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
    const deVenda = ativos.filter((i: any) => !TIPOS_FORA_DA_VENDA.includes(i.tipo));

    const publicacao = deVenda.length > 0
      ? await avaliarPublicacaoItens(pool as any, tenant, deVenda.map((i: any) => Number(i.id_item)))
      : new Map();
    const publicaveis = [...publicacao.values()].filter(p => p.publicavel).length;

    const contar = async (sql: string) => n(((await pool.execute(sql, [tenant])) as any)[0][0]?.total);
    const [familiasStatus]: any = await pool.execute(
      `SELECT UPPER(COALESCE(status, 'RASCUNHO')) AS status, COUNT(*) AS total FROM comercial_familias WHERE tenant_id = ? GROUP BY 1`, [tenant]
    );
    const familias: Record<string, number> = {};
    for (const f of familiasStatus) familias[f.status] = n(f.total);

    return res.json({
      itens: { total: itens.length, ativos: ativos.length, inativos: itens.length - ativos.length, porTipo },
      publicacao: { itensVenda: deVenda.length, publicaveis, foraDoPdv: deVenda.length - publicaveis },
      cadastro: {
        semClassificacao: ativos.filter((i: any) => !i.familia_id && !i.categoria_id).length,
        semFamilia: ativos.filter((i: any) => !i.familia_id).length,
        semPreco: deVenda.filter((i: any) => !Number(i.tem_preco)).length,
        semGtin: deVenda.filter((i: any) => !Number(i.tem_gtin)).length,
      },
      estrutura: {
        familias: { total: Object.values(familias).reduce((a, b) => a + b, 0), porStatus: familias },
        categorias: await contar(`SELECT COUNT(*) AS total FROM comercial_categorias WHERE tenant_id = ?`),
        atributos: await contar(`SELECT COUNT(*) AS total FROM atributos_comercial WHERE tenant_id = ? AND COALESCE(ativo, 1) = 1`),
        marcas: await contar(`SELECT COUNT(*) AS total FROM comercial_marcas WHERE tenant_id = ? AND UPPER(COALESCE(status, 'ATIVO')) <> 'INATIVO'`),
      },
      entradas: {
        aguardandoAprovacao: await contar(`SELECT COUNT(*) AS total FROM importacoes_lotes WHERE tenant_id = ? AND status = 'RASCUNHO'`),
        importadas30dias: await contar(`SELECT COUNT(*) AS total FROM importacoes_lotes WHERE tenant_id = ? AND status = 'IMPORTADO' AND updated_at >= NOW() - INTERVAL 30 DAY`),
      },
    });
  } catch (error: any) {
    console.error('Erro ao montar o resumo do catálogo:', error);
    return res.status(500).json({ error: error.message });
  }
};
