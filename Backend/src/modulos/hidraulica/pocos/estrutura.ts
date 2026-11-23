// Estrutura do poço na ficha: junta os relatórios técnicos das obras do mesmo poço (a perfuração original, o complemento
// com revestimento interno feito anos depois, a troca de bomba...) numa estrutura só, para o desenho e o resumo do front
// (Front/App/src/modulos/hidraulica/pocos/estruturaPoco.ts). Puro, com teste.

type Dados = Record<string, any>;
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
  const estrutura = {
    perfuracoes: perf ? perf.dados!.perfuracoes : [],
    perfilGeologico: geo ? geo.dados!.perfilGeologico : [],
    revestimentos,
    profundidade: Math.max(...lista.map(o => num(o.dados!.profundidade)), fundoDaLista(perf?.dados?.perfuracoes, 'perfAte')),
    bombaNivelEstatico: recente('bombaNivelEstatico'),
    bombaProfundidade: recente('bombaProfundidade'),
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
export const estruturaDoPoco = (obras: RelatorioDaObra[], cadastro: CadastroPoco) => {
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
