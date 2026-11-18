// Configuração das regras de venda (vendas_configuracoes): limite de desconto, senha de autorização
// e política para venda abaixo do custo. A senha nunca sai do servidor (só "temSenha").
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { conferirSenha, gerarHashSenha, POLITICAS_ABAIXO_CUSTO, PoliticaAbaixoCusto, REGRAS_PADRAO, RegrasVenda, validarNovaSenha } from './regrasVenda';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

export const carregarRegras = async (conn: Conn, tenant: number): Promise<RegrasVenda> => {
  const [[r]]: any = await conn.execute(
    `SELECT desconto_max_percentual, senha_autorizacao_hash, politica_abaixo_custo FROM vendas_configuracoes WHERE tenant_id = ?`, [tenant]
  );
  if (!r) return REGRAS_PADRAO;
  const politica = String(r.politica_abaixo_custo || '').toUpperCase() as PoliticaAbaixoCusto;
  return {
    descontoMaxPercentual: Number(r.desconto_max_percentual),
    politicaAbaixoCusto: POLITICAS_ABAIXO_CUSTO.includes(politica) ? politica : 'AVISAR',
    senhaHash: r.senha_autorizacao_hash || null,
  };
};

/** Margens da negociação de orçamento: a que o orçamento busca e a mínima por item (abaixo dela pede a senha). */
export const carregarMargensNegociacao = async (conn: Conn, tenant: number) => {
  const [[r]]: any = await conn.execute(`SELECT margem_alvo_padrao, margem_minima_negociacao FROM vendas_configuracoes WHERE tenant_id = ?`, [tenant]);
  return { margemAlvoPadrao: r ? Number(r.margem_alvo_padrao) : 0.3, margemMinimaNegociacao: r ? Number(r.margem_minima_negociacao) : 0.1 };
};

const publicas = (r: RegrasVenda, m: { margemAlvoPadrao: number; margemMinimaNegociacao: number }) => ({
  descontoMaxPercentual: r.descontoMaxPercentual,
  politicaAbaixoCusto: r.politicaAbaixoCusto,
  temSenha: Boolean(r.senhaHash),
  ...m,
});

/** GET /api/vendas/configuracoes */
export const obterConfiguracoes = async (req: Request, res: Response) => {
  try {
    return res.json(publicas(await carregarRegras(pool as any, tenantDe(req)), await carregarMargensNegociacao(pool as any, tenantDe(req))));
  } catch (error: any) {
    console.error('Erro ao carregar as regras de venda:', error);
    return res.status(500).json({ error: 'Erro ao carregar as regras de venda.' });
  }
};

/**
 * PUT /api/vendas/configuracoes { descontoMaxPercentual, politicaAbaixoCusto, senhaAtual?, novaSenha? }
 * Com senha definida, qualquer alteração exige a senha atual (senão o operador mudaria o próprio limite).
 */
export const salvarConfiguracoes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const atual = await carregarRegras(pool as any, tenant);
    if (atual.senhaHash && !conferirSenha(String(req.body?.senhaAtual || ''), atual.senhaHash)) {
      return res.status(403).json({ error: 'Senha de autorização atual incorreta.' });
    }
    const desconto = req.body?.descontoMaxPercentual === undefined ? atual.descontoMaxPercentual : Number(req.body.descontoMaxPercentual);
    if (!Number.isFinite(desconto) || desconto < 0 || desconto > 100) return res.status(400).json({ error: 'Limite de desconto inválido (0 a 100%).' });
    const politica = String(req.body?.politicaAbaixoCusto || atual.politicaAbaixoCusto).toUpperCase() as PoliticaAbaixoCusto;
    if (!POLITICAS_ABAIXO_CUSTO.includes(politica)) return res.status(400).json({ error: 'Política inválida (PERMITIR, AVISAR ou BLOQUEAR).' });

    const margensAtuais = await carregarMargensNegociacao(pool as any, tenant);
    const margemDe = (v: unknown, padrao: number) => (v === undefined || v === null || v === '' ? padrao : Number(v));
    const margemAlvo = margemDe(req.body?.margemAlvoPadrao, margensAtuais.margemAlvoPadrao);
    const margemMinima = margemDe(req.body?.margemMinimaNegociacao, margensAtuais.margemMinimaNegociacao);
    if (![margemAlvo, margemMinima].every(m => Number.isFinite(m) && m >= 0 && m <= 0.9)) return res.status(400).json({ error: 'Margens da negociação: de 0 a 90%.' });
    if (margemMinima > margemAlvo) return res.status(400).json({ error: 'A margem mínima não pode passar da margem alvo.' });

    let hash = atual.senhaHash;
    if (req.body?.novaSenha !== undefined && req.body.novaSenha !== null && req.body.novaSenha !== '') {
      const erro = validarNovaSenha(String(req.body.novaSenha));
      if (erro) return res.status(400).json({ error: erro });
      hash = gerarHashSenha(String(req.body.novaSenha));
    }

    await pool.execute(
      `INSERT INTO vendas_configuracoes (tenant_id, desconto_max_percentual, senha_autorizacao_hash, politica_abaixo_custo, margem_alvo_padrao, margem_minima_negociacao)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE desconto_max_percentual = VALUES(desconto_max_percentual),
                               senha_autorizacao_hash = VALUES(senha_autorizacao_hash),
                               politica_abaixo_custo = VALUES(politica_abaixo_custo),
                               margem_alvo_padrao = VALUES(margem_alvo_padrao),
                               margem_minima_negociacao = VALUES(margem_minima_negociacao)`,
      [tenant, desconto.toFixed(2), hash, politica, margemAlvo.toFixed(4), margemMinima.toFixed(4)]
    );
    return res.json(publicas({ descontoMaxPercentual: desconto, politicaAbaixoCusto: politica, senhaHash: hash },
      { margemAlvoPadrao: margemAlvo, margemMinimaNegociacao: margemMinima }));
  } catch (error: any) {
    console.error('Erro ao salvar as regras de venda:', error);
    return res.status(500).json({ error: 'Erro ao salvar as regras de venda.' });
  }
};
