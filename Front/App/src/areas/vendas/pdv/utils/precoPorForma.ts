// Quanto o cliente paga em cada forma, a partir do total de tabela (que já embute a taxa de referência):
// à vista (PIX/dinheiro/débito) pode ter desconto; crédito até N vezes sem juros vale o total; acima disso,
// acréscimo pela taxa da maquininha. Mesmas contas de FinalizarVenda (descontoDaForma / acrescimoParcelamento).
import { acrescimoParcelamento, ConfigTaxas, descontoDaForma } from '../../taxas/taxasVenda';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export interface OpcaoForma { forma: string; rotulo: string; valor: number; pct: number }
export interface OpcaoParcela { parcelas: number; valor: number; parcela: number; acrescimoPct: number }

export interface PrecosPorForma {
  aVista: OpcaoForma[];       // formas com desconto (ex.: PIX -4,8%)
  semJuros: OpcaoParcela;     // crédito até N vezes pelo total
  comJuros: OpcaoParcela[];   // crédito acima do sem juros (total + acréscimo)
}

const ROTULO: Record<string, string> = { PIX: 'PIX', DINHEIRO: 'Dinheiro', DEBITO: 'Débito' };

/** Maior número de parcelas do crédito cadastrado nas taxas (sem cadastro: o sem juros). */
export const maxParcelasCredito = (cfg: ConfigTaxas) =>
  Math.max(cfg.parcelasSemJuros || 1, ...cfg.taxas.filter(t => t.forma === 'CREDITO').map(t => Number(t.parcelasAte) || 1));

export const precosPorForma = (cfg: ConfigTaxas | null, total: number): PrecosPorForma | null => {
  if (!cfg || !(total > 0)) return null;
  // Desconto da forma: mesma conta do pagamento (desconto em R$ arredondado sobre o total)
  const aVista = ['PIX', 'DINHEIRO', 'DEBITO']
    .map(forma => {
      const pct = descontoDaForma(cfg, forma);
      return { forma, rotulo: ROTULO[forma], pct, valor: r2(total - r2(total * pct / 100)) };
    })
    .filter(o => o.pct > 0);
  const n = Math.max(1, cfg.parcelasSemJuros || 1);
  const semJuros = { parcelas: n, valor: r2(total), parcela: r2(total / n), acrescimoPct: 0 };
  const comJuros: OpcaoParcela[] = [];
  for (let p = n + 1; p <= maxParcelasCredito(cfg); p++) {
    const acr = acrescimoParcelamento(cfg, 'CREDITO', p, total);
    const valor = r2(total + acr);
    comJuros.push({ parcelas: p, valor, parcela: r2(valor / p), acrescimoPct: total > 0 ? r2((acr / total) * 100) : 0 });
  }
  return { aVista, semJuros, comJuros };
};
