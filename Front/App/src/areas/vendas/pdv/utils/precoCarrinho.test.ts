import { emAtacado, podeFracionar, precoTabelaCarrinho, proximaFaixa, UnidadeCarrinho } from './precoCarrinho';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runPrecoCarrinhoTests = (): void => {
  // Rolamento: varejo 13,275 até 9 peças, atacado 9,2925 a partir de 10 (dado real do item 50)
  const pc: UnidadeCarrinho = {
    idUnidade: 2, sigla: 'PC', fator: 1, isBase: true, padraoPdv: false, nomeExibicao: 'PC', gtin: null, preco: 13.275, estoque: 4,
    faixas: [
      { idUnidade: 2, tipoFaixa: 'VAREJO', ordem: 1, quantidadeMinima: 0, quantidadeMaxima: 9, precoUnitario: 13.275 },
      { idUnidade: 2, tipoFaixa: 'ATACADO', ordem: 2, quantidadeMinima: 10, quantidadeMaxima: null, precoUnitario: 9.2925 },
    ],
  };
  assert(precoTabelaCarrinho(pc, 1) === 13.275, 'Uma peça no varejo.');
  assert(precoTabelaCarrinho(pc, 10) === 9.2925 && emAtacado(pc, 10), 'Dez peças entram no atacado.');
  assert(precoTabelaCarrinho(pc, 0) === 13.275, 'Quantidade zero mostra o preço de uma unidade.');
  assert(proximaFaixa(pc, 3)?.quantidadeMinima === 10, 'Sugere o atacado a partir de 10.');
  assert(proximaFaixa(pc, 10) === null, 'Já no atacado, sem sugestão.');

  const semFaixa: UnidadeCarrinho = { ...pc, preco: 20, faixas: [] };
  assert(precoTabelaCarrinho(semFaixa, 5) === 20 && !emAtacado(semFaixa, 5), 'Sem faixa, usa o preço da unidade.');

  assert(podeFracionar('m') && podeFracionar('KG') && !podeFracionar('PC') && !podeFracionar(undefined), 'Fraciona metro e quilo, não peça.');
};
