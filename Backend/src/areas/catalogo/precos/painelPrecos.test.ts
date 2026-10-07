import { margemPct, situacoesPreco, PrecoItem } from './painelPrecos';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(`painelPrecos: ${msg}`); };
const base: PrecoItem = { custoGerencial: 10, custoMedio: 10, ultimoCusto: 10, precoVarejo: 18 };
const sit = (p: Partial<PrecoItem>) => situacoesPreco({ ...base, ...p }).join(',');

export const runPainelPrecosTests = () => {
  assert(margemPct(base) === 44.44, 'margem sobre o preço');
  assert(margemPct({ ...base, precoVarejo: 0 }) === null && margemPct({ ...base, custoGerencial: null }) === null, 'margem sem preço/custo');
  assert(sit({}) === '', 'item saudável');
  assert(sit({ precoVarejo: null }) === 'SEM_PRECO', 'sem preço');
  assert(sit({ custoGerencial: null, custoMedio: null, ultimoCusto: null }) === 'SEM_CUSTO', 'sem custo e sem entrada');
  assert(sit({ custoGerencial: null }) === 'SEM_CUSTO', 'sem custo (com entrada não acusa defasado em dobro)');
  assert(sit({ ultimoCusto: 12 }) === 'CUSTO_DEFASADO', 'último custo subiu');
  assert(sit({ precoVarejo: 9 }) === 'MARGEM_NEGATIVA', 'vende abaixo do custo');
  assert(sit({ precoVarejo: 11 }) === 'MARGEM_BAIXA', 'margem de 9% é baixa');
  assert(sit({ precoVarejo: 11.8 }) === '', 'margem de 15,25% está ok');
};
