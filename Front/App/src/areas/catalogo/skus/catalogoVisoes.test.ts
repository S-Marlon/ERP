import { agruparPorFamilia, contarSituacoes, ehDaVisao, filtrarLinhas, itensDasLinhas, visaoDoTipo } from './catalogoVisoes';
import type { ItemParentType } from './CatalogSku.types';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`catalogoVisoes: ${msg}`); };

const item = (id: number, p: Partial<ItemParentType> & { estoque?: number; preco?: number; custo?: number; unidade?: string; marca?: string }): ItemParentType => ({
  key: String(id), id_item: id, tenant_id: 1, sku: `S${id}`, nome_item: `Item ${id}`, tipo_recurso: 'PRODUTO', status: 'ATIVO',
  categoria_id: null, familia_id: null, ...p,
  skus: [{
    key: `${id}`, id_item: id, sku: `S${id}`, variacao: 'Principal', marca: p.marca ?? 'Própria', estoque: p.estoque ?? 0,
    preco_venda: p.preco ?? 10, custo_gerencial: p.custo ?? 5, status: 'ATIVO', unidade: p.unidade ?? 'UN', publicavel: true,
  }],
});

ok(visaoDoTipo('produto') === 'VENDA' && visaoDoTipo('SERVICO') === 'VENDA' && visaoDoTipo(null) === 'VENDA', 'venda');
ok(visaoDoTipo('CONSUMO') === 'ALMOXARIFADO' && visaoDoTipo('insumo') === 'ALMOXARIFADO', 'almoxarifado');
ok(visaoDoTipo('ATIVO') === 'PATRIMONIO', 'patrimônio');
ok(ehDaVisao('ATIVO', 'TODOS') && !ehDaVisao('ATIVO', 'VENDA'), 'todos inclui tudo');
console.log('visão: ok');

const itens = [
  item(1, { familia_id: 7, familia: 'Rolamento 6205', estoque: 3, marca: 'SKF', categoria_id: 2 }),
  item(2, { familia_id: 7, familia: 'Rolamento 6205', estoque: 0, marca: 'NSK', categoria_id: 2 }),
  item(3, { estoque: 10, preco: 0, custo: 0, unidade: '' }),
];
const linhas = agruparPorFamilia(itens);
ok(linhas.length === 2 && linhas[0].familiaReal && linhas[0].skus.length === 2 && linhas[0].nome_item === 'Rolamento 6205', 'família agrupa as variações');
ok(!linhas[1].familiaReal && linhas[1].skus.length === 1, 'item avulso sozinho');
console.log('agrupar: ok');

const base = { busca: '', categoriaId: null, marca: null, situacao: 'TODAS' as const, estrutura: 'TODAS' as const };
ok(filtrarLinhas(linhas, { ...base, busca: 's2' }).length === 1, 'busca acha o SKU da variação');
ok(filtrarLinhas(linhas, { ...base, marca: 'nsk' }).length === 1, 'marca de uma variação');
ok(filtrarLinhas(linhas, { ...base, categoriaId: 2 }).length === 1, 'categoria');
ok(filtrarLinhas(linhas, { ...base, estrutura: 'AVULSOS' })[0].id_item === 3, 'só avulsos');
const c = contarSituacoes(linhas);
ok(c.ESGOTADO === 1 && c.CRITICO === 1 && c.SEM_FAMILIA === 1 && c.SEM_PRECO === 1 && c.SEM_CUSTO === 1 && c.SEM_UNIDADE === 1 && c.COM_ESTOQUE === 2, 'contagens');
console.log('filtros: ok');

const sel = itensDasLinhas([linhas[0]]);
ok(sel.length === 2 && sel[0].idItem === 1 && sel[0].nome === 'Item 1' && sel[1].sku === 'S2', 'família selecionada vira as variações');
console.log('seleção: ok');
