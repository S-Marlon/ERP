// Rascunho do editor de anúncio: as mudanças ficam aqui até o operador salvar. Dá a lista "antes → depois"
// (com desfazer por linha) e os corpos para gravar. Regras puras, testadas em rascunhoAnuncio.test.ts.
import type { AnuncioDetalhe, FaixaQuantidade, ItemDoAnuncio, ValorAtributo } from './mercadoLivreApi';

export interface RascunhoAnuncio {
  titulo?: string;
  modeloTitulo?: string;
  tipoAnuncio?: string;
  condicao?: string;
  descricao?: string;
  ajustePreco?: number;
  estoqueReserva?: number;
  estoqueMaximo?: number | null;
  estoqueAutomatico?: boolean;
  atributos?: Record<string, ValorAtributo>;        // o mapa inteiro, quando algum atributo mudou
  faixasQuantidade?: FaixaQuantidade[];
  freteGratis?: boolean;                             // só anúncio publicado (vai ao ML ao salvar)
}
export interface RascunhoItem { precoMl?: number | null; estoqueReserva?: number | null; estoqueMaximo?: number | null; idUnidade?: number | null }
export interface Rascunho { anuncio: RascunhoAnuncio; itens: Record<number, RascunhoItem> }

export const RASCUNHO_VAZIO: Rascunho = { anuncio: {}, itens: {} };

type CampoAnuncio = Exclude<keyof RascunhoAnuncio, 'atributos'>;
type CampoItem = keyof RascunhoItem;

/** Atributo em forma estável para comparar (campos vazios iguais a null). */
const chaveAtributo = (v: ValorAtributo | undefined) => {
  if (!v) return '';
  if (v.origem === 'fixo') return JSON.stringify(['fixo', v.valor, v.valorId || null, v.unidade || null]);
  if (v.origem === 'erp') return JSON.stringify(['erp', v.atributoId]);
  return JSON.stringify([v.origem]);
};
const mesmosAtributos = (a: Record<string, ValorAtributo>, b: Record<string, ValorAtributo>) => {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...ids].every(id => chaveAtributo(a[id]) === chaveAtributo(b[id]));
};
const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Valor salvo de cada campo do anúncio (o que está no banco). */
export const originalAnuncio = (det: AnuncioDetalhe, campo: CampoAnuncio): unknown => ({
  titulo: det.titulo || '', modeloTitulo: det.modeloTitulo || '', tipoAnuncio: det.tipoAnuncio, condicao: det.condicao,
  descricao: det.descricao || '', ajustePreco: det.ajustePreco, estoqueReserva: det.estoqueReserva, estoqueMaximo: det.estoqueMaximo,
  estoqueAutomatico: det.estoqueAutomatico, faixasQuantidade: det.faixasGerenciadas ? det.faixasQuantidade : null,
  freteGratis: det.vendaMl ? det.vendaMl.freteGratis : null,
} as Record<CampoAnuncio, unknown>)[campo];

export const originalItem = (item: ItemDoAnuncio, campo: CampoItem): unknown => ({
  precoMl: item.precoMl, estoqueReserva: item.ml?.regra?.reserva ?? null, estoqueMaximo: item.ml?.regra?.maximo ?? null,
  idUnidade: item.unidadeMl?.idUnidade ?? null,
} as Record<CampoItem, unknown>)[campo];

/** Muda um campo do anúncio; voltar ao valor salvo tira do rascunho. */
export const mudarAnuncio = <K extends CampoAnuncio>(r: Rascunho, det: AnuncioDetalhe, campo: K, valor: RascunhoAnuncio[K]): Rascunho => {
  const anuncio = { ...r.anuncio };
  if (igual(valor, originalAnuncio(det, campo))) delete anuncio[campo];
  else anuncio[campo] = valor;
  return { ...r, anuncio };
};

/** Muda (ou tira, com null) um atributo; o rascunho guarda o mapa inteiro. */
export const mudarAtributo = (r: Rascunho, det: AnuncioDetalhe, idAtributo: string, valor: ValorAtributo | null): Rascunho => {
  const mapa = { ...(r.anuncio.atributos ?? det.atributos) };
  if (valor) mapa[idAtributo] = valor; else delete mapa[idAtributo];
  const anuncio = { ...r.anuncio };
  if (mesmosAtributos(mapa, det.atributos)) delete anuncio.atributos; else anuncio.atributos = mapa;
  return { ...r, anuncio };
};

export const mudarItem = <K extends CampoItem>(r: Rascunho, det: AnuncioDetalhe, idItem: number, campo: K, valor: RascunhoItem[K]): Rascunho => {
  const item = det.itens.find(i => i.idItem === idItem);
  if (!item) return r;
  const doItem = { ...(r.itens[idItem] || {}) };
  if (igual(valor, originalItem(item, campo))) delete doItem[campo]; else doItem[campo] = valor;
  const itens = { ...r.itens };
  if (Object.keys(doItem).length) itens[idItem] = doItem; else delete itens[idItem];
  return { ...r, itens };
};

/** Valor que vale na tela: o do rascunho, senão o salvo. */
export const valorAnuncio = <K extends CampoAnuncio>(det: AnuncioDetalhe, r: Rascunho, campo: K) =>
  (campo in r.anuncio ? r.anuncio[campo] : originalAnuncio(det, campo)) as Exclude<RascunhoAnuncio[K], undefined> | null;
export const atributosEfetivos = (det: AnuncioDetalhe, r: Rascunho) => r.anuncio.atributos ?? det.atributos;
export const valorItem = <K extends CampoItem>(item: ItemDoAnuncio, r: Rascunho, campo: K) => {
  const doItem = r.itens[item.idItem];
  return (doItem && campo in doItem ? doItem[campo] : originalItem(item, campo)) as RascunhoItem[K] | null;
};

/** Tira do rascunho o que já ficou igual ao salvo (depois de gravar ou recarregar). */
export const limparIguais = (r: Rascunho, det: AnuncioDetalhe): Rascunho => {
  let novo: Rascunho = { anuncio: {}, itens: {} };
  for (const [campo, valor] of Object.entries(r.anuncio)) {
    novo = campo === 'atributos'
      ? mudarAtributosInteiros(novo, det, valor as Record<string, ValorAtributo>)
      : mudarAnuncio(novo, det, campo as CampoAnuncio, valor as never);
  }
  for (const [id, campos] of Object.entries(r.itens)) {
    for (const [campo, valor] of Object.entries(campos)) novo = mudarItem(novo, det, Number(id), campo as CampoItem, valor as never);
  }
  return novo;
};
const mudarAtributosInteiros = (r: Rascunho, det: AnuncioDetalhe, mapa: Record<string, ValorAtributo>): Rascunho =>
  (mesmosAtributos(mapa, det.atributos) ? r : { ...r, anuncio: { ...r.anuncio, atributos: mapa } });

// ---------------------------------------------------------------------------
// Lista "antes → depois"
// ---------------------------------------------------------------------------

export interface Alteracao { chave: string; grupo: string; rotulo: string; antes: string; depois: string; vaiAoMl: 'NA_HORA' | 'BOTAO' | 'NAO' }

const moeda = (v: unknown) => (v === null || v === undefined ? '—' : `R$ ${Number(v).toFixed(2).replace('.', ',')}`);
const texto = (v: unknown, vazio = '(vazio)') => (v === null || v === undefined || String(v).trim() === '' ? vazio : String(v));
const cortar = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}…` : s);

export const descreverAtributo = (v: ValorAtributo | undefined, nomeErp: (id: number) => string) => {
  if (!v) return '— sem valor —';
  if (v.origem === 'marca') return 'Marca do item';
  if (v.origem === 'erp') return `Do cadastro: ${nomeErp(v.atributoId)}`;
  return `${v.valor}${v.unidade ? ` ${v.unidade}` : ''}`;
};
const descreverFaixas = (f: FaixaQuantidade[] | null | undefined) =>
  (f === null || f === undefined ? 'o ERP não mexe' : f.length ? f.map(x => `${x.minimo}+ −${x.desconto}%`).join(', ') : 'sem faixas');

const ROTULOS: Record<CampoAnuncio, { grupo: string; rotulo: string; formato: (v: unknown) => string }> = {
  titulo: { grupo: 'Anúncio', rotulo: 'Título', formato: v => texto(v) },
  modeloTitulo: { grupo: 'Anúncio', rotulo: 'Título de cada item', formato: v => texto(v, '{nome}') },
  tipoAnuncio: { grupo: 'Venda no ML', rotulo: 'Tipo de anúncio', formato: v => (v === 'gold_pro' ? 'Premium' : 'Clássico') },
  condicao: { grupo: 'Anúncio', rotulo: 'Condição', formato: v => (v === 'used' ? 'Usado' : 'Novo') },
  descricao: { grupo: 'Anúncio', rotulo: 'Descrição', formato: v => cortar(texto(v)) },
  ajustePreco: { grupo: 'Preço', rotulo: 'Ajuste sobre o preço do ERP', formato: v => `${Number(v || 0)}%` },
  estoqueReserva: { grupo: 'Estoque', rotulo: 'Reserva da loja', formato: v => `${Number(v || 0)} un.` },
  estoqueMaximo: { grupo: 'Estoque', rotulo: 'Teto no ML', formato: v => (v === null || v === undefined ? 'sem teto' : `${v} un.`) },
  estoqueAutomatico: { grupo: 'Estoque', rotulo: 'Atualizar sozinho', formato: v => (v ? 'Ligado' : 'Desligado') },
  faixasQuantidade: { grupo: 'Preço', rotulo: 'Preço por quantidade', formato: v => descreverFaixas(v as FaixaQuantidade[] | null) },
  freteGratis: { grupo: 'Venda no ML', rotulo: 'Frete grátis', formato: v => (v === null || v === undefined ? '—' : v ? 'Ligado (você paga o frete)' : 'Desligado (o comprador paga)') },
};

/** Tudo o que mudou, na ordem da tela. vaiAoMl: o que vai sozinho ao salvar, o que precisa do "enviar ao ML" e o que não vai. */
export const listarAlteracoes = (det: AnuncioDetalhe, r: Rascunho, nomes: { atributo: (id: string) => string; erp: (id: number) => string }): Alteracao[] => {
  const publicado = det.publicados > 0;
  const lista: Alteracao[] = [];
  for (const campo of Object.keys(ROTULOS) as CampoAnuncio[]) {
    if (!(campo in r.anuncio)) continue;
    const def = ROTULOS[campo];
    const naHora = ['ajustePreco', 'estoqueReserva', 'estoqueMaximo', 'faixasQuantidade', 'tipoAnuncio', 'freteGratis'].includes(campo);
    lista.push({
      chave: `a:${campo}`, grupo: def.grupo, rotulo: def.rotulo, antes: def.formato(originalAnuncio(det, campo)), depois: def.formato(r.anuncio[campo]),
      vaiAoMl: !publicado ? 'NAO' : naHora ? 'NA_HORA' : campo === 'descricao' ? 'BOTAO' : 'NAO',
    });
  }
  if (r.anuncio.atributos) {
    const novo = r.anuncio.atributos;
    const ids = [...new Set([...Object.keys(det.atributos), ...Object.keys(novo)])];
    for (const id of ids) {
      if (chaveAtributo(det.atributos[id]) === chaveAtributo(novo[id])) continue;
      lista.push({
        chave: `t:${id}`, grupo: 'Atributos', rotulo: nomes.atributo(id),
        antes: descreverAtributo(det.atributos[id], nomes.erp), depois: descreverAtributo(novo[id], nomes.erp), vaiAoMl: publicado ? 'BOTAO' : 'NAO',
      });
    }
  }
  for (const item of det.itens) {
    const doItem = r.itens[item.idItem];
    if (!doItem) continue;
    const noMl = !!item.ml?.mlbId;
    const unidade = (id: unknown) => (id ? item.unidades.find(u => u.idUnidade === id)?.sigla || `#${id}` : item.siglaBase || 'unidade base');
    const campos: [CampoItem, string, (v: unknown) => string][] = [
      ['precoMl', 'Preço no ML', v => (v === null || v === undefined ? 'ERP + ajuste' : moeda(v))],
      ['idUnidade', 'Vende no ML como', unidade],
      ['estoqueReserva', 'Reserva da loja', v => (v === null || v === undefined ? 'a do anúncio' : `${v} un.`)],
      ['estoqueMaximo', 'Teto no ML', v => (v === null || v === undefined ? 'o do anúncio' : `${v} un.`)],
    ];
    for (const [campo, rotulo, formato] of campos) {
      if (!(campo in doItem)) continue;
      lista.push({
        chave: `i:${item.idItem}:${campo}`, grupo: `Item ${item.sku}`, rotulo,
        antes: formato(originalItem(item, campo)), depois: formato(doItem[campo]), vaiAoMl: noMl ? 'NA_HORA' : 'NAO',
      });
    }
  }
  return lista;
};

/** Desfaz uma linha da lista. */
export const desfazer = (r: Rascunho, det: AnuncioDetalhe, chave: string): Rascunho => {
  const [tipo, a, b] = chave.split(':');
  if (tipo === 'a') { const anuncio = { ...r.anuncio }; delete anuncio[a as CampoAnuncio]; return { ...r, anuncio }; }
  if (tipo === 't') return mudarAtributo(r, det, a, det.atributos[a] || null);
  if (tipo === 'i') {
    const item = det.itens.find(i => i.idItem === Number(a));
    return item ? mudarItem(r, det, item.idItem, b as CampoItem, originalItem(item, b as CampoItem) as never) : r;
  }
  return r;
};

/** O que gravar: o corpo do anúncio (só o que mudou) e o de cada item. */
export const corposParaSalvar = (r: Rascunho) => ({
  anuncio: Object.keys(r.anuncio).length ? { ...r.anuncio } : null,
  itens: Object.entries(r.itens).map(([id, c]) => ({
    idItem: Number(id),
    corpo: {
      ...('precoMl' in c ? { preco: c.precoMl ?? null } : {}),
      ...('idUnidade' in c ? { idUnidade: c.idUnidade ?? null } : {}),
      ...('estoqueReserva' in c ? { estoqueReserva: c.estoqueReserva ?? null } : {}),
      ...('estoqueMaximo' in c ? { estoqueMaximo: c.estoqueMaximo ?? null } : {}),
    },
  })),
});

export const quantasAlteracoes = (r: Rascunho) =>
  Object.keys(r.anuncio).filter(k => k !== 'atributos').length + Object.values(r.itens).reduce((s, c) => s + Object.keys(c).length, 0) + (r.anuncio.atributos ? 1 : 0);

/** O anúncio como fica na tela com o rascunho aplicado (os cartões leem daqui; os números calculados seguem os salvos). */
export const comRascunho = (det: AnuncioDetalhe, r: Rascunho): AnuncioDetalhe => {
  const a = r.anuncio;
  return {
    ...det,
    ...('titulo' in a ? { titulo: a.titulo ?? '' } : {}),
    ...('modeloTitulo' in a ? { modeloTitulo: a.modeloTitulo ?? '' } : {}),
    ...('tipoAnuncio' in a ? { tipoAnuncio: a.tipoAnuncio! } : {}),
    ...('condicao' in a ? { condicao: a.condicao as AnuncioDetalhe['condicao'] } : {}),
    ...('descricao' in a ? { descricao: a.descricao ?? '' } : {}),
    ...('ajustePreco' in a ? { ajustePreco: a.ajustePreco ?? 0 } : {}),
    ...('estoqueReserva' in a ? { estoqueReserva: a.estoqueReserva ?? 0 } : {}),
    ...('estoqueMaximo' in a ? { estoqueMaximo: a.estoqueMaximo ?? null } : {}),
    ...('estoqueAutomatico' in a ? { estoqueAutomatico: !!a.estoqueAutomatico } : {}),
    ...('faixasQuantidade' in a ? { faixasQuantidade: a.faixasQuantidade ?? [], faixasGerenciadas: a.faixasQuantidade !== null && a.faixasQuantidade !== undefined } : {}),
    ...('freteGratis' in a && det.vendaMl ? { vendaMl: { ...det.vendaMl, freteGratis: !!a.freteGratis } } : {}),
    atributos: a.atributos ?? det.atributos,
    itens: det.itens.map(i => {
      const c = r.itens[i.idItem];
      if (!c) return i;
      return {
        ...i,
        ...('precoMl' in c ? { precoMl: c.precoMl ?? null } : {}),
        ...('idUnidade' in c ? { unidadeMl: c.idUnidade ? i.unidades.find(u => u.idUnidade === c.idUnidade) || null : null } : {}),
        ml: {
          ...i.ml,
          regra: {
            reserva: 'estoqueReserva' in c ? c.estoqueReserva ?? null : i.ml.regra.reserva,
            maximo: 'estoqueMaximo' in c ? c.estoqueMaximo ?? null : i.ml.regra.maximo,
          },
        },
      };
    }),
  };
};
