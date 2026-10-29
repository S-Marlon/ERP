import assert from 'assert';
import type { NotaEntrada } from './notasEntradaApi';
import {
  csvDuplicatasDasNotas, csvItensDasNotas, htmlListaNotas, juntarDanfes, linhaDuplicata, nomeArquivoXml, podeDescartar, rotuloDuplicatas, totalSelecionado,
} from './operacoesNotas';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const nota = (numero: string, valorNf: number, chave = ''): NotaEntrada => ({
  idLote: Number(numero), chave, numero, serie: '1', fornecedor: 'Forn & Cia', fantasia: null, cnpj: '123', emissao: '2026-10-07T11:42:55-03:00',
  entradaEm: '2026-10-13T17:22:23.000Z', valorNf, freteAdicional: 0, custoEntrada: 0, totalItens: 2, conferidos: 2, semVinculo: 0, situacao: 'IMPORTADA', duplicatas: [],
});

teste('boletos/duplicatas', () => {
  assert.deepStrictEqual([rotuloDuplicatas(1), rotuloDuplicatas(3)], ['1 boleto', '3 boletos']);
  const d = { numero: '001', vencimento: '2026-11-10', valor: 1234.5 };
  assert.strictEqual(linhaDuplicata(d), '001 · 10/11/2026 · R$ 1.234,50');
  const n = { ...nota('20', 2000), duplicatas: [d, { numero: '002', vencimento: null, valor: 765.5 }] };
  const linhas = csvDuplicatasDasNotas([n, nota('21', 10)]).split('\r\n');
  assert.strictEqual(linhas.length, 3);   // cabeçalho + 2 boletos (a nota sem boleto não entra)
  assert.ok(linhas[1].includes('"001";"10/11/2026";"1234,50"') && linhas[2].includes('"002";"";"765,50"'));
  assert.ok(htmlListaNotas([n]).includes('<td class="n">2</td>'));
});

teste('total e descarte da seleção', () => {
  assert.strictEqual(totalSelecionado([nota('1', 10.105), nota('2', 0.1), nota('3', 0.2)]), 10.41);
  assert.deepStrictEqual(['EM_CONFERENCIA', 'PRONTA', 'IMPORTADA', 'DESCARTADA'].map(s => podeDescartar(s as any)), [true, true, false, false]);
});

teste('nome do arquivo XML', () => {
  const chave = '3526 1012 3456 7800 0199 5500 1000 0012 3410 0000 1234'.replace(/\s/g, '');
  assert.strictEqual(nomeArquivoXml({ chave, numero: '123' }), `${chave}-nfe.xml`);
  assert.strictEqual(nomeArquivoXml({ chave: '', numero: '12/3' }), 'NF_12_3.xml');
});

teste('DANFEs juntos num documento', () => {
  const d = (n: string) => `<!DOCTYPE html><html><head><style>.a{}</style></head><body>\n<div class="pagina">NF ${n}</div></body></html>`;
  const html = juntarDanfes([d('1'), d('2')]);
  assert.strictEqual(html.match(/<style>/g)?.length, 1);
  assert.strictEqual(html.match(/class="folha"/g)?.length, 2);
  assert.ok(html.includes('NF 1') && html.includes('NF 2') && html.includes('break-before: page'));
  assert.strictEqual(juntarDanfes([]), '');
});

teste('lista impressa e CSV de itens', () => {
  const html = htmlListaNotas([nota('10', 100), nota('11', 50.5)]);
  assert.ok(html.includes('Forn &amp; Cia') && html.includes('150,50') && html.includes('07/10/2026'));
  const csv = csvItensDasNotas([{ nota: nota('10', 100), itens: [{ seq: 1, descricaoNf: 'Tubo "PVC"', quantidadeNf: 2.5, custoUnitarioNf: 3, custoUnitarioFinal: 3.1, quantidadeEstoque: null } as any] }]);
  const linhas = csv.split('\r\n');
  assert.strictEqual(linhas.length, 2);
  assert.ok(linhas[1].includes('"Tubo ""PVC"""') && linhas[1].includes('"2,5000"') && linhas[1].includes('"07/10/2026"'));
});
