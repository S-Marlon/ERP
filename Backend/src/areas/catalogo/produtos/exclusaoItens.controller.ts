// Exclusão definitiva de itens sem histórico (ex.: itens de teste). Quem tem nota, estoque, venda... fica bloqueado.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { lerIds, motivosBloqueio, UsoDoItem, USO_VAZIO } from './exclusaoItens';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };
const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

/** Contagens de uso por item; tabela que não existir (módulo não instalado) conta como zero. */
const carregarUso = async (conn: Conn, ids: number[]): Promise<Map<number, UsoDoItem>> => {
  const uso = new Map<number, UsoDoItem>(ids.map(id => [id, { ...USO_VAZIO }]));
  if (!ids.length) return uso;
  const lista = ids.map(() => '?').join(',');
  const contar = async (campo: keyof UsoDoItem, sql: string, params: any[] = ids) => {
    try {
      const [rows] = await conn.execute(sql, params);
      for (const r of rows as any[]) {
        const u = uso.get(Number(r.id));
        if (u) u[campo] += Number(r.n) || 0;
      }
    } catch (e: any) {
      if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
    }
  };
  await contar('notasEntrada', `SELECT produto_id_sistema AS id, COUNT(*) AS n FROM importacao_produtos_staging WHERE produto_id_sistema IN (${lista}) GROUP BY produto_id_sistema`);
  await contar('notasEntrada', `SELECT id_item AS id, COUNT(*) AS n FROM compras_core_nota_itens WHERE id_item IN (${lista}) GROUP BY id_item`);
  await contar('movimentos', `SELECT id_item AS id, COUNT(*) AS n FROM estoque_movimentos WHERE id_item IN (${lista}) GROUP BY id_item`);
  await contar('saldo', `SELECT id_item AS id, SUM(quantidade_atual) AS n FROM estoque_saldos_itens WHERE id_item IN (${lista}) GROUP BY id_item`);
  await contar('vendas', `SELECT id_item AS id, COUNT(*) AS n FROM vendas_pedidos_itens WHERE id_item IN (${lista}) GROUP BY id_item`);
  await contar('devolucoes', `SELECT id_item AS id, COUNT(*) AS n FROM vendas_devolucoes_itens WHERE id_item IN (${lista}) GROUP BY id_item`);
  await contar('ordensServico', `SELECT id_item AS id, COUNT(*) AS n FROM modulo_hidraulica_montagens_os_itens WHERE id_item IN (${lista}) GROUP BY id_item`);
  await contar('composicoes', `SELECT id_item_filho AS id, COUNT(*) AS n FROM itens_composicoes WHERE id_item_filho IN (${lista}) GROUP BY id_item_filho`);
  await contar('unificacoes', `SELECT id_item_origem AS id, COUNT(*) AS n FROM itens_core_unificacoes WHERE id_item_origem IN (${lista}) GROUP BY id_item_origem`);
  await contar('unificacoes', `SELECT id_item_destino AS id, COUNT(*) AS n FROM itens_core_unificacoes WHERE id_item_destino IN (${lista}) GROUP BY id_item_destino`);
  await contar('correcoes', `SELECT id_item_novo AS id, COUNT(*) AS n FROM importacao_correcoes WHERE id_item_novo IN (${lista}) GROUP BY id_item_novo`);
  return uso;
};

const conferir = async (conn: Conn, tenant: number, ids: number[], trava = false) => {
  if (!ids.length) return [];
  const [rows] = await conn.execute(
    `SELECT ic.id_item, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
            COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome
     FROM itens_core ic LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     WHERE ic.tenant_id = ? AND ic.id_item IN (${ids.map(() => '?').join(',')})${trava ? ' FOR UPDATE' : ''}`,
    [tenant, ...ids]
  );
  const itens = rows as any[];
  const uso = await carregarUso(conn, itens.map(i => Number(i.id_item)));
  return itens.map(i => {
    const motivos = motivosBloqueio(uso.get(Number(i.id_item)) || USO_VAZIO);
    return { idItem: Number(i.id_item), sku: i.sku, nome: i.nome, podeApagar: motivos.length === 0, motivos };
  });
};

/** POST /catalogo/itens/exclusao/conferir { ids } — quem pode ser apagado e por que os outros não. */
export const conferirExclusao = async (req: Request, res: Response) => {
  const ids = lerIds(req.body?.ids);
  if (!ids.length) return res.status(400).json({ error: 'Nenhum item informado.' });
  try {
    return res.json({ itens: await conferir(pool as any, tenantDe(req), ids) });
  } catch (error: any) {
    console.error('Erro ao conferir exclusão de itens:', error);
    return res.status(500).json({ error: 'Erro ao conferir os itens.', details: error.message });
  }
};

/**
 * POST /catalogo/itens/exclusao { ids } — apaga de vez os itens sem histórico (confere de novo, travando as linhas).
 * Vai junto o que é só do item: preços, unidades, dados fiscais/logísticos, anexos, vínculo com fornecedor,
 * saldo zerado e registro de etiqueta.
 */
export const apagarItens = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const ids = lerIds(req.body?.ids);
  if (!ids.length) return res.status(400).json({ error: 'Nenhum item informado.' });
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const conferidos = await conferir(connection, tenant, ids, true);
    const apagar = conferidos.filter(c => c.podeApagar).map(c => c.idItem);
    if (apagar.length) {
      const lista = apagar.map(() => '?').join(',');
      // Sem ON DELETE CASCADE: saem antes do item
      await connection.execute(`DELETE FROM estoque_etiquetas_impressas WHERE id_item IN (${lista})`, apagar);
      await connection.execute(`DELETE FROM estoque_saldos_itens WHERE id_item IN (${lista})`, apagar);
      await connection.execute(`DELETE FROM comercial_precos_faixas WHERE id_item IN (${lista})`, apagar);
      // O resto (dados comerciais, unidades, fiscais, anexos, fornecedor...) cai em cascata com o item
      await connection.execute(`DELETE FROM itens_core WHERE tenant_id = ? AND id_item IN (${lista})`, [tenant, ...apagar]);
    }
    await connection.commit();
    return res.json({
      apagados: conferidos.filter(c => c.podeApagar),
      bloqueados: conferidos.filter(c => !c.podeApagar),
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao apagar itens:', error);
    if (error?.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Algum item ainda é usado em outro cadastro: nada foi apagado.', details: error.sqlMessage });
    }
    return res.status(500).json({ error: 'Erro ao apagar os itens.', details: error.message });
  } finally {
    connection.release();
  }
};

