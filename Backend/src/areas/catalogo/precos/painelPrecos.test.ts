import { composicaoPreco, conferenciaTaxa, margemPct, situacoesPreco, PrecoItem } from './painelPrecos';
import { fatorTaxa } from '../../vendas/taxas/taxas';

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

  // Taxa embutida (10%): preço = custo × markup ÷ 0,9
  const taxa = { percentual: 10, fator: fatorTaxa(10) };
  const item: PrecoItem = { custoGerencial: 27.95, custoMedio: 27.95, ultimoCusto: 27.95, precoVarejo: 62.11, markupVarejo: 2 };
  const c = composicaoPreco(item, taxa)!;
  assert(c.semTaxa === 55.9 && c.esperado === 62.11 && c.valorTaxa === 6.21, 'composição: 27,95 × 2 = 55,90 + taxa 6,21 = 62,11');
  assert(conferenciaTaxa(item, taxa) === 'OK', 'preço com a taxa: ok');
  assert(conferenciaTaxa({ ...item, precoVarejo: 55.9 }, taxa) === 'SEM_TAXA', 'preço antigo, só o markup');
  assert(conferenciaTaxa({ ...item, precoVarejo: 65 }, taxa) === 'FORA_DO_MARKUP', 'preço à mão');
  assert(conferenciaTaxa({ ...item, precoVarejo: 55.9 }) === 'OK', 'sem taxa configurada: custo × markup é o certo');
  assert(conferenciaTaxa({ ...item, markupVarejo: null }, taxa) === null, 'sem markup não confere');
  assert(margemPct(item, taxa) === 45, 'margem líquida: (62,11 × 0,9 − 27,95) ÷ 62,11');
  assert(situacoesPreco({ ...item, precoVarejo: 55.9 }, taxa).join(',') === 'SEM_TAXA', 'situação do preço antigo');

  // Taxa registrada na faixa: mudar a taxa não muda o preço, mas acusa
  const calc1224 = { ...item, precoVarejo: 63.7, taxaEmbutida: 12.24 };
  const taxa1224 = { percentual: 12.24, fator: fatorTaxa(12.24) };
  assert(conferenciaTaxa(calc1224, taxa1224) === 'OK', 'mesma taxa: ok');
  assert(conferenciaTaxa(calc1224, { percentual: 13, fator: fatorTaxa(13) }) === 'TAXA_ANTIGA', 'taxa subiu depois do preço');
  assert(situacoesPreco(calc1224, { percentual: 13, fator: fatorTaxa(13) }).includes('TAXA_ANTIGA'), 'situação taxa mudou');
  assert(conferenciaTaxa({ ...item, precoVarejo: 55.9, taxaEmbutida: 0 }, taxa1224) === 'SEM_TAXA', 'registrado sem taxa');
  assert(conferenciaTaxa({ ...calc1224, taxaEmbutida: null }, { percentual: 13, fator: fatorTaxa(13) }) === 'FORA_DO_MARKUP', 'sem registro: taxa mudou vira fora do markup');

  // Preço redondo digitado à mão: o markup gravado com 2 casas não reproduz o centavo, mas o preço segue o markup
  const tubo: PrecoItem = { custoGerencial: 119, custoMedio: 119, ultimoCusto: 119, precoVarejo: 155, markupVarejo: 1.14 };
  assert(conferenciaTaxa(tubo, taxa1224) === 'OK', 'preço à mão com markup arredondado não é fora do markup');
  assert(conferenciaTaxa({ ...tubo, precoVarejo: 170 }, taxa1224) === 'FORA_DO_MARKUP', 'preço bem diferente continua acusado');
};

runPainelPrecosTests();
console.log('painelPrecos: ok');

