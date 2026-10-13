// Catálogo do Mercado Livre: textos dos status da API, oportunidades para ganhar o botão de compra e a conferência
// dos produtos candidatos (o produto de catálogo é de uma marca: entrar no de outra gera reclamação). Regras puras.

export const ELEGIBILIDADE: Record<string, { texto: string; cor: string }> = {
  READY_FOR_OPTIN: { texto: 'Pode entrar no catálogo', cor: 'blue' },
  ALREADY_OPTED_IN: { texto: 'Já está no catálogo', cor: 'green' },
  COMPETING: { texto: 'Anúncio de catálogo', cor: 'green' },
  PRODUCT_INACTIVE: { texto: 'Produto do catálogo ainda inativo', cor: 'default' },
  NOT_ELIGIBLE: { texto: 'Não pode entrar no catálogo', cor: 'default' },
  CLOSED: { texto: 'Anúncio encerrado', cor: 'default' },
};

export const DISPUTA: Record<string, { texto: string; cor: string }> = {
  winning: { texto: 'Ganhando o botão de compra', cor: 'green' },
  sharing_first_place: { texto: 'Dividindo o primeiro lugar', cor: 'gold' },
  competing: { texto: 'Disputando (perdendo)', cor: 'orange' },
  listed: { texto: 'Só listado (não disputa)', cor: 'red' },
};

export const MOTIVOS: Record<string, string> = {
  non_trusted_seller: 'conta marcada como vendedor não confiável',
  reputation_below_threshold: 'reputação abaixo do mínimo para ganhar (melhora com vendas entregues no prazo e sem reclamação)',
  winner_has_better_reputation: 'o ganhador tem reputação melhor',
  manufacturing_time: 'o anúncio tem prazo de fabricação e o ganhador tem pronta entrega',
  temporarily_winning_manufacturing_time: 'ganhando por enquanto (prazo de fabricação)',
  temporarily_competing_manufacturing_time: 'disputando por enquanto (prazo de fabricação)',
  temporarily_winning_best_reputation_available: 'ganhando por enquanto (melhor reputação disponível)',
  temporarily_competing_best_reputation_available: 'disputando por enquanto (melhor reputação disponível)',
  item_paused: 'anúncio pausado',
  item_not_opted_in: 'o anúncio não está no catálogo',
  shipping_mode: 'a forma de envio é pior que a do ganhador (Mercado Envios ganha de envio próprio)',
  newbie_program_seller: 'limite de vendas do programa de vendedor iniciante',
};

export const OPORTUNIDADES: Record<string, string> = {
  fulfillment: 'Mercado Envios Full',
  free_installments: 'parcelamento sem juros',
  free_shipping: 'frete grátis',
  shipping_collect: 'envio com coleta',
  same_day_shipping: 'envio no mesmo dia',
  shipping_quarantine: 'envio normal',
};

/** price_to_win do ML no formato da tela. */
export const lerDisputa = (r: any) => (!r ? null : {
  status: String(r.status || ''),
  precoAtual: Number(r.current_price) || null,
  precoParaGanhar: r.price_to_win === null || r.price_to_win === undefined ? null : Number(r.price_to_win),
  motivos: (r.reason || []).map((m: string) => MOTIVOS[m] || m),
  oportunidades: (r.boosts || []).filter((b: any) => b?.status === 'opportunity').map((b: any) => OPORTUNIDADES[b.id] || b.description || b.id),
  vantagens: (r.boosts || []).filter((b: any) => b?.status === 'boosted').map((b: any) => OPORTUNIDADES[b.id] || b.description || b.id),
  ganhador: r.winner ? { mlbId: String(r.winner.item_id || ''), preco: Number(r.winner.price) || null } : null,
  produtoId: r.catalog_product_id || null,
  dividindoCom: r.competitors_sharing_first_place ?? null,
});

const normal = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SEM_MARCA = new Set(['', 'sem marca', 'generica', 'generico']);

// Medidas: tudo vira mm para comparar (o catálogo usa cm, o cadastro pode estar em mm)
const PARA_MM: Record<string, number> = { mm: 1, cm: 10, m: 1000, pol: 25.4, '"': 25.4, in: 25.4 };
const lerMedida = (texto: string) => {
  const m = String(texto).replace(',', '.').match(/^\s*([\d.]+)\s*([a-z"]+)?\s*$/i);
  if (!m) return null;
  const fator = m[2] ? PARA_MM[m[2].toLowerCase()] : undefined;
  return { numero: Number(m[1]) * (fator ?? 1), comUnidade: fator !== undefined };
};
const NAO_COMPARAR = new Set(['BRAND', 'MODEL', 'GTIN', 'SELLER_SKU', 'ITEM_CONDITION', 'EMPTY_GTIN_REASON', 'MPN', 'LINE', 'ALPHANUMERIC_MODEL']);

/** Grafias quase iguais contam como iguais ("nilon" x "nylon"): até 1 letra de diferença em palavra longa. */
const quaseIgual = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  const ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = ant[0];
    ant[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = ant[j];
      ant[j] = Math.min(ant[j] + 1, ant[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = guardado;
    }
  }
  return ant[b.length] <= 1;
};

/**
 * Compara os atributos do produto do catálogo com os do item (os que o anúncio já liga). Número/medida diferente
 * é outro produto (trava); texto diferente (material, nome da cor) fica para o operador conferir.
 */
export const compararAtributos = (
  produtoAtributos: any[], itemValores: Record<string, { valor: string; unidade: string | null } | null>, ignorar: Set<string> = new Set()
) => {
  const conferem: string[] = [];
  const diferentes: { nome: string; catalogo: string; item: string }[] = [];
  const conferir: { nome: string; catalogo: string; item: string }[] = [];
  for (const a of produtoAtributos || []) {
    const v = itemValores[a?.id];
    if (!v || NAO_COMPARAR.has(a.id) || ignorar.has(a.id) || !a.value_name) continue;
    const doItem = `${v.valor}${v.unidade ? ` ${v.unidade}` : ''}`;
    const p = lerMedida(a.value_name);
    const i = lerMedida(doItem);
    const numerico = Boolean(p && i);
    const iguais = numerico
      ? Math.abs(p!.numero - i!.numero) <= Math.max(0.01, p!.numero * 0.01)
      : quaseIgual(normal(a.value_name), normal(doItem));
    const linha = { nome: a.name || a.id, catalogo: a.value_name, item: doItem };
    if (iguais) conferem.push(linha.nome);
    else if (numerico) diferentes.push(linha);
    else conferir.push(linha);
  }
  return { conferem, diferentes, conferir };
};

/**
 * Confere um produto do catálogo com o item: código de barras igual é certeza; senão, precisa da mesma marca e
 * de nenhum atributo divergente (medida, unidades, cor). Outra marca ou outra medida = produto diferente.
 */
export const conferirCandidato = (
  produto: any, item: { marca: string | null; gtin: string | null; valores?: Record<string, { valor: string; unidade: string | null } | null> }
) => {
  const atributo = (id: string) => (produto?.attributes || []).find((a: any) => a.id === id);
  const marca = atributo('BRAND')?.value_name || null;
  const gtins = (atributo('GTIN')?.values || []).map((v: any) => String(v?.name || '').replace(/\D/g, '')).filter(Boolean);
  const gtinConfere = !!item.gtin && gtins.includes(String(item.gtin).replace(/\D/g, ''));
  const marcaItem = normal(item.marca);
  const marcaConfere = !SEM_MARCA.has(marcaItem) && normal(marca) === marcaItem;
  const comparacao = compararAtributos(produto?.attributes || [], item.valores || {});
  return {
    produtoId: String(produto?.id || ''),
    nome: String(produto?.name || ''),
    marca,
    modelo: atributo('MODEL')?.value_name || null,
    unidades: atributo('UNITS_PER_PACK')?.value_name || atributo('UNITS_PER_PACKAGE')?.value_name || null,
    foto: produto?.pictures?.[0]?.url || null,
    gtinConfere,
    marcaConfere,
    conferem: comparacao.conferem,
    diferentes: comparacao.diferentes,
    conferir: comparacao.conferir,
    // pode entrar: código de barras igual, ou a mesma marca sem nenhum atributo divergente
    podeEntrar: gtinConfere || (marcaConfere && comparacao.diferentes.length === 0),
  };
};

/** Melhores primeiro: código de barras, depois mesma marca; os de outra marca vão por último. */
export const ordenarCandidatos = <T extends { gtinConfere: boolean; marcaConfere: boolean; podeEntrar: boolean; conferem: string[] }>(lista: T[]) =>
  [...lista].sort((a, b) => Number(b.gtinConfere) - Number(a.gtinConfere) || Number(b.podeEntrar) - Number(a.podeEntrar)
    || Number(b.marcaConfere) - Number(a.marcaConfere) || b.conferem.length - a.conferem.length);
