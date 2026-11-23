import assert from 'assert';
import {
  diasEntre, nivelDoPrazo, ordenarTarefas, semAdiadas, tarefasCaixa, tarefasCurva, tarefasInventario, tarefasNotas, tarefasOrcamentos,
  tarefasPagar, tarefasPedidos, tarefasPrecos,
} from './tarefasDoDia';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const HOJE = '2026-11-23';

teste('datas e prazo', () => {
  assert.strictEqual(diasEntre('2026-11-20', HOJE), 3);
  assert.strictEqual(nivelDoPrazo('2026-11-22', HOJE), 'URGENTE');
  assert.strictEqual(nivelDoPrazo(HOJE, HOJE), 'HOJE');
  assert.strictEqual(nivelDoPrazo('2026-11-30', HOJE), 'SEMANA');
  assert.strictEqual(nivelDoPrazo('2026-12-05', HOJE), null);
});

teste('nota começada: de hoje é hoje, antiga é atrasada', () => {
  const t = tarefasNotas([{ id: 7, numero: '1543', fornecedor: 'IMDEPA', criadaEm: '2026-11-20', valor: 850 }, { id: 8, numero: null, fornecedor: null, criadaEm: HOJE, valor: 0 }], HOJE);
  assert.strictEqual(t[0].nivel, 'URGENTE');
  assert.ok(t[0].titulo.includes('NF 1543 · IMDEPA') && t[0].detalhe!.includes('há 3 dias') && t[0].rota === '/compras/entrada-nfe?lote=7');
  assert.strictEqual(t[1].nivel, 'HOJE');
  assert.ok(t[1].titulo.includes('(lote 8)'));
});

teste('inventário: listas abertas e a de hoje', () => {
  const t = tarefasInventario([{ id: 2, area: 'Hidráulica', itens: 20, criadaEm: '2026-11-19' }], false, true, HOJE);
  assert.deepStrictEqual(t.map(x => [x.chave, x.nivel]), [['INVENTARIO:2', 'URGENTE'], [`INVENTARIO_HOJE:${HOJE}`, 'HOJE']]);
  assert.strictEqual(tarefasInventario([], true, true, HOJE).length, 0);    // já gerou hoje
  assert.strictEqual(tarefasInventario([], false, false, HOJE).length, 0);  // domingo
});

teste('caixa de outro dia, contas, pedidos, orçamentos', () => {
  assert.strictEqual(tarefasCaixa([{ id: 1, operador: 'ADM', abertoEm: '2026-11-22 08:00' }, { id: 2, operador: null, abertoEm: `${HOJE} 08:00` }], HOJE).length, 1);
  const vazio = { quantidade: 0, valor: 0, exemplos: [] };
  const p = tarefasPagar({ quantidade: 2, valor: 300, exemplos: ['Luz', 'Água', 'x', 'y'] }, vazio, { quantidade: 1, valor: 50, exemplos: [] });
  assert.deepStrictEqual(p.map(x => x.nivel), ['URGENTE', 'SEMANA']);
  assert.strictEqual(p[0].exemplos!.length, 3);
  const ped = tarefasPedidos([{ id: 122, cliente: 'Fazenda', previsao: '2026-11-21', boletosFaltando: 2, total: 500 }, { id: 123, cliente: 'X', previsao: '2026-11-28', boletosFaltando: 0, total: 1 }], HOJE);
  assert.deepStrictEqual(ped.map(x => [x.chave, x.nivel]), [['PEDIDO_ENTREGA:122', 'URGENTE'], ['PEDIDO_BOLETO:122', 'HOJE']]);
  const o = tarefasOrcamentos([
    { id: 96, cliente: 'Ana', validade: '2026-11-24', total: 100, status: 'ORCAMENTO', criadoEm: '2026-11-10' },
    { id: 97, cliente: 'Bia', validade: '2026-12-10', total: 100, status: 'ORCAMENTO', criadoEm: '2026-11-10' },
    { id: 98, cliente: 'Caio', validade: null, total: 40, status: 'SUSPENSA', criadoEm: '2026-11-21' },
  ], HOJE);
  assert.deepStrictEqual(o.map(x => [x.chave, x.nivel]), [['ORCAMENTO:96', 'SEMANA'], ['SUSPENSA:98', 'HOJE']]);
  assert.ok(o[0].detalhe!.includes('amanhã'));
});

teste('preços e curva ABC', () => {
  assert.deepStrictEqual(tarefasPrecos({ SEM_PRECO: 3, MARGEM_NEGATIVA: 0, CUSTO_DEFASADO: 107 }).map(x => x.chave), ['PRECO_SEM', 'PRECO_CUSTO']);
  const item = (x: any) => ({ nome: 'Item', venda: 'C', situacao: 'NORMAL', estoque: 1, valorEstoque: 10, lucro: 1, margem: 0.3, lucroClasse: 'B', decisaoCompra: null, ...x });
  const c = tarefasCurva([
    item({ nome: 'Bomba A', venda: 'A', estoque: 0 }),
    item({ nome: 'Cabo', venda: 'A', margem: 0.1 }),
    ...Array.from({ length: 12 }, (_, k) => item({ nome: `Parado ${k}`, situacao: 'PARADO', valorEstoque: 100 + k })),
    item({ nome: 'Tetis', decisaoCompra: 'NAO_RECOMPRAR', estoque: 4, valorEstoque: 2000 }),
  ]);
  assert.deepStrictEqual(c.map(x => x.chave), ['CURVA_A_ZERADA', 'CURVA_LUCRA_POUCO', 'CURVA_PROMOCAO', 'CURVA_ESCOAR']);
  const promo = c.find(x => x.chave === 'CURVA_PROMOCAO')!;
  assert.strictEqual(promo.quantidade, 10);
  assert.deepStrictEqual(promo.exemplos, ['Parado 11', 'Parado 10', 'Parado 9']);   // os com mais dinheiro parado
});

teste('ordem e adiadas', () => {
  const t = ordenarTarefas([
    ...tarefasPrecos({ CUSTO_DEFASADO: 2 }),
    ...tarefasCaixa([{ id: 1, operador: null, abertoEm: '2026-11-20' }], HOJE),
    ...tarefasNotas([{ id: 7, numero: '1', fornecedor: null, criadaEm: HOJE, valor: 0 }], HOJE),
  ]);
  assert.deepStrictEqual(t.map(x => x.chave), ['CAIXA:1', 'NF:7', 'PRECO_CUSTO']);
  const r = semAdiadas(t, new Map([['PRECO_CUSTO', '2026-11-30'], ['NF:7', HOJE]]), HOJE);
  assert.deepStrictEqual(r.visiveis.map(x => x.chave), ['CAIXA:1', 'NF:7']);   // adiada até hoje já volta
  assert.strictEqual(r.adiadas, 1);
});
