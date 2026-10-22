// Obras de poços › cobrança: as leituras e gravações que a obra também usa (a parcela do sinal acompanha o valor do
// sinal da obra; o início da obra consulta se o sinal foi pago).
import { acertoDoSinal, descricaoParcela } from './cobranca';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

export const parcelaDoSinal = async (conn: Conn, idObra: number) => {
  const [[p]]: any = await conn.execute(
    `SELECT * FROM modulo_hidraulica_pocos_parcelas WHERE id_obra = ? AND tipo = 'SINAL' AND status <> 'CANCELADO' ORDER BY id_parcela DESC LIMIT 1 FOR UPDATE`, [idObra]);
  return p ? { idParcela: Number(p.id_parcela), valor: Number(p.valor), valorPago: Number(p.valor_pago), status: p.status as 'ABERTO' | 'PAGO' | 'CANCELADO' } : null;
};

/** Deixa a parcela do sinal igual ao sinal da obra (cria, muda o valor ou cancela). Chamar dentro da transação. */
export const acertarSinal = async (conn: Conn, tenant: number, idObra: number, valorSinal: number | null, operador: string) => {
  const a = acertoDoSinal(valorSinal, await parcelaDoSinal(conn, idObra));
  if (a.acao === 'CRIAR') {
    await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_parcelas (tenant_id, id_obra, tipo, parcela, total_parcelas, descricao, vencimento, valor, operador)
       VALUES (?, ?, 'SINAL', 1, 1, ?, NULL, ?, ?)`, [tenant, idObra, descricaoParcela(idObra, 'SINAL', 1, 1), a.valor, operador]);
  } else if (a.acao === 'ATUALIZAR') {
    await conn.execute(`UPDATE modulo_hidraulica_pocos_parcelas SET valor = ?, status = ?, operador = ? WHERE id_parcela = ?`, [a.valor, a.status, operador, a.idParcela]);
  } else if (a.acao === 'CANCELAR') {
    await conn.execute(`UPDATE modulo_hidraulica_pocos_parcelas SET status = 'CANCELADO', operador = ? WHERE id_parcela = ?`, [operador, a.idParcela]);
  }
  return a.acao;
};
