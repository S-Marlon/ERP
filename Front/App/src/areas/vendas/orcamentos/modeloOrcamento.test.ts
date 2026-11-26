import assert from 'assert';
import { modeloOrcamento } from './modeloOrcamento';
import type { PedidoAbertoDetalhe } from '../pdv/services/pedidosAbertosApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const sp = (s: string) => s.replace(/\s/g, ' ');

const empresa = {
  nomeFantasia: 'ATIMANG', razaoSocial: 'Marlon Victor Costa Santos', cnpj: '61225297000188', inscricaoEstadual: '190503230119',
  logradouro: 'Rua Otávio Passos', numero: '274', bairro: 'Alvinópolis', cidade: 'Atibaia', uf: 'SP', cep: '12942590',
};
const item = (x: Partial<PedidoAbertoDetalhe['itens'][number]>) => ({
  idItem: 1, sku: 'X', nome: 'Item', idUnidade: null, unidade: 'un', quantidade: 1, precoTabela: 10, precoUnitario: 10, desconto: 0, total: 10, ...x,
});
const orc = (x: Partial<PedidoAbertoDetalhe> = {}): PedidoAbertoDetalhe => ({
  id: 127, tipo: 'ORCAMENTO', situacao: 'VALIDO', cliente: 'Air Filter', idCliente: 5, contato: null, operador: 'ADM', observacao: null,
  validade: '2026-11-18', criadoEm: '2026-11-11T10:00:00', totalBruto: 1720.95, totalDesconto: 0, total: 1720.95,
  itens: [
    item({ sku: 'B', nome: 'Bujão 1/2" BSP', quantidade: 1, precoUnitario: 2.84, total: 2.84, categoria: 'Conexões e abraçadeiras' }),
    item({ sku: 'A', nome: 'Abraçadeira 32 mm', quantidade: 96, precoUnitario: 13.11, total: 1258.56, categoria: 'Conexões e abraçadeiras' }),
    item({ sku: 'M', nome: 'Mangueira R1AT 1/2"', unidade: 'MT', quantidade: 3, precoUnitario: 24.57, total: 73.71, categoria: 'Mangueiras montadas' }),
    item({ sku: 'C', nome: 'Capa de prensagem', quantidade: 14, precoUnitario: 8.86, total: 124.04, categoria: 'Mangueiras montadas' }),
    item({ sku: 'T', nome: 'Terminal fêmea', quantidade: 14, precoUnitario: 18.7, total: 261.8, categoria: 'Mangueiras montadas' }),
  ],
  ...x,
});

teste('modelo do orçamento: cabeçalho, seções com subtotal e total geral', () => {
  const m = modeloOrcamento(orc(), empresa);
  assert.deepStrictEqual([m.empresa.nome, m.empresa.razao, m.empresa.documentos], ['ATIMANG', 'Marlon Victor Costa Santos', 'CNPJ: 61.225.297/0001-88  |  IE: 190.503.230.119']);
  assert.strictEqual(m.empresa.endereco, 'Rua Otávio Passos, 274 – Alvinópolis – Atibaia/SP – CEP 12942-590');
  assert.deepStrictEqual([m.titulo, m.data, m.validade, m.cliente], ['ORÇAMENTO', '11/11/2026', '7 dias', 'Air Filter']);
  assert.deepStrictEqual(m.secoes.map(s => [s.numero, s.titulo, s.linhas.map(l => l.n).join(','), sp(s.subtotal)]),
    [[1, 'Conexões e abraçadeiras', '1,2', 'R$ 1.261,40'], [2, 'Mangueiras montadas', '3,4,5', 'R$ 459,55']]);
  assert.deepStrictEqual(m.totais.map(t => [t.rotulo, sp(t.valor), !!t.destaque]), [['TOTAL GERAL', 'R$ 1.720,95', true]]);
  assert.deepStrictEqual(m.condicoes.slice(0, 2).map(c => `${c.rotulo}: ${c.valor}`), ['Forma de pagamento: a combinar', 'Prazo de entrega: a combinar']);
});

teste('modelo do orçamento: PIX com 10% e 1/3 antecipado, sem categoria vira "Itens"', () => {
  const m = modeloOrcamento(orc({
    margemAlvo: 0.3, condicaoPagamento: 'No PIX com 10% de desconto', condicao: { forma: 'PIX', parcelas: 1, intervaloDias: null, entrada: 516.29, descontoPct: 0.1 },
  }), empresa);
  // 1720,95 − 10% = 1548,86 (arredondado); 1/3 antecipado 516,29 + 1032,57
  assert.deepStrictEqual(m.totais.map(t => [t.rotulo, sp(t.valor)]), [
    ['TOTAL GERAL', 'R$ 1.720,95'], ['Desconto no PIX (10%)', '- R$ 172,09'], ['TOTAL NO PIX', 'R$ 1.548,86'],
    ['Antecipado', 'R$ 516,29'], ['Na conclusão e entrega', 'R$ 1.032,57'],
  ]);
  assert.strictEqual(m.cliente, 'C00005 - Air Filter');
  const semCat = modeloOrcamento(orc({ itens: [item({})] }), empresa);
  assert.strictEqual(semCat.secoes[0].titulo, 'Itens');
});
