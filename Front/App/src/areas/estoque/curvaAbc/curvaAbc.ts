// Curva ABC dos itens: três curvas (venda, lucro e estoque parado), a frequência de venda (XYZ), as classes que não cabem
// no ABC (N = novo, ainda sem histórico; P = parado: tem estoque e não vendeu no período), a curva dentro da categoria e
// a recomendação de cada item. Regras puras, sem banco, com teste. Cópia de Backend/src/areas/estoque/curvaAbc/curvaAbc.ts
// (manter as duas iguais): a tela usa classeExibida/resumir para trocar de curva sem ir ao servidor.

export type Classe = 'A' | 'B' | 'C';
export type Frequencia = 'X' | 'Y' | 'Z';
/** Classe que aparece para o operador: A/B/C na curva escolhida, P (parado), N (novo) ou '-' (sem venda e sem estoque). */
export type ClasseExibida = Classe | 'P' | 'N' | '-';

export interface Cortes { a: number; b: number }
export const CORTES_PADRAO: Cortes = { a: 0.8, b: 0.95 };
/** Item com menos dias que isso desde a primeira entrada/cadastro é "novo" (ainda não dá para julgar). */
export const DIAS_NOVO = 60;

/** ABC por valor: A até `a` do total acumulado (o item que cruza a marca ainda é A), B até `b`, C o resto; valor ≤ 0 fica fora. */
export const classificar = (valores: Map<number, number>, cortes: Cortes = CORTES_PADRAO): Map<number, Classe> => {
  const lista = [...valores.entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  const total = lista.reduce((s, [, v]) => s + v, 0);
  const r = new Map<number, Classe>();
  let acumulado = 0;
  for (const [id, v] of lista) {
    const antes = acumulado / total;
    acumulado += v;
    r.set(id, antes < cortes.a ? 'A' : antes < cortes.b ? 'B' : 'C');
  }
  return r;
};

/**
 * Frequência pelo número de semanas com venda no período: X = em pelo menos 40% das semanas (vende sempre),
 * Y = em 2 semanas ou mais (de vez em quando), Z = numa semana só (pedido pontual).
 */
export const frequencia = (semanasComVenda: number, semanasNoPeriodo: number): Frequencia | null => {
  if (semanasComVenda <= 0) return null;
  if (semanasNoPeriodo > 0 && semanasComVenda / semanasNoPeriodo >= 0.4 && semanasComVenda >= 2) return 'X';
  return semanasComVenda >= 2 ? 'Y' : 'Z';
};

export interface ItemCurva {
  idItem: number; categoriaTopo: number | null;
  receita: number; lucro: number; quantidade: number; vendas: number; semanasComVenda: number;
  estoque: number; custoUnitario: number; diasDesdeEntrada: number | null; ultimaVenda: string | null;
}

export interface ItemClassificado extends ItemCurva {
  valorEstoque: number; margem: number | null;
  venda: Classe | null; lucroClasse: Classe | null; estoqueClasse: Classe | null; vendaNaCategoria: Classe | null;
  xyz: Frequencia | null; situacao: 'NORMAL' | 'PARADO' | 'NOVO' | 'SEM_GIRO';
  /** Dias que o estoque dura no ritmo de venda do período (null = não vendeu). */
  coberturaDias: number | null;
  recomendacao: string | null;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Classifica tudo de uma vez: as três curvas no conjunto, a de venda dentro da categoria, XYZ, situação e recomendação.
 * `diasDeHistorico`: há quanto tempo o ERP registra vendas. O ritmo (cobertura, XYZ) usa o menor entre o período e o
 * histórico; "novo" é só o que entrou depois que o ERP já vendia (a carga inicial do estoque é julgada normalmente).
 */
export const classificarItens = (itens: ItemCurva[], dias: number, cortes: Cortes = CORTES_PADRAO, diasDeHistorico?: number): ItemClassificado[] => {
  const diasUteis = Math.max(1, Math.min(dias, diasDeHistorico ?? dias));
  const semanas = Math.max(1, Math.round(diasUteis / 7));
  const venda = classificar(new Map(itens.map(i => [i.idItem, i.receita])), cortes);
  const lucro = classificar(new Map(itens.map(i => [i.idItem, i.lucro])), cortes);
  const estoque = classificar(new Map(itens.map(i => [i.idItem, Math.max(0, i.estoque) * i.custoUnitario])), cortes);
  const porCategoria = new Map<string, Map<number, number>>();
  for (const i of itens) {
    const k = String(i.categoriaTopo ?? 'sem');
    if (!porCategoria.has(k)) porCategoria.set(k, new Map());
    porCategoria.get(k)!.set(i.idItem, i.receita);
  }
  const naCategoria = new Map<number, Classe>();
  for (const m of porCategoria.values()) for (const [id, c] of classificar(m, cortes)) naCategoria.set(id, c);

  return itens.map(i => {
    const valorEstoque = r2(Math.max(0, i.estoque) * i.custoUnitario);
    const vendeu = i.receita > 0 || i.quantidade > 0;
    const novo = !vendeu && i.diasDesdeEntrada !== null && i.diasDesdeEntrada < DIAS_NOVO
      && (diasDeHistorico === undefined || i.diasDesdeEntrada < diasDeHistorico - 7);
    const situacao: ItemClassificado['situacao'] = vendeu ? 'NORMAL' : novo ? 'NOVO' : i.estoque > 0 ? 'PARADO' : 'SEM_GIRO';
    const xyz = frequencia(i.semanasComVenda, semanas);
    const coberturaDias = i.quantidade > 0 && i.estoque > 0 ? Math.round(i.estoque / (i.quantidade / diasUteis)) : i.quantidade > 0 ? 0 : null;
    const c: ItemClassificado = {
      ...i, valorEstoque, margem: i.receita > 0 ? r2(i.lucro / i.receita * 10000) / 10000 : null,
      venda: venda.get(i.idItem) ?? null, lucroClasse: lucro.get(i.idItem) ?? null, estoqueClasse: estoque.get(i.idItem) ?? null,
      vendaNaCategoria: naCategoria.get(i.idItem) ?? null, xyz, situacao, coberturaDias, recomendacao: null,
    };
    c.recomendacao = recomendar(c, diasUteis);
    return c;
  });
};

/** Uma frase do que fazer com o item (a mais importante só). */
export const recomendar = (c: ItemClassificado, dias: number): string | null => {
  if (c.situacao === 'PARADO') {
    return c.estoqueClasse === 'A' ? 'Dinheiro parado alto: promoção, anúncio no ML ou devolver ao fornecedor'
      : c.estoqueClasse === 'B' ? 'Parado: considerar promoção ou anúncio no ML' : null;
  }
  if (c.situacao !== 'NORMAL') return null;
  if (c.lucro < 0) return 'Vendendo com prejuízo: revisar custo e preço';
  if ((c.venda === 'A' || c.venda === 'B') && c.estoque <= 0) return 'Sem estoque: repor';
  if (c.venda === 'A' && c.coberturaDias !== null && c.coberturaDias < 15) return `Pode faltar: estoque para ~${c.coberturaDias} dias`;
  if (c.venda === 'A' && (c.lucroClasse === 'C' || (c.margem !== null && c.margem < 0.15))) return 'Vende muito e lucra pouco: revisar preço';
  if (c.venda === 'A' && c.xyz === 'X') return 'Não pode faltar: manter estoque mínimo';
  if (c.venda === 'A' && c.xyz === 'Z') return 'Venda pontual (um pedido): não estocar além do necessário';
  if (c.coberturaDias !== null && c.coberturaDias > dias * 4 && c.valorEstoque > 0 && c.estoqueClasse !== 'C') return `Estoque para ~${c.coberturaDias} dias: comprar menos`;
  return null;
};

export type Curva = 'VENDA' | 'LUCRO' | 'ESTOQUE';

/** Classe do item na curva escolhida, já com P/N para quem não vendeu. */
export const classeExibida = (c: ItemClassificado, curva: Curva): ClasseExibida => {
  if (curva === 'ESTOQUE') return c.estoqueClasse ?? '-';
  if (c.situacao === 'PARADO') return 'P';
  if (c.situacao === 'NOVO') return 'N';
  if (c.situacao === 'SEM_GIRO') return '-';
  return (curva === 'VENDA' ? c.venda : c.lucroClasse) ?? 'C';
};

const valorNaCurva = (c: ItemClassificado, curva: Curva) => (curva === 'VENDA' ? c.receita : curva === 'LUCRO' ? c.lucro : c.valorEstoque);

/** Resumo por classe (itens e valor) e a matriz ABC × XYZ da curva escolhida. */
export const resumir = (itens: ItemClassificado[], curva: Curva) => {
  const classes: ClasseExibida[] = ['A', 'B', 'C', 'P', 'N', '-'];
  const total = itens.reduce((s, i) => s + Math.max(0, valorNaCurva(i, curva)), 0);
  const porClasse = classes.map(k => {
    const l = itens.filter(i => classeExibida(i, curva) === k);
    const valor = l.reduce((s, i) => s + Math.max(0, k === 'P' ? i.valorEstoque : valorNaCurva(i, curva)), 0);
    return { classe: k, itens: l.length, valor: r2(valor), pctValor: total > 0 && k !== 'P' ? valor / total : null, valorEstoque: r2(l.reduce((s, i) => s + i.valorEstoque, 0)) };
  });
  const matriz: Record<string, number> = {};
  for (const i of itens) {
    const k = classeExibida(i, curva);
    if (!['A', 'B', 'C'].includes(k) || !i.xyz) continue;
    matriz[`${k}${i.xyz}`] = (matriz[`${k}${i.xyz}`] || 0) + 1;
  }
  return { total: r2(total), porClasse, matriz };
};
