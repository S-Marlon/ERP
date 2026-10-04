import { CONFIG_PADRAO, digitoChave, Emitente, gerarChaveAcesso, ItemVendaFiscal, modeloSugerido, montarNota, pendenciasDaNota, ratear, tributacaoDoItem } from './notaSaida';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const falha = (fn: () => unknown, msg: string) => { try { fn(); } catch { return; } throw new Error(msg); };

// Exemplo do Manual de Orientação do Contribuinte: DV 5
assert(digitoChave('5206043300991100250655012000000780026730161') === 5, 'DV do manual');
const chave = gerarChaveAcesso({ uf: 'SP', emissao: new Date(2026, 9, 4), cnpj: '12345678000195', modelo: '65', serie: 1, numero: 42, codigoNumerico: 12345678 });
assert(chave.length === 44 && chave.startsWith('352610123456780001956500100000004211234567'), `chave ${chave}`);

assert(Math.round(ratear(10, [1, 1, 1]).reduce((a, v) => a + v, 0) * 100) === 1000, 'rateio soma');

// Tributação: padrão MEI 102/5102; com CEST vai para ST 500/5405; exceção do item vale; CFOP de entrada é ignorado
assert(JSON.stringify(tributacaoDoItem({ csosn: null, cfop: null, cest: null }, CONFIG_PADRAO)) === JSON.stringify({ csosn: '102', cfop: '5102' }), 'padrão');
assert(JSON.stringify(tributacaoDoItem({ csosn: null, cfop: null, cest: '0107700' }, CONFIG_PADRAO)) === JSON.stringify({ csosn: '500', cfop: '5405' }), 'ST');
assert(tributacaoDoItem({ csosn: '103', cfop: '1102', cest: null }, CONFIG_PADRAO).cfop === '5102', 'CFOP de entrada ignorado');
assert(tributacaoDoItem({ csosn: '103', cfop: '5101', cest: null }, CONFIG_PADRAO).csosn === '103', 'exceção do item');

const emitente: Emitente = {
  cnpj: '12.345.678/0001-95', inscricaoEstadual: '123456789110', razaoSocial: 'LOJA TESTE', nomeFantasia: null, crt: 4,
  logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cep: '01001-000', municipio: 'São Paulo',
  codigoMunicipioIbge: '3550308', uf: 'SP', telefone: null, email: null,
};
const item = (x: Partial<ItemVendaFiscal>): ItemVendaFiscal => ({
  idItem: 1, codigo: 'T1', descricao: 'Terminal', unidade: 'un', quantidade: 3, precoTabela: 10, totalItem: 27, servico: false,
  ncm: '73079900', cest: null, origem: 0, csosn: null, cfop: null, ...x,
});

// Pendências
assert(pendenciasDaNota(emitente, [item({})], '65', null).length === 0, 'sem pendência');
assert(pendenciasDaNota(null, [item({})], '65', null).length === 1, 'sem emitente');
assert(pendenciasDaNota(emitente, [item({ ncm: null })], '65', null).some(p => p.includes('NCM')), 'sem NCM');
assert(pendenciasDaNota(emitente, [item({ servico: true })], '65', null).some(p => p.includes('serviço')), 'só serviço');
assert(pendenciasDaNota(emitente, [item({})], '55', { documento: '12345678000195', nome: 'X', email: null, celular: null }).some(p => p.includes('endereço')), 'NF-e sem endereço');
assert(modeloSugerido('12.345.678/0001-95') === '55' && modeloSugerido('123.456.789-09') === '65' && modeloSugerido(null) === '65', 'modelo sugerido');

// Nota: 3 x 10 com desconto (27) + serviço 20 fora da nota; pagou 50 em dinheiro com troco 3 e PIX 0
const base = { modelo: '65' as const, config: CONFIG_PADRAO, emitente, serie: 1, numero: 7, emissao: new Date(), destinatario: null, idVenda: 99 };
let nota = montarNota({ ...base, itens: [item({}), item({ idItem: 2, descricao: 'Prensagem', servico: true, totalItem: 20, quantidade: 1 })], pagamentos: [{ forma: 'DINHEIRO', valor: 50, troco: 3 }] });
assert(nota.itens.length === 1 && nota.itens[0].valorBruto === 30 && nota.itens[0].desconto === 3, `item ${JSON.stringify(nota.itens[0])}`);
assert(nota.totais.total === 27, `total só produtos ${nota.totais.total}`);
// 27 de 47 da venda em dinheiro -> pagamento proporcional 27 + troco 3 = 30
assert(nota.pagamentos[0].tPag === '01' && nota.pagamentos[0].valor === 30 && nota.troco === 3, `pagamento ${JSON.stringify(nota.pagamentos)} troco ${nota.troco}`);

// Parcelado com acréscimo: itens 100, cartão 105 -> 5 em outras despesas
nota = montarNota({ ...base, itens: [item({ quantidade: 1, precoTabela: 100, totalItem: 100 })], pagamentos: [{ forma: 'CREDITO', valor: 105, troco: 0 }] });
assert(nota.totais.outros === 5 && nota.totais.total === 105 && nota.itens[0].outros === 5 && nota.pagamentos[0].cartao, `acréscimo ${JSON.stringify(nota.totais)}`);

// Pagamentos divididos fecham no centavo: 2 itens 33,33 + 33,34; PIX 50 + a prazo 16,67
nota = montarNota({ ...base, itens: [item({ quantidade: 1, precoTabela: 33.33, totalItem: 33.33 }), item({ idItem: 3, quantidade: 1, precoTabela: 33.34, totalItem: 33.34 })], pagamentos: [{ forma: 'PIX', valor: 50, troco: 0 }, { forma: 'PRAZO', valor: 16.67, troco: 0 }] });
assert(Math.round(nota.pagamentos.reduce((a, p) => a + p.valor, 0) * 100) === 6667 && nota.pagamentos[1].tPag === '05', 'divididos');

// Vendido acima da tabela: o preço praticado vira o unitário
nota = montarNota({ ...base, itens: [item({ quantidade: 2, precoTabela: 10, totalItem: 25 })], pagamentos: [{ forma: 'DINHEIRO', valor: 25, troco: 0 }] });
assert(nota.itens[0].valorUnitario === 12.5 && nota.itens[0].desconto === 0, 'acima da tabela');

falha(() => montarNota({ ...base, itens: [item({ ncm: '' })], pagamentos: [] }), 'pendência bloqueia');

console.log('notaSaida: ok');
