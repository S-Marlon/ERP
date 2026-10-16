// Trava de prejuízo: anúncio do ML não fica ativo vendendo com prejuízo (lucro abaixo de zero). Margem baixa pode;
// pagar para vender, não. Vale para o que o operador faz (publicar, reativar, mudar preço, ajuste, tipo ou frete
// grátis) e para a sincronização automática, que pausa no ML a linha que caiu em prejuízo (custo subiu, preço do ERP
// baixou, tarifa ou frete do ML mudou) e a reativa sozinha quando volta a dar lucro.
// Sem custo no ERP não dá para saber: não trava (o aviso "sem custo" já aparece no anúncio).

export const PREFIXO_TRAVA = 'Pausado por prejuízo';
/** Centavos de arredondamento não contam como prejuízo. */
const TOLERANCIA = 0.005;

const moeda = (v: number) => `R$ ${(Math.round((Number(v) + Number.EPSILON) * 100) / 100).toFixed(2).replace('.', ',')}`;

export const daPrejuizo = (l: { custo: number; lucro: number }) => l.custo > 0 && l.lucro < -TOLERANCIA;

export interface Prejuizo { preco: number; lucro: number; precoMinimo: number | null }

/** Texto do motivo (vai para a mensagem de erro e, na pausa automática, fica gravado na linha). */
export const textoPrejuizo = (sku: string, p: Prejuizo) =>
  `${sku}: a ${moeda(p.preco)} dá prejuízo de ${moeda(-p.lucro)} por venda`
  + (p.precoMinimo ? `; sem prejuízo a partir de ${moeda(p.precoMinimo)}` : '')
  + '. Suba o preço ou baixe o custo do envio (veja as Sugestões).';

export const pausaPor = (texto: string) => `${PREFIXO_TRAVA}. ${texto}`;
export const motivoDaPausa = (sku: string, p: Prejuizo) => pausaPor(textoPrejuizo(sku, p));
export const pausadoPelaTrava = (erro: string | null | undefined) => !!erro && erro.startsWith(PREFIXO_TRAVA);

/** Mensagem de recusa para o operador (uma ou várias linhas). */
export const recusaPorPrejuizo = (acao: string, linhas: string[]) =>
  `Trava de prejuízo: não dá para ${acao}. ${linhas.slice(0, 3).join(' ')}${linhas.length > 3 ? ` (e mais ${linhas.length - 3})` : ''}`;

export type AcaoTrava = 'PAUSAR' | 'REATIVAR' | 'MANTER';

/**
 * O que a sincronização faz com uma linha publicada. Pausa a ativa em prejuízo; reativa só a que a própria trava
 * pausou (a pausada pelo operador continua pausada) e só com estoque (sem estoque o ML não reativa).
 * `erro` é o que fica gravado na linha depois: o motivo enquanto a trava a segura, null quando libera.
 */
export const decidirTrava = (p: {
  status: string | null; linhaAtiva: boolean; erroAntes: string | null; estoque: number; prejuizo: string | null;
}): { acao: AcaoTrava; erro: string | null } => {
  const pelaTrava = pausadoPelaTrava(p.erroAntes);
  if (!p.linhaAtiva) return { acao: 'MANTER', erro: null };
  if (p.status === 'active' && p.prejuizo) return { acao: 'PAUSAR', erro: p.prejuizo };
  if (p.status === 'paused' && pelaTrava) {
    if (p.prejuizo) return { acao: 'MANTER', erro: p.prejuizo };
    return p.estoque > 0 ? { acao: 'REATIVAR', erro: null } : { acao: 'MANTER', erro: p.erroAntes };
  }
  return { acao: 'MANTER', erro: null };
};
