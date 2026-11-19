import assert from 'assert';
import {
  areaDaCategoria, avaliarDivergencia, Candidato, categoriaDoTopo, CONFIG_PADRAO, curvaAbc, escolherLista, motivoDoItem, saldoNaHora, validarConfig,
} from './inventarioRotativo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const hoje = '2026-11-19';
const cand = (x: Partial<Candidato>): Candidato => ({
  idItem: 1, grupo: 'a1', nome: 'Item', categoria: 'Cat', curva: 'C', saldo: 10, custoMedio: 1, custoGerencial: 1, ultimoCusto: 1,
  ultimaContagem: null, pedidaEm: null, pedidoMotivo: null, ...x,
});

teste('inventário: áreas pela categoria', () => {
  // 1 Hidráulica > 9 Terminais > 10 Prensáveis > 14 JIC ; 1 > 8 Óleos
  const pais = new Map<number, number | null>([[1, null], [9, 1], [10, 9], [14, 10], [8, 1], [2, null]]);
  const mapa = new Map([[9, 200], [8, 100]]);
  assert.strictEqual(areaDaCategoria(14, pais, mapa), 200);
  assert.strictEqual(areaDaCategoria(8, pais, mapa), 100);
  assert.strictEqual(areaDaCategoria(1, pais, mapa), null);
  assert.strictEqual(areaDaCategoria(null, pais, mapa), null);
  assert.strictEqual(categoriaDoTopo(14, pais), 1);
  assert.strictEqual(categoriaDoTopo(2, pais), 2);
  // laço no cadastro não trava
  assert.strictEqual(areaDaCategoria(5, new Map([[5, 6], [6, 5]]), mapa), null);
});

teste('inventário: curva ABC', () => {
  const c = curvaAbc(new Map([[1, 700], [2, 150], [3, 100], [4, 50]]), [1, 2, 3, 4, 5]);
  assert.deepStrictEqual([...c.entries()], [[1, 'A'], [2, 'A'], [3, 'B'], [4, 'C'], [5, 'C']]);   // o que cruza os 80% ainda é A
});

teste('inventário: por que o item entra', () => {
  assert.strictEqual(motivoDoItem(cand({ pedidaEm: '2026-11-18', pedidoMotivo: 'corda: rolo entrou como 1 m' }), hoje, CONFIG_PADRAO)?.motivo, 'PEDIDO');
  assert.strictEqual(motivoDoItem(cand({ saldo: -2, ultimaContagem: hoje }), hoje, CONFIG_PADRAO)?.detalhe, 'saldo negativo (-2)');
  assert.match(motivoDoItem(cand({ ultimoCusto: 206.82, custoGerencial: 0.8, ultimaContagem: '2026-11-01' }), hoje, CONFIG_PADRAO)!.detalhe!, /259x/);
  assert.deepStrictEqual(motivoDoItem(cand({ curva: 'A' }), hoje, CONFIG_PADRAO), { motivo: 'NUNCA_CONTADO', detalhe: 'curva A', peso: 300 });
  assert.strictEqual(motivoDoItem(cand({ curva: 'A', ultimaContagem: '2026-11-01' }), hoje, CONFIG_PADRAO), null);
  assert.strictEqual(motivoDoItem(cand({ curva: 'A', ultimaContagem: '2026-10-10' }), hoje, CONFIG_PADRAO)?.motivo, 'CURVA_A');
  assert.strictEqual(motivoDoItem(cand({ curva: 'C', ultimaContagem: '2026-10-10' }), hoje, CONFIG_PADRAO), null);
});

teste('inventário: lista do dia de um grupo só', () => {
  const c = (id: number, grupo: string, peso: number, nome: string, categoria = 'X') => ({ ...cand({ idItem: id, grupo, nome, categoria }), motivo: 'NUNCA_CONTADO' as const, detalhe: null, peso });
  const todos = [c(1, 'frente', 100, 'Óleo 2T'), c(2, 'frente', 100, 'Óleo 15W40'), c(3, 'fundo', 1000, 'Terminal JIC', 'B'), c(4, 'fundo', 100, 'Adaptador', 'A'), c(5, 'fundo', 300, 'Capa')];
  const r = escolherLista(todos, 2);
  assert.strictEqual(r.grupo, 'fundo');
  assert.deepStrictEqual(r.itens.map(i => i.idItem), [3, 5]);   // os 2 mais urgentes, em ordem de categoria (B antes de X)
  assert.deepStrictEqual(escolherLista(todos, 20, 'frente').itens.map(i => i.idItem), [2, 1]);
  assert.deepStrictEqual(escolherLista([], 20), { grupo: null, itens: [] });
});

teste('inventário: saldo na hora e divergência', () => {
  // contou às 9h; depois vendeu 3 e entrou 10 -> saldo de agora 17 era 10 na contagem
  assert.strictEqual(saldoNaHora(17, 10 - 3), 10);
  const cfg = CONFIG_PADRAO;
  assert.deepStrictEqual(avaliarDivergencia(10, 10, 5, cfg), { diferenca: 0, valor: 0, pct: 0, exigeSenha: false });
  assert.strictEqual(avaliarDivergencia(9, 10, 5, cfg).exigeSenha, false);          // 10%, R$ 5
  assert.strictEqual(avaliarDivergencia(5, 10, 5, cfg).exigeSenha, true);           // 50% com R$ 25 (acima de R$ 10)
  assert.strictEqual(avaliarDivergencia(1, 2, 0.5, cfg).exigeSenha, false);         // 50% mas só R$ 0,50
  assert.strictEqual(avaliarDivergencia(40, 280, 0.85, cfg).exigeSenha, true);      // corda: faltam 240 m = R$ 204
  assert.strictEqual(avaliarDivergencia(3, 0, 20, cfg).exigeSenha, true);           // apareceu do nada R$ 60
});

teste('inventário: configuração', () => {
  assert.deepStrictEqual(validarConfig({ ...CONFIG_PADRAO, itensPorDia: '25' }).itensPorDia, 25);
  assert.throws(() => validarConfig({ ...CONFIG_PADRAO, itensPorDia: 0 }), /Itens por lista/);
  assert.throws(() => validarConfig({ ...CONFIG_PADRAO, limiteDivergenciaPct: 2 }), /%/);
});
