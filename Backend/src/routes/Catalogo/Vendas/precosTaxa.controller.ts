// Preços com a taxa da maquininha embutida: prévia (preço atual x novo) e aplicação.
// Novo preço de cada faixa = custo gerencial x fator da unidade x markup x fator da taxa de referência.
// Itens sem custo gerencial ficam de fora (não há de onde calcular).
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { calcularPrecoUnidade, margemLiquida } from './precificacao';
import { carregarTaxaPreco } from '../../Venda/taxas/taxas.controller';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.body?.tenant_id || 1);

const carregarFaixas = async (conn: Conn, tenant: number, ids: number[] | null, trava = false) => {
  const [rows]: any = await conn.execute(
    `SELECT f.id_faixa, f.id_item, f.tipo_faixa, f.ordem, f.quantidade_minima, f.markup, f.preco_unitario,
            u.sigla, cpd.custo_gerencial, ic.nome_item,
            COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
            COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
            CASE WHEN f.id_unidade = ic.id_unidade THEN 1 ELSE COALESCE(conv.fator_conversao, 1) END AS fator,
            (f.id_unidade = ic.id_unidade) AS eh_base, COALESCE(uv.padrao_pdv, 0) AS padrao_pdv
     FROM comercial_precos_faixas f
     INNER JOIN itens_core ic ON ic.id_item = f.id_item AND ic.tenant_id = f.tenant_id
     INNER JOIN comercial_produtos_dados cpd ON cpd.id_item = f.id_item AND cpd.tenant_id = f.tenant_id
     LEFT JOIN itens_unidades_medida u ON u.id_unidade = f.id_unidade
     LEFT JOIN itens_unidades_conversao conv ON conv.id_item = f.id_item AND conv.tenant_id = f.tenant_id AND conv.id_unidade_derivada = f.id_unidade
     LEFT JOIN comercial_unidades_venda uv ON uv.id_item = f.id_item AND uv.tenant_id = f.tenant_id AND uv.id_unidade = f.id_unidade
     WHERE f.tenant_id = ? AND cpd.custo_gerencial > 0 AND f.markup > 0
       ${ids && ids.length ? `AND f.id_item IN (${ids.map(() => '?').join(',')})` : ''}
     ORDER BY nome, f.id_item, eh_base DESC, f.ordem
     ${trava ? 'FOR UPDATE' : ''}`,
    [tenant, ...(ids || [])]
  );
  return rows as any[];
};

/** GET /api/catalogo/precos/taxa/previa — itens cujo preço muda com a taxa embutida */
export const previaPrecosComTaxa = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const taxa = await carregarTaxaPreco(pool as any, tenant);
    const faixas = await carregarFaixas(pool as any, tenant, null);
    const porItem = new Map<number, any>();
    for (const f of faixas) {
      const novo = calcularPrecoUnidade(Number(f.custo_gerencial), Number(f.fator), Number(f.markup), taxa.fator);
      const atual = Number(f.preco_unitario);
      if (Math.abs(novo - atual) < 0.005) continue;
      const id = Number(f.id_item);
      if (!porItem.has(id)) porItem.set(id, { idItem: id, sku: f.sku, nome: f.nome, custo: Number(f.custo_gerencial), faixas: [] });
      porItem.get(id).faixas.push({
        idFaixa: Number(f.id_faixa), sigla: f.sigla, tipo: f.tipo_faixa, quantidadeMinima: Number(f.quantidade_minima),
        markup: Number(f.markup), precoAtual: atual, precoNovo: novo,
        variacaoPct: atual > 0 ? Number((((novo - atual) / atual) * 100).toFixed(2)) : null,
        margemAtual: margemLiquida(atual, Number(f.custo_gerencial) * Number(f.fator), taxa.percentual),
        margemNova: margemLiquida(novo, Number(f.custo_gerencial) * Number(f.fator), taxa.percentual),
      });
    }
    return res.json({ taxaPercentual: taxa.percentual, fator: Number(taxa.fator.toFixed(6)), itens: [...porItem.values()] });
  } catch (error: any) {
    console.error('Erro na prévia de preços com taxa:', error);
    return res.status(500).json({ error: 'Erro ao calcular a prévia.' });
  }
};

/** POST /api/catalogo/precos/taxa/aplicar { ids?: number[] } — sem ids, aplica em todos os itens da prévia */
export const aplicarPrecosComTaxa = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const ids: number[] | null = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter((n: number) => n > 0) : null;
  if (ids && ids.length === 0) return res.status(400).json({ error: 'Nenhum item selecionado.' });
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const taxa = await carregarTaxaPreco(connection, tenant);
    const faixas = await carregarFaixas(connection, tenant, ids, true);
    const itens = new Set<number>();
    let alteradas = 0;
    // Preço de referência do item (varejo da unidade padrão do PDV ou da base) para telas legadas
    const referencia = new Map<number, { preco: number; custoUnidade: number; prioridade: number }>();
    for (const f of faixas) {
      const novo = calcularPrecoUnidade(Number(f.custo_gerencial), Number(f.fator), Number(f.markup), taxa.fator);
      if (Math.abs(novo - Number(f.preco_unitario)) >= 0.005) {
        await connection.execute(`UPDATE comercial_precos_faixas SET preco_unitario = ? WHERE id_faixa = ?`, [novo, f.id_faixa]);
        alteradas++;
        itens.add(Number(f.id_item));
      }
      if (f.tipo_faixa === 'VAREJO') {
        const prioridade = Number(f.padrao_pdv) ? 2 : Number(f.eh_base) ? 1 : 0;
        const atual = referencia.get(Number(f.id_item));
        if (!atual || prioridade > atual.prioridade) {
          referencia.set(Number(f.id_item), { preco: novo, custoUnidade: Number(f.custo_gerencial) * Number(f.fator), prioridade });
        }
      }
    }
    for (const id of itens) {
      const ref = referencia.get(id);
      if (!ref) continue;
      await connection.execute(
        `UPDATE comercial_produtos_dados SET preco_venda = ?, margem_lucro = ? WHERE id_item = ? AND tenant_id = ?`,
        [ref.preco, margemLiquida(ref.preco, ref.custoUnidade, taxa.percentual), id, tenant]
      );
    }
    await connection.commit();
    return res.json({ success: true, itens: itens.size, faixas: alteradas, taxaPercentual: taxa.percentual });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao aplicar preços com taxa:', error);
    return res.status(500).json({ error: 'Erro ao aplicar os preços.' });
  } finally {
    connection.release();
  }
};
