// Correção de uma linha de NF já aprovada (vínculo ou conversão errados).
// Plano puro: a partir dos movimentos que a linha deixou no estoque, o que estornar e o que lançar no item certo.
import { Deposito, depositoPorTipoRecurso, ehDeposito } from '../../EstoqueItens/depositos';
import { depositosPermitidos } from './destinos';

export const ORIGEM_CORRECAO_ENTRADA = 'CORRECAO_NFE_ENTRADA';
export const ORIGEM_CORRECAO_ESTORNO = 'CORRECAO_NFE_ESTORNO';

export interface MovimentoDaLinha {
  idItem: number;
  deposito: string;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;             // unidade base do item
  quantidadeDocumento: number;    // unidade da NF
  custoTotal: number;
}

export interface PosicaoLinha {
  idItem: number;
  deposito: Deposito;
  quantidade: number;
  quantidadeDocumento: number;
  custoUnitario: number;          // por unidade base
}

const arred = (v: number, casas = 4) => Number(v.toFixed(casas));

/** O que a linha tem hoje no estoque: soma das entradas menos os estornos, por item e depósito. */
export const posicaoAtualDaLinha = (movimentos: MovimentoDaLinha[]): PosicaoLinha[] => {
  const mapa = new Map<string, { idItem: number; deposito: Deposito; q: number; qd: number; custo: number }>();
  for (const m of movimentos) {
    if (!ehDeposito(m.deposito)) continue;
    const chave = `${m.idItem}|${m.deposito}`;
    const atual = mapa.get(chave) || { idItem: m.idItem, deposito: m.deposito.toUpperCase() as Deposito, q: 0, qd: 0, custo: 0 };
    const sinal = m.tipo === 'ENTRADA' ? 1 : -1;
    atual.q += sinal * (Number(m.quantidade) || 0);
    atual.qd += sinal * (Number(m.quantidadeDocumento) || 0);
    atual.custo += sinal * (Number(m.custoTotal) || 0);
    mapa.set(chave, atual);
  }
  return [...mapa.values()]
    .filter(p => p.q > 0.0001)
    .map(p => ({
      idItem: p.idItem,
      deposito: p.deposito,
      quantidade: arred(p.q),
      quantidadeDocumento: arred(p.qd),
      custoUnitario: arred(p.custo / p.q, 6),
    }));
};

export interface PlanoCorrecao {
  estornos: PosicaoLinha[];
  entradas: PosicaoLinha[];
}

/**
 * Plano: estorna tudo o que a linha tem hoje e lança no item certo, com o fator novo e o custo da nota.
 * Depósito: item de venda mantém a divisão venda/almoxarifado; consumo/ativo vão inteiros para o depósito do tipo.
 */
export const planejarCorrecao = (
  atual: PosicaoLinha[],
  itemNovo: { idItem: number; tipoRecurso: string | null },
  fatorNovo: number,
  custoUnitarioDocumento: number   // custo final da NF por unidade da NF (frete/IPI já rateados)
): PlanoCorrecao => {
  if (!(fatorNovo > 0)) throw new Error('Fator de conversão precisa ser maior que zero.');
  const permitidos = depositosPermitidos(itemNovo.tipoRecurso);
  const padrao = depositoPorTipoRecurso(itemNovo.tipoRecurso);
  const porDeposito = new Map<Deposito, number>();
  for (const p of atual) {
    const destino = permitidos.includes(p.deposito) ? p.deposito : padrao;
    porDeposito.set(destino, (porDeposito.get(destino) || 0) + p.quantidadeDocumento);
  }
  const entradas = [...porDeposito.entries()]
    .filter(([, qd]) => qd > 0.0001)
    .map(([deposito, qd]) => ({
      idItem: itemNovo.idItem,
      deposito,
      quantidade: arred(qd * fatorNovo),
      quantidadeDocumento: arred(qd),
      custoUnitario: arred(custoUnitarioDocumento / fatorNovo, 6),
    }));
  return { estornos: atual, entradas };
};
