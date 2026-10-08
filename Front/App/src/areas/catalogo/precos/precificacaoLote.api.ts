// API da precificação em lote (lista de precificação)
import { API_URL } from '../../../shared/api/config';

export interface ResultadoLote { idItem: number; ok: boolean; erro?: string; faixas?: number }

export const salvarPrecosLote = async (itens: Array<{ idItem: number; custo: number | null; preco: number | null }>) => {
  const r = await fetch(`${API_URL}/api/catalogo/precos/lote?tenant_id=1`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || 'Erro ao gravar os preços.');
  return d as { resultados: ResultadoLote[]; atualizados: number; taxaPercentual: number };
};
