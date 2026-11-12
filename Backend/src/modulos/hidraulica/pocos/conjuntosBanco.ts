// Obras de poços › conjunto motobomba: gravações que a obra também usa (ao concluir instalação, troca de bomba ou
// perfuração com bomba no relatório, o conjunto do relatório entra como instalado e o anterior fica retirado).
import { Conjunto, conjuntoDoRelatorio, instalaConjunto } from './conjuntos';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

export const COLUNAS_CONJUNTO: Record<keyof Conjunto, string> = {
  instaladoEm: 'instalado_em', retiradoEm: 'retirado_em', bombaTipo: 'bomba_tipo', bombaMarca: 'bomba_marca', bombaModelo: 'bomba_modelo',
  potenciaCv: 'potencia_cv', tensao: 'tensao', estagios: 'estagios', motorMarca: 'motor_marca', motorModelo: 'motor_modelo',
  bombeadorMarca: 'bombeador_marca', bombeadorModelo: 'bombeador_modelo', profundidadeBombaM: 'profundidade_bomba_m',
  tuboMaterial: 'tubo_material', tuboDiametro: 'tubo_diametro', tuboBarras: 'tubo_barras', tuboMetros: 'tubo_metros',
  fioTipo: 'fio_tipo', fioBitola: 'fio_bitola', fioMetros: 'fio_metros', cordaMaterial: 'corda_material', cordaMetros: 'corda_metros',
  quadroComando: 'quadro_comando', cabecaPoco: 'cabeca_poco', observacao: 'observacao',
};

/** Linha do banco → conjunto (números como número). */
export const conjuntoDaLinha = (r: any): Partial<Conjunto> => {
  const c: any = {};
  for (const [k, col] of Object.entries(COLUNAS_CONJUNTO)) c[k] = r[col] === null || r[col] === undefined ? null : NUMERICAS.has(k) ? Number(r[col]) : r[col];
  return c;
};
export const NUMERICAS = new Set(['potenciaCv', 'estagios', 'profundidadeBombaM', 'tuboBarras', 'tuboMetros', 'fioMetros', 'cordaMetros']);

/** Retira o conjunto instalado do poço (se houver) na data informada. Devolve quantos retirou. */
export const retirarInstalado = async (conn: Conn, tenant: number, idPoco: number, dia: string, operador: string) => {
  const [u]: any = await conn.execute(
    `UPDATE modulo_hidraulica_pocos_conjuntos SET situacao = 'RETIRADO', retirado_em = GREATEST(?, COALESCE(instalado_em, ?)), operador = ?
     WHERE id_poco = ? AND tenant_id = ? AND situacao = 'INSTALADO'`, [dia, dia, operador, idPoco, tenant]);
  return Number(u.affectedRows) || 0;
};

/** Grava um conjunto novo (todas as colunas). Com data de retirada já entra no histórico. */
export const inserirConjunto = async (conn: Conn, tenant: number, idPoco: number, idObra: number | null, c: Partial<Conjunto>, operador: string) => {
  const chaves = Object.keys(COLUNAS_CONJUNTO) as (keyof Conjunto)[];
  const situacao = c.retiradoEm ? 'RETIRADO' : 'INSTALADO';
  const [ins]: any = await conn.execute(
    `INSERT INTO modulo_hidraulica_pocos_conjuntos (tenant_id, id_poco, id_obra, situacao, ${chaves.map(k => COLUNAS_CONJUNTO[k]).join(', ')}, operador)
     VALUES (?, ?, ?, ?, ${chaves.map(() => '?').join(', ')}, ?)`,
    [tenant, idPoco, idObra, situacao, ...chaves.map(k => c[k] ?? null), operador]);
  return Number(ins.insertId);
};

/**
 * Ao concluir a obra: se o serviço instala bomba e o relatório descreve o conjunto, ele entra como instalado no poço
 * (o anterior fica retirado). Não repete se a obra já registrou um conjunto. Devolve o id ou null.
 */
export const registrarConjuntoDaObra = async (conn: Conn, tenant: number, idObra: number, idPoco: number | null, servicos: string[],
  relatorio: Record<string, any> | null, dia: string, operador: string) => {
  if (!idPoco || !instalaConjunto(servicos)) return null;
  const c = conjuntoDoRelatorio(relatorio);
  if (!c) return null;
  const [[ja]]: any = await conn.execute(`SELECT id_conjunto FROM modulo_hidraulica_pocos_conjuntos WHERE id_obra = ? LIMIT 1`, [idObra]);
  if (ja) return null;
  const instaladoEm = c.instaladoEm && c.instaladoEm <= dia ? c.instaladoEm : dia;
  await retirarInstalado(conn, tenant, idPoco, instaladoEm, operador);
  return inserirConjunto(conn, tenant, idPoco, idObra, { ...c, instaladoEm, retiradoEm: null }, operador);
};
