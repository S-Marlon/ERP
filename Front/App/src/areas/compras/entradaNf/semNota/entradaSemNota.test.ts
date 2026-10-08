import { CNPJ_COMPRA_AVULSA, chaveSemNota, alteracoesDaLista, dadosDaEntradaSemNota, dvChave, ehEntradaSemNota, montarXmlSemNota, validarSemNota } from './entradaSemNota';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`entradaSemNota: ${msg}`); };
const tag = (xml: string, nome: string) => [...xml.matchAll(new RegExp(`<${nome}>([^<]*)</${nome}>`, 'g'))].map(m => m[1]);

// Chave: 44 dígitos, modelo 99, DV pelo módulo 11 (resto 0 ou 1 vira 0)
ok(dvChave('0000000000000000000000000000000000000000001') === 9, 'dv: 1x2 = 2, resto 2 -> 9');
ok(dvChave('0000000000000000000000000000000000000000000') === 0, 'dv: soma 0 -> 0');
const chave = chaveSemNota(CNPJ_COMPRA_AVULSA, new Date(2026, 9, 7), 1234);
ok(chave.length === 44 && /^\d+$/.test(chave), 'chave com 44 dígitos');
ok(chave.slice(20, 22) === '99' && chave.slice(22, 25) === '999', 'modelo 99 e série 999');
ok(Number(chave.slice(-1)) === dvChave(chave.slice(0, 43)), 'dígito verificador');
ok(chave.slice(2, 6) === '2610', 'ano/mês da compra');
ok(ehEntradaSemNota(chave) && !ehEntradaSemNota('35240112345678000190550010000001231000001234'), 'reconhece entrada sem nota');
console.log('chave: ok');

// XML: totais batem, frete/desconto rateados, texto escapado, código interno quando não informado
const xml = montarXmlSemNota({
  fornecedor: { cnpj: CNPJ_COMPRA_AVULSA, nome: 'COMPRA AVULSA (SEM NOTA)' },
  data: new Date(2026, 9, 7, 10, 0, 0),
  numero: 77,
  frete: 10,
  desconto: 1,
  observacao: 'Loja do Zé & Cia',
  itens: [
    { descricao: 'Graxa <azul>', unidade: 'un', quantidade: 3, custoUnitario: 12.5 },
    { descricao: 'Fita veda rosca', codigo: 'FV18', ean: '7891234567895', ncm: '3919.10.00', unidade: 'RL', quantidade: 2, custoUnitario: 4.25 },
  ],
});
ok(tag(xml, 'vProd').slice(-1)[0] === '46.00', 'vProd total = 37,50 + 8,50');
ok(tag(xml, 'vNF')[0] === '55.00', 'vNF = produtos + frete - desconto');
const fretes = tag(xml, 'vFrete').map(Number);
ok(Math.abs(fretes[0] + fretes[1] - 10) < 0.001 && fretes[2] === 10, 'frete rateado nos itens e total');
ok(xml.includes('GRAXA &lt;AZUL&gt;') && xml.includes('Loja do Zé &amp; Cia'), 'texto escapado');
ok(tag(xml, 'cProd')[0] === 'AV77-1' && tag(xml, 'cProd')[1] === 'FV18', 'código interno só quando não informado');
ok(tag(xml, 'NCM')[1] === '39191000' && tag(xml, 'NCM')[0] === '' && tag(xml, 'cEAN')[0] === 'SEM GTIN', 'NCM só dígitos, vazio quando não informado (fica pendente na venda)');
ok(tag(xml, 'uCom')[0] === 'UN', 'unidade em maiúsculas');
ok(xml.includes(`Id="NFe${chaveSemNota(CNPJ_COMPRA_AVULSA, new Date(2026, 9, 7), 77)}"`), 'Id da infNFe com a chave');
console.log('xml: ok');

// Validação
ok(validarSemNota({ fornecedor: { cnpj: '', nome: '' }, data: new Date(), numero: 1, itens: [] }).length === 2, 'sem fornecedor e sem itens');
ok(validarSemNota({ fornecedor: { cnpj: CNPJ_COMPRA_AVULSA, nome: 'X' }, data: new Date(), numero: 1,
  itens: [{ descricao: '', unidade: 'UN', quantidade: 0, custoUnitario: 1, ncm: '123' }] }).length === 3, 'descrição, quantidade e NCM');
console.log('validação: ok');

// Ida e volta: lendo o XML gerado e somando um item, a chave continua a mesma e os itens antigos não mudam
{
  const base = {
    fornecedor: { cnpj: CNPJ_COMPRA_AVULSA, nome: 'COMPRA AVULSA (SEM NOTA)', uf: 'SP' },
    data: new Date(2026, 9, 7, 10, 0, 0), numero: 123456789, observacao: 'Recibo 55', frete: 5, desconto: 0,
    itens: [{ descricao: 'Graxa', unidade: 'UN', quantidade: 2, custoUnitario: 10 }],
  };
  const xml1 = montarXmlSemNota(base);
  // "Leitura" do XML como a tela faz (aqui por expressão regular: o teste roda sem DOM)
  const lida = {
    numero: tag(xml1, 'nNF')[0], dataEmissao: tag(xml1, 'dhEmi')[0],
    emitente: { cnpj: tag(xml1, 'CNPJ')[0], nome: tag(xml1, 'xNome')[0], uf: tag(xml1, 'UF')[0] },
    informacoesAdicionais: { infCpl: tag(xml1, 'infCpl')[0] },
    totais: { icmsTot: { vFrete: tag(xml1, 'vFrete').slice(-1)[0], vDesc: tag(xml1, 'vDesc').slice(-1)[0] } },
    produtos: [...xml1.matchAll(/<det nItem="(\d+)">(.*?)<\/det>/g)].map(m => m[2]).map((d, k) => ({ nItem: String(k + 1), prod: {
      xProd: tag(d, 'xProd')[0], cProd: tag(d, 'cProd')[0], cEAN: tag(d, 'cEAN')[0], NCM: tag(d, 'NCM')[0],
      uCom: tag(d, 'uCom')[0], qCom: tag(d, 'qCom')[0], vUnCom: tag(d, 'vUnCom')[0],
    } })),
  };
  const dados = dadosDaEntradaSemNota(lida);
  ok(dados.observacao === 'Recibo 55' && dados.frete === 5 && dados.itens[0].codigo === 'AV123456789-1', 'dados lidos de volta');
  const xml2 = montarXmlSemNota({ ...dados, itens: [...dados.itens, { descricao: 'Estopa', unidade: 'KG', quantidade: 1, custoUnitario: 8 }] });
  const id = (x: string) => x.match(/Id="NFe(\d+)"/)![1];
  ok(id(xml2) === id(xml1), 'mesma chave depois de adicionar');
  ok(tag(xml2, 'cProd')[0] === 'AV123456789-1' && tag(xml2, 'cProd')[1] === 'AV123456789-2', 'item antigo mantém o código; novo continua a sequência');
  ok(tag(xml2, 'vNF')[0] === '33.00', 'total refeito: 20 + 8 + frete 5');
  console.log('adicionar itens: ok');
}

// Edição da lista: remover do meio mantém os números; mudanças marcam reconferência/reclassificação
{
  const dados = {
    fornecedor: { cnpj: CNPJ_COMPRA_AVULSA, nome: 'X' }, data: new Date(2026, 9, 7), numero: 5,
    itens: [
      { nItem: 1, descricao: 'A', unidade: 'UN', quantidade: 1, custoUnitario: 1 },
      { nItem: 3, descricao: 'C', unidade: 'UN', quantidade: 1, custoUnitario: 1 },
      { descricao: 'Novo', unidade: 'UN', quantidade: 1, custoUnitario: 1 },
    ],
  };
  const xml = montarXmlSemNota(dados);
  const nums = [...xml.matchAll(/<det nItem="(\d+)">/g)].map(m => m[1]);
  ok(nums.join(',') === '1,3,4', 'números mantidos e novo continua a sequência');
  ok(tag(xml, 'cProd')[2] === 'AV5-4', 'código do item novo pelo número dele');

  const antes = [
    { nItem: 1, descricao: 'Graxa', unidade: 'UN', quantidade: 2, custoUnitario: 10 },
    { nItem: 2, descricao: 'Fita', unidade: 'RL', quantidade: 1, custoUnitario: 4 },
    { nItem: 3, descricao: 'Estopa', unidade: 'KG', quantidade: 1, custoUnitario: 8 },
  ];
  const depois = [
    { nItem: 1, descricao: 'graxa ', unidade: 'un', quantidade: 2, custoUnitario: 10 },
    { nItem: 2, descricao: 'Fita', unidade: 'UN', quantidade: 1, custoUnitario: 4 },
    { nItem: 3, descricao: 'Estopa', unidade: 'KG', quantidade: 1.5, custoUnitario: 8 },
    { descricao: 'Novo', unidade: 'UN', quantidade: 1, custoUnitario: 1 },
  ];
  const alt = alteracoesDaLista(antes, depois);
  ok(!alt['1'], 'só maiúsculas/espaços: não muda nada');
  ok(alt['2']?.reclassificar && alt['2']?.reconferir, 'unidade mudou: reclassifica');
  ok(alt['3']?.reconferir && !alt['3']?.reclassificar, 'quantidade mudou: reconfere');
  ok(Object.keys(alt).length === 2, 'item novo e removidos não entram');
  console.log('edição da lista: ok');
}
