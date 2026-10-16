// Moderação do ML: anúncio que o ML pôs em revisão, bloqueou ou finalizou (ex.: "Estava em uma categoria incorreta").
// O ML guarda o motivo, o que fazer e as categorias sugeridas na infração (/moderations/infractions); o ERP lê na
// sincronização e grava na linha do anúncio (ultimo_erro, com o prefixo abaixo) para o operador ver e corrigir.

export const PREFIXO_MODERACAO = 'Moderação do ML';

/** sub_status que indicam bloqueio da moderação (os de pausa do vendedor ou falta de estoque não contam). */
const BLOQUEIOS = ['forbidden', 'held', 'suspended', 'waiting_for_patch', 'pending_documentation', 'freezed'];

/** O anúncio está parado pela moderação do ML? (em revisão, inativo ou finalizado com bloqueio; excluído pelo vendedor não). */
export const bloqueadoPeloMl = (status: string | null | undefined, subStatus: string[] | null | undefined) => {
  const sub = (subStatus || []).map(s => String(s).toLowerCase());
  if (sub.includes('deleted')) return false;
  return status === 'under_review' || sub.some(s => BLOQUEIOS.includes(s));
};

export interface Infracao {
  date_created?: string;
  reason?: string;
  remedy?: string;
  suggested?: { categories?: { id: string; name?: string; path?: string }[] };
}

const dataCurta = (iso?: string) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : null;
};

/** Texto que fica na linha: motivo, o que fazer e até 3 categorias sugeridas. Cabe em 500 caracteres. */
export const textoModeracao = (inf: Infracao | null, status: string | null) => {
  const quando = dataCurta(inf?.date_created);
  const partes = [
    `${PREFIXO_MODERACAO}${quando ? ` (${quando})` : ''}: ${inf?.reason?.trim() || (status === 'under_review' ? 'anúncio em revisão.' : 'anúncio bloqueado.')}`,
  ];
  if (inf?.remedy?.trim()) partes.push(`O que fazer: ${inf.remedy.trim()}`);
  const cats = (inf?.suggested?.categories || []).slice(0, 3);
  if (cats.length) partes.push(`Categorias sugeridas: ${cats.map(c => `${c.path || c.name} (${c.id})`).join(' · ')}`);
  const t = partes.join(' ');
  return t.length > 500 ? `${t.slice(0, 497)}...` : t;
};

export const ehModeracao = (erro: string | null | undefined) => !!erro && erro.startsWith(PREFIXO_MODERACAO);

/** A infração mais recente entre as do anúncio. */
export const infracaoMaisRecente = (lista: Infracao[] | null | undefined) =>
  [...(lista || [])].sort((a, b) => String(b.date_created || '').localeCompare(String(a.date_created || '')))[0] || null;
