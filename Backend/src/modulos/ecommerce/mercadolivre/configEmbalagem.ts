// Interruptor do ML "custo da embalagem no lucro" (modulo_ecommerce_mercadolivre_config.custo_embalagem_no_lucro).
// Ligado, a conta de lucro de cada forma de venda soma o custo da embalagem recomendada (e a trava de prejuízo também).
// Guardado por 1 minuto: a conta de lucro roda muitas vezes por tela.
import pool from '../../../infra/db';

const cache = new Map<number, { em: number; valor: boolean }>();

export const custoEmbalagemNoLucro = async (tenant: number): Promise<boolean> => {
  const g = cache.get(tenant);
  if (g && Date.now() - g.em < 60 * 1000) return g.valor;
  const [[c]]: any = await pool.execute(`SELECT custo_embalagem_no_lucro FROM modulo_ecommerce_mercadolivre_config WHERE tenant_id = ?`, [tenant]).catch(() => [[null]]);
  const valor = !!Number(c?.custo_embalagem_no_lucro);
  cache.set(tenant, { em: Date.now(), valor });
  return valor;
};

export const salvarCustoEmbalagemNoLucro = async (tenant: number, ligado: boolean) => {
  await pool.execute(
    `INSERT INTO modulo_ecommerce_mercadolivre_config (tenant_id, custo_embalagem_no_lucro) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE custo_embalagem_no_lucro = VALUES(custo_embalagem_no_lucro)`,
    [tenant, ligado ? 1 : 0]
  );
  cache.delete(tenant);
};
