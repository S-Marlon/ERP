// Resultado do mês (DRE gerencial): os últimos meses lado a lado. Vendas, custo e taxas vêm das vendas concluídas
// (a do Mercado Livre entra com a tarifa e o frete nas taxas); devoluções das devoluções; despesas do contas a pagar
// pelo mês de competência (conta fixa) ou pelo vencimento, por categoria. Montado em /api/financeiro/resultado.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { rotuloMes, ultimosMeses } from '../painel/painelFinanceiro';
import { gerarTitulosRecorrentes } from '../pagar/recorrentes.controller';
import { DadosDoMes, ehCompraDeMercadoria, montarResultado } from './resultadoMes';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

// GET /api/financeiro/resultado?meses=6
export const resultadoDosMeses = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const qtd = [3, 6, 12].includes(Number(req.query.meses)) ? Number(req.query.meses) : 6;
    await gerarTitulosRecorrentes(pool, tenant);
    const [[{ hoje }]]: any = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoje`);
    const meses = ultimosMeses(hoje, qtd);
    const desde = `${meses[0]}-01`;

    const [vendas]: any = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes, origem, COUNT(*) AS qtd, COALESCE(SUM(total_liquido), 0) AS liquido,
              COALESCE(SUM(total_custo), 0) AS custo, COALESCE(SUM(total_taxas), 0) AS taxas
       FROM vendas_pedidos WHERE tenant_id = ? AND status = 'CONCLUIDA' AND created_at >= ? GROUP BY mes, origem`,
      [tenant, desde]
    );
    const [devolucoes]: any = await pool.execute(
      `SELECT DATE_FORMAT(d.created_at, '%Y-%m') AS mes, COALESCE(SUM(di.valor), 0) AS valor,
              COALESCE(SUM(CASE WHEN di.voltou_estoque = 1 THEN di.custo_unitario_base * di.quantidade_base END), 0) AS custo_recuperado
       FROM vendas_devolucoes d INNER JOIN vendas_devolucoes_itens di ON di.id_devolucao = d.id_devolucao
       WHERE d.tenant_id = ? AND d.created_at >= ? GROUP BY mes`,
      [tenant, desde]
    );
    // despesas: pelo mês a que a conta se refere (conta fixa) ou pelo vencimento; abertas e pagas (competência)
    const [contas]: any = await pool.execute(
      `SELECT DATE_FORMAT(COALESCE(t.competencia, t.vencimento), '%Y-%m') AS mes, t.id_lote, cat.grupo, cat.nome AS categoria, SUM(t.valor) AS valor
       FROM financeiro_contas_pagar t LEFT JOIN financeiro_categorias cat ON cat.id_categoria = t.id_categoria
       WHERE t.tenant_id = ? AND t.status <> 'CANCELADO' AND COALESCE(t.competencia, t.vencimento) >= ?
         AND COALESCE(t.competencia, t.vencimento) < DATE_ADD(?, INTERVAL 1 MONTH)
       GROUP BY mes, t.id_lote IS NULL, cat.grupo, cat.nome, t.id_lote`,
      [tenant, desde, `${meses[meses.length - 1]}-01`]
    );

    const resultado = meses.map(mes => {
      const doMes = vendas.filter((v: any) => v.mes === mes);
      const dev = devolucoes.find((d: any) => d.mes === mes);
      const dados: DadosDoMes = {
        vendas: n(doMes.reduce((a: number, v: any) => a + Number(v.liquido), 0)),
        qtdVendas: doMes.reduce((a: number, v: any) => a + Number(v.qtd), 0),
        devolucoes: n(dev?.valor), custoRecuperado: n(dev?.custo_recuperado),
        custoVendas: n(doMes.reduce((a: number, v: any) => a + Number(v.custo), 0)),
        taxasMl: n(doMes.filter((v: any) => v.origem === 'MERCADO_LIVRE').reduce((a: number, v: any) => a + Number(v.taxas), 0)),
        taxasCartao: n(doMes.filter((v: any) => v.origem !== 'MERCADO_LIVRE').reduce((a: number, v: any) => a + Number(v.taxas), 0)),
        despesas: contas
          .filter((c: any) => c.mes === mes && !ehCompraDeMercadoria({ idLote: c.id_lote ? Number(c.id_lote) : null, grupo: c.grupo || null }))
          .map((c: any) => ({ grupo: c.grupo || 'Sem categoria', categoria: c.categoria || 'Sem categoria', valor: n(c.valor) })),
      };
      const compras = n(contas.filter((c: any) => c.mes === mes && ehCompraDeMercadoria({ idLote: c.id_lote ? Number(c.id_lote) : null, grupo: c.grupo || null }))
        .reduce((a: number, c: any) => a + Number(c.valor), 0));
      return { mes, rotulo: rotuloMes(mes), linhas: montarResultado(dados), comprasMercadoria: compras };
    });
    return res.json({ hoje, meses: resultado });
  } catch (error: any) {
    console.error('Erro no resultado do mês:', error);
    return res.status(500).json({ error: 'Erro ao montar o resultado do mês.', details: error?.message });
  }
};
