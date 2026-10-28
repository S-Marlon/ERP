import assert from 'assert';
import { ItemVenda, previaAjuste } from './vendaCompletaApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const item = (idVendaItem: number, quantidade: number, precoUnitario: number, total: number): ItemVenda => ({
  idVendaItem, idItem: idVendaItem, sku: '', nome: '', unidade: 'UN', fator: 1, quantidade, precoTabela: precoUnitario, precoUnitario, desconto: 0, total,
  devolvido: 0, kit: false, servico: false,
});

teste('prévia do ajuste de venda', () => {
  const itens = [item(1, 6, 9.5, 57), item(2, 2, 30, 60)];
  const nada = previaAjuste(itens, { 1: { quantidade: 6, precoUnitario: 9.5 } }, []);
  assert.deepStrictEqual([nada.mudou, nada.diferenca, nada.mudadas.length], [false, 0, 0]);
  const p = previaAjuste(itens, { 1: { quantidade: 8, precoUnitario: 9.5 }, 2: { quantidade: 0, precoUnitario: 30 } },
    [{ idItem: 9, nome: 'Fita', sku: 'F', idUnidade: null, unidade: 'UN', quantidade: 3, precoUnitario: 4.333 }]);
  assert.strictEqual(p.mudadas.length, 2);
  assert.strictEqual(p.totalItensAntes, 117);
  assert.strictEqual(p.totalItensDepois, 76 + 13);   // 3 × 4,333 = 12,999 → 13,00
  assert.strictEqual(p.diferenca, -28);
});
