// Operações em várias notas de entrada de uma vez (seleção na lista): DANFEs juntos numa impressão, lista das notas
// para imprimir, CSV das notas e dos itens, nomes dos XMLs. Regras puras, sem fetch.
import type { DuplicataNota, ItemNota, NotaEntrada, SituacaoNota } from './notasEntradaApi';

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const moeda = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dia = (v?: string | null) => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : '';
};
const celulaCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const numeroCsv = (v: number, casas = 2) => Number(v || 0).toFixed(casas).replace('.', ',');

/** Soma dos valores das notas, arredondando nota a nota. */
export const totalSelecionado = (notas: NotaEntrada[]) => notas.reduce((a, n) => a + Math.round(Number(n.valorNf || 0) * 100), 0) / 100;

/** Texto curto da tag: "1 boleto" / "3 boletos". */
export const rotuloDuplicatas = (qtd: number) => `${qtd} ${qtd === 1 ? 'boleto' : 'boletos'}`;

/** Linha de uma duplicata para tooltip/lista: "001 · 10/11/2026 · R$ 100,00". */
export const linhaDuplicata = (d: DuplicataNota) =>
  `${d.numero} · ${dia(d.vencimento) || 'sem vencimento'} · R$ ${moeda(d.valor)}`;

/** O que pode ser descartado: só o que ainda não entrou no estoque nem foi descartado. */
export const podeDescartar = (s: SituacaoNota) => s === 'EM_CONFERENCIA' || s === 'PRONTA';

/** Nome do arquivo XML: chave de acesso (padrão da SEFAZ) ou o número da NF. */
export const nomeArquivoXml = (n: Pick<NotaEntrada, 'chave' | 'numero'>) => {
  const chave = String(n.chave || '').replace(/\D/g, '');
  return chave.length === 44 ? `${chave}-nfe.xml` : `NF_${String(n.numero || 'sem_numero').replace(/[^\w-]/g, '_')}.xml`;
};

/**
 * Junta vários DANFEs (cada um é um HTML completo) num documento só: um estilo e uma nota por página.
 * A marca d'água sai de `fixed` (repetiria em todas as páginas) para dentro da página da própria nota.
 */
export const juntarDanfes = (htmls: string[]) => {
  if (htmls.length === 0) return '';
  const estilo = htmls[0].match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
  const corpos = htmls.map(h => h.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || '');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>DANFEs (${htmls.length})</title><style>${estilo}
.marca { position: absolute; top: 110mm; }
.folha + .folha { break-before: page; page-break-before: always; }
@media screen { .folha + .folha { margin-top: 10px; } }
</style></head><body>${corpos.map(c => `<div class="folha">${c}</div>`).join('')}</body></html>`;
};

const ROTULO: Record<SituacaoNota, string> = {
  EM_CONFERENCIA: 'Em conferência', PRONTA: 'Pronta para entrada', IMPORTADA: 'Entrada realizada', DESCARTADA: 'Descartada',
};

/** Relação das notas selecionadas para imprimir (A4 deitado) com total. */
export const htmlListaNotas = (notas: NotaEntrada[], titulo = 'Notas de entrada') => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>${esc(titulo)}</title><style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; margin: 0; }
h1 { font-size: 13pt; margin: 0 0 2px; } .sub { color: #444; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #999; padding: 3px 5px; text-align: left; vertical-align: top; }
th { background: #eee; font-size: 8pt; text-transform: uppercase; }
.n { text-align: right; white-space: nowrap; } .chave { font-family: monospace; font-size: 7.5pt; }
tfoot td { font-weight: bold; }
</style></head><body>
<h1>${esc(titulo)}</h1>
<div class="sub">${notas.length} nota(s) · impresso em ${esc(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}</div>
<table><thead><tr><th>NF</th><th>Fornecedor</th><th>CNPJ</th><th>Emissão</th><th>Entrada</th><th>Situação</th><th class="n">Itens</th><th class="n">Boletos</th><th class="n">Valor NF</th><th>Chave de acesso</th></tr></thead>
<tbody>${notas.map(n => `<tr>
<td><b>${esc(n.numero)}${n.serie && n.serie !== '0' ? `/${esc(n.serie)}` : ''}</b></td>
<td>${esc(n.fantasia || n.fornecedor)}</td><td>${esc(n.cnpj)}</td><td>${dia(n.emissao)}</td><td>${n.entradaEm ? new Date(n.entradaEm).toLocaleDateString('pt-BR') : ''}</td>
<td>${ROTULO[n.situacao] || esc(n.situacao)}</td><td class="n">${n.totalItens}</td><td class="n">${(n.duplicatas || []).length || ''}</td><td class="n">${moeda(n.valorNf)}</td>
<td class="chave">${esc(n.chave)}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="8">Total</td><td class="n">${moeda(totalSelecionado(notas))}</td><td></td></tr></tfoot>
</table></body></html>`;

/** CSV com uma linha por duplicata (boleto) das notas: o que se manda para quem vai pagar ou conferir. */
export const csvDuplicatasDasNotas = (notas: NotaEntrada[]) => {
  const cab = ['NF', 'Serie', 'Fornecedor', 'CNPJ', 'Emissao', 'Valor NF', 'Duplicata', 'Vencimento', 'Valor duplicata', 'Chave'];
  const linhas = notas.flatMap(n => (n.duplicatas || []).map(d => [
    n.numero, n.serie || '', n.fantasia || n.fornecedor, n.cnpj, dia(n.emissao), numeroCsv(n.valorNf), d.numero, dia(d.vencimento),
    numeroCsv(d.valor), n.chave,
  ].map(celulaCsv).join(';')));
  return '\ufeff' + [cab.join(';'), ...linhas].join('\r\n');
};

/** CSV com uma linha por item de cada nota (para conferir ou mandar para a contabilidade). */
export const csvItensDasNotas = (notas: Array<{ nota: NotaEntrada; itens: ItemNota[] }>) => {
  const cab = ['NF', 'Fornecedor', 'CNPJ', 'Emissao', 'Seq', 'Cod. fornecedor', 'Descricao NF', 'GTIN', 'Un NF', 'Qtd NF',
    'Custo un NF', 'Custo un final', 'SKU', 'Item no sistema', 'Qtd estoque', 'Un estoque'];
  const linhas = notas.flatMap(({ nota, itens }) => itens.map(i => [
    nota.numero, nota.fantasia || nota.fornecedor, nota.cnpj, dia(nota.emissao), i.seq, i.codigoFornecedor, i.descricaoNf, i.ean,
    i.unidadeNf, numeroCsv(i.quantidadeNf, 4), numeroCsv(i.custoUnitarioNf, 4), numeroCsv(i.custoUnitarioFinal, 4),
    i.skuItem, i.nomeItem, i.quantidadeEstoque === null ? '' : numeroCsv(i.quantidadeEstoque, 4), i.unidadeBase,
  ].map(celulaCsv).join(';')));
  return '﻿' + [cab.join(';'), ...linhas].join('\r\n');
};
