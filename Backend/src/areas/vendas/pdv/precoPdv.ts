// Regras de preço do PDV no modelo novo (comercial_unidades_venda + comercial_precos_faixas).

export interface UnidadeVendaPdv {
  idUnidade: number;
  sigla: string;
  fator: number;          // unidade de venda -> base
  isBase: boolean;
  padraoPdv: boolean;
  permiteVenda: boolean;
  gtin: string | null;
  nomeExibicao: string | null;
}

export interface FaixaPdv {
  idUnidade: number;
  tipoFaixa: string;      // VAREJO, ATACADO
  ordem: number;
  quantidadeMinima: number;
  quantidadeMaxima: number | null;
  precoUnitario: number;
}

export interface PrecoPdv {
  unidade: UnidadeVendaPdv | null;
  preco: number;
  origem: 'FAIXA' | 'CADASTRO' | 'SEM_PRECO';
  temAtacado: boolean;
}

// Unidade sugerida: a marcada como padrão do PDV; senão a base; senão a primeira que permite venda
// (idUnidadePreferida: ex. a embalagem cujo GTIN foi bipado)
export const unidadePadraoPdv = (unidades: UnidadeVendaPdv[], idUnidadePreferida?: number | null): UnidadeVendaPdv | null => {
  const vendaveis = unidades.filter(u => u.permiteVenda);
  return vendaveis.find(u => u.idUnidade === idUnidadePreferida)
    || vendaveis.find(u => u.padraoPdv) || vendaveis.find(u => u.isBase) || vendaveis[0] || null;
};

// Faixa que vale para a quantidade (na unidade de venda). Sem faixa aplicável = null.
export const faixaParaQuantidade = (faixas: FaixaPdv[], idUnidade: number, quantidade: number): FaixaPdv | null => {
  const candidatas = faixas
    .filter(f => f.idUnidade === idUnidade)
    .filter(f => quantidade >= f.quantidadeMinima && (f.quantidadeMaxima === null || quantidade <= f.quantidadeMaxima))
    // Mais específica primeiro: maior quantidade mínima (atacado vence varejo)
    .sort((a, b) => b.quantidadeMinima - a.quantidadeMinima || a.ordem - b.ordem);
  return candidatas[0] || null;
};

/**
 * Preço de vitrine do PDV (1 unidade da unidade padrão).
 * Prioridade: faixa da unidade padrão -> preço de venda do cadastro (convertido pelo fator) -> sem preço.
 */
export const resolverPrecoPdv = (
  unidades: UnidadeVendaPdv[],
  faixas: FaixaPdv[],
  precoCadastro: number | null,
  idUnidadePreferida?: number | null
): PrecoPdv => {
  const unidade = unidadePadraoPdv(unidades, idUnidadePreferida);
  const temAtacado = faixas.some(f => f.tipoFaixa === 'ATACADO');
  if (unidade) {
    const faixa = faixaParaQuantidade(faixas, unidade.idUnidade, 1);
    if (faixa && faixa.precoUnitario > 0) return { unidade, preco: faixa.precoUnitario, origem: 'FAIXA', temAtacado };
  }
  if (precoCadastro && precoCadastro > 0) {
    const fator = unidade?.fator || 1;
    return { unidade, preco: Number((precoCadastro * fator).toFixed(4)), origem: 'CADASTRO', temAtacado };
  }
  return { unidade, preco: 0, origem: 'SEM_PRECO', temAtacado };
};
