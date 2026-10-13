// Módulo Mercado Livre: regras puras (sem banco nem rede). Testadas em mercadolivre.test.ts.

export const URL_AUTORIZACAO = 'https://auth.mercadolivre.com.br/authorization';
export const URL_API = 'https://api.mercadolibre.com';

export interface ConfigML { clientId: string; clientSecret: string; redirectUri: string; ok: boolean; faltando: string[] }

/** Credenciais do aplicativo (Backend/.env). */
export const lerConfigML = (env: Record<string, string | undefined>): ConfigML => {
  const clientId = String(env.ML_CLIENT_ID || '').trim();
  const clientSecret = String(env.ML_CLIENT_SECRET || '').trim();
  const redirectUri = String(env.ML_REDIRECT_URI || '').trim();
  const faltando = [!clientId && 'ML_CLIENT_ID', !clientSecret && 'ML_CLIENT_SECRET', !redirectUri && 'ML_REDIRECT_URI'].filter(Boolean) as string[];
  return { clientId, clientSecret, redirectUri, ok: faltando.length === 0, faltando };
};

/** Endereço para o vendedor autorizar o ERP (abre no navegador). */
export const montarUrlAutorizacao = (cfg: Pick<ConfigML, 'clientId' | 'redirectUri'>, state: string) =>
  `${URL_AUTORIZACAO}?response_type=code&client_id=${encodeURIComponent(cfg.clientId)}&redirect_uri=${encodeURIComponent(cfg.redirectUri)}&state=${encodeURIComponent(state)}`;

/**
 * O ML volta para o redirect com ?code=TG-...&state=...: o operador cola o endereço inteiro (ou só o código).
 * Devolve o código e o state (se vier).
 */
export const extrairCodigo = (texto: string): { codigo: string; state: string | null } | null => {
  const t = String(texto || '').trim();
  if (!t) return null;
  const naUrl = /[?&]code=([^&#\s]+)/.exec(t);
  if (naUrl) {
    const st = /[?&]state=([^&#\s]+)/.exec(t);
    return { codigo: decodeURIComponent(naUrl[1]), state: st ? decodeURIComponent(st[1]) : null };
  }
  return /^TG-[A-Za-z0-9-]+$/.test(t) ? { codigo: t, state: null } : null;
};

/** Renova o token um pouco antes de vencer (o access token dura 6 h). */
export const precisaRenovar = (expiraEm: Date, agora = new Date(), margemMinutos = 10) =>
  expiraEm.getTime() - agora.getTime() < margemMinutos * 60 * 1000;

/** Mensagem legível de um erro da API do ML (message + causes). */
export const mensagemErroML = (corpo: any, status: number) => {
  const causas = Array.isArray(corpo?.cause) ? corpo.cause.map((c: any) => c?.message || c?.code).filter(Boolean) : [];
  const base = corpo?.message || corpo?.error_description || corpo?.error || `HTTP ${status}`;
  return causas.length ? `${base}: ${causas.join('; ')}` : String(base);
};

export const ROTULO_REPUTACAO: Record<string, string> = {
  '5_green': 'Verde (ótima)', '4_light_green': 'Verde-claro', '3_yellow': 'Amarela', '2_orange': 'Laranja', '1_red': 'Vermelha',
};
