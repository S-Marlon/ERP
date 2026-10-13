// Regras puras dos anúncios do Mercado Livre: atributos da categoria, valores vindos do ERP, variações e pendências.

/** Atributo de uma categoria do ML já filtrado para o que o vendedor preenche. */
export interface AtributoML {
  id: string;
  nome: string;
  tipo: string;                     // string, number, number_unit, list, boolean...
  obrigatorio: boolean;
  permiteVariar: boolean;           // allow_variations: pode ser eixo de variação (ex.: Voltagem)
  porVariacao: boolean;             // variation_attribute: pode ter valor diferente em cada variação (ex.: SKU)
  valores: { id: string; nome: string }[];
  unidades: string[];
  unidadePadrao: string | null;
}

/** De onde vem o valor de um atributo do ML no anúncio. */
export type ValorAtributo =
  | { origem: 'erp'; atributoId: number }        // atributo do nosso cadastro (pode mudar por item)
  | { origem: 'marca' }                          // marca do item (ou da família)
  | { origem: 'fixo'; valor: string; valorId?: string | null; unidade?: string | null };

export interface ItemAnuncio {
  idItem: number;
  sku: string;
  nome: string;
  ativo: boolean;
  preco: number;                    // preço de venda do ERP
  precoMl: number | null;           // preço só no ML (vazio = ERP + ajuste do anúncio)
  estoque: number;                  // saldo do ERP (kit: quantos dá para montar)
  estoqueMl?: number;               // o que vai para o ML depois da reserva da loja e do teto
  kit?: boolean;
  fotos: number;
  fotoUrl: string | null;
  gtin: string | null;
  pesoKg: number | null;
  medidasCm: { altura: number; largura: number; comprimento: number } | null;
  marca: string | null;
  valoresErp: Record<string, string | null>;     // id do atributo nosso -> valor
  motivosCadastro: string[];                     // o que falta no cadastro interno (PIM)
}

export interface AnuncioDados {
  titulo: string | null;
  categoriaMl: string | null;
  descricao: string | null;
  ajustePreco: number;              // % sobre o preço do ERP
  fotoFamilia?: string | null;      // foto da família: vale para o item que não tem foto própria
  atributos: Record<string, ValorAtributo>;
}

export interface CategoriaInfo {
  id: string;
  final: boolean;                   // dá para anunciar nela (sem subcategorias)
  maxTitulo: number;
  maxVariacoes: number;
  maxFotos: number;
}

export interface Pendencia {
  nivel: 'erro' | 'aviso';
  area: 'dados' | 'itens' | 'atributos' | 'cadastro';
  texto: string;
  idItem?: number;
  atributo?: string;
}

const ATRIBUTOS_AUTOMATICOS = new Set(['GTIN', 'SELLER_SKU', 'ITEM_CONDITION', 'EMPTY_GTIN_REASON']);

/** Filtra os atributos brutos de /categories/:id/attributes (some com os ocultos e só-leitura). */
export const filtrarAtributosCategoria = (brutos: any[]): AtributoML[] =>
  (brutos || [])
    .filter(a => a && !a.tags?.hidden && !a.tags?.read_only && !a.tags?.fixed && !ATRIBUTOS_AUTOMATICOS.has(a.id))
    .map(a => ({
      id: String(a.id),
      nome: String(a.name || a.id),
      tipo: String(a.value_type || 'string'),
      obrigatorio: Boolean(a.tags?.required || a.tags?.catalog_required),
      permiteVariar: Boolean(a.tags?.allow_variations),
      porVariacao: Boolean(a.tags?.variation_attribute),
      valores: (a.values || []).map((v: any) => ({ id: String(v.id), nome: String(v.name) })),
      unidades: (a.allowed_units || []).map((u: any) => String(u.id)),
      unidadePadrao: a.default_unit || null,
    }))
    .sort((x, y) => Number(y.obrigatorio) - Number(x.obrigatorio) || Number(y.permiteVariar) - Number(x.permiteVariar));

export const categoriaInfo = (c: any): CategoriaInfo => ({
  id: String(c.id),
  final: (c.children_categories || []).length === 0 && c.settings?.listing_allowed !== false,
  maxTitulo: Number(c.settings?.max_title_length) || 60,
  maxVariacoes: Number(c.settings?.max_variations_allowed) || 100,
  maxFotos: Number(c.settings?.max_pictures_per_item_var) || 10,
});

export const normalizar = (s: string | null | undefined) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Sugere de onde tirar o valor de cada atributo do ML: marca, ou atributo nosso com o mesmo nome. */
export const sugerirAtributos = (
  atributos: AtributoML[], atributosErp: { id: number; nome: string }[], jaDefinidos: Record<string, ValorAtributo>
): Record<string, ValorAtributo> => {
  const novo: Record<string, ValorAtributo> = { ...jaDefinidos };
  const porNome = new Map(atributosErp.map(a => [normalizar(a.nome), a.id]));
  for (const a of atributos) {
    if (novo[a.id]) continue;
    if (a.id === 'BRAND') { novo[a.id] = { origem: 'marca' }; continue; }
    const id = porNome.get(normalizar(a.nome));
    if (id) novo[a.id] = { origem: 'erp', atributoId: id };
  }
  return novo;
};

// No ML o produto sem marca vai como "Genérica"
const SEM_MARCA = new Set(['sem marca', 'generica', 'generico', 'nenhuma']);

export interface ValorResolvido { valor: string; valorId: string | null; unidade: string | null }

/** Valor do atributo para um item; na lista do ML usa o id da opção quando o nome bate. */
export const resolverValor = (atributo: AtributoML | undefined, origem: ValorAtributo | undefined, item: ItemAnuncio): ValorResolvido | null => {
  if (!origem) return null;
  let valor: string | null = null;
  let valorId: string | null = null;
  let unidade: string | null = null;
  if (origem.origem === 'marca') valor = SEM_MARCA.has(normalizar(item.marca)) ? 'Genérica' : item.marca;
  else if (origem.origem === 'erp') valor = item.valoresErp[String(origem.atributoId)] ?? null;
  else { valor = origem.valor; valorId = origem.valorId || null; unidade = origem.unidade || null; }
  if (valor === null || String(valor).trim() === '') return null;
  valor = String(valor).trim();
  if (!valorId && atributo?.valores.length) {
    const n = normalizar(valor);
    valorId = atributo.valores.find(v => normalizar(v.nome) === n)?.id || null;
  }
  if (atributo?.tipo === 'number_unit' && !unidade) {
    // "10 bar" -> 10 + bar; sem unidade usa a padrão do ML
    const m = valor.match(/^([\d.,]+)\s*([^\d\s].*)?$/);
    if (m) { valor = m[1].replace(',', '.'); unidade = m[2]?.trim() || atributo.unidadePadrao; }
  }
  return { valor, valorId, unidade };
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Preço no ML: o preço próprio do item no anúncio, ou o do ERP com o ajuste do anúncio. */
export const precoNoMl = (item: Pick<ItemAnuncio, 'preco' | 'precoMl'>, ajustePreco: number) =>
  item.precoMl !== null && item.precoMl !== undefined ? r2(item.precoMl) : r2(item.preco * (1 + (Number(ajustePreco) || 0) / 100));

/** Atributos que viram eixo de variação: os que permitem variar e têm valores diferentes entre os itens. */
export const eixosDeVariacao = (atributos: AtributoML[], dados: AnuncioDados, itens: ItemAnuncio[]) =>
  atributos.filter(a => {
    if (!a.permiteVariar || !dados.atributos[a.id]) return false;
    const distintos = new Set(itens.map(i => normalizar(resolverValor(a, dados.atributos[a.id], i)?.valor)));
    return distintos.size > 1;
  });

const listaNomes = (itens: ItemAnuncio[], max = 3) =>
  itens.slice(0, max).map(i => i.sku || i.nome).join(', ') + (itens.length > max ? ` e mais ${itens.length - max}` : '');

/** Tudo o que falta para publicar (erros travam a publicação; avisos não). */
export const pendenciasAnuncio = (
  dados: AnuncioDados, itens: ItemAnuncio[], categoria: CategoriaInfo | null, atributos: AtributoML[], temGtinNaCategoria = true
): Pendencia[] => {
  const p: Pendencia[] = [];
  const erro = (area: Pendencia['area'], texto: string, extra: Partial<Pendencia> = {}) => p.push({ nivel: 'erro', area, texto, ...extra });
  const aviso = (area: Pendencia['area'], texto: string, extra: Partial<Pendencia> = {}) => p.push({ nivel: 'aviso', area, texto, ...extra });

  // Dados do anúncio
  if (!dados.categoriaMl) erro('dados', 'Escolha a categoria do Mercado Livre.');
  else if (categoria && !categoria.final) erro('dados', 'A categoria escolhida tem subcategorias: escolha a mais específica.');
  const titulo = (dados.titulo || '').trim();
  const maxTitulo = categoria?.maxTitulo || 60;
  if (!titulo) erro('dados', 'Informe o título do anúncio.');
  else if (titulo.length > maxTitulo) erro('dados', `Título com ${titulo.length} caracteres: o máximo é ${maxTitulo}.`);
  if (!(dados.descricao || '').trim()) aviso('dados', 'Sem descrição: o anúncio vende melhor com medidas, aplicação e o que vem na embalagem.');

  // Itens
  if (itens.length === 0) { erro('itens', 'Adicione ao menos um item do catálogo.'); return p; }
  if (categoria && itens.length > categoria.maxVariacoes) erro('itens', `São ${itens.length} itens: a categoria aceita até ${categoria.maxVariacoes} variações.`);
  for (const i of itens) {
    if (!i.ativo) erro('itens', `${i.sku}: item inativo no catálogo.`, { idItem: i.idItem });
    if (i.fotos === 0) {
      if (dados.fotoFamilia) aviso('itens', `${i.sku}: sem foto própria: vai a foto da família.`, { idItem: i.idItem });
      else erro('itens', `${i.sku}: sem foto (o Mercado Livre exige ao menos uma): envie a do item ou a foto da família.`, { idItem: i.idItem });
    }
    if (!(precoNoMl(i, dados.ajustePreco) > 0)) erro('itens', `${i.sku}: sem preço de venda.`, { idItem: i.idItem });
    const noMl = i.estoqueMl ?? Math.max(0, Math.floor(i.estoque));
    if (!(noMl > 0)) {
      aviso('itens', i.estoque > 0
        ? `${i.sku}: estoque todo reservado para a loja (entra com 0 no ML).`
        : `${i.sku}: sem estoque (entra com quantidade 0).`, { idItem: i.idItem });
    }
    if (temGtinNaCategoria && !i.gtin) {
      const marca = resolverValor(atributos.find(a => a.id === 'BRAND'), dados.atributos.BRAND, i)?.valor;
      if (marca && !SEM_MARCA.has(normalizar(marca))) {
        aviso('itens', `${i.sku}: sem código de barras (GTIN): com marca "${marca}" o ML costuma exigir o GTIN.`, { idItem: i.idItem });
      } else {
        aviso('itens', `${i.sku}: sem código de barras (GTIN): vai como "produto sem código".`, { idItem: i.idItem });
      }
    }
    if (!i.pesoKg || !i.medidasCm) aviso('itens', `${i.sku}: sem peso ou medidas da embalagem (o ML estima o frete).`, { idItem: i.idItem });
    for (const m of i.motivosCadastro) aviso('cadastro', `${i.sku}: ${m}`, { idItem: i.idItem });
  }
  if (!dados.categoriaMl) return p;

  // Atributos
  for (const a of atributos) {
    const origem = dados.atributos[a.id];
    const semValor = itens.filter(i => !resolverValor(a, origem, i));
    if (a.obrigatorio && semValor.length > 0) {
      erro('atributos', semValor.length === itens.length
        ? `Atributo obrigatório "${a.nome}" sem valor.`
        : `Atributo obrigatório "${a.nome}" sem valor em ${listaNomes(semValor)}.`, { atributo: a.id });
    }
    if (!origem || a.valores.length === 0 || a.tipo !== 'list') continue;
    const foraDaLista = itens.filter(i => { const v = resolverValor(a, origem, i); return v && !v.valorId; });
    if (foraDaLista.length > 0) aviso('atributos', `"${a.nome}": valor fora da lista do ML em ${listaNomes(foraDaLista)}.`, { atributo: a.id });
  }

  // Variações: na conta com User Products cada item é um anúncio e o ML agrupa pelo nome da família,
  // mostrando como opção o que muda entre eles
  if (itens.length > 1) {
    const eixos = eixosDeVariacao(atributos, dados, itens);
    if (eixos.length === 0) {
      const possiveis = atributos.filter(a => a.permiteVariar).map(a => a.nome);
      aviso('atributos', possiveis.length
        ? `Nenhum atributo de variação muda entre os ${itens.length} itens (${possiveis.slice(0, 4).join(', ')}): o ML pode mostrar cada item como anúncio separado.`
        : 'A categoria não tem atributo de variação: no ML cada item aparece como anúncio separado.');
    } else {
      const vistos = new Map<string, ItemAnuncio>();
      for (const i of itens) {
        const chave = eixos.map(a => normalizar(resolverValor(a, dados.atributos[a.id], i)?.valor)).join('|');
        const outro = vistos.get(chave);
        if (outro) aviso('atributos', `${outro.sku} e ${i.sku} ficam iguais nas opções do ML (${eixos.map(a => a.nome).join(', ')}).`, { idItem: i.idItem });
        else vistos.set(chave, i);
      }
    }
  }
  return p;
};

/** Situação do anúncio para a lista. */
export const situacaoPreparo = (pendencias: Pendencia[]) =>
  pendencias.some(x => x.nivel === 'erro') ? 'PENDENTE' : 'PRONTO';

const SIGLAS = new Set(['JIC', 'NPT', 'NPTF', 'BSP', 'BSPP', 'BSPT', 'ORFS', 'SAE', 'DIN', 'ISO', 'PVC', 'NBR', 'UNF', 'UNC', 'PN', 'DN', 'CV', 'HP', 'PU', 'PP', 'PE', 'INOX', 'ABNT', 'LED', 'USB']);

/** Título todo em maiúsculas vira normal (o ML pede para não gritar), mantendo as siglas técnicas. */
export const tituloLegivel = (s: string) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!/[A-ZÀ-Ý]/.test(t) || t !== t.toUpperCase()) return t;
  return t.split(' ').map((p, k) => {
    if (SIGLAS.has(p.replace(/[^A-Z]/g, '')) && /^[A-Z]+$/.test(p.replace(/[^A-Za-z]/g, ''))) return p;
    if (/\d/.test(p)) return p.toLowerCase() === 'x' ? 'x' : p;
    const baixo = p.toLowerCase();
    return k === 0 ? baixo.charAt(0).toUpperCase() + baixo.slice(1) : baixo;
  }).join(' ');
};

/** Corta o título no limite, na palavra, sem deixar separador pendurado no fim. */
export const cortarTitulo = (s: string, max = 60) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  const limpar = (x: string) => x.replace(/[\s\-–,/]+$/, '').trim();
  if (t.length <= max) return limpar(t);
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return limpar(espaco > max * 0.6 ? corte.slice(0, espaco) : corte);
};

// ---------------------------------------------------------------------------
// Envio ao ML
// ---------------------------------------------------------------------------

export const MOTIVO_SEM_GTIN = '17055160';   // EMPTY_GTIN_REASON: "O produto não tem código cadastrado"

export interface AtributoEnvio { id: string; value_id?: string; value_name?: string }

const numeroMl = (n: number) => String(Math.round(n * 100) / 100);

/** Atributos de um item para o ML: os da categoria + SKU, GTIN (ou o motivo de não ter) e a embalagem. */
export const atributosDoItem = (atributos: AtributoML[], dados: AnuncioDados, item: ItemAnuncio, temGtin: boolean): AtributoEnvio[] => {
  const saida: AtributoEnvio[] = [];
  for (const a of atributos) {
    const v = resolverValor(a, dados.atributos[a.id], item);
    if (!v) continue;
    const nome = a.tipo === 'number_unit' && v.unidade ? `${v.valor} ${v.unidade}` : v.valor;
    saida.push(v.valorId ? { id: a.id, value_id: v.valorId, value_name: nome } : { id: a.id, value_name: nome });
  }
  if (item.sku) saida.push({ id: 'SELLER_SKU', value_name: item.sku });
  if (temGtin) saida.push(item.gtin ? { id: 'GTIN', value_name: item.gtin } : { id: 'EMPTY_GTIN_REASON', value_id: MOTIVO_SEM_GTIN });
  if (item.medidasCm) {
    saida.push({ id: 'SELLER_PACKAGE_HEIGHT', value_name: `${numeroMl(item.medidasCm.altura)} cm` });
    saida.push({ id: 'SELLER_PACKAGE_WIDTH', value_name: `${numeroMl(item.medidasCm.largura)} cm` });
    saida.push({ id: 'SELLER_PACKAGE_LENGTH', value_name: `${numeroMl(item.medidasCm.comprimento)} cm` });
  }
  if (item.pesoKg) saida.push({ id: 'SELLER_PACKAGE_WEIGHT', value_name: `${Math.max(1, Math.round(item.pesoKg * 1000))} g` });
  return saida;
};

export type FotoEnvio = { id: string } | { source: string };

/**
 * Corpo do POST /items de um item. Conta com User Products (porFamilia) manda family_name e o ML monta o título
 * e agrupa os itens da mesma família; conta antiga manda o título.
 */
export const corpoDoItem = (p: {
  dados: AnuncioDados; tipoAnuncio: string; condicao: string; item: ItemAnuncio; atributos: AtributoML[];
  temGtin: boolean; fotos: FotoEnvio[]; porFamilia: boolean;
}) => {
  const titulo = (p.dados.titulo || '').trim();
  return {
    ...(p.porFamilia ? { family_name: titulo } : { title: titulo }),
    category_id: p.dados.categoriaMl,
    price: precoNoMl(p.item, p.dados.ajustePreco),
    currency_id: 'BRL',
    available_quantity: p.item.estoqueMl ?? Math.max(0, Math.floor(p.item.estoque)),
    buying_mode: 'buy_it_now',
    condition: p.condicao === 'used' ? 'used' : 'new',
    listing_type_id: p.tipoAnuncio,
    pictures: p.fotos,
    attributes: atributosDoItem(p.atributos, p.dados, p.item, p.temGtin),
  };
};

/** Foto menor que o ML aceita (pelo menos 500 px num dos lados), a partir do "max_size" do upload ("498x343"). */
export const fotoPequena = (maxSize: string | null | undefined) => {
  const m = String(maxSize || '').match(/^(\d+)x(\d+)$/);
  return m ? Math.max(Number(m[1]), Number(m[2])) < 500 : false;
};

// As mensagens mais comuns do validador, em português
const TRADUCOES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/The attributes \[(.+?)\] are required for category/i, m => `O ML exige os atributos: ${m[1]}.`],
  [/The fields \[(.+?)\] are invalid/i, m => `Campos recusados pelo ML: ${m[1]}.`],
  [/The body does not contains? some or none of the following properties \[(.+?)\]/i, m => `Faltou enviar: ${m[1]}.`],
  [/Attribute \[(.+?)\] is not valid/i, m => `Valor inválido no atributo ${m[1]}.`],
  [/title.*(too long|length)/i, () => 'Título maior do que o ML aceita.'],
  [/price.*(minimum|lower|invalid)/i, () => 'Preço fora do que o ML aceita para a categoria.'],
];
export const traduzirErroMl = (msg: string) => {
  for (const [re, f] of TRADUCOES) { const m = msg.match(re); if (m) return f(m); }
  return msg;
};

/** Mensagens do validador do ML ({ cause: [...] }), só os erros. */
export const errosDoValidador = (d: any): string[] => {
  const causas = Array.isArray(d?.cause) ? d.cause : [];
  const erros = causas.filter((c: any) => c?.type !== 'warning').map((c: any) => traduzirErroMl(String(c.message || c.code)));
  if (erros.length) return erros;
  if (d?.error && d.error !== 'validation_error') return [traduzirErroMl(String(d.error))];
  return d?.message ? [String(d.message)] : [];
};

const skuNormal = (s: string | null | undefined) => String(s ?? '').trim().toUpperCase();

/** Liga um anúncio que já está no ML a um item do ERP pelo SKU (o customizado ou o raiz). */
export const ligarPorSku = <T extends { idItem: number; sku: string; skuRaiz?: string }>(skuMl: string | null, itensErp: T[]): T | null => {
  const s = skuNormal(skuMl);
  if (!s) return null;
  return itensErp.find(i => skuNormal(i.sku) === s) || itensErp.find(i => skuNormal(i.skuRaiz) === s) || null;
};

export const SITUACAO_POR_STATUS: Record<string, string> = {
  active: 'PUBLICADO', under_review: 'PUBLICADO', paused: 'PAUSADO', inactive: 'PAUSADO', closed: 'ENCERRADO',
};

// ---------------------------------------------------------------------------
// Estoque dividido entre a loja e o ML
// ---------------------------------------------------------------------------

/** reserva: unidades que ficam para a loja; maximo: teto no ML (null = sem teto). */
export interface RegraEstoque { reserva: number; maximo: number | null }

/** Regra do item: a própria quando informada, senão a do anúncio. */
export const regraDoItem = (doAnuncio: RegraEstoque, doItem: { reserva: number | null; maximo: number | null }): RegraEstoque => ({
  reserva: doItem.reserva ?? doAnuncio.reserva,
  maximo: doItem.maximo ?? doAnuncio.maximo,
});

/** Quantidade que vai para o ML: saldo menos a reserva da loja, limitado ao teto (sempre inteiro, nunca negativo). */
export const estoqueParaMl = (saldo: number, regra: RegraEstoque) => {
  const livre = Math.max(0, Math.floor((Number(saldo) || 0) - (Number(regra.reserva) || 0)));
  return regra.maximo === null || regra.maximo === undefined ? livre : Math.min(livre, Math.max(0, Math.floor(regra.maximo)));
};

/** O que mudou desde o último envio (null = nada a mandar). */
export const mudancasParaMl = (
  enviado: { estoque: number | null; preco: number | null }, atual: { estoque: number; preco: number }
): { available_quantity?: number; price?: number } | null => {
  const corpo: { available_quantity?: number; price?: number } = {};
  if (enviado.estoque === null || Number(enviado.estoque) !== atual.estoque) corpo.available_quantity = atual.estoque;
  if (atual.preco > 0 && (enviado.preco === null || Math.abs(Number(enviado.preco) - atual.preco) >= 0.005)) corpo.price = atual.preco;
  return Object.keys(corpo).length ? corpo : null;
};
