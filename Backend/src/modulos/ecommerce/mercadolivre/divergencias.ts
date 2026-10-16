// Divergências entre o ERP e o anúncio publicado no ML: o que o "Enviar atributos, fotos e descrição" mandaria e o que
// está lá hoje. Serve para avisar o operador de que precisa enviar (e para o envio mandar só o que difere).
// Compara o que importa: valores de atributo sem ligar para formato ("0,4 kg" = "400 g"), fotos (quais e a ordem),
// descrição (sem ligar para espaços no fim das linhas) e título (que no modelo novo do ML só muda pelo painel).

export type CampoDivergente = 'ATRIBUTOS' | 'FOTOS' | 'DESCRICAO' | 'TITULO';

export interface Divergencia {
  campo: CampoDivergente;
  texto: string;
  enviavel: boolean;   // o botão resolve; false = só pelo painel do ML (ex.: título de anúncio com family_name)
}

export interface AtributoComparavel { id: string; value_id?: string | null; value_name?: string | null }

const NOME_UNIDADE: Record<string, [number, string]> = {
  mg: [0.001, 'g'], g: [1, 'g'], kg: [1000, 'g'],
  mm: [0.1, 'cm'], cm: [1, 'cm'], m: [100, 'cm'],
  ml: [1, 'ml'], l: [1000, 'ml'],
};

/** Valor comparável: número com unidade vira a unidade base ("0,4 kg" -> "400 g"); texto vira minúsculo sem espaços extras. */
export const valorComparavel = (v: string | null | undefined) => {
  const t = String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const m = t.match(/^(-?[\d.,]+)\s*([a-zµ]+)?$/);
  if (m) {
    const n = Number(m[1].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (Number.isFinite(n)) {
      const u = m[2] ? NOME_UNIDADE[m[2]] : null;
      if (!m[2]) return String(Math.round(n * 1e6) / 1e6);
      if (u) return `${Math.round(n * u[0] * 1e6) / 1e6} ${u[1]}`;
    }
  }
  return t;
};

/** Atributos que o ERP mandaria e que estão diferentes (ou faltando) no ML. */
export const atributosDivergentes = (erp: AtributoComparavel[], noMl: AtributoComparavel[]) => {
  const porId = new Map(noMl.map(a => [a.id, a]));
  const saida: { id: string; erp: string; ml: string | null }[] = [];
  for (const a of erp) {
    const m = porId.get(a.id);
    const erpTxt = String(a.value_name ?? a.value_id ?? '');
    if (!m || (!m.value_id && !m.value_name)) { saida.push({ id: a.id, erp: erpTxt, ml: null }); continue; }
    const iguais = a.value_id && m.value_id ? String(a.value_id) === String(m.value_id) : valorComparavel(a.value_name) === valorComparavel(m.value_name);
    if (!iguais) saida.push({ id: a.id, erp: erpTxt, ml: String(m.value_name ?? m.value_id ?? '') });
  }
  return saida;
};

/**
 * Fotos: `planejadas` = as que o envio mandaria, com o id que cada uma já tem no ML (null = ainda não subiu).
 * `link` = foto que vai por link (o ML dá outro id): conta só a quantidade.
 */
export const fotosDivergentes = (planejadas: { idMl: string | null; link?: boolean }[], noMl: string[]): string | null => {
  const novas = planejadas.filter(f => !f.idMl && !f.link).length;
  if (novas) return `${novas} foto(s) nova(s) para subir`;
  const conhecidas = planejadas.filter(f => f.idMl).map(f => f.idMl as string);
  const temLink = planejadas.some(f => f.link);
  if (!temLink) {
    if (conhecidas.length !== noMl.length || conhecidas.some((id, k) => noMl[k] !== id)) {
      return conhecidas.length !== noMl.length ? `o ML tem ${noMl.length} foto(s), o ERP manda ${conhecidas.length}` : 'ordem das fotos diferente';
    }
    return null;
  }
  return conhecidas.every(id => noMl.includes(id)) && planejadas.length === noMl.length ? null : 'fotos diferentes do ML';
};

/** Texto comparável: fim de linha, espaços no fim das linhas e no fim do texto não contam. */
const textoComparavel = (s: string | null | undefined) =>
  String(s ?? '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();

export const descricaoDiverge = (erp: string | null | undefined, noMl: string | null | undefined) =>
  !!textoComparavel(erp) && textoComparavel(erp) !== textoComparavel(noMl);

const tituloComparavel = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface PacoteMl { pesoG: number; alturaCm: number; larguraCm: number; comprimentoCm: number }
const PACOTE = ['SELLER_PACKAGE_HEIGHT', 'SELLER_PACKAGE_WIDTH', 'SELLER_PACKAGE_LENGTH', 'SELLER_PACKAGE_WEIGHT'];

/**
 * Embalagem que está no ML, quando ela difere da que o ERP mandaria (para trazer ao cadastro). Só com as 4 medidas lá.
 * `lerMedida` lê "4 cm" / "0,095 kg" em cm ou g.
 */
export const pacoteParaTrazer = (erp: AtributoComparavel[], noMl: AtributoComparavel[], lerMedida: (t: string | null | undefined) => number | null): PacoteMl | null => {
  const difere = atributosDivergentes(erp.filter(a => PACOTE.includes(a.id)), noMl).length > 0;
  if (!difere) return null;
  const v = (id: string) => lerMedida(noMl.find(a => a.id === id)?.value_name);
  const [alturaCm, larguraCm, comprimentoCm, pesoG] = PACOTE.map(v);
  return alturaCm && larguraCm && comprimentoCm && pesoG ? { pesoG, alturaCm, larguraCm, comprimentoCm } : null;
};

/** Junta tudo de uma linha. `nomeAtributo` traduz o id do atributo para o nome que o operador conhece. */
export const divergenciasDaLinha = (p: {
  atributos: { erp: AtributoComparavel[]; ml: AtributoComparavel[] };
  fotos: { planejadas: { idMl: string | null; link?: boolean }[]; ml: string[] } | null;
  descricao: { erp: string | null; ml: string | null } | null;
  titulo: { erp: string | null; ml: string | null; temFamilia: boolean; familia?: string | null } | null;   // familia = family_name do ML
  nomeAtributo?: (id: string) => string;
}): Divergencia[] => {
  const saida: Divergencia[] = [];
  const attrs = atributosDivergentes(p.atributos.erp, p.atributos.ml);
  if (attrs.length) {
    const nome = p.nomeAtributo || ((id: string) => id);
    const lista = attrs.slice(0, 4).map(a => `${nome(a.id)}: ${a.ml === null ? 'falta no ML' : `"${a.ml}" no ML`} → "${a.erp}"`).join('; ');
    saida.push({ campo: 'ATRIBUTOS', enviavel: true, texto: `${attrs.length} atributo(s) diferente(s): ${lista}${attrs.length > 4 ? '…' : ''}` });
  }
  const fotos = p.fotos ? fotosDivergentes(p.fotos.planejadas, p.fotos.ml) : null;
  if (fotos) saida.push({ campo: 'FOTOS', enviavel: true, texto: fotos });
  if (p.descricao && descricaoDiverge(p.descricao.erp, p.descricao.ml)) {
    saida.push({ campo: 'DESCRICAO', enviavel: true, texto: p.descricao.ml ? 'descrição diferente da do ML' : 'o anúncio no ML está sem descrição' });
  }
  // com family_name o ML acrescenta atributos ao título (ex.: a cor): basta o nome da família bater
  const tituloIgual = (t: NonNullable<typeof p.titulo>) => tituloComparavel(t.erp) === tituloComparavel(t.ml)
    || (t.temFamilia && !!t.familia && tituloComparavel(t.erp) === tituloComparavel(t.familia));
  if (p.titulo?.erp && !tituloIgual(p.titulo)) {
    saida.push(p.titulo.temFamilia
      ? { campo: 'TITULO', enviavel: false, texto: `título no ML: "${p.titulo.ml}"; no ERP: "${p.titulo.erp}". Neste anúncio o ML monta o título pelo nome da família: só muda pelo painel do ML (ou republicando)` }
      : { campo: 'TITULO', enviavel: true, texto: `título no ML: "${p.titulo.ml}"; no ERP: "${p.titulo.erp}"` });
  }
  return saida;
};
