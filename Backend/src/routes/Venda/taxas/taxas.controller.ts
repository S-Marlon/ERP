// Taxas dos meios de pagamento (vendas_taxas_pagamento) e as escolhas de vendas_configuracoes:
// qual taxa o preço de tabela embute, até quantas parcelas a loja absorve e se o desconto da forma é automático.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { conferirSenha } from '../regras/regrasVenda';
import { carregarRegras } from '../regras/regrasVenda.controller';
import { ajusteDaForma, ConfigTaxas, ErroTaxa, taxaReferencia, TaxaPagamento, validarTaxas } from './taxas';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

export const carregarConfigTaxas = async (conn: Conn, tenant: number): Promise<ConfigTaxas> => {
  const [rows]: any = await conn.execute(
    `SELECT forma, parcelas_de, parcelas_ate, taxa_percentual, taxa_fixa FROM vendas_taxas_pagamento
     WHERE tenant_id = ? AND ativo = 1 ORDER BY forma, parcelas_de`, [tenant]
  );
  const [[cfg]]: any = await conn.execute(
    `SELECT forma_referencia_preco, parcelas_referencia_preco, parcelas_sem_juros, desconto_forma_automatico
     FROM vendas_configuracoes WHERE tenant_id = ?`, [tenant]
  );
  return {
    taxas: rows.map((r: any) => ({
      forma: String(r.forma), parcelasDe: Number(r.parcelas_de), parcelasAte: Number(r.parcelas_ate),
      percentual: Number(r.taxa_percentual), fixa: Number(r.taxa_fixa),
    })),
    formaReferencia: String(cfg?.forma_referencia_preco || 'CREDITO'),
    parcelasReferencia: Number(cfg?.parcelas_referencia_preco) || 1,
    parcelasSemJuros: Number(cfg?.parcelas_sem_juros) || 1,
    descontoFormaAutomatico: cfg ? Boolean(Number(cfg.desconto_forma_automatico)) : true,
  };
};

// Tabela pronta para a tela: ajuste de cada forma/faixa sobre o preço de tabela
const comAjustes = (cfg: ConfigTaxas) => ({
  ...cfg,
  taxaReferencia: taxaReferencia(cfg),
  ajustes: [
    ...['DINHEIRO', 'PIX', 'DEBITO', 'TRANSFERENCIA'].map(forma => ({ forma, parcelas: 1, ajuste: ajusteDaForma(cfg, forma, 1) })),
    ...Array.from({ length: 12 }, (_, i) => ({ forma: 'CREDITO', parcelas: i + 1, ajuste: ajusteDaForma(cfg, 'CREDITO', i + 1) })),
  ],
});

/** GET /api/vendas/taxas */
export const obterTaxas = async (req: Request, res: Response) => {
  try {
    return res.json(comAjustes(await carregarConfigTaxas(pool as any, tenantDe(req))));
  } catch (error: any) {
    console.error('Erro ao carregar as taxas:', error);
    return res.status(500).json({ error: 'Erro ao carregar as taxas.' });
  }
};

/**
 * PUT /api/vendas/taxas { taxas: [{ forma, parcelasDe, parcelasAte, percentual, fixa, observacao? }],
 *   formaReferencia, parcelasReferencia, parcelasSemJuros, descontoFormaAutomatico, senhaAtual? }
 * Substitui a tabela inteira. Com senha de autorização definida, exige a senha (mexe nos descontos liberados).
 */
export const salvarTaxas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection: any = await pool.getConnection();
  try {
    const regras = await carregarRegras(connection, tenant);
    if (regras.senhaHash && !conferirSenha(String(req.body?.senhaAtual || ''), regras.senhaHash)) {
      throw new ErroTaxa('Senha de autorização incorreta.', 403);
    }
    const taxas: (TaxaPagamento & { observacao?: string })[] = (Array.isArray(req.body?.taxas) ? req.body.taxas : []).map((t: any) => ({
      forma: String(t.forma || '').toUpperCase(),
      parcelasDe: Math.floor(Number(t.parcelasDe) || 1),
      parcelasAte: Math.floor(Number(t.parcelasAte) || Number(t.parcelasDe) || 1),
      percentual: Number(t.percentual) || 0,
      fixa: Number(t.fixa) || 0,
      observacao: String(t.observacao || '').trim().slice(0, 100) || null,
    }));
    validarTaxas(taxas);
    const formaReferencia = String(req.body?.formaReferencia || 'CREDITO').toUpperCase();
    const parcelasReferencia = Math.max(1, Math.floor(Number(req.body?.parcelasReferencia) || 1));
    const parcelasSemJuros = Math.max(1, Math.floor(Number(req.body?.parcelasSemJuros) || 1));
    if (parcelasReferencia > 36 || parcelasSemJuros > 36) throw new ErroTaxa('Parcelas de 1 a 36.');

    await connection.beginTransaction();
    await connection.execute(`DELETE FROM vendas_taxas_pagamento WHERE tenant_id = ?`, [tenant]);
    for (const t of taxas) {
      await connection.execute(
        `INSERT INTO vendas_taxas_pagamento (tenant_id, forma, parcelas_de, parcelas_ate, taxa_percentual, taxa_fixa, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenant, t.forma, t.parcelasDe, t.parcelasAte, t.percentual.toFixed(4), t.fixa.toFixed(4), t.observacao]
      );
    }
    await connection.execute(
      `INSERT INTO vendas_configuracoes (tenant_id, forma_referencia_preco, parcelas_referencia_preco, parcelas_sem_juros, desconto_forma_automatico)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE forma_referencia_preco = VALUES(forma_referencia_preco), parcelas_referencia_preco = VALUES(parcelas_referencia_preco),
                               parcelas_sem_juros = VALUES(parcelas_sem_juros), desconto_forma_automatico = VALUES(desconto_forma_automatico)`,
      [tenant, formaReferencia, parcelasReferencia, parcelasSemJuros, req.body?.descontoFormaAutomatico === false ? 0 : 1]
    );
    await connection.commit();
    return res.json(comAjustes(await carregarConfigTaxas(pool as any, tenant)));
  } catch (error: any) {
    await connection.rollback().catch(() => undefined);
    if (error instanceof ErroTaxa) return res.status(error.status).json({ error: error.message });
    console.error('Erro ao salvar as taxas:', error);
    return res.status(500).json({ error: 'Erro ao salvar as taxas.' });
  } finally {
    connection.release();
  }
};
