import { analisarDefasagem, calcularPrecoUnidade, margemLiquida, recalcularFaixas } from './precificacao';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runPrecificacaoTests = (): void => {
  // Taxa embutida: custo 50 x markup 2 com 5% de taxa = 105,26 (recebe 100 depois da taxa)
  assert(calcularPrecoUnidade(50, 1, 2, 1 / 0.95) === 105.26, 'preço com taxa embutida');
  assert(calcularPrecoUnidade(50, 1, 2) === 100, 'sem taxa (padrão) não muda');
  assert(margemLiquida(105.26, 50, 5) === 47.5, `margem líquida ${margemLiquida(105.26, 50, 5)}`);
  assert(margemLiquida(0, 50, 5) === null, 'sem preço');
  assert(calcularPrecoUnidade(0.15, 150, 1.8) === 40.5, 'Rolo de 150m a 0,15/m com markup 1,8 deveria custar 40,50.');
  assert(calcularPrecoUnidade(0.15, 1, 2.2) === 0.33, 'Metro com markup 2,2 deveria custar 0,33.');

  const ok = analisarDefasagem(10, 10.02, 10.03);
  assert(!ok.defasado, 'Variação abaixo de 0,5% não deveria marcar defasagem.');

  const subiu = analisarDefasagem(10, 10.5, 11);
  assert(subiu.defasado && subiu.variacaoUltimoPct === 10 && subiu.variacaoMedioPct === 5, 'Custo novo 10% acima deveria marcar defasagem.');

  assert(analisarDefasagem(null, 5, 5).defasado, 'Sem custo gerencial e com custo de entrada deveria pedir definição.');
  assert(!analisarDefasagem(null, null, null).defasado, 'Item sem custo algum não está defasado.');

  const faixas = recalcularFaixas(
    [{ sigla: 'MT', markup: 2, preco_unitario: 0 }, { sigla: 'RL', markup: 1.5, preco_unitario: 0 }],
    0.2,
    new Map([['MT', 1], ['RL', 150]])
  );
  assert(faixas[0].preco_unitario === 0.4 && faixas[1].preco_unitario === 45, 'Faixas deveriam ser recalculadas com o novo custo mantendo o markup.');
};
