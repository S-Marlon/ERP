import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { analisarDefasagem, calcularPrecoUnidade } from './precificacao';

// Conexão do pool (mysql2/promise), dentro ou fora de transação
type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number =>
  Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

const siglaNormalizada = (sigla: unknown): string => String(sigla || '').trim().toUpperCase();

/**
 * Localiza a unidade no dicionário (itens_unidades_medida) ou cria se não existir.
 * Exportada para a aprovação da staging definir a unidade base de itens novos.
 */
export const obterOuCriarUnidade = async (conn: Conn, tenant: number, sigla: string, descricao?: string | null): Promise<number> => {
  const s = siglaNormalizada(sigla);
  const [rows] = await conn.execute(
    `SELECT id_unidade FROM itens_unidades_medida WHERE tenant_id = ? AND sigla = ? LIMIT 1`,
    [tenant, s]
  );
  if (rows[0]) return Number(rows[0].id_unidade);

  const [novo] = await conn.execute(
    `INSERT INTO itens_unidades_medida (tenant_id, sigla, descricao, ativa) VALUES (?, ?, ?, 1)`,
    [tenant, s, String(descricao || s).trim()]
  );
  return Number(novo.insertId);
};

const carregarConfig = async (conn: Conn, tenant: number, idItem: number) => {
  const [itemRows] = await conn.execute(
    `SELECT ic.id_item, ic.sku, ic.nome_item, ic.tipo_recurso, ic.id_unidade,
            um.sigla AS sigla_base, um.descricao AS descricao_base,
            cpd.custo_gerencial, cpd.nome_comercial, cpd.preco_venda,
            es.custo_medio, es.ultimo_custo, es.quantidade_atual
     FROM itens_core ic
     LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id
     WHERE ic.id_item = ? AND ic.tenant_id = ?`,
    [idItem, tenant]
  );
  const item = itemRows[0];
  if (!item) return null;

  // Unidades: base (fator 1) + derivadas da conversão + camada comercial (se configurada)
  const [unidadeRows] = await conn.execute(
    `SELECT um.id_unidade, um.sigla, um.descricao,
            CASE WHEN um.id_unidade = ? THEN 1 ELSE conv.fator_conversao END AS fator,
            (um.id_unidade = ?) AS is_base,
            cuv.nome_exibicao, cuv.gtin, cuv.permite_venda, cuv.permite_atacado, cuv.markup_varejo, cuv.padrao_pdv,
            (cuv.id_unidade IS NOT NULL) AS configurada
     FROM itens_unidades_medida um
     LEFT JOIN itens_unidades_conversao conv
            ON conv.id_unidade_derivada = um.id_unidade AND conv.id_item = ? AND conv.tenant_id = ?
     LEFT JOIN comercial_unidades_venda cuv
            ON cuv.id_unidade = um.id_unidade AND cuv.id_item = ? AND cuv.tenant_id = ?
     WHERE um.tenant_id = ?
       AND (um.id_unidade = ? OR conv.id_unidade_derivada IS NOT NULL OR cuv.id_unidade IS NOT NULL)
     ORDER BY is_base DESC, fator ASC`,
    [item.id_unidade, item.id_unidade, idItem, tenant, idItem, tenant, tenant, item.id_unidade]
  );

  const [faixaRows] = await conn.execute(
    `SELECT um.sigla, f.tipo_faixa, f.ordem, f.quantidade_minima, f.quantidade_maxima, f.markup, f.preco_unitario
     FROM comercial_precos_faixas f
     INNER JOIN itens_unidades_medida um ON um.id_unidade = f.id_unidade
     WHERE f.id_item = ? AND f.tenant_id = ?
     ORDER BY um.sigla, f.ordem`,
    [idItem, tenant]
  );

  const custoGerencial = item.custo_gerencial !== null ? Number(item.custo_gerencial) : null;
  return {
    item: {
      id_item: Number(item.id_item),
      sku: item.sku,
      nome: item.nome_comercial || item.nome_item,
      tipo_recurso: item.tipo_recurso,
      sigla_base: item.sigla_base || null,
      descricao_base: item.descricao_base || null,
    },
    custos: {
      ...analisarDefasagem(
        custoGerencial,
        item.custo_medio !== null ? Number(item.custo_medio) : null,
        item.ultimo_custo !== null ? Number(item.ultimo_custo) : null
      ),
      quantidadeAtual: Number(item.quantidade_atual) || 0,
    },
    unidades: unidadeRows.map((u: any) => ({
      sigla: u.sigla,
      descricao: u.descricao,
      fator: Number(u.fator) || 1,
      is_base: Boolean(Number(u.is_base)),
      configurada: Boolean(Number(u.configurada)),
      nome_exibicao: u.nome_exibicao || null,
      gtin: u.gtin || null,
      permite_venda: u.permite_venda === null ? true : Boolean(u.permite_venda),
      permite_atacado: Boolean(u.permite_atacado),
      markup_varejo: u.markup_varejo !== null ? Number(u.markup_varejo) : null,
      padrao_pdv: Boolean(u.padrao_pdv),
    })),
    faixas: faixaRows.map((f: any) => ({
      sigla: f.sigla,
      tipo_faixa: f.tipo_faixa,
      ordem: Number(f.ordem),
      quantidade_minima: Number(f.quantidade_minima),
      quantidade_maxima: f.quantidade_maxima === null ? null : Number(f.quantidade_maxima),
      markup: Number(f.markup),
      preco_unitario: Number(f.preco_unitario),
    })),
  };
};

/**
 * GET /catalogo/itens/:idItem/config-vendas
 */
export const getConfigVendas = async (req: Request, res: Response) => {
  try {
    const config = await carregarConfig(pool, tenantDe(req), Number(req.params.idItem));
    if (!config) return res.status(404).json({ success: false, error: 'Item não encontrado.' });
    return res.json({ success: true, ...config });
  } catch (error: any) {
    console.error('Erro ao carregar configuração de vendas:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export interface UnidadePayload {
  sigla: string;
  descricao?: string;
  fator: number;
  is_base?: boolean;
  nome_exibicao?: string | null;
  gtin?: string | null;
  permite_venda?: boolean;
  permite_atacado?: boolean;
  markup_varejo?: number;
  padrao_pdv?: boolean;
}

export interface FaixaPayload {
  sigla: string;
  tipo_faixa: 'VAREJO' | 'ATACADO';
  ordem: number;
  quantidade_minima: number;
  quantidade_maxima: number | null;
  markup: number;
  preco_unitario: number;
}

export const validarConfigVendas = (unidades: UnidadePayload[], faixas: FaixaPayload[]): string | null => {
  const bases = unidades.filter(u => u.is_base);
  if (bases.length !== 1) {
    return 'Informe exatamente uma unidade base.';
  }
  if (unidades.some(u => !siglaNormalizada(u.sigla) || !(Number(u.fator) > 0))) {
    return 'Toda unidade precisa de sigla e fator maior que zero.';
  }
  const siglas = unidades.map(u => siglaNormalizada(u.sigla));
  if (new Set(siglas).size !== siglas.length) {
    return 'Há unidades com a mesma sigla.';
  }
  if (faixas.some(f => !siglas.includes(siglaNormalizada(f.sigla)))) {
    return 'Há faixas de preço para unidades não configuradas.';
  }
  return null;
};

/**
 * Grava unidade base, conversões, unidades de venda, faixas e custo gerencial do item.
 * Usa a conexão recebida (deve estar em transação). Reaproveitada pela aprovação da Staging (item novo).
 */
export const gravarConfigVendas = async (
  connection: Conn,
  tenant: number,
  idItem: number,
  unidades: UnidadePayload[],
  faixas: FaixaPayload[],
  custoGerencial: number | null
): Promise<void> => {
  const bases = unidades.filter(u => u.is_base);
  const idPorSigla = new Map<string, number>();
  for (const u of unidades) {
    idPorSigla.set(siglaNormalizada(u.sigla), await obterOuCriarUnidade(connection, tenant, u.sigla, u.descricao));
  }
  const base = bases[0];
  const idBase = idPorSigla.get(siglaNormalizada(base.sigla))!;

  await connection.execute(`UPDATE itens_core SET id_unidade = ? WHERE id_item = ? AND tenant_id = ?`, [idBase, idItem, tenant]);

  // Reescreve conversões, unidades de venda e faixas do item (faixas caem em cascata com as unidades de venda)
  await connection.execute(`DELETE FROM comercial_precos_faixas WHERE id_item = ? AND tenant_id = ?`, [idItem, tenant]);
  await connection.execute(`DELETE FROM comercial_unidades_venda WHERE id_item = ? AND tenant_id = ?`, [idItem, tenant]);
  await connection.execute(`DELETE FROM itens_unidades_conversao WHERE id_item = ? AND tenant_id = ?`, [idItem, tenant]);

  for (const u of unidades) {
    const idUnidade = idPorSigla.get(siglaNormalizada(u.sigla))!;
    if (!u.is_base) {
      await connection.execute(
        `INSERT INTO itens_unidades_conversao (tenant_id, id_item, id_unidade_derivada, fator_conversao) VALUES (?, ?, ?, ?)`,
        [tenant, idItem, idUnidade, Number(u.fator)]
      );
    }
    await connection.execute(
      `INSERT INTO comercial_unidades_venda
       (tenant_id, id_item, id_unidade, nome_exibicao, gtin, permite_venda, permite_atacado, markup_varejo, padrao_pdv)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant, idItem, idUnidade,
        String(u.nome_exibicao || '').trim() || null,
        String(u.gtin || '').trim() || null,
        u.permite_venda === false ? 0 : 1,
        u.permite_atacado ? 1 : 0,
        Number(u.markup_varejo) || 1,
        u.padrao_pdv ? 1 : 0,
      ]
    );
  }

  for (const f of faixas) {
    await connection.execute(
      `INSERT INTO comercial_precos_faixas
       (tenant_id, id_item, id_unidade, tipo_faixa, ordem, quantidade_minima, quantidade_maxima, markup, preco_unitario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant, idItem, idPorSigla.get(siglaNormalizada(f.sigla)),
        f.tipo_faixa === 'ATACADO' ? 'ATACADO' : 'VAREJO',
        Number(f.ordem) || 1,
        Number(f.quantidade_minima) || 0,
        f.quantidade_maxima === null || f.quantidade_maxima === undefined ? null : Number(f.quantidade_maxima),
        Number(f.markup) || 0,
        Number(f.preco_unitario) || 0,
      ]
    );
  }

  // Custo gerencial + preço de referência (varejo da unidade padrão do PDV, ou da base) para telas legadas
  const unidadePreco = unidades.find(u => u.padrao_pdv) || base;
  const varejo = faixas
    .filter(f => siglaNormalizada(f.sigla) === siglaNormalizada(unidadePreco.sigla))
    .sort((a, b) => a.ordem - b.ordem)[0];
  await connection.execute(
    `INSERT INTO comercial_produtos_dados (tenant_id, id_item, custo_gerencial, preco_venda, margem_lucro)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE custo_gerencial = COALESCE(VALUES(custo_gerencial), custo_gerencial),
                             preco_venda = COALESCE(VALUES(preco_venda), preco_venda),
                             margem_lucro = COALESCE(VALUES(margem_lucro), margem_lucro)`,
    [
      tenant, idItem,
      custoGerencial,
      varejo ? Number(varejo.preco_unitario) : null,
      varejo && Number(varejo.preco_unitario) > 0 && custoGerencial !== null
        ? Number((((Number(varejo.preco_unitario) - custoGerencial * Number(unidadePreco.fator)) / Number(varejo.preco_unitario)) * 100).toFixed(2))
        : null,
    ]
  );
};

/**
 * PUT /catalogo/itens/:idItem/config-vendas
 * Salva unidade base, conversões, unidades de venda, faixas de preço e custo gerencial (transação única)
 */
export const salvarConfigVendas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.idItem);
  const unidades: UnidadePayload[] = Array.isArray(req.body?.unidades) ? req.body.unidades : [];
  const faixas: FaixaPayload[] = Array.isArray(req.body?.faixas) ? req.body.faixas : [];
  const custoGerencial = req.body?.custo_gerencial !== undefined ? Number(req.body.custo_gerencial) : null;

  const erro = validarConfigVendas(unidades, faixas);
  if (erro) return res.status(400).json({ success: false, error: erro });

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [itemRows] = await connection.execute(
      `SELECT id_item FROM itens_core WHERE id_item = ? AND tenant_id = ? FOR UPDATE`,
      [idItem, tenant]
    );
    if (!itemRows[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Item não encontrado.' });
    }

    await gravarConfigVendas(connection, tenant, idItem, unidades, faixas, custoGerencial);

    await connection.commit();
    const config = await carregarConfig(pool, tenant, idItem);
    return res.json({ success: true, message: 'Configuração de vendas salva.', ...config });
  } catch (error: any) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'GTIN já usado em outra unidade/item.' });
    }
    console.error('Erro ao salvar configuração de vendas:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * POST /catalogo/itens/:idItem/custo-gerencial  { custo_gerencial }
 * Decisão do gestor diante da defasagem: atualiza o custo e recalcula as faixas mantendo o markup
 */
export const atualizarCustoGerencial = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.idItem);
  const novoCusto = Number(req.body?.custo_gerencial);

  if (!(novoCusto > 0)) {
    return res.status(400).json({ success: false, error: 'Informe um custo gerencial maior que zero.' });
  }

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [faixas] = await connection.execute(
      `SELECT f.id_faixa, f.markup,
              CASE WHEN f.id_unidade = ic.id_unidade THEN 1 ELSE COALESCE(conv.fator_conversao, 1) END AS fator
       FROM comercial_precos_faixas f
       INNER JOIN itens_core ic ON ic.id_item = f.id_item AND ic.tenant_id = f.tenant_id
       LEFT JOIN itens_unidades_conversao conv
              ON conv.id_item = f.id_item AND conv.tenant_id = f.tenant_id AND conv.id_unidade_derivada = f.id_unidade
       WHERE f.id_item = ? AND f.tenant_id = ?
       FOR UPDATE`,
      [idItem, tenant]
    );

    for (const f of faixas) {
      await connection.execute(
        `UPDATE comercial_precos_faixas SET preco_unitario = ? WHERE id_faixa = ?`,
        [calcularPrecoUnidade(novoCusto, Number(f.fator), Number(f.markup)), f.id_faixa]
      );
    }

    await connection.execute(
      `INSERT INTO comercial_produtos_dados (tenant_id, id_item, custo_gerencial)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE custo_gerencial = VALUES(custo_gerencial)`,
      [tenant, idItem, novoCusto]
    );

    await connection.commit();
    const config = await carregarConfig(pool, tenant, idItem);
    return res.json({
      success: true,
      message: `Custo atualizado e ${faixas.length} faixa(s) de preço recalculada(s).`,
      ...config,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao atualizar custo gerencial:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * GET /catalogo/itens-unidades — dicionário de unidades dos itens (UN, MT, CX...)
 */
export const listarUnidadesItens = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id_unidade, sigla, descricao FROM itens_unidades_medida WHERE tenant_id = ? AND ativa = 1 ORDER BY sigla`,
      [tenantDe(req)]
    );
    return res.json({ success: true, unidades: rows });
  } catch (error: any) {
    console.error('Erro ao listar unidades dos itens:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
