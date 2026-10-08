import { taxaParaGravar } from './taxaEmbutida';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`taxaEmbutida: ${msg}`); };

// Faixas gravadas antes: varejo calculado com 12,24%; atacado sem registro (preço antigo)
const anteriores = [
  { sigla: 'UN', tipo: 'VAREJO', ordem: 1, preco: 63.7, taxa: 12.24 },
  { sigla: 'UN', tipo: 'ATACADO', ordem: 2, preco: 58, taxa: null },
];
ok(taxaParaGravar({ sigla: 'UN', tipo: 'VAREJO', ordem: 1, preco: 63.7 }, anteriores, 13) === 12.24, 'preço igual mantém a taxa com que foi calculado');
ok(taxaParaGravar({ sigla: 'UN', tipo: 'ATACADO', ordem: 2, preco: 58 }, anteriores, 13) === null, 'preço antigo sem registro continua sem registro');
ok(taxaParaGravar({ sigla: 'UN', tipo: 'VAREJO', ordem: 1, preco: 64.33 }, anteriores, 13) === 13, 'preço recalculado leva a taxa atual');
ok(taxaParaGravar({ sigla: 'CX', tipo: 'VAREJO', ordem: 1, preco: 600 }, anteriores, 13) === 13, 'faixa nova leva a taxa atual');
console.log('taxaEmbutida: ok');
