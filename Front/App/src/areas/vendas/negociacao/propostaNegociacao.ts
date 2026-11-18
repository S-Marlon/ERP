// Proposta comercial do orçamento de negociação (o que o cliente vê): itens por categoria, preço por unidade base
// (R$/L, R$/kg, R$/m quando a embalagem tem várias), faixas por quantidade, condição de pagamento, validade, vendedor e
// código do cliente. Custo e margem nunca entram. Puro (sem tela), com teste; a impressão e o PDF usam estas linhas.
import type { PedidoAbertoDetalhe } from '../pdv/services/pedidosAbertosApi';

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export interface ItemProposta {
  /** Posição do item no orçamento. */
  indice: number;
  codigo: string; descricao: string; embalagem: string; quantidade: string; valorBase: string | null; valorUnitario: string; total: string;
  /** "A partir de 10 CX: R$ 90,00 (R$ 3,75/L)" */
  faixas: string[];
}
export interface SecaoProposta { titulo: string; itens: ItemProposta[] }

/** Embalagem como o cliente entende: "CX (24 L)" quando a unidade tem várias da base; senão só a sigla. */
export const embalagem = (sigla: string | null | undefined, fator: number | undefined, siglaBase: string | null | undefined) =>
  `${sigla || ''}${fator && fator !== 1 && siglaBase ? ` (${qtd(fator)} ${siglaBase})` : ''}`.trim();

/** Preço por unidade base (R$/L) só quando a embalagem tem mais de uma base. */
export const precoPorBase = (preco: number, fator: number | undefined, siglaBase: string | null | undefined) =>
  (fator && fator !== 1 && siglaBase ? `${brl(preco / fator)}/${siglaBase}` : null);

/** Itens agrupados por categoria, na ordem em que aparecem (sem categoria fica por último). */
export const secoesDaProposta = (o: Pick<PedidoAbertoDetalhe, 'itens'>): SecaoProposta[] => {
  const mapa = new Map<string, SecaoProposta>();
  for (const [indice, i] of o.itens.entries()) {
    const titulo = (i.categoria || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Outros itens';
    if (!mapa.has(titulo)) mapa.set(titulo, { titulo, itens: [] });
    mapa.get(titulo)!.itens.push({
      indice, codigo: i.sku, descricao: i.nome, embalagem: embalagem(i.unidade, i.fator, i.siglaBase), quantidade: qtd(i.quantidade),
      valorBase: precoPorBase(i.precoUnitario, i.fator, i.siglaBase), valorUnitario: brl(i.precoUnitario), total: brl(i.total),
      faixas: (i.faixas || []).map(f => `A partir de ${qtd(f.quantidadeMinima)} ${i.unidade || ''}: ${brl(f.precoUnitario)}`
        + `${precoPorBase(f.precoUnitario, i.fator, i.siglaBase) ? ` (${precoPorBase(f.precoUnitario, i.fator, i.siglaBase)})` : ''}`),
    });
  }
  const lista = [...mapa.values()];
  return [...lista.filter(x => x.titulo !== 'Outros itens'), ...lista.filter(x => x.titulo === 'Outros itens')];
};

/** Código do cliente no cabeçalho (como "C43835" da proposta do fornecedor). */
export const codigoCliente = (idCliente: number | null | undefined) => (idCliente ? `C${String(idCliente).padStart(5, '0')}` : null);
