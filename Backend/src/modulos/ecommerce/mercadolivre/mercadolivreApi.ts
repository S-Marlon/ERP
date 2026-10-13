// Cliente da API do Mercado Livre: troca do código por tokens, renovação automática (o refresh token só vale
// uma vez, então a renovação é única por loja) e chamadas autenticadas.
import pool from '../../../infra/db';
import { lerConfigML, mensagemErroML, precisaRenovar, URL_API } from './mercadolivre';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

export class ErroML extends Error {
  constructor(message: string, public status = 400, public detalhes?: unknown) { super(message); }
}

export const configML = () => lerConfigML(process.env);

export interface ContaML { tenant: number; mlUserId: number; apelido: string | null; accessToken: string; refreshToken: string; expiraEm: Date }

export const carregarConta = async (conn: Conn, tenant: number): Promise<ContaML | null> => {
  const [[c]]: any = await conn.execute(`SELECT * FROM modulo_ecommerce_mercadolivre_contas WHERE tenant_id = ?`, [tenant]);
  if (!c) return null;
  return { tenant, mlUserId: Number(c.ml_user_id), apelido: c.apelido, accessToken: c.access_token, refreshToken: c.refresh_token, expiraEm: new Date(c.expira_em) };
};

/** POST /oauth/token (código de autorização ou refresh token). */
const pedirToken = async (corpo: Record<string, string>) => {
  const cfg = configML();
  if (!cfg.ok) throw new ErroML(`Configure o aplicativo do Mercado Livre no Backend/.env: falta ${cfg.faltando.join(', ')}.`, 412);
  const r = await fetch(`${URL_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...corpo }).toString(),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroML(`Mercado Livre recusou: ${mensagemErroML(d, r.status)}`, 400);
  return d as { access_token: string; refresh_token: string; expires_in: number; user_id: number };
};

const gravarTokens = async (conn: Conn, tenant: number, t: { access_token: string; refresh_token: string; expires_in: number; user_id: number }, apelido?: string | null) => {
  const expira = new Date(Date.now() + (Number(t.expires_in) || 21600) * 1000);
  await conn.execute(
    `INSERT INTO modulo_ecommerce_mercadolivre_contas (tenant_id, ml_user_id, apelido, access_token, refresh_token, expira_em)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE ml_user_id = VALUES(ml_user_id), apelido = COALESCE(VALUES(apelido), apelido),
       access_token = VALUES(access_token), refresh_token = VALUES(refresh_token), expira_em = VALUES(expira_em)`,
    [tenant, t.user_id, apelido ?? null, t.access_token, t.refresh_token, expira]
  );
};

/** Troca o código colado pelo operador por tokens e guarda a conta (com o apelido do vendedor). */
export const conectarComCodigo = async (tenant: number, codigo: string) => {
  const cfg = configML();
  const t = await pedirToken({ grant_type: 'authorization_code', code: codigo, redirect_uri: cfg.redirectUri });
  const r = await fetch(`${URL_API}/users/me`, { headers: { Authorization: `Bearer ${t.access_token}` } });
  const eu: any = await r.json().catch(() => ({}));
  await gravarTokens(pool as any, tenant, t, eu?.nickname || null);
  return { mlUserId: Number(t.user_id), apelido: eu?.nickname || null };
};

// Uma renovação por loja de cada vez (o refresh token é de uso único)
const renovando = new Map<number, Promise<string>>();

/** Token válido da loja: renova sozinho quando está para vencer. */
export const tokenValido = async (tenant: number): Promise<{ token: string; conta: ContaML }> => {
  const conta = await carregarConta(pool as any, tenant);
  if (!conta) throw new ErroML('Conecte a conta do Mercado Livre primeiro.', 412, { codigo: 'ML_DESCONECTADO' });
  if (!precisaRenovar(conta.expiraEm)) return { token: conta.accessToken, conta };
  if (!renovando.has(tenant)) {
    renovando.set(tenant, (async () => {
      try {
        const t = await pedirToken({ grant_type: 'refresh_token', refresh_token: conta.refreshToken });
        await gravarTokens(pool as any, tenant, t);
        return t.access_token;
      } finally {
        renovando.delete(tenant);
      }
    })());
  }
  try {
    return { token: await renovando.get(tenant)!, conta };
  } catch (e) {
    throw new ErroML(`A conexão com o Mercado Livre expirou: conecte de novo. (${e instanceof Error ? e.message : ''})`, 412, { codigo: 'ML_DESCONECTADO' });
  }
};

/** Envia uma foto ao ML (multipart). Devolve o id da foto e o tamanho máximo que o ML gerou ("498x343"). */
export const enviarFotoMl = async (tenant: number, conteudo: Buffer, nome: string, tipo: string) => {
  const { token } = await tokenValido(tenant);
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(conteudo)], { type: tipo }), nome);
  const r = await fetch(`${URL_API}/pictures/items/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok || !d?.id) throw new ErroML(`Mercado Livre recusou a foto ${nome}: ${mensagemErroML(d, r.status)}`, 400, d);
  return { id: String(d.id), maxSize: (d.max_size as string) || null };
};

// Conta no modelo User Products: cada variação é um anúncio e o ML agrupa pelo family_name
// e a conta "business" pode ter preço por quantidade para compradores empresa (B2B)
const tagsPorConta = new Map<number, { em: number; tags: string[] }>();
const tagsDaConta = async (tenant: number) => {
  const guardado = tagsPorConta.get(tenant);
  if (guardado && Date.now() - guardado.em < 60 * 60 * 1000) return guardado.tags;
  const eu: any = await ml(tenant, 'GET', '/users/me');
  const tags: string[] = Array.isArray(eu?.tags) ? eu.tags : [];
  tagsPorConta.set(tenant, { em: Date.now(), tags });
  return tags;
};
export const contaPorFamilia = async (tenant: number) => (await tagsDaConta(tenant)).includes('user_product_seller');
export const contaB2B = async (tenant: number) => (await tagsDaConta(tenant)).includes('business');

/** Chamada autenticada à API do ML (JSON). */
export const ml = async <T = any>(
  tenant: number, metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}
): Promise<T> => {
  const { token } = await tokenValido(tenant);
  const r = await fetch(`${URL_API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...cabecalhos },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroML(`Mercado Livre: ${mensagemErroML(d, r.status)}`, r.status >= 500 ? 502 : 400, d);
  return d as T;
};
