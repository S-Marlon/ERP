// Estrutura do poço na ficha: junta os relatórios técnicos das obras do mesmo poço (a perfuração original, o complemento
// com revestimento interno feito anos depois, a troca de bomba...) numa estrutura só, para o desenho e o resumo do front
// (Front/App/src/modulos/hidraulica/pocos/estruturaPoco.ts). Puro, com teste.

type Dados = Record<string, any>;
const CAMPOS_COMPLETACAO = ['compPreFiltroDe', 'compPreFiltroAte', 'compPreFiltroMaterial', 'compPreFiltroQtd', 'compCimentoDe', 'compCimentoAte', 'compCimentoQtd', 'compLaje', 'compTampa'];
const num = (v: unknown) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const fundoDaLista = (l: unknown, campo: string) => (Array.isArray(l) ? l.reduce((m: number, x: any) => Math.max(m, num(x?.[campo])), 0) : 0);

export interface RelatorioDaObra { dados: Dados | null; data: string | null; origem: string }

/**
 * - perfuração e perfil geológico: do relatório que foi mais fundo (a perfuração original ou o aprofundamento);
 * - revestimentos: de todos os relatórios, cada um com a obra de origem, sem repetir o mesmo trecho;
 * - nível estático e profundidade da bomba: do relatório mais recente que tem o dado.
 */
export const estruturaDasObras = (obras: RelatorioDaObra[]) => {
  const lista = obras.filter(o => o.dados).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  if (!lista.length) return null;
  const maisFunda = (campo: 'perfuracoes' | 'perfilGeologico', ate: string) =>
    lista.reduce<RelatorioDaObra | null>((m, o) => (fundoDaLista(o.dados![campo], ate) > (m ? fundoDaLista(m.dados![campo], ate) : 0) ? o : m), null);
  const perf = maisFunda('perfuracoes', 'perfAte');
  const geo = maisFunda('perfilGeologico', 'geoAte');
  const vistos = new Set<string>();
  const revestimentos: Dados[] = [];
  for (const o of lista) {
    for (const r of Array.isArray(o.dados!.revestimentos) ? o.dados!.revestimentos : []) {
      if (!(num(r?.revAte) > num(r?.revDe))) continue;
      const chave = [r.revTipo || 'EXTERNO', num(r.revDe), num(r.revAte), num(r.revDiam), r.revDiamUnidade || '"'].join('|');
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      revestimentos.push({ ...r, origem: lista.length > 1 ? o.origem : undefined });
    }
  }
  const recente = (campo: string) => [...lista].reverse().map(o => num(o.dados![campo])).find(v => v > 0) || null;
  const recenteTexto = (campo: string) => [...lista].reverse().map(o => o.dados![campo]).find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? null;
  // completação: a do relatório mais recente que a informou (pré-filtro e cimentação andam juntos)
  const comComp = [...lista].reverse().find(o => num(o.dados!.compPreFiltroAte) > 0 || num(o.dados!.compCimentoAte) > 0 || o.dados!.compLaje || o.dados!.compTampa);
  const completacao = comComp ? Object.fromEntries(CAMPOS_COMPLETACAO.map(k => [k, comComp.dados![k] ?? null])) : {};
  const estrutura = {
    perfuracoes: perf ? perf.dados!.perfuracoes : [],
    perfilGeologico: geo ? geo.dados!.perfilGeologico : [],
    revestimentos,
    profundidade: Math.max(...lista.map(o => num(o.dados!.profundidade)), fundoDaLista(perf?.dados?.perfuracoes, 'perfAte')),
    bombaNivelEstatico: recente('bombaNivelEstatico'),
    bombaNivelDinamico: recente('bombaNivelDinamico'),
    bombaProfundidade: recente('bombaProfundidade'),
    // tubo edutor do relatório mais recente (desenho e resumo)
    bombaQtdTubos: recente('bombaQtdTubos'), bombaTamTubo: recente('bombaTamTubo'), bombaMedidaTubo: recenteTexto('bombaMedidaTubo'),
    bombaTuboUnidade: recenteTexto('bombaTuboUnidade'), bombaTubulacao: recenteTexto('bombaTubulacao'), bombaTuboCor: recenteTexto('bombaTuboCor'),
    ...completacao,
  };
  return estrutura.perfuracoes.length || revestimentos.length ? estrutura : null;
};

// ---------------------------------------------------------------- com o cadastro do poço
export interface CadastroPoco { profundidadeM: number | null; diametro: string | null; nivelEstaticoM: number | null }

/** "5", "5\"", "6 pol", "152 mm" → número e unidade do relatório (" ou mm); sem número, null. */
export const diametroDoTexto = (t: unknown) => {
  const m = String(t ?? '').replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { perfDiam: Number(m[1]), perfDiamUnidade: /mm/i.test(String(t)) ? 'mm' : '"' };
};

/**
 * Estrutura da ficha: a das obras e, no que faltar, o cadastro do poço (profundidade e diâmetro viram a perfuração;
 * o nível estático, o NE). Sem revestimento em lugar nenhum, `revestimentoDesconhecido` (não dá para dizer que é
 * parede na rocha); `soCadastro` quando nada veio dos relatórios.
 */
export const estruturaDoPoco = (obras: RelatorioDaObra[], cadastro: CadastroPoco, propria?: Dados | null) => {
  // A estrutura informada direto no poço vale como a mais antiga (base); o que as obras registraram depois entra por cima
  if (propria && (propria.perfuracoes?.length || propria.revestimentos?.length || propria.perfilGeologico?.length)) {
    obras = [{ dados: propria, data: '0000-00-00', origem: 'Cadastro do poço' }, ...obras];
  }
  const prof = num(cadastro.profundidadeM);
  const base = prof > 0 ? [{ perfDe: 0, perfAte: prof, ...(diametroDoTexto(cadastro.diametro) || {}) }] : [];
  const e: Dados | null = estruturaDasObras(obras);
  if (!e) {
    if (!base.length) return null;
    return { perfuracoes: base, revestimentos: [], perfilGeologico: [], profundidade: prof, bombaNivelEstatico: num(cadastro.nivelEstaticoM) || null,
      bombaProfundidade: null, revestimentoDesconhecido: true, soCadastro: true };
  }
  if (!e.perfuracoes?.length && base.length) e.perfuracoes = base;
  if (!e.bombaNivelEstatico && num(cadastro.nivelEstaticoM)) e.bombaNivelEstatico = num(cadastro.nivelEstaticoM);
  e.profundidade = Math.max(num(e.profundidade), prof);
  e.revestimentoDesconhecido = !e.revestimentos.length;
  e.soCadastro = false;
  return e;
};

// ---------------------------------------------------------------- edição direta no poço
const TIPOS_REV = ['EXTERNO', 'INTERNO', 'FILTRO', 'BOCA'];
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const numOuNulo = (v: unknown) => { const t = String(v ?? '').trim(); if (!t) return null; const x = num(t); return x >= 0 && x <= 5000 ? x : null; };
const unidade = (v: unknown) => (v === 'mm' ? 'mm' : '"');

/**
 * Estrutura digitada na ficha do poço: só as três listas, com os campos conhecidos e números de verdade; linha sem "até"
 * maior que o "de" é descartada. Perfuração e geologia ficam em ordem de profundidade.
 */
export const limparEstrutura = (b: any) => {
  const lista = (v: unknown) => (Array.isArray(v) ? v.slice(0, 50) : []);
  const valida = (de: number | null, ate: number | null) => ate !== null && ate > (de ?? 0);
  const perfuracoes = lista(b?.perfuracoes)
    .map((p: any) => ({ perfDe: numOuNulo(p?.perfDe) ?? 0, perfAte: numOuNulo(p?.perfAte), perfDiam: numOuNulo(p?.perfDiam), perfDiamUnidade: unidade(p?.perfDiamUnidade) }))
    .filter((p: any) => valida(p.perfDe, p.perfAte)).sort((a: any, c: any) => a.perfDe - c.perfDe);
  const revestimentos = lista(b?.revestimentos)
    .map((r: any) => ({
      revTipo: TIPOS_REV.includes(r?.revTipo) ? r.revTipo : 'EXTERNO', revDe: numOuNulo(r?.revDe) ?? 0, revAte: numOuNulo(r?.revAte),
      revDiam: numOuNulo(r?.revDiam), revDiamUnidade: unidade(r?.revDiamUnidade), revMaterial: texto(r?.revMaterial, 120), revUniao: texto(r?.revUniao, 40), revObs: texto(r?.revObs, 120),
      // material do cadastro: id, cor do desenho e comprimento da barra
      revIdMaterial: Number(r?.revIdMaterial) > 0 ? Number(r.revIdMaterial) : null,
      revCor: /^#[0-9a-f]{6}$/i.test(String(r?.revCor || '')) ? String(r.revCor) : null,
      revComprimentoBarra: numOuNulo(r?.revComprimentoBarra),
    }))
    .filter((r: any) => valida(r.revDe, r.revAte));
  const perfilGeologico = lista(b?.perfilGeologico)
    .map((c: any) => ({ geoDe: numOuNulo(c?.geoDe) ?? 0, geoAte: numOuNulo(c?.geoAte), geoTipo: texto(c?.geoTipo, 40), geoObs: texto(c?.geoObs, 120) }))
    .filter((c: any) => valida(c.geoDe, c.geoAte) && c.geoTipo).sort((a: any, c: any) => a.geoDe - c.geoDe);
  // completação (pré-filtro, cimentação, laje e tampa)
  const completacao = {
    compPreFiltroDe: numOuNulo(b?.compPreFiltroDe), compPreFiltroAte: numOuNulo(b?.compPreFiltroAte), compPreFiltroMaterial: texto(b?.compPreFiltroMaterial, 120),
    compPreFiltroQtd: numOuNulo(b?.compPreFiltroQtd), compCimentoDe: numOuNulo(b?.compCimentoDe), compCimentoAte: numOuNulo(b?.compCimentoAte),
    compCimentoQtd: numOuNulo(b?.compCimentoQtd), compLaje: texto(b?.compLaje, 60), compTampa: texto(b?.compTampa, 60),
  };
  return { perfuracoes, revestimentos, perfilGeologico, ...completacao };
};
