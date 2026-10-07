// Taxas dos meios de pagamento no front: mesma conta do servidor (Backend/src/routes/Venda/taxas/taxas.ts).
// Preço de tabela embute a taxa de referência; na forma f o equivalente é tabela x (1 - t_ref) / (1 - t_f).
import { API_URL } from '../../../shared/api/config';
import { useEffect, useState } from 'react';

const API = `${API_URL}/api/vendas/taxas`;

// percentual = taxa da faixa; vendaPercentual = taxa % de toda venda (ex.: 3,09%); fixa = R$ por venda
export interface TaxaPagamento { forma: string; parcelasDe: number; parcelasAte: number; percentual: number; vendaPercentual?: number; fixa: number; observacao?: string | null }

export interface ConfigTaxas {
  taxas: TaxaPagamento[];
  formaReferencia: string;
  parcelasReferencia: number;
  parcelasSemJuros: number;
  descontoFormaAutomatico: boolean;
  taxaReferencia: number;
  ajustes: Array<{ forma: string; parcelas: number; ajuste: number }>;
}

export const taxaPara = (cfg: ConfigTaxas, forma: string, parcelas = 1) => {
  const n = Math.max(1, Math.floor(parcelas || 1));
  const t = cfg.taxas.find(x => x.forma === forma && n >= x.parcelasDe && n <= x.parcelasAte);
  return t
    ? { percentual: (Number(t.percentual) || 0) + (Number(t.vendaPercentual) || 0), fixa: Number(t.fixa) || 0 }
    : { percentual: 0, fixa: 0 };
};

/** % sobre o preço de tabela: negativo = desconto permitido, positivo = acréscimo necessário. */
export const ajusteDaForma = (cfg: ConfigTaxas, forma: string, parcelas = 1) => {
  const ref = cfg.taxaReferencia / 100;
  const tf = taxaPara(cfg, forma, parcelas).percentual / 100;
  if (tf >= 1 || ref >= 1) return 0;
  return ((1 - ref) / (1 - tf) - 1) * 100;
};

/** Acréscimo (R$) no crédito acima do sem juros para cobrar `base` sem perder margem. */
export const acrescimoParcelamento = (cfg: ConfigTaxas | null, forma: string, parcelas: number, base: number) => {
  if (!cfg || forma !== 'CREDITO' || parcelas <= cfg.parcelasSemJuros) return 0;
  const ajuste = ajusteDaForma(cfg, forma, parcelas);
  return ajuste > 0 ? Math.round(base * ajuste) / 100 : 0;
};

/** Desconto (%) que a forma permite sem autorização (0 se não permite ou se o automático está desligado). */
export const descontoDaForma = (cfg: ConfigTaxas | null, forma: string) => {
  if (!cfg || !cfg.descontoFormaAutomatico) return 0;
  const ajuste = ajusteDaForma(cfg, forma, 1);
  return ajuste < 0 ? Math.floor(-ajuste * 100) / 100 : 0;
};

const ler = async (r: Response, erro: string) => {
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || erro);
  return d;
};

export const taxasApi = {
  obter: async (): Promise<ConfigTaxas> => ler(await fetch(API), 'Erro ao carregar as taxas.'),
  salvar: async (dados: Omit<ConfigTaxas, 'taxaReferencia' | 'ajustes'> & { senhaAtual?: string }): Promise<ConfigTaxas> =>
    ler(await fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }), 'Erro ao salvar as taxas.'),
};

// Carregadas uma vez por sessão da tela (mudam pouco)
let cache: Promise<ConfigTaxas> | null = null;
export const invalidarTaxas = () => { cache = null; };

export const useTaxasVenda = () => {
  const [cfg, setCfg] = useState<ConfigTaxas | null>(null);
  useEffect(() => {
    if (!cache) cache = taxasApi.obter().catch(e => { cache = null; throw e; });
    let ativo = true;
    cache.then(c => { if (ativo) setCfg(c); }).catch(() => { if (ativo) setCfg(null); });
    return () => { ativo = false; };
  }, []);
  return cfg;
};

export const ROTULO_FORMA_TAXA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'PIX', DEBITO: 'Débito', CREDITO: 'Crédito', PRAZO: 'A prazo', TRANSFERENCIA: 'Transferência',
};
