// Módulo Mercado Livre (/api/modulos/ecommerce/mercadolivre).
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/modulos/ecommerce/mercadolivre`;

export interface StatusML {
  configurado: boolean; faltando: string[]; redirectUri: string | null; urlAutorizacao: string | null;
  conectado: boolean; apelido: string | null; mlUserId: number | null; expiraEm: string | null;
}

export interface ContaML {
  id: number; apelido: string; email: string | null; site: string; cidade: string | null; estado: string | null;
  reputacao: string; mercadoLider: string | null; vendasConcluidas: number; anuncios: number; link: string | null;
}

const ler = async <T,>(r: Response, padrao: string): Promise<T> => {
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (r.status === 403 && d?.detalhes?.codigo === 'MODULO_DESATIVADO') throw new Error('Ligue o módulo Mercado Livre em Configurações › Módulos.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d as T;
};
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export const mercadoLivreApi = {
  status: async () => ler<StatusML>(await fetch(`${API}/status?tenant_id=1`), 'Erro ao ler a conexão.'),
  conectar: async (endereco: string) => ler<{ apelido: string | null }>(await fetch(`${API}/conectar?tenant_id=1`, json('POST', { endereco })), 'Erro ao conectar.'),
  desconectar: async () => ler<{ success: boolean }>(await fetch(`${API}/desconectar?tenant_id=1`, json('POST', {})), 'Erro ao desconectar.'),
  conta: async () => ler<ContaML>(await fetch(`${API}/conta?tenant_id=1`), 'Erro ao consultar a conta.'),
};
