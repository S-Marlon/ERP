// Equivalentes ("o joio e o trigo"): itens da mesma categoria com os mesmos valores nos atributos que definem
// equivalência (ex.: bomba 0,75 HP) servem para a mesma coisa para o cliente; dentro do grupo, quem vende e quem trava o
// estoque, com a confiança (poucas vendas = sinal fraco) e a sugestão (preferir nas compras / não recomprar e escoar com
// preço abaixo do que vende). Também a demanda pelo valor do atributo (o que manter) e o giro por marca. Puro, com teste.

export interface ItemEquivalencia {
  idItem: number; sku: string; nome: string; categoriaId: number | null; categoria: string | null; marca: string | null; familia: string | null;
  /** atributo (id) → valor já normalizado (só os que definem equivalência). */
  atributos: Map<number, string>;
  quantidade: number; receita: number; lucro: number; vendas: number; estoque: number; valorEstoque: number; custoUnitario: number; precoVenda: number;
  decisaoCompra: 'PREFERIDO' | 'NAO_RECOMPRAR' | null;
}

export type Papel = 'VENDE' | 'TRAVA' | 'OK';
export type Confianca = 'BAIXA' | 'MEDIA' | 'ALTA';

/** "0,75 HP" = "0.75 hp" = " 0,75hp ": minúsculo, vírgula vira ponto, sem espaços. */
export const normalizarValor = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, '');

/** Quem é "outro fornecedor" dentro do grupo: a marca; sem marca, a família; sem as duas, o próprio item. */
const origem = (i: ItemEquivalencia) => (i.marca || i.familia || `item ${i.idItem}`).toUpperCase();

/**
 * Grupos de equivalentes: mesma categoria + mesmos valores em TODOS os atributos de equivalência que o item tem. Só vira
 * grupo com 2+ itens de origens diferentes (marca/família) — senão não há escolha a fazer.
 */
export const montarGrupos = (itens: ItemEquivalencia[]) => {
  const grupos = new Map<string, ItemEquivalencia[]>();
  for (const i of itens) {
    if (!i.atributos.size || i.categoriaId === null) continue;
    const chave = `${i.categoriaId}|${[...i.atributos.entries()].sort((a, b) => a[0] - b[0]).map(([a, v]) => `${a}=${v}`).join('&')}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(i);
  }
  return [...grupos.entries()].filter(([, l]) => l.length >= 2 && new Set(l.map(origem)).size >= 2).map(([chave, itens]) => ({ chave, itens }));
};

export const confiancaDas = (vendas: number): Confianca => (vendas >= 15 ? 'ALTA' : vendas >= 5 ? 'MEDIA' : 'BAIXA');

/** Preço que deixa a margem mínima (custo ÷ (1 − mínima)). */
const precoMinimo = (custo: number, margemMinima: number) => (margemMinima < 1 ? custo / (1 - margemMinima) : custo);
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Analisa um grupo: participação de cada item nas vendas (quantidade) e no estoque, quem vende e quem trava.
 * TRAVA = tem estoque, metade ou mais do estoque do grupo e menos da metade da participação de estoque nas vendas
 * (ex.: 78% do estoque e 0% das vendas). Preço para escoar = 10% abaixo do que mais vende, sem passar da margem mínima.
 */
export const analisarGrupo = (itens: ItemEquivalencia[], margemMinima: number) => {
  const qtdTotal = itens.reduce((a, i) => a + Math.max(0, i.quantidade), 0);
  const estTotal = itens.reduce((a, i) => a + Math.max(0, i.estoque), 0);
  const vendasTotal = itens.reduce((a, i) => a + i.vendas, 0);
  const vencedor = qtdTotal > 0 ? [...itens].sort((a, b) => b.quantidade - a.quantidade || b.receita - a.receita)[0] : null;
  const linhas = itens.map(i => {
    const partVendas = qtdTotal > 0 ? Math.max(0, i.quantidade) / qtdTotal : 0;
    const partEstoque = estTotal > 0 ? Math.max(0, i.estoque) / estTotal : 0;
    const trava = i.estoque > 0 && qtdTotal > 0 && partEstoque >= 0.5 && partVendas < partEstoque / 2;
    const papel: Papel = vencedor && i.idItem === vencedor.idItem ? 'VENDE' : trava ? 'TRAVA' : 'OK';
    const minimo = precoMinimo(i.custoUnitario, margemMinima);
    const alvo = vencedor && vencedor.precoVenda > 0 ? vencedor.precoVenda * 0.9 : 0;
    const precoEscoar = papel === 'TRAVA' && alvo > 0 && i.precoVenda > alvo ? r2(Math.max(alvo, minimo)) : null;
    return {
      ...i, atributos: undefined as never, partVendas: Math.round(partVendas * 1000) / 1000, partEstoque: Math.round(partEstoque * 1000) / 1000,
      giro: i.estoque + i.quantidade > 0 ? Math.round((i.quantidade / (i.estoque + i.quantidade / 2)) * 100) / 100 : null,
      papel, precoEscoar, precoEscoarNoMinimo: precoEscoar !== null && Math.abs(precoEscoar - minimo) < 0.01,
    };
  }).sort((a, b) => b.quantidade - a.quantidade || b.estoque - a.estoque);
  const travados = linhas.filter(l => l.papel === 'TRAVA');
  const pctTxt = (v: number) => `${Math.round(v * 100)}%`;
  const quem = (l: { marca: string | null; familia: string | null; sku: string }) => l.marca || l.familia || l.sku;
  const alerta = travados.length && vencedor
    ? travados.map(t => `${quem(t)} tem ${pctTxt(t.partEstoque)} do estoque e ${pctTxt(t.partVendas)} das vendas: o cliente prefere ${quem(vencedor)}`).join('; ')
    : null;
  const valorTravado = r2(travados.reduce((a, t) => a + t.valorEstoque, 0));
  return {
    itens: linhas, quantidadeVendida: qtdTotal, estoque: estTotal, vendas: vendasTotal, confianca: confiancaDas(vendasTotal),
    alerta, valorTravado, vencedor: vencedor ? { idItem: vencedor.idItem, nome: vencedor.nome, marca: quem(vencedor) } : null,
    /** Decisão gravada diferente do que os números dizem (ex.: preferido que trava): vale avisar. */
    conflito: linhas.some(l => (l.decisaoCompra === 'PREFERIDO' && l.papel === 'TRAVA') || (l.decisaoCompra === 'NAO_RECOMPRAR' && l.papel === 'VENDE')),
  };
};

/** Demanda pelo valor do atributo (ex.: Potência 0,75 HP), somando todas as marcas: o que manter em estoque. */
export const demandaPorAtributo = (itens: ItemEquivalencia[], nomes: Map<number, string>, rotulos: Map<string, string>) => {
  const acc = new Map<string, { atributo: string; valor: string; categoria: string | null; quantidade: number; receita: number; estoque: number; itens: number; marcas: Set<string> }>();
  for (const i of itens) {
    for (const [a, v] of i.atributos) {
      const k = `${i.categoriaId}|${a}|${v}`;
      const x = acc.get(k) || { atributo: nomes.get(a) || `Atributo ${a}`, valor: rotulos.get(`${a}|${v}`) || v, categoria: i.categoria, quantidade: 0, receita: 0, estoque: 0, itens: 0, marcas: new Set<string>() };
      x.quantidade += Math.max(0, i.quantidade); x.receita += i.receita; x.estoque += Math.max(0, i.estoque); x.itens++; x.marcas.add(origem(i));
      acc.set(k, x);
    }
  }
  return [...acc.values()].map(x => ({ ...x, receita: r2(x.receita), marcas: [...x.marcas] }))
    .sort((a, b) => b.quantidade - a.quantidade || b.receita - a.receita);
};

/** Giro por marca (todas as categorias): vendido no período ÷ estoque médio. */
export const giroPorMarca = (itens: Array<{ marca: string | null; quantidade: number; receita: number; estoque: number; valorEstoque: number }>) => {
  const acc = new Map<string, { marca: string; itens: number; quantidade: number; receita: number; estoque: number; valorEstoque: number }>();
  for (const i of itens) {
    if (!i.marca) continue;
    const x = acc.get(i.marca) || { marca: i.marca, itens: 0, quantidade: 0, receita: 0, estoque: 0, valorEstoque: 0 };
    x.itens++; x.quantidade += Math.max(0, i.quantidade); x.receita += i.receita; x.estoque += Math.max(0, i.estoque); x.valorEstoque += i.valorEstoque;
    acc.set(i.marca, x);
  }
  return [...acc.values()].map(x => ({
    ...x, receita: r2(x.receita), valorEstoque: r2(x.valorEstoque),
    giro: x.estoque + x.quantidade > 0 ? Math.round((x.quantidade / (x.estoque + x.quantidade / 2)) * 100) / 100 : null,
  })).sort((a, b) => b.receita - a.receita || b.valorEstoque - a.valorEstoque);
};
