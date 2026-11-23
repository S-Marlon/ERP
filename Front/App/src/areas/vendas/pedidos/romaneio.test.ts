import assert from 'assert';
import { htmlRomaneio, linhasDoRomaneio } from './romaneio';
import type { PedidoFaturadoDetalhe } from './pedidosFaturadosApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const item = (x: Partial<PedidoFaturadoDetalhe['itens'][number]>): PedidoFaturadoDetalhe['itens'][number] => ({
  idItem: 1, sku: 'SKU', nome: 'Item', unidade: 'UN', fator: 1, siglaBase: 'UN', quantidade: 1, quantidadeBase: 1, precoUnitario: 10, total: 10,
  servico: false, componentes: [], localizacao: null, ...x,
});

const pedido = (itens: PedidoFaturadoDetalhe['itens']): PedidoFaturadoDetalhe => ({
  id: 122, etapa: 'CONFIRMADO', status: 'PEDIDO', idCliente: 5, cliente: 'Fazenda <Boa Vista>', contato: 'Maria', idOrcamento: 96,
  pedidoCliente: 'PC-77', previsaoEntrega: '2026-11-30', enderecoEntrega: null, observacao: null, total: 586.95, totalCusto: 300,
  condicaoPagamento: 'Boleto 30 dias', condicao: null, operador: 'ADM', criadoEm: '2026-11-23 10:00', faturadoEm: null, entregueEm: null,
  recebidoPor: null, canceladoEm: null, motivoCancelamento: null, itens, estoque: [], faltas: [], nota: null, parcelas: [], parcelasSugeridas: [], formasParcela: [],
  clienteDados: { documento: '10573521000191', telefone: '11988887777', endereco: 'Estrada X, 4 · Zona Rural · Itu/SP' },
});

teste('romaneio: linhas (serviço fora, kit com componentes)', () => {
  const l = linhasDoRomaneio([
    item({ sku: 'CABO', nome: 'Cabo PP', quantidade: 50, unidade: 'MT', localizacao: 'A1' }),
    item({ sku: 'MONT', nome: 'Montagem', servico: true }),
    item({ sku: 'KIT', nome: 'Kit cavalete', quantidade: 2, quantidadeBase: 2, componentes: [{ idItem: 7, nome: 'Registro', quantidade: 1 }, { idItem: 8, nome: 'Niple', quantidade: 3 }] }),
  ]);
  assert.deepStrictEqual(l.map(x => [x.n, x.nome, x.quantidade, x.componente]), [
    ['1', 'Cabo PP', 50, false], ['2', 'Kit cavalete', 2, false], ['2.1', 'Registro', 2, true], ['2.2', 'Niple', 6, true],
  ]);
  assert.strictEqual(l[0].local, 'A1');
});

teste('romaneio: folha sem e com valores', () => {
  const d = pedido([item({ nome: 'Cabo PP', quantidade: 50, precoUnitario: 4.5, total: 225 })]);
  const sem = htmlRomaneio(d, { nomeFantasia: 'Loja' });
  assert.ok(sem.startsWith('<!doctype html>'));
  assert.ok(sem.includes('Fazenda &lt;Boa Vista&gt;'));               // escapa o texto
  assert.ok(sem.includes('10.573.521/0001-91') && sem.includes('(11) 98888-7777'));
  assert.ok(sem.includes('Estrada X, 4'));                            // sem endereço no pedido: o do cadastro
  assert.ok(htmlRomaneio({ ...d, enderecoEntrega: 'Rua A, 1 · 13300000' }, {}).includes('13300-000'));   // CEP com traço
  assert.ok(sem.includes('30/11/2026') && sem.includes('PC-77'));
  assert.ok(!sem.includes('R$'));                                     // via do motorista: sem valores
  const com = htmlRomaneio(d, {}, { comValores: true });
  assert.ok(com.includes('via do cliente') && com.includes('R$') && com.includes('Boleto 30 dias'));
  const retira = htmlRomaneio({ ...d, clienteDados: null }, {});
  assert.ok(retira.includes('Retira na loja'));
});
