import { intervaloPeriodo, margemLiquidaPct, preencherSerie, variacaoPct } from './painelVendas';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const hoje = new Date(2026, 9, 3, 15, 30); // 03/10/2026

let i = intervaloPeriodo('hoje', hoje);
assert(i.de === '2026-10-03' && i.ate === '2026-10-03' && i.anteriorDe === '2026-10-02' && i.agrupamento === 'hora', `hoje ${JSON.stringify(i)}`);
i = intervaloPeriodo('ontem', hoje);
assert(i.de === '2026-10-02' && i.anteriorAte === '2026-10-01', 'ontem');
i = intervaloPeriodo('7dias', hoje);
assert(i.de === '2026-09-27' && i.ate === '2026-10-03' && i.dias === 7 && i.anteriorDe === '2026-09-20' && i.anteriorAte === '2026-09-26' && i.agrupamento === 'dia', `7 dias ${JSON.stringify(i)}`);
i = intervaloPeriodo('mes', hoje);
assert(i.de === '2026-10-01' && i.anteriorDe === '2026-09-01' && i.anteriorAte === '2026-09-03', `mês ${JSON.stringify(i)}`);
// 31 de março compara com 1 a 28 de fevereiro (último dia do mês anterior)
i = intervaloPeriodo('mes', new Date(2026, 2, 31));
assert(i.anteriorDe === '2026-02-01' && i.anteriorAte === '2026-02-28', `mês curto ${JSON.stringify(i)}`);
i = intervaloPeriodo('personalizado', hoje, '2026-09-10', '2026-09-01');
assert(i.de === '2026-09-01' && i.ate === '2026-09-10' && i.dias === 10, 'personalizado invertido');
assert(intervaloPeriodo('personalizado', hoje, 'x', null).de === '2026-10-03', 'personalizado inválido = hoje');

assert(variacaoPct(120, 100) === 20 && variacaoPct(80, 100) === -20 && variacaoPct(10, 0) === null, 'variação');
assert(margemLiquidaPct(100, 60, 5) === 35 && margemLiquidaPct(0, 1, 1) === null, 'margem líquida');

// Série por hora: 7h a 20h, estendendo se houver venda fora
let s = preencherSerie([{ chave: '9', total: 50, qtd: 2 }, { chave: '22', total: 10, qtd: 1 }], intervaloPeriodo('hoje', hoje));
assert(s[0].rotulo === '07h' && s[s.length - 1].rotulo === '22h' && s.find(p => p.chave === '9')!.total === 50 && s.find(p => p.chave === '8')!.total === 0, 'série por hora');
// Série por dia com zeros
s = preencherSerie([{ chave: '2026-09-29', total: 30, qtd: 1 }], intervaloPeriodo('7dias', hoje));
assert(s.length === 7 && s[2].total === 30 && s[2].rotulo === '29/09' && s[0].total === 0, `série por dia ${JSON.stringify(s)}`);

console.log('painelVendas: ok');
