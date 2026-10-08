// Precificação em lote: grava custo, markup e preço de vários itens de uma vez (lista de precificação).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { margemLiquida } from './precificacao';
import { carregarTaxaPreco } from '../../vendas/taxas/taxas.controller';
import { temTaxaEmbutida } from './taxaEmbutida';
import { ErroLote, FaixaAtual, PedidoPreco, planejarItem } from './precificacaoLote';
import { obterOuCriarUnidade } from './configVendas.controller';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

const lerPedidos = (corpo: unknown): PedidoPreco[] => {
  const lista = Array.isArray((corpo as { itens?: unknown })?.itens) ? (corpo as { itens: unknown[] }).itens : [];
  const porItem = new Map<number, PedidoPreco>();
  for (const bruto of lista) {
    const i = bruto as Record<string, unknown>;
    const idItem = Number(i.idItem);
    if (!Number.isInteger(idItem) || idItem <= 0) continue;
    const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
    const unidade = String(i.unidade ?? '').trim().toUpperCase().slice(0, 10) || null;
    porItem.set(idItem, { idItem, custo: num(i.custo), markup: num(i.markup), preco: num(i.preco), unidade });
  }
  return [...porItem.values()];
};

/**
 * POST /api/catalogo/precos/lote  { itens: [{ idItem, custo?, markup?, preco? }] }
 * Custo novo recalcula todas as faixas (markup mantido); markup/preço valem para o varejo da unidade base.
 * Item com problema volta com o motivo e não impede os outros.
 */
export const salvarPrecosLote = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const pedidos = lerPedidos(req.body);
  if (pedidos.length === 0) return res.status(400).json({ error: 'Nenhum item para precificar.' });
  if (pedidos.length > 500) return res.status(400).json({ error: 'No máximo 500 itens por vez.' });

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const taxa = await carregarTaxaPreco(connection, tenant);
    const temColuna = await temTaxaEmbutida(connection);
    const resultados: Array<{ idItem: number; ok: boolean; erro?: string; faixas?: number }> = [];

    for (const pedido of pedidos) {
      const [[item]]: any = await connection.execute(
        `SELECT ic.id_item, ic.id_unidade, cpd.custo_gerencial
         FROM itens_core ic
         LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
         WHERE ic.id_item = ? AND ic.tenant_id = ? FOR UPDATE`,
        [pedido.idItem, tenant]
      );
      if (!item) { resultados.push({ idItem: pedido.idItem, ok: false, erro: 'Item não encontrado.' }); continue; }

      const [faixaRows]: any = await connection.execute(
        `SELECT f.id_faixa, f.tipo_faixa, f.ordem, f.markup, f.preco_unitario,
                CASE WHEN f.id_unidade = ic.id_unidade THEN 1 ELSE COALESCE(conv.fator_conversao, 1) END AS fator,
                (f.id_unidade = ic.id_unidade) AS eh_base, COALESCE(uv.padrao_pdv, 0) AS padrao_pdv
         FROM comercial_precos_faixas f
         INNER JOIN itens_core ic ON ic.id_item = f.id_item AND ic.tenant_id = f.tenant_id
         LEFT JOIN itens_unidades_conversao conv ON conv.id_item = f.id_item AND conv.tenant_id = f.tenant_id AND conv.id_unidade_derivada = f.id_unidade
         LEFT JOIN comercial_unidades_venda uv ON uv.id_item = f.id_item AND uv.tenant_id = f.tenant_id AND uv.id_unidade = f.id_unidade
         WHERE f.id_item = ? AND f.tenant_id = ?
         FOR UPDATE`,
        [pedido.idItem, tenant]
      );
      const faixas: FaixaAtual[] = (faixaRows as any[]).map(f => ({
        idFaixa: Number(f.id_faixa), tipo: f.tipo_faixa === 'ATACADO' ? 'ATACADO' : 'VAREJO', ordem: Number(f.ordem),
        fator: Number(f.fator) || 1, markup: Number(f.markup), preco: Number(f.preco_unitario),
        ehBase: Boolean(Number(f.eh_base)), padraoPdv: Boolean(Number(f.padrao_pdv)),
      }));

      let plano;
      try {
        plano = planejarItem(item.custo_gerencial === null ? null : Number(item.custo_gerencial), faixas, pedido, taxa.fator);
        if (plano.criarVarejoBase && !item.id_unidade && !pedido.unidade) {
          throw new ErroLote('Item sem unidade base: escolha a unidade na coluna "Unidade" da lista.');
        }
      } catch (e) {
        if (e instanceof ErroLote) { resultados.push({ idItem: pedido.idItem, ok: false, erro: e.message }); continue; }
        throw e;
      }

      // Item antigo sem unidade base: passa a ter a escolhida na lista
      if (!item.id_unidade && pedido.unidade) {
        item.id_unidade = await obterOuCriarUnidade(connection, tenant, pedido.unidade);
        await connection.execute(`UPDATE itens_core SET id_unidade = ? WHERE id_item = ? AND tenant_id = ?`, [item.id_unidade, pedido.idItem, tenant]);
      }

      if (plano.custoMudou) {
        await connection.execute(
          `INSERT INTO comercial_produtos_dados (tenant_id, id_item, custo_gerencial) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE custo_gerencial = VALUES(custo_gerencial)`,
          [tenant, pedido.idItem, plano.novoCusto.toFixed(4)]
        );
      }
      for (const f of plano.faixas) {
        await connection.execute(
          temColuna ? `UPDATE comercial_precos_faixas SET markup = ?, preco_unitario = ?, taxa_embutida = ? WHERE id_faixa = ?`
            : `UPDATE comercial_precos_faixas SET markup = ?, preco_unitario = ? WHERE id_faixa = ?`,
          temColuna ? [f.markup, f.preco, taxa.percentual, f.idFaixa] : [f.markup, f.preco, f.idFaixa]
        );
      }
      // Markup do varejo base também é o padrão da unidade (usado ao criar faixas novas)
      const base = faixas.find(x => x.ehBase && x.tipo === 'VAREJO');
      const baseNova = base ? plano.faixas.find(x => x.idFaixa === base.idFaixa) : null;
      if (baseNova) {
        await connection.execute(
          `UPDATE comercial_unidades_venda SET markup_varejo = ? WHERE tenant_id = ? AND id_item = ? AND id_unidade = ?`,
          [baseNova.markup, tenant, pedido.idItem, item.id_unidade]
        );
      }
      if (plano.criarVarejoBase) {
        await connection.execute(
          `INSERT IGNORE INTO comercial_unidades_venda (tenant_id, id_item, id_unidade, permite_venda, permite_atacado, markup_varejo, padrao_pdv)
           VALUES (?, ?, ?, 1, 0, ?, 1)`,
          [tenant, pedido.idItem, item.id_unidade, plano.criarVarejoBase.markup]
        );
        await connection.execute(
          temColuna
            ? `INSERT INTO comercial_precos_faixas (tenant_id, id_item, id_unidade, tipo_faixa, ordem, quantidade_minima, quantidade_maxima, markup, preco_unitario, taxa_embutida)
               VALUES (?, ?, ?, 'VAREJO', 1, 0, NULL, ?, ?, ?)`
            : `INSERT INTO comercial_precos_faixas (tenant_id, id_item, id_unidade, tipo_faixa, ordem, quantidade_minima, quantidade_maxima, markup, preco_unitario)
               VALUES (?, ?, ?, 'VAREJO', 1, 0, NULL, ?, ?)`,
          temColuna
            ? [tenant, pedido.idItem, item.id_unidade, plano.criarVarejoBase.markup, plano.criarVarejoBase.preco, taxa.percentual]
            : [tenant, pedido.idItem, item.id_unidade, plano.criarVarejoBase.markup, plano.criarVarejoBase.preco]
        );
      }
      // Preço de referência do item (telas antigas)
      if (plano.referencia && (plano.faixas.length || plano.criarVarejoBase)) {
        await connection.execute(
          `UPDATE comercial_produtos_dados SET preco_venda = ?, margem_lucro = ? WHERE id_item = ? AND tenant_id = ?`,
          [plano.referencia.preco, margemLiquida(plano.referencia.preco, plano.referencia.custoUnidade, taxa.percentual), pedido.idItem, tenant]
        );
      }
      resultados.push({ idItem: pedido.idItem, ok: true, faixas: plano.faixas.length + (plano.criarVarejoBase ? 1 : 0) });
    }

    await connection.commit();
    return res.json({ resultados, atualizados: resultados.filter(r => r.ok).length, taxaPercentual: taxa.percentual });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro na precificação em lote:', error);
    return res.status(500).json({ error: 'Erro ao gravar os preços.', details: error.message });
  } finally {
    connection.release();
  }
};
