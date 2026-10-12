// Opções do kit configurável para a tela de escolha do PDV (/api/catalogo/kits/:id/opcoes).
import { API_URL } from '../../../../shared/api/config';
import type { PosicaoKit } from '../utils/kitPdv';

export const opcoesDoKit = async (idKit: number): Promise<PosicaoKit[]> => {
  const r = await fetch(`${API_URL}/api/catalogo/kits/${idKit}/opcoes?tenant_id=1`);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || 'Erro ao carregar as opções do kit.');
  return d;
};
