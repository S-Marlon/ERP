import { lerIds, motivosBloqueio, USO_VAZIO } from './exclusaoItens';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`exclusaoItens: ${msg}`); };

ok(motivosBloqueio(USO_VAZIO).length === 0, 'sem histórico: pode apagar');
ok(motivosBloqueio({ ...USO_VAZIO, notasEntrada: 2 })[0] === 'tem nota de entrada (2)', 'nota de entrada bloqueia');
ok(motivosBloqueio({ ...USO_VAZIO, saldo: 0.00001 }).length === 0, 'saldo zerado (arredondamento) não bloqueia');
ok(motivosBloqueio({ ...USO_VAZIO, saldo: -3 })[0].includes('saldo'), 'saldo negativo bloqueia');
ok(motivosBloqueio({ ...USO_VAZIO, movimentos: 1, vendas: 1, devolucoes: 1, ordensServico: 1, composicoes: 1, unificacoes: 1, correcoes: 1 }).length === 7, 'cada uso vira um motivo');
console.log('motivos: ok');

ok(lerIds([3, '3', 'x', -1, 0, 7.5, 9]).join(',') === '3,9', 'ids válidos e sem repetição');
ok(lerIds('4,5,,4').join(',') === '4,5', 'ids em texto');
ok(lerIds(Array.from({ length: 600 }, (_, i) => i + 1)).length === 500, 'até 500');
console.log('ids: ok');
