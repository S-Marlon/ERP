// Situação da cobrança de uma nota de entrada (duplicatas do XML x títulos lançados no contas a pagar).
// Usada pela validação da aprovação da nota (bloqueio) e pela tela de cobrança.
import { cobrancaDoXml, situacaoCobranca, SituacaoCobranca } from './pagar';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

export const titulosAtivosDoLote = async (conn: Conn, tenant: number, idLote: number) => {
  const [[t]]: any = await conn.execute(
    `SELECT COUNT(*) AS qtd, COALESCE(SUM(valor), 0) AS total FROM financeiro_contas_pagar
     WHERE tenant_id = ? AND id_lote = ? AND status <> 'CANCELADO'`,
    [tenant, idLote]
  );
  return { qtd: Number(t?.qtd) || 0, total: Number(t?.total) || 0 };
};

/** lote = linha de importacoes_lotes (precisa de id, xml_conteudo, financeiro_situacao, financeiro_observacao). */
export const situacaoCobrancaDoLote = async (conn: Conn, tenant: number, lote: any): Promise<SituacaoCobranca> =>
  situacaoCobranca(
    cobrancaDoXml(lote.xml_conteudo),
    await titulosAtivosDoLote(conn, tenant, Number(lote.id)),
    { situacao: lote.financeiro_situacao ?? null, observacao: lote.financeiro_observacao ?? null }
  );
