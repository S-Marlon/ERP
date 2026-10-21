// API do resultado do mês (/api/financeiro/resultado): os últimos meses com as linhas da cascata.
import { API_URL } from '../../../shared/api/config';

export type TipoLinha = 'RECEITA' | 'DEDUCAO' | 'SUBTOTAL' | 'RESULTADO';
export interface LinhaResultado { chave: string; rotulo: string; tipo: TipoLinha; valor: number; pct: number | null; detalhe?: { nome: string; valor: number }[] }
export interface MesResultado { mes: string; rotulo: string; linhas: LinhaResultado[]; comprasMercadoria: number }

export const resultadoApi = {
  carregar: async (meses: number): Promise<{ hoje: string; meses: MesResultado[] }> => {
    const r = await fetch(`${API_URL}/api/financeiro/resultado?tenant_id=1&meses=${meses}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || (r.status === 404 ? 'Rota não encontrada: reinicie o backend.' : 'Erro ao carregar o resultado.'));
    return d;
  },
};

/** Linhas da comparação entre meses: as fixas na ordem da cascata e os grupos de despesa de todos os meses. */
export const linhasDaComparacao = (meses: MesResultado[]) => {
  const vistas = new Map<string, { chave: string; rotulo: string; tipo: TipoLinha }>();
  const fixasAntes = ['vendas', 'devolucoes', 'receita', 'cmv', 'bruto', 'cartao', 'ml', 'margem'];
  for (const m of meses) for (const l of m.linhas) if (!vistas.has(l.chave)) vistas.set(l.chave, { chave: l.chave, rotulo: l.chave === 'vendas' ? 'Vendas' : l.rotulo, tipo: l.tipo });
  const todas = [...vistas.values()];
  const despesas = todas.filter(l => l.chave.startsWith('desp:')).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return [
    ...fixasAntes.map(c => vistas.get(c)).filter((l): l is NonNullable<typeof l> => !!l),
    ...despesas,
    ...todas.filter(l => l.chave === 'resultado'),
  ];
};
