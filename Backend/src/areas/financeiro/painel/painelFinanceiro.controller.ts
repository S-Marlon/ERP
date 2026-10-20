// Painel do financeiro: o que vai entrar e sair (títulos em aberto), o que entrou e saiu nos últimos meses (vendas à
// vista, recebimentos, sinais, pagamentos e devoluções em dinheiro), atrasados, para onde vai o dinheiro (categorias)
// e os maiores fornecedores e devedores.
// Montado em /api/financeiro/painel. Só leitura.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { Agrupamento, atrasosPorFaixa, diasEntre, Lancamento, montarFluxo, rotuloMes, somarDias, ultimosMeses } from './painelFinanceiro';
import { gerarTitulosRecorrentes } from '../pagar/recorrentes.controller';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;
const MESES_REALIZADO = 6;
const DIAS_VENCIMENTOS = 14;

const NOME_PESSOA = `COALESCE(NULLIF(pj.nome_fantasia, ''), NULLIF(pj.razao_social, ''), NULLIF(pf.nome, ''), CONCAT('Cadastro ', c.id_pessoa))`;
// conta da loja sem cadastro (luz, aluguel): vale o favorecido
const NOME_QUEM_RECEBE = `COALESCE(NULLIF(t.favorecido, ''), NULLIF(pj.nome_fantasia, ''), NULLIF(pj.razao_social, ''), NULLIF(pf.nome, ''), 'Sem favorecido')`;
const JOIN_PESSOA = (coluna: string) => `LEFT JOIN pessoas_core c ON c.id_pessoa = ${coluna}
       LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa`;

/** GET /api/financeiro/painel?dias=30|60|90 */
export const painelFinanceiro = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const dias = [30, 60, 90].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
    const agrupamento: Agrupamento = dias === 30 ? 'dia' : 'semana';
    await gerarTitulosRecorrentes(pool, tenant);
    const [[{ hoje }]]: any = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoje`);
    const meses = ultimosMeses(hoje, MESES_REALIZADO);
    const desde = `${meses[0]}-01`;

    // Títulos em aberto (o saldo de cada um)
    const [receber]: any = await pool.execute(
      `SELECT t.id_titulo, t.id_cliente AS id_pessoa, ${NOME_PESSOA} AS nome, t.descricao, t.parcela, t.total_parcelas,
              DATE_FORMAT(t.vencimento, '%Y-%m-%d') AS vencimento, t.valor - t.valor_pago AS saldo
       FROM financeiro_contas_receber t ${JOIN_PESSOA('t.id_cliente')}
       WHERE t.tenant_id = ? AND t.status = 'ABERTO' AND t.valor - t.valor_pago > 0.004`,
      [tenant]
    );
    const [pagar]: any = await pool.execute(
      `SELECT t.id_titulo, t.id_fornecedor AS id_pessoa, ${NOME_QUEM_RECEBE} AS nome, t.descricao, t.parcela, t.total_parcelas, t.forma_pagamento,
              t.valor_estimado, cat.nome AS categoria,
              DATE_FORMAT(t.vencimento, '%Y-%m-%d') AS vencimento, t.valor - t.valor_pago AS saldo
       FROM financeiro_contas_pagar t ${JOIN_PESSOA('t.id_fornecedor')}
       LEFT JOIN financeiro_categorias cat ON cat.id_categoria = t.id_categoria
       WHERE t.tenant_id = ? AND t.status = 'ABERTO' AND t.valor - t.valor_pago > 0.004`,
      [tenant]
    );
    const titulo = (t: any, tipo: 'RECEBER' | 'PAGAR') => ({
      tipo, idTitulo: Number(t.id_titulo), nome: t.nome, descricao: t.descricao || null, vencimento: t.vencimento, valor: n(t.saldo),
      parcela: Number(t.parcela) || 1, totalParcelas: Number(t.total_parcelas) || 1, forma: t.forma_pagamento || null,
      categoria: t.categoria || null, estimado: !!Number(t.valor_estimado),
    });
    const abertosReceber = receber.map((t: any) => titulo(t, 'RECEBER'));
    const abertosPagar = pagar.map((t: any) => titulo(t, 'PAGAR'));

    // a receber sem prazo ("paga quando puder") não tem data: fica fora do fluxo e dos atrasados, com o total à parte
    const semPrazo = abertosReceber.filter((t: any) => !t.vencimento);
    const comData = <T extends { vencimento: string | null }>(l: T[]) => l.filter(t => !!t.vencimento) as (T & { vencimento: string })[];
    const lancamentos: Lancamento[] = [
      ...comData(abertosReceber).map((t: any) => ({ data: t.vencimento, valor: t.valor, tipo: 'ENTRADA' as const })),
      ...abertosPagar.map((t: any) => ({ data: t.vencimento, valor: t.valor, tipo: 'SAIDA' as const })),
    ];
    const fluxo = montarFluxo(lancamentos, { hoje, dias, agrupamento });
    const fimPeriodo = somarDias(hoje, dias - 1);
    const soma = (l: { valor: number }[]) => n(l.reduce((a, t) => a + t.valor, 0));
    const vencidos = (l: any[]) => l.filter(t => t.vencimento && t.vencimento < hoje);
    const noPeriodo = (l: any[]) => l.filter(t => t.vencimento && t.vencimento >= hoje && t.vencimento <= fimPeriodo);

    // Realizado por mês: o dinheiro que entrou e saiu de verdade
    const [vendas]: any = await pool.execute(
      `SELECT DATE_FORMAT(v.created_at, '%Y-%m') AS mes, COALESCE(SUM(p.valor - p.troco), 0) AS bruto, COALESCE(SUM(p.taxa_valor), 0) AS taxas
       FROM vendas_pedidos_pagamentos p INNER JOIN vendas_pedidos v ON v.id_venda = p.id_venda
       WHERE v.tenant_id = ? AND v.status = 'CONCLUIDA' AND p.forma NOT IN ('PRAZO', 'ADIANTAMENTO') AND v.created_at >= ?
       GROUP BY mes`,
      [tenant, desde]
    );
    const [recebimentos]: any = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes, COALESCE(SUM(valor), 0) AS total FROM financeiro_contas_receber_baixas
       WHERE tenant_id = ? AND estornado_em IS NULL AND created_at >= ? GROUP BY mes`,
      [tenant, desde]
    );
    // sinal recebido (o crédito de devolução não é dinheiro novo)
    const [sinais]: any = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes, COALESCE(SUM(valor), 0) AS total FROM vendas_adiantamentos
       WHERE tenant_id = ? AND forma <> 'CREDITO_LOJA' AND status <> 'CANCELADO' AND created_at >= ? GROUP BY mes`,
      [tenant, desde]
    );
    const [pagos]: any = await pool.execute(
      `SELECT DATE_FORMAT(pago_em, '%Y-%m') AS mes, COALESCE(SUM(valor_pago), 0) AS total FROM financeiro_contas_pagar
       WHERE tenant_id = ? AND pago_em IS NOT NULL AND status <> 'CANCELADO' AND pago_em >= ? GROUP BY mes`,
      [tenant, desde]
    );
    const [devolvidos]: any = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes, COALESCE(SUM(valor_total), 0) AS total FROM vendas_devolucoes
       WHERE tenant_id = ? AND reembolso IN ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA') AND created_at >= ? GROUP BY mes`,
      [tenant, desde]
    );
    const porMes = (linhas: any[], campo = 'total') => new Map<string, number>(linhas.map(l => [l.mes, n(l[campo])]));
    const [mv, mt, mr, ms, mp, md] = [porMes(vendas, 'bruto'), porMes(vendas, 'taxas'), porMes(recebimentos), porMes(sinais), porMes(pagos), porMes(devolvidos)];
    const realizado = meses.map(mes => {
      // venda à vista entra líquida da taxa do cartão (o que cai na conta)
      const vendasVista = n((mv.get(mes) || 0) - (mt.get(mes) || 0));
      const entradas = n(vendasVista + (mr.get(mes) || 0) + (ms.get(mes) || 0));
      const saidas = n((mp.get(mes) || 0) + (md.get(mes) || 0));
      return {
        mes, rotulo: rotuloMes(mes), entradas, saidas, saldo: n(entradas - saidas),
        detalhe: {
          vendasVista, taxasCartao: mt.get(mes) || 0, recebimentos: mr.get(mes) || 0, sinais: ms.get(mes) || 0,
          pagamentos: mp.get(mes) || 0, devolucoes: md.get(mes) || 0,
        },
      };
    });

    // Maiores fornecedores (pago nos meses do realizado + em aberto) e maiores devedores (em aberto)
    const [fornecedores]: any = await pool.execute(
      `SELECT * FROM (
         SELECT t.id_fornecedor AS id_pessoa, ${NOME_QUEM_RECEBE} AS nome,
                COALESCE(SUM(CASE WHEN t.pago_em >= ? THEN t.valor_pago END), 0) AS pago,
                COALESCE(SUM(CASE WHEN t.status = 'ABERTO' THEN t.valor - t.valor_pago END), 0) AS aberto
         FROM financeiro_contas_pagar t ${JOIN_PESSOA('t.id_fornecedor')}
         WHERE t.tenant_id = ? AND t.status <> 'CANCELADO'
         GROUP BY t.id_fornecedor, nome
       ) f WHERE f.pago + f.aberto > 0 ORDER BY f.pago + f.aberto DESC LIMIT 6`,
      [desde, tenant]
    );
    // Para onde vai o dinheiro: pago nos meses do realizado e o que vence no período, por categoria
    const [categorias]: any = await pool.execute(
      `SELECT COALESCE(cat.grupo, 'Sem categoria') AS grupo, COALESCE(cat.nome, 'Sem categoria') AS nome,
              COALESCE(SUM(CASE WHEN t.pago_em >= ? THEN t.valor_pago END), 0) AS pago,
              COALESCE(SUM(CASE WHEN t.status = 'ABERTO' AND t.vencimento <= ? THEN t.valor - t.valor_pago END), 0) AS previsto
       FROM financeiro_contas_pagar t LEFT JOIN financeiro_categorias cat ON cat.id_categoria = t.id_categoria
       WHERE t.tenant_id = ? AND t.status <> 'CANCELADO'
       GROUP BY grupo, nome`,
      [desde, fimPeriodo, tenant]
    );
    const devedores = new Map<number, { nome: string; aberto: number; vencido: number; titulos: number }>();
    for (const t of receber) {
      const id = Number(t.id_pessoa);
      const d = devedores.get(id) || { nome: t.nome, aberto: 0, vencido: 0, titulos: 0 };
      d.aberto = n(d.aberto + Number(t.saldo));
      if (t.vencimento && t.vencimento < hoje) d.vencido = n(d.vencido + Number(t.saldo));
      d.titulos++;
      devedores.set(id, d);
    }

    return res.json({
      hoje, dias, agrupamento,
      totais: {
        aReceber: soma(abertosReceber), aPagar: soma(abertosPagar),
        receberVencido: soma(vencidos(abertosReceber)), pagarVencido: soma(vencidos(abertosPagar)),
        qtdReceberVencido: vencidos(abertosReceber).length, qtdPagarVencido: vencidos(abertosPagar).length,
        entraNoPeriodo: soma(noPeriodo(abertosReceber)), saiNoPeriodo: soma(noPeriodo(abertosPagar)),
        receberSemPrazo: soma(semPrazo), qtdReceberSemPrazo: semPrazo.length,
      },
      fluxo,
      vencimentos: [...comData(abertosReceber), ...abertosPagar]
        .filter(t => t.vencimento >= hoje && diasEntre(hoje, t.vencimento) < DIAS_VENCIMENTOS)
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor),
      atrasados: [...vencidos(abertosReceber), ...vencidos(abertosPagar)]
        .map(t => ({ ...t, diasAtraso: diasEntre(t.vencimento, hoje) }))
        .sort((a, b) => b.diasAtraso - a.diasAtraso),
      atrasoReceber: atrasosPorFaixa(comData(abertosReceber), hoje),
      atrasoPagar: atrasosPorFaixa(abertosPagar, hoje),
      realizado,
      fornecedores: fornecedores.map((f: any) => ({ idPessoa: Number(f.id_pessoa) || 0, nome: f.nome, pago: n(f.pago), aberto: n(f.aberto) })),
      categorias: categorias.map((c: any) => ({ grupo: c.grupo, nome: c.nome, pago: n(c.pago), previsto: n(c.previsto) }))
        .filter((c: any) => c.pago + c.previsto > 0).sort((a: any, b: any) => b.pago + b.previsto - (a.pago + a.previsto)),
      // todos (o painel mostra os maiores e abre o resto em "ver todos")
      devedores: [...devedores.entries()].map(([idPessoa, d]) => ({ idPessoa, ...d })).sort((a, b) => b.aberto - a.aberto),
    });
  } catch (error: any) {
    console.error('Erro no painel financeiro:', error);
    return res.status(500).json({ error: 'Erro ao montar o painel financeiro.', details: error?.message });
  }
};
