// Módulo Mercado Livre: conexão da conta (OAuth com o código colado pelo operador, porque o ERP roda em localhost
// e o ML só volta para endereço https).
import crypto from 'crypto';
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { extrairCodigo, montarUrlAutorizacao, ROTULO_REPUTACAO } from './mercadolivre';
import { carregarConta, conectarComCodigo, configML, ErroML, ml } from './mercadolivreApi';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroML) return res.status(error.status).json({ error: error.message, detalhes: error.detalhes });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

// state da autorização por loja (confere que o código colado veio desta tentativa)
const estados = new Map<number, string>();

/** GET /status — aplicativo configurado? conta conectada? */
export const status = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const cfg = configML();
    const conta = await carregarConta(pool as any, tenant);
    let urlAutorizacao: string | null = null;
    if (cfg.ok) {
      const state = estados.get(tenant) || crypto.randomBytes(8).toString('hex');
      estados.set(tenant, state);
      urlAutorizacao = montarUrlAutorizacao(cfg, state);
    }
    return res.json({
      configurado: cfg.ok, faltando: cfg.faltando, redirectUri: cfg.redirectUri || null, urlAutorizacao,
      conectado: Boolean(conta), apelido: conta?.apelido || null, mlUserId: conta?.mlUserId || null,
      expiraEm: conta ? conta.expiraEm.toISOString() : null,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao ler a conexão com o Mercado Livre.');
  }
};

/** POST /conectar { endereco } — o endereço para onde o ML voltou (com ?code=...) ou só o código */
export const conectar = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const lido = extrairCodigo(String(req.body?.endereco || ''));
    if (!lido) throw new ErroML('Cole o endereço completo para onde o Mercado Livre voltou (tem "?code=TG-...").');
    const esperado = estados.get(tenant);
    if (lido.state && esperado && lido.state !== esperado) {
      throw new ErroML('Esse código é de outra tentativa de conexão: clique em "Autorizar no Mercado Livre" de novo.');
    }
    const r = await conectarComCodigo(tenant, lido.codigo);
    estados.delete(tenant);
    return res.json({ success: true, ...r });
  } catch (error) {
    return responderErro(res, error, 'Erro ao conectar o Mercado Livre.');
  }
};

/** POST /desconectar — apaga os tokens (os anúncios no ML continuam lá) */
export const desconectar = async (req: Request, res: Response) => {
  try {
    await pool.execute(`DELETE FROM modulo_ecommerce_mercadolivre_contas WHERE tenant_id = ?`, [tenantDe(req)]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao desconectar.');
  }
};

/** GET /conta — dados do vendedor no ML (testa a conexão e a renovação do token) */
export const conta = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const eu = await ml(tenant, 'GET', '/users/me');
    const rep = eu?.seller_reputation || {};
    const anuncios = await ml(tenant, 'GET', `/users/${eu.id}/items/search?limit=1`).catch(() => null);
    return res.json({
      id: eu.id, apelido: eu.nickname, email: eu.email || null, site: eu.site_id,
      cidade: eu?.address?.city || null, estado: eu?.address?.state || null,
      reputacao: rep.level_id ? (ROTULO_REPUTACAO[rep.level_id] || rep.level_id) : 'Sem reputação ainda',
      mercadoLider: rep.power_seller_status || null,
      vendasConcluidas: Number(rep?.transactions?.completed) || 0,
      anuncios: Number(anuncios?.paging?.total) || 0,
      link: eu.permalink || null,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao consultar a conta do Mercado Livre.');
  }
};
