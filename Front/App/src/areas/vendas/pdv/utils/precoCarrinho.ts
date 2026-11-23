// Preço do carrinho por unidade e quantidade (mesma regra do backend: Venda/pdv/precoPdv.ts).

export interface FaixaCarrinho {
  idUnidade: number;
  tipoFaixa: string;             // VAREJO, ATACADO
  ordem: number;
  quantidadeMinima: number;
  quantidadeMaxima: number | null;
  precoUnitario: number;
}

export interface UnidadeCarrinho {
  idUnidade: number;
  sigla: string;
  fator: number;                 // unidade -> base
  isBase: boolean;
  padraoPdv: boolean;
  nomeExibicao: string | null;
  gtin: string | null;
  preco: number;                 // preço de 1 unidade (varejo ou cadastro x fator)
  estoque: number;               // saldo convertido para esta unidade
  faixas: FaixaCarrinho[];
}

// Faixa que vale para a quantidade: a de maior mínima que a quantidade alcança
export const faixaVigente = (unidade: UnidadeCarrinho, quantidade: number): FaixaCarrinho | null =>
  unidade.faixas
    .filter(f => quantidade >= f.quantidadeMinima && (f.quantidadeMaxima === null || quantidade <= f.quantidadeMaxima))
    .sort((a, b) => b.quantidadeMinima - a.quantidadeMinima || a.ordem - b.ordem)[0] || null;

/**
 * Preço de tabela da linha. O atacado só vale quando o operador aplicou (`comAtacado`): a quantidade alcançar a faixa
 * não muda o preço sozinha, o carrinho oferece o botão "aplicar atacado".
 */
export const precoTabelaCarrinho = (unidade: UnidadeCarrinho, quantidade: number, comAtacado = true): number => {
  const u = comAtacado ? unidade : { ...unidade, faixas: unidade.faixas.filter(f => f.tipoFaixa !== 'ATACADO') };
  const faixa = faixaVigente(u, Math.max(quantidade, 0) || 1);
  return faixa && faixa.precoUnitario > 0 ? faixa.precoUnitario : unidade.preco;
};

/** Atacado que a quantidade já alcança e ainda não foi aplicado (preço menor que o de varejo); null se não houver. */
export const atacadoDisponivel = (unidade: UnidadeCarrinho, quantidade: number, aplicado: boolean): number | null => {
  if (aplicado || !emAtacado(unidade, quantidade)) return null;
  const preco = precoTabelaCarrinho(unidade, quantidade, true);
  return preco < precoTabelaCarrinho(unidade, quantidade, false) - 0.00005 ? preco : null;
};

// Próxima faixa mais barata ainda não alcançada (para sugerir "leve X e pague Y")
export const proximaFaixa = (unidade: UnidadeCarrinho, quantidade: number): FaixaCarrinho | null => {
  const atual = precoTabelaCarrinho(unidade, quantidade);
  return unidade.faixas
    .filter(f => f.quantidadeMinima > quantidade && f.precoUnitario > 0 && f.precoUnitario < atual)
    .sort((a, b) => a.quantidadeMinima - b.quantidadeMinima)[0] || null;
};

export const emAtacado = (unidade: UnidadeCarrinho, quantidade: number): boolean =>
  faixaVigente(unidade, quantidade)?.tipoFaixa === 'ATACADO';

// Unidades que aceitam quantidade fracionada (metro, litro, quilo)
const FRACIONAVEIS = ['M', 'MT', 'MTS', 'L', 'LT', 'KG', 'G', 'ML', 'CM', 'M2', 'M3'];
export const podeFracionar = (sigla?: string | null): boolean => FRACIONAVEIS.includes(String(sigla || '').toUpperCase());
