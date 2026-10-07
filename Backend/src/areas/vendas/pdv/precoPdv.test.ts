import { faixaParaQuantidade, resolverPrecoPdv, unidadePadraoPdv, UnidadeVendaPdv } from './precoPdv';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runPrecoPdvTests = (): void => {
  const un = (idUnidade: number, extra: Partial<UnidadeVendaPdv> = {}): UnidadeVendaPdv => ({
    idUnidade, sigla: `U${idUnidade}`, fator: 1, isBase: false, padraoPdv: false, permiteVenda: true, gtin: null, nomeExibicao: null, ...extra,
  });

  // Metro (base) e rolo de 150 m (padrão do PDV)
  const unidades = [un(1, { isBase: true, sigla: 'M' }), un(2, { sigla: 'RL', fator: 150, padraoPdv: true })];
  assert(unidadePadraoPdv(unidades)!.idUnidade === 2, 'Unidade marcada como padrão do PDV vence a base.');
  assert(unidadePadraoPdv([un(1, { isBase: true }), un(2)])!.idUnidade === 1, 'Sem padrão, usa a base.');
  assert(unidadePadraoPdv([un(1, { isBase: true, permiteVenda: false }), un(2)])!.idUnidade === 2, 'Unidade que não permite venda é ignorada.');

  const faixas = [
    { idUnidade: 1, tipoFaixa: 'VAREJO', ordem: 1, quantidadeMinima: 0, quantidadeMaxima: null, precoUnitario: 10 },
    { idUnidade: 1, tipoFaixa: 'ATACADO', ordem: 2, quantidadeMinima: 50, quantidadeMaxima: null, precoUnitario: 8 },
  ];
  assert(faixaParaQuantidade(faixas, 1, 10)!.precoUnitario === 10, 'Quantidade pequena usa varejo.');
  assert(faixaParaQuantidade(faixas, 1, 50)!.precoUnitario === 8, 'A partir da mínima do atacado, usa atacado.');

  const p1 = resolverPrecoPdv([un(1, { isBase: true })], faixas, 99);
  assert(p1.origem === 'FAIXA' && p1.preco === 10 && p1.temAtacado, 'Faixa de varejo define o preço de vitrine.');

  const p2 = resolverPrecoPdv(unidades, [], 12.5);
  assert(p2.origem === 'CADASTRO' && p2.preco === 1875, 'Sem faixa, preço do cadastro vezes o fator da unidade.');

  const p3 = resolverPrecoPdv([], [], null);
  assert(p3.origem === 'SEM_PRECO' && p3.preco === 0 && p3.unidade === null, 'Sem unidade e sem preço.');
};
