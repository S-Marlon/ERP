// Obras de poços › conjunto motobomba do poço (bomba, motor/bombeador, tubo, fio, corda, quadro e cabeça do poço) com
// histórico de trocas, e as fotos do próprio poço. Regras puras (sem banco), com teste.
import { ErroObra } from './obras';

export const TIPOS_BOMBA = ['SUBMERSA', 'INJETORA', 'SUPERFICIE', 'OUTRA'] as const;
export const TIPOS_FOTO_POCO = ['BOMBA', 'CABECA', 'QUADRO', 'LOCAL', 'OUTRO'] as const;
export type TipoFotoPoco = typeof TIPOS_FOTO_POCO[number];

/** Campos de texto do conjunto e o tamanho da coluna (o banco corta em silêncio, então corta aqui). */
const TEXTOS: Record<string, number> = {
  bombaMarca: 60, bombaModelo: 60, tensao: 20, motorMarca: 60, motorModelo: 60, bombeadorMarca: 60, bombeadorModelo: 60,
  tuboMaterial: 40, tuboDiametro: 20, fioTipo: 40, fioBitola: 20, cordaMaterial: 40, quadroComando: 150, cabecaPoco: 255, observacao: 255,
};
const NUMEROS = ['potenciaCv', 'profundidadeBombaM', 'tuboMetros', 'fioMetros', 'cordaMetros'] as const;
const INTEIROS = ['estagios', 'tuboBarras'] as const;

export interface Conjunto {
  instaladoEm: string | null; retiradoEm: string | null; bombaTipo: string | null;
  bombaMarca: string | null; bombaModelo: string | null; potenciaCv: number | null; tensao: string | null; estagios: number | null;
  motorMarca: string | null; motorModelo: string | null; bombeadorMarca: string | null; bombeadorModelo: string | null;
  profundidadeBombaM: number | null; tuboMaterial: string | null; tuboDiametro: string | null; tuboBarras: number | null; tuboMetros: number | null;
  fioTipo: string | null; fioBitola: string | null; fioMetros: number | null; cordaMaterial: string | null; cordaMetros: number | null;
  quadroComando: string | null; cabecaPoco: string | null; observacao: string | null;
}

const data = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) throw new ErroObra('Data inválida.');
  return s.slice(0, 10);
};
const numero = (v: unknown, nome: string) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new ErroObra(`${nome}: número inválido.`);
  return Math.round(n * 100) / 100;
};
const ROTULOS: Record<string, string> = {
  potenciaCv: 'Potência', profundidadeBombaM: 'Profundidade da bomba', tuboMetros: 'Metros de tubo', fioMetros: 'Metros de fio',
  cordaMetros: 'Metros de corda', estagios: 'Estágios', tuboBarras: 'Barras de tubo',
};

/** Confere e normaliza o conjunto. Precisa de ao menos uma informação de bomba, tubo, fio ou quadro. */
export const validarConjunto = (b: any, hoje: string): Conjunto => {
  const c: any = {};
  for (const [k, max] of Object.entries(TEXTOS)) c[k] = String(b?.[k] ?? '').trim().replace(/\s+/g, ' ').slice(0, max) || null;
  for (const k of NUMEROS) c[k] = numero(b?.[k], ROTULOS[k]);
  for (const k of INTEIROS) { const n = numero(b?.[k], ROTULOS[k]); c[k] = n === null ? null : Math.round(n); }
  const tipo = String(b?.bombaTipo ?? '').trim().toUpperCase();
  if (tipo && !(TIPOS_BOMBA as readonly string[]).includes(tipo)) throw new ErroObra('Tipo de bomba: submersa, injetora, superfície ou outra.');
  c.bombaTipo = tipo || null;
  c.instaladoEm = data(b?.instaladoEm);
  c.retiradoEm = data(b?.retiradoEm);
  if (c.instaladoEm && c.instaladoEm > hoje) throw new ErroObra('A data de instalação não pode ser no futuro.');
  if (c.retiradoEm && c.retiradoEm > hoje) throw new ErroObra('A data de retirada não pode ser no futuro.');
  if (c.retiradoEm && c.instaladoEm && c.retiradoEm < c.instaladoEm) throw new ErroObra('A retirada não pode ser antes da instalação.');
  if (c.potenciaCv !== null && c.potenciaCv > 200) throw new ErroObra('Potência acima de 200 CV: confira.');
  const algo = ['bombaTipo', 'bombaMarca', 'bombaModelo', 'potenciaCv', 'motorMarca', 'motorModelo', 'bombeadorMarca', 'bombeadorModelo',
    'profundidadeBombaM', 'tuboMaterial', 'tuboDiametro', 'tuboBarras', 'tuboMetros', 'fioBitola', 'fioMetros', 'quadroComando', 'cabecaPoco']
    .some(k => c[k] !== null);
  if (!algo) throw new ErroObra('Preencha ao menos a bomba, o tubo, o fio ou o quadro.');
  return c as Conjunto;
};

const texto = (v: unknown, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const pos = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Conjunto que o relatório da obra descreve (Sistema de bombeamento): marca, motor, bombeador, tubos (barras ×
 * comprimento), diâmetro e material do tubo, profundidade, cabo e cavalete. null se o relatório não tem bomba.
 */
export const conjuntoDoRelatorio = (r: Record<string, any> | null | undefined): Partial<Conjunto> | null => {
  if (!r) return null;
  const barras = pos(r.bombaQtdTubos), comp = pos(r.bombaTamTubo);
  const c: Partial<Conjunto> = {
    bombaMarca: texto(r.bombaMarca, 60), motorModelo: texto(r.imgMotorModelo, 60), bombeadorModelo: texto(r.imgBombeadorModelo, 60),
    profundidadeBombaM: pos(r.bombaProfundidade), tuboBarras: barras ? Math.round(barras) : null,
    tuboMetros: barras && comp ? Math.round(barras * comp * 100) / 100 : null,
    tuboDiametro: r.bombaMedidaTubo ? texto(`${r.bombaMedidaTubo}${r.bombaTuboUnidade || '"'}`, 20) : null,
    tuboMaterial: texto(r.bombaTubulacao, 40), fioBitola: texto(r.bombaCabeamento, 20), cabecaPoco: texto(r.bombaCavalete ? `Cavalete: ${r.bombaCavalete}` : null, 255),
    instaladoEm: /^\d{4}-\d{2}-\d{2}/.test(String(r.bombaDtInstalacao || '')) ? String(r.bombaDtInstalacao).slice(0, 10) : null,
    observacao: texto(r.bombaObsGerais, 255),
  };
  const tem = ['bombaMarca', 'motorModelo', 'bombeadorModelo', 'profundidadeBombaM', 'tuboBarras', 'tuboDiametro', 'tuboMaterial', 'fioBitola']
    .some(k => (c as any)[k] !== null);
  if (!tem) return null;
  if (c.profundidadeBombaM === null && c.tuboMetros) c.profundidadeBombaM = c.tuboMetros;
  return c;
};

const fmt = (n: number) => String(n).replace('.', ',');
const TIPO_TEXTO: Record<string, string> = { SUBMERSA: 'Submersa', INJETORA: 'Injetora', SUPERFICIE: 'Superfície', OUTRA: '' };

/** Uma linha do conjunto: "Submersa Ebara 1,5 CV · a 60 m · tubo PVC 1¼" (10 barras) · fio 3 x 4 mm² 70 m". */
export const resumoConjunto = (c: Partial<Conjunto>) => {
  const bomba = [c.bombaTipo ? TIPO_TEXTO[c.bombaTipo] : null, c.bombaMarca, c.bombaModelo, c.potenciaCv ? `${fmt(c.potenciaCv)} CV` : null].filter(Boolean).join(' ');
  const motor = c.motorMarca || c.motorModelo ? `motor ${[c.motorMarca, c.motorModelo].filter(Boolean).join(' ')}` : null;
  const tubo = c.tuboMaterial || c.tuboDiametro || c.tuboBarras || c.tuboMetros
    ? ['tubo', c.tuboMaterial, c.tuboDiametro, c.tuboBarras ? `(${c.tuboBarras} barras)` : c.tuboMetros ? `${fmt(c.tuboMetros)} m` : null].filter(Boolean).join(' ')
    : null;
  const fio = c.fioBitola || c.fioMetros ? ['fio', c.fioTipo, c.fioBitola, c.fioMetros ? `${fmt(c.fioMetros)} m` : null].filter(Boolean).join(' ') : null;
  return [bomba || null, motor, c.profundidadeBombaM ? `a ${fmt(c.profundidadeBombaM)} m` : null, tubo, fio].filter(Boolean).join(' · ') || 'Conjunto sem descrição';
};

/** Anos completos desde a instalação (null sem data). */
export const idadeEmAnos = (instaladoEm: string | null, hoje: string) => {
  if (!instaladoEm) return null;
  const [a1, m1, d1] = instaladoEm.split('-').map(Number), [a2, m2, d2] = hoje.split('-').map(Number);
  const anos = a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
  return Math.max(0, anos);
};

/** Serviços que trocam o conjunto ao concluir a obra (o conjunto anterior fica como retirado). */
export const instalaConjunto = (servicos: string[]) => servicos.some(s => s === 'INSTALACAO' || s === 'TROCA_BOMBA' || s === 'PERFURACAO');
