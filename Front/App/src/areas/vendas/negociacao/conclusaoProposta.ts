// Negociação › "Conclusão da proposta": o fechamento como o cliente vai pagar — tabela, desconto nos preços, total dos
// itens, desconto da forma de pagamento (ex.: 10% no PIX), total a pagar e as etapas (antecipado e saldo) — e o que fica
// para a loja: custo, taxas da condição, lucro e margem finais contra o alvo e a mínima. Puro, com teste.
import { CondicaoPagamento, pagamentosDaCondicao, textoDaCondicao, totalComDesconto } from './condicaoPagamento';

export interface LinhaConclusao { quantidade: number; preco: number; precoTabela: number; custoUnitario: number }
export type NivelConclusao = 'PREJUIZO' | 'ABAIXO_MINIMA' | 'ABAIXO_ALVO' | 'NO_ALVO';

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const conclusaoDaProposta = (
  linhas: LinhaConclusao[], condicao: CondicaoPagamento | null, taxa: number, alvo: number, minima: number,
) => {
  const tabela = r2(linhas.reduce((s, l) => s + r2(l.precoTabela * l.quantidade), 0));
  const totalItens = r2(linhas.reduce((s, l) => s + r2(l.preco * l.quantidade), 0));
  const descontoPrecos = r2(Math.max(0, tabela - totalItens));
  const aPagar = condicao ? totalComDesconto(condicao, totalItens) : totalItens;
  const descontoForma = r2(totalItens - aPagar);
  const custo = r2(linhas.reduce((s, l) => s + r2(l.custoUnitario * l.quantidade), 0));
  const semCusto = linhas.filter(l => !(l.custoUnitario > 0)).length;
  const lucro = r2(aPagar - custo - taxa);
  const margem = aPagar > 0 ? Math.round((lucro / aPagar) * 10000) / 10000 : null;
  const nivel: NivelConclusao = lucro < 0 ? 'PREJUIZO' : margem !== null && margem < minima ? 'ABAIXO_MINIMA' : margem !== null && margem < alvo - 0.0005 ? 'ABAIXO_ALVO' : 'NO_ALVO';
  // etapas do pagamento (antecipado/entrada e o resto), como o cliente vai pagar
  const pagamentos = condicao ? pagamentosDaCondicao(condicao, aPagar).filter(p => p.valor > 0) : [];
  const aVista = condicao?.forma === 'PIX' || condicao?.forma === 'DINHEIRO';
  const etapas = pagamentos.map((p, i) => ({
    rotulo: pagamentos.length > 1 && i === 0 ? (aVista ? 'Antecipado' : 'Entrada') : pagamentos.length > 1 && aVista ? 'Na conclusão e entrega'
      : p.forma === 'PRAZO' ? `A prazo ${p.parcelas}x` : p.forma === 'CREDITO' && (p.parcelas || 1) > 1 ? `Cartão ${p.parcelas}x` : 'No fechamento',
    forma: p.forma, valor: p.valor,
  }));
  return {
    tabela, descontoPrecos, totalItens, descontoForma, aPagar, descontoTotal: r2(descontoPrecos + descontoForma),
    descontoTotalPct: tabela > 0 ? Math.round(((descontoPrecos + descontoForma) / tabela) * 10000) / 10000 : 0,
    custo, taxa: r2(taxa), lucro, margem, nivel, semCusto, etapas,
    texto: condicao ? textoDaCondicao(condicao, totalItens) : null,
    /** Quanto o total a pagar precisaria ter para chegar no alvo (0 se já chega). */
    faltaParaAlvo: alvo < 1 && margem !== null && margem < alvo ? r2((custo + taxa) / (1 - alvo) - aPagar) : 0,
  };
};
