// Condição de pagamento da proposta negociada em campos (forma, parcelas, intervalo, entrada). Daqui saem o texto da
// proposta, o custo da condição (taxa da maquininha + prazo médio para receber) que entra na margem da negociação, os
// pagamentos que o PDV lança e a conferência "o caixa trocou por um pagamento mais caro que o combinado?" (pede senha).
// Puro, com teste. Cópia igual em Front/App/src/areas/vendas/negociacao/condicaoPagamento.ts.

export const FORMAS_CONDICAO = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'PRAZO'] as const;
export type FormaCondicao = typeof FORMAS_CONDICAO[number];

export interface CondicaoPagamento {
  forma: FormaCondicao;
  /** Parcelas do crédito ou do a prazo (1 nas outras formas). */
  parcelas: number;
  /** A prazo: dias entre as parcelas (o 1º vencimento também). */
  intervaloDias: number | null;
  /** Crédito e a prazo: entrada no ato (PIX). PIX e dinheiro: o antecipado (o saldo na conclusão e entrega). */
  entrada: number;
  /** Desconto por pagar nesta forma (PIX/dinheiro), sobre o total da proposta: 0,10 = 10%. Sem ele, 0. */
  descontoPct?: number;
}

/** Total a pagar na condição: o da proposta menos o desconto da forma (PIX/dinheiro). */
export const totalComDesconto = (c: Pick<CondicaoPagamento, 'descontoPct'> | null | undefined, total: number) =>
  r2(total * (1 - (Number(c?.descontoPct) || 0)));

/** Taxa da forma (a configurada em Vendas › Taxas): % sobre o valor + R$ fixo. */
export type TaxaDe = (forma: string, parcelas: number) => { percentual: number; fixa: number };

/** Pagamento como o PDV manda (valor já sem o troco). */
export interface PagamentoFeito { forma: string; valor: number; parcelas?: number; intervaloDias?: number | null; semPrazo?: boolean }

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Lê a condição vinda da tela; null = "a combinar". Erro com a mensagem para o operador. */
export const lerCondicao = (c: any, total?: number): CondicaoPagamento | null => {
  if (!c || !c.forma) return null;
  const forma = String(c.forma).toUpperCase() as FormaCondicao;
  if (!FORMAS_CONDICAO.includes(forma)) throw new Error('Forma de pagamento da condição inválida.');
  const parcelada = forma === 'PRAZO' || forma === 'CREDITO';
  const parcelas = parcelada ? Math.floor(Number(c.parcelas) || 1) : 1;
  if (parcelas < 1 || parcelas > 24) throw new Error('Parcelas da condição: de 1 a 24.');
  const intervaloDias = forma === 'PRAZO' ? Math.floor(Number(c.intervaloDias) || 30) : null;
  if (intervaloDias !== null && (intervaloDias < 1 || intervaloDias > 180)) throw new Error('Intervalo entre as parcelas: de 1 a 180 dias.');
  // PIX e dinheiro também podem ir em duas etapas: antecipado (a "entrada") e o saldo na conclusão e entrega
  const comEntrada = parcelada || forma === 'PIX' || forma === 'DINHEIRO';
  const entrada = comEntrada ? r2(Math.max(0, Number(c.entrada) || 0)) : 0;
  // desconto só no PIX e no dinheiro (as formas sem taxa), até 50%
  const descontoPct = forma === 'PIX' || forma === 'DINHEIRO' ? Math.round(Math.max(0, Number(c.descontoPct) || 0) * 10000) / 10000 : 0;
  if (descontoPct > 0.5) throw new Error('Desconto da forma de pagamento: até 50%.');
  const aPagar = total !== undefined ? r2(total * (1 - descontoPct)) : undefined;
  if (aPagar !== undefined && entrada > 0 && entrada >= aPagar - 0.004) throw new Error('A entrada precisa ser menor que o total da proposta.');
  return { forma, parcelas, intervaloDias, entrada, ...(descontoPct > 0 ? { descontoPct } : {}) };
};

/** "10%", "7,5%" */
const pctTexto = (d: number) => `${(d * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** Fração "bonita" do antecipado: 1/3 e 2/3, 1/2... ou a porcentagem (30% e 70%). */
const fracaoDoAntecipado = (parte: number) => {
  const comuns: Array<[number, string, string]> = [[1 / 4, '1/4', '3/4'], [1 / 3, '1/3', '2/3'], [1 / 2, '1/2', '1/2'], [2 / 3, '2/3', '1/3'], [3 / 4, '3/4', '1/4']];
  const f = comuns.find(([v]) => Math.abs(v - parte) < 0.005);
  if (f) return { antes: f[1], depois: f[2] };
  const pct = Math.round(parte * 100);
  return { antes: `${pct}%`, depois: `${100 - pct}%` };
};

/**
 * Texto da proposta: "A prazo 28/56 dias (2 parcelas)", "Entrada de R$ 100,00 + cartão de crédito em 3x", "1/3 antecipado
 * no PIX (R$ 70,00) + 2/3 na conclusão e entrega (R$ 140,00)"... Com o total, o PIX/dinheiro em etapas mostra a fração e os valores.
 */
export const textoDaCondicao = (c: CondicaoPagamento, total?: number): string => {
  const p = c.parcelas;
  const d = Number(c.descontoPct) || 0;
  const onde = c.forma === 'PIX' ? 'no PIX' : 'em dinheiro';
  // com desconto da forma: "No PIX com 10% de desconto: R$ 189,00" e as etapas sobre o total com desconto
  const comDesconto = d > 0 ? `${onde === 'no PIX' ? 'No PIX' : 'Em dinheiro'} com ${pctTexto(d)} de desconto${total ? `: ${brl(r2(total * (1 - d)))}` : ''}` : '';
  const aPagar = total ? r2(total * (1 - d)) : undefined;
  if ((c.forma === 'PIX' || c.forma === 'DINHEIRO') && c.entrada > 0) {
    if (aPagar && aPagar > c.entrada) {
      const f = fracaoDoAntecipado(c.entrada / aPagar);
      const etapas = `${f.antes} antecipado${d ? '' : ` ${onde}`} (${brl(c.entrada)}) + ${f.depois} na conclusão e entrega (${brl(r2(aPagar - c.entrada))})`;
      return d ? `${comDesconto} — ${etapas}` : etapas;
    }
    return `${comDesconto ? `${comDesconto} — ` : ''}${brl(c.entrada)} antecipado ${onde} + o saldo ${onde} na conclusão e entrega`;
  }
  if (comDesconto) return comDesconto;
  const base = c.forma === 'PIX' ? 'À vista no PIX'
    : c.forma === 'DINHEIRO' ? 'À vista em dinheiro'
      : c.forma === 'DEBITO' ? 'Cartão de débito'
        : c.forma === 'CREDITO' ? (p === 1 ? 'Cartão de crédito à vista' : `Cartão de crédito em ${p}x`)
          : `A prazo ${Array.from({ length: p }, (_, i) => (i + 1) * (c.intervaloDias || 30)).join('/')} dias (${p} ${p === 1 ? 'parcela' : 'parcelas'})`;
  return c.entrada > 0 ? `Entrada de ${brl(c.entrada)} + ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
};

/** Dias, em média, até receber o pagamento (a prazo sem data: infinito). Cartão a loja recebe da maquininha: 0. */
export const prazoMedioDias = (p: { forma: string; parcelas?: number; intervaloDias?: number | null; semPrazo?: boolean }) => {
  if (String(p.forma).toUpperCase() !== 'PRAZO') return 0;
  if (p.semPrazo) return Infinity;
  const n = Math.max(1, Math.floor(Number(p.parcelas) || 1));
  return (Number(p.intervaloDias) || 30) * (n + 1) / 2;
};

const taxaDoValor = (taxaDe: TaxaDe, forma: string, parcelas: number, valor: number) => {
  if (!(valor > 0)) return 0;
  const t = taxaDe(String(forma).toUpperCase(), Math.max(1, Math.floor(parcelas || 1)));
  return r2(valor * (Number(t.percentual) || 0) / 100 + (Number(t.fixa) || 0));
};

/** Pagamentos que cumprem a condição: entrada no PIX (ou o antecipado na própria forma, no PIX/dinheiro) + o resto na forma combinada. */
export const pagamentosDaCondicao = (c: CondicaoPagamento, total: number): PagamentoFeito[] => {
  const resto = r2(total - c.entrada);
  const formaEntrada = c.forma === 'DINHEIRO' ? 'DINHEIRO' : 'PIX';
  return [
    ...(c.entrada > 0 ? [{ forma: formaEntrada, valor: c.entrada, parcelas: 1 }] : []),
    { forma: c.forma, valor: resto, parcelas: c.parcelas, ...(c.forma === 'PRAZO' ? { intervaloDias: c.intervaloDias } : {}) },
  ];
};

/** Quanto a condição custa à loja sobre `total`: taxas (R$) e prazo médio ponderado até receber (dias). */
export const custoDaCondicao = (taxaDe: TaxaDe, c: CondicaoPagamento, total: number) => custoDosPagamentos(taxaDe, pagamentosDaCondicao(c, total), total);

/** Mesma conta para o que o caixa lançou. Acréscimo pago pelo cliente (valor acima do total) abate a taxa. */
export const custoDosPagamentos = (taxaDe: TaxaDe, pagamentos: PagamentoFeito[], total: number) => {
  const validos = pagamentos.filter(p => Number(p.valor) > 0);
  const soma = validos.reduce((a, p) => a + Number(p.valor), 0);
  const taxas = validos.reduce((a, p) => a + taxaDoValor(taxaDe, p.forma, p.parcelas || 1, Number(p.valor)), 0);
  const acrescimo = Math.max(0, soma - total);
  const prazo = soma > 0 ? validos.reduce((a, p) => a + prazoMedioDias(p) * Number(p.valor), 0) / soma : 0;
  return { taxa: r2(Math.max(0, taxas - acrescimo)), prazoMedioDias: Number.isFinite(prazo) ? Math.round(prazo * 10) / 10 : Infinity };
};

/**
 * O pagamento lançado é mais caro para a loja que o combinado na proposta? (mais taxa ou mais tempo para receber)
 * Devolve o motivo para o pedido de senha, ou null.
 */
export const pagamentoMaisCaro = (taxaDe: TaxaDe, c: CondicaoPagamento, total: number, pagamentos: PagamentoFeito[]): string | null => {
  const combinado = custoDaCondicao(taxaDe, c, total);
  const feito = custoDosPagamentos(taxaDe, pagamentos, total);
  const motivos: string[] = [];
  if (feito.taxa > combinado.taxa + 0.05) motivos.push(`taxa de ${brl(feito.taxa)} contra ${brl(combinado.taxa)} da condição combinada`);
  if (feito.prazoMedioDias > combinado.prazoMedioDias + 1) {
    motivos.push(Number.isFinite(feito.prazoMedioDias)
      ? `recebe em ${feito.prazoMedioDias.toLocaleString('pt-BR')} dias em média contra ${combinado.prazoMedioDias.toLocaleString('pt-BR')} combinados`
      : 'a prazo sem data de vencimento');
  }
  return motivos.length ? `Pagamento diferente do combinado na proposta (${textoDaCondicao(c)}): ${motivos.join('; ')}.` : null;
};

/** Condição em campos gravada no orçamento (colunas condicao_*); null = a combinar ou orçamento antigo só com o texto. */
export const condicaoDaLinha = (p: any) => (p?.condicao_forma
  ? {
    forma: p.condicao_forma, parcelas: Number(p.condicao_parcelas) || 1,
    intervaloDias: p.condicao_intervalo_dias !== null && p.condicao_intervalo_dias !== undefined ? Number(p.condicao_intervalo_dias) : null,
    entrada: Number(p.condicao_entrada) || 0, ...(Number(p.condicao_desconto_pct) > 0 ? { descontoPct: Number(p.condicao_desconto_pct) } : {}),
  }
  : null);
