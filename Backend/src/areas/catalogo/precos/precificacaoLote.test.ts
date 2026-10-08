import { ErroLote, FaixaAtual, planejarItem } from './precificacaoLote';
import { fatorTaxa } from '../../vendas/taxas/taxas';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`precificacaoLote: ${msg}`); };
const f = fatorTaxa(12.24); // 1,139471...

// Item: custo 27,95; varejo UN (base, markup 2) = 63,70; atacado UN ≥10 (markup 1,8); CX com 10 (markup 1,9)
const faixas: FaixaAtual[] = [
  { idFaixa: 1, tipo: 'VAREJO', ordem: 1, fator: 1, markup: 2, preco: 63.7, ehBase: true, padraoPdv: true },
  { idFaixa: 2, tipo: 'ATACADO', ordem: 2, fator: 1, markup: 1.8, preco: 57.33, ehBase: true, padraoPdv: true },
  { idFaixa: 3, tipo: 'VAREJO', ordem: 1, fator: 10, markup: 1.9, preco: 605.13, ehBase: false, padraoPdv: false },
];

// Só markup novo: muda o varejo base; atacado e caixa ficam como estão
const m = planejarItem(27.95, faixas, { idItem: 1, markup: 2.2 }, f);
ok(!m.custoMudou && m.faixas.length === 1 && m.faixas[0].idFaixa === 1, 'markup mexe só no varejo base');
ok(m.faixas[0].markup === 2.2 && m.faixas[0].preco === 70.07, 'preço pelo markup com a taxa: 27,95 × 2,2 ÷ 0,8776');
ok(m.referencia?.preco === 70.07, 'referência acompanha o varejo do PDV');
console.log('markup: ok');

// Preço digitado: markup derivado (4 casas) e preço exatamente o digitado
const p = planejarItem(27.95, faixas, { idItem: 1, preco: 69.9 }, f);
ok(p.faixas[0].preco === 69.9 && Math.abs(p.faixas[0].markup - 69.9 / (27.95 * f)) < 0.0001, 'preço digitado vira markup');
console.log('preço: ok');

// Custo novo: todas as faixas recalculadas com o markup de cada uma
const c = planejarItem(27.95, faixas, { idItem: 1, custo: 30 }, f);
ok(c.custoMudou && c.novoCusto === 30 && c.faixas.length === 3, 'custo novo recalcula tudo');
ok(c.faixas.find(x => x.idFaixa === 3)!.preco === Math.round(30 * 10 * 1.9 * f * 100) / 100, 'caixa: custo × fator × markup + taxa');
ok(c.faixas.find(x => x.idFaixa === 1)!.markup === 2, 'markup mantido quando só o custo muda');
console.log('custo: ok');

// Nada muda: nenhuma faixa
ok(planejarItem(27.95, faixas, { idItem: 1, markup: 2 }, f).faixas.length === 0, 'mesmo markup e custo: nada a gravar');

// Item sem preço: cria o varejo base
const novo = planejarItem(10, [], { idItem: 2, markup: 1.8 }, f);
ok(novo.criarVarejoBase?.markup === 1.8 && novo.criarVarejoBase?.preco === Math.round(10 * 1.8 * f * 100) / 100, 'cria o varejo base');
ok(novo.referencia?.preco === novo.criarVarejoBase?.preco, 'referência do item novo');

// Erros
let erro = '';
try { planejarItem(null, [], { idItem: 3, markup: 2 }, f); } catch (e) { erro = e instanceof ErroLote ? e.message : ''; }
ok(erro.includes('custo'), 'sem custo: pede o custo');
erro = '';
try { planejarItem(10, [], { idItem: 3 }, f); } catch (e) { erro = e instanceof ErroLote ? e.message : ''; }
ok(erro.includes('markup'), 'sem preço e sem markup: pede um dos dois');
console.log('casos: ok');
