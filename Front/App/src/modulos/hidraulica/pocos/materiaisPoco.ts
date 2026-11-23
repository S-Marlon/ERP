// Materiais do poço no relatório e no desenho: a cor de cada material (a escolhida no cadastro ou a padrão do tipo), os
// dados técnicos sugeridos pelo nome ("Tubo geomecânico 6" (barra)" → 6", barra de 6 m), as barras de cada trecho e o
// que o relatório consumiu (para lançar em Materiais da obra). Puro, com teste.

export interface MaterialTecnico {
  idMaterial: number; nome: string; categoria: string; unidade: string; custo?: number;
  diametro?: string | null; comprimentoM?: number | null; marca?: string | null; classe?: string | null; cor?: string | null;
}
type Dados = Record<string, any>;

const num = (v: unknown) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const sem = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cor padrão pelo que o nome diz (aço, geomecânico, PVC, PEAD...) e, sem pista, pela categoria. */
export const corPadrao = (nome: unknown, categoria?: unknown) => {
  const n = sem(nome);
  if (/inox/.test(n)) return '#bfbfbf';
  if (/\baco\b|galvan|ferro/.test(n)) return '#595959';   // "aço" inteiro (não o "saco" do cimento)
  if (/geomec/.test(n)) return '#2f54eb';
  if (/pead|polietileno|mangueira/.test(n)) return '#262626';
  if (/edutor/.test(n)) return '#fa8c16';
  if (/pvc|tigre|asperbras|aditivado/.test(n)) return '#69b1ff';
  if (/corda/.test(n)) return '#ad8b00';
  if (/cabo/.test(n)) return '#cf1322';
  if (/cascalho|pre.?filtro|brita/.test(n)) return '#d4b106';
  if (/cimento|calda/.test(n)) return '#8c8c8c';
  const c = String(categoria || '');
  return ({ FILTRO: '#13a8a8', TUBO: '#434343', CABO: '#cf1322', PRE_FILTRO: '#d4b106' } as Record<string, string>)[c] || '#434343';
};
export const corDoMaterial = (m: Pick<MaterialTecnico, 'nome' | 'categoria' | 'cor'> | null | undefined) => (m ? m.cor || corPadrao(m.nome, m.categoria) : null);

/** Diâmetro, comprimento da barra e classe tirados do nome; "(barra)" sem comprimento = barra de 6 m (o comum). */
export const sugerirDadosTecnicos = (nome: string, categoria: string) => {
  const t = String(nome || '');
  const diam = t.match(/(\d+\s+\d\/\d|\d+\/\d|\d+(?:[.,]\d+)?)\s*(?:"|''|pol\b|”)/i);
  const comp = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m|metros?)\b(?!\s*m)/i);
  const classe = t.match(/\b(PN\s?\d+|SCH\s?\d+|CL\s?\d+|DEF\s?\d+)\b/i);
  const barra = /barra/i.test(t);
  return {
    diametro: diam ? `${diam[1].replace(',', '.')}"` : null,
    comprimentoM: comp && !/\(m\)/i.test(t) ? num(comp[1]) || null : barra ? 6 : null,
    classe: classe ? classe[1].toUpperCase().replace(/\s+/, '') : null,
    cor: corPadrao(nome, categoria),
  };
};

/** Barras para cobrir um trecho (sempre inteiras, para cima). */
export const barrasDoTrecho = (de: unknown, ate: unknown, comprimento: unknown) => {
  const l = num(ate) - num(de);
  const c = num(comprimento);
  return l > 0 && c > 0 ? Math.ceil(l / c - 1e-6) : null;
};

/** "8 barras de 6 m" (ou "1 barra de 6 m"). */
export const textoBarras = (barras: number | null, comprimento: unknown) =>
  (barras ? `${barras} ${barras === 1 ? 'barra' : 'barras'} de ${String(num(comprimento)).replace('.', ',')} m` : '');

export interface ConsumoMaterial { idMaterial: number; nome: string; unidade: string; quantidade: number; origem: string }

/**
 * O que o relatório consumiu, por material do cadastro: revestimentos e filtros (barras pelo trecho, ou metros quando o
 * material é por metro), tubo edutor (barras), cabo e corda (metros), pré-filtro e cimento (a quantidade informada).
 */
export const consumoDoRelatorio = (d: Dados, catalogo: MaterialTecnico[]): ConsumoMaterial[] => {
  const porId = new Map(catalogo.map(m => [m.idMaterial, m]));
  const soma = new Map<number, ConsumoMaterial>();
  const add = (id: unknown, quantidade: number, origem: string) => {
    const m = porId.get(Number(id));
    if (!m || !(quantidade > 0)) return;
    const atual = soma.get(m.idMaterial);
    const q = Math.round(quantidade * 100) / 100;
    if (atual) { atual.quantidade = Math.round((atual.quantidade + q) * 100) / 100; if (!atual.origem.includes(origem)) atual.origem += `, ${origem}`; }
    else soma.set(m.idMaterial, { idMaterial: m.idMaterial, nome: m.nome, unidade: m.unidade, quantidade: q, origem });
  };
  // por barra (un) quando tem comprimento; senão em metros
  const trecho = (id: unknown, de: unknown, ate: unknown, origem: string) => {
    const m = porId.get(Number(id));
    if (!m) return;
    const metros = num(ate) - num(de);
    if (m.unidade === 'm') add(id, metros, origem);
    else add(id, barrasDoTrecho(de, ate, m.comprimentoM) ?? 0, origem);
  };
  for (const r of d.revestimentos || []) trecho(r?.revIdMaterial, r?.revDe, r?.revAte, r?.revTipo === 'FILTRO' ? 'filtro' : 'revestimento');
  const tubo = porId.get(Number(d.bombaIdTubo));
  if (tubo) add(tubo.idMaterial, tubo.unidade === 'm' ? num(d.bombaQtdTubos) * num(d.bombaTamTubo) : num(d.bombaQtdTubos), 'tubo edutor');
  add(d.bombaIdCabo, num(d.bombaCaboMetros), 'cabo da bomba');
  add(d.bombaIdCorda, num(d.bombaCordaMetros), 'corda');
  add(d.compIdPreFiltro, num(d.compPreFiltroQtd), 'pré-filtro');
  // cimento: o "Cimento" do cadastro (a tela só pede os sacos)
  add(d.compIdCimento ?? catalogo.find(m => /cimento/i.test(m.nome))?.idMaterial, num(d.compCimentoQtd), 'cimentação');
  return [...soma.values()];
};

/** Metros de cabo sugeridos: profundidade da bomba mais a sobra até o quadro (padrão 10 m). */
export const caboSugerido = (profundidadeBomba: unknown, sobra = 10) => (num(profundidadeBomba) > 0 ? Math.ceil(num(profundidadeBomba) + sobra) : null);

/** Diâmetro do cadastro em número para o relatório: '6"' → 6 pol, '1 1/4"' → 1,25 pol, '150 mm' → 150 mm. */
export const diametroEmNumero = (texto: unknown): { valor: number; unidade: '"' | 'mm' } | null => {
  const t = String(texto ?? '').replace(',', '.').trim();
  const mm = /mm/i.test(t);
  const misto = t.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (misto) return { valor: Number(misto[1]) + Number(misto[2]) / Number(misto[3]), unidade: '"' };
  const fracao = t.match(/^(\d+)\/(\d+)/);
  if (fracao) return { valor: Number(fracao[1]) / Number(fracao[2]), unidade: '"' };
  const n = t.match(/^(\d+(?:\.\d+)?)/);
  return n ? { valor: Number(n[1]), unidade: mm ? 'mm' : '"' } : null;
};
