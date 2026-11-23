// Central do dia (GET /api/inicio/tarefas): junta as pendências de cada área numa lista só. Cada fonte é consultada à
// parte e, se uma falhar, as outras continuam (a falha volta em `fontesComErro`). Regras em tarefasDoDia.ts.
import { Request, Response } from 'express';
import pool from '../../infra/db';
import { carregarCurva } from '../estoque/curvaAbc/curvaAbc.controller';
import { painelPrecos } from '../catalogo/precos/painelPrecos.controller';
import {
  ordenarTarefas, Tarefa, tarefasCaixa, tarefasCurva, tarefasEstoqueNegativo, tarefasInventario, tarefasNotas, tarefasOrcamentos,
  tarefasPagar, tarefasPedidos, tarefasPedidosCompra, tarefasPrecos, tarefasReceber, Titulos,
} from './tarefasDoDia';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Number(v) || 0;

/** Resumo do painel de preços (quantos itens em cada situação), pelo mesmo cálculo da tela Catálogo › Preços. */
const resumoPrecos = (tenant: number) => new Promise<Record<string, number>>((resolve, reject) => {
  const res: any = {
    status: () => res,
    json: (b: any) => (b?.resumo?.porSituacao ? resolve(b.resumo.porSituacao) : reject(new Error(b?.error || 'painel de preços sem resumo'))),
  };
  painelPrecos({ query: { tenant_id: String(tenant), limit: '1' }, headers: {} } as any, res).catch(reject);
});

/** Soma de títulos em aberto por faixa de vencimento, com até 3 nomes de exemplo. */
const titulos = async (tabela: 'financeiro_contas_pagar' | 'financeiro_contas_receber', nome: string, tenant: number, condicao: string): Promise<Titulos> => {
  const [[r]]: any = await pool.execute(
    `SELECT COUNT(*) AS quantidade, COALESCE(SUM(valor - COALESCE(valor_pago, 0)), 0) AS valor,
            SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT ${nome} ORDER BY vencimento SEPARATOR '|'), '|', 3) AS exemplos
     FROM ${tabela} WHERE tenant_id = ? AND status NOT IN ('PAGO', 'CANCELADO') AND vencimento IS NOT NULL AND ${condicao}`, [tenant]);
  return { quantidade: n(r.quantidade), valor: n(r.valor), exemplos: r.exemplos ? String(r.exemplos).split('|').filter(Boolean) : [] };
};

export const tarefasDoDia = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [[dia]]: any = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoje, DAYOFWEEK(CURDATE()) AS semana`);
    const hoje: string = dia.hoje;
    const diaDeLoja = Number(dia.semana) !== 1;   // domingo fechado

    const fontes: Record<string, () => Promise<Tarefa[]>> = {
      'notas de entrada': async () => {
        const [rows]: any = await pool.execute(
          `SELECT id, numero_nf, COALESCE(NULLIF(nome_fantasia_fornecedor, ''), razao_social_fornecedor) AS fornecedor,
                  DATE_FORMAT(created_at, '%Y-%m-%d') AS criada, COALESCE(valor_total_nf, 0) AS valor
           FROM importacoes_lotes WHERE tenant_id = ? AND status NOT IN ('IMPORTADO', 'DESCARTADO') ORDER BY created_at`, [tenant]);
        return tarefasNotas(rows.map((r: any) => ({ id: Number(r.id), numero: r.numero_nf, fornecedor: r.fornecedor, criadaEm: r.criada, valor: n(r.valor) })), hoje);
      },
      inventário: async () => {
        const [[listas], [[gerada]]]: any = await Promise.all([
          pool.execute(
            `SELECT i.id_inventario, a.nome AS area, DATE_FORMAT(i.created_at, '%Y-%m-%d') AS criada,
                    (SELECT COUNT(*) FROM estoque_inventarios_itens x WHERE x.id_inventario = i.id_inventario) AS itens
             FROM estoque_inventarios i LEFT JOIN estoque_inventario_areas a ON a.id_area = i.id_area
             WHERE i.tenant_id = ? AND i.status = 'ABERTA' ORDER BY i.id_inventario`, [tenant]),
          pool.execute(`SELECT COUNT(*) AS n FROM estoque_inventarios WHERE tenant_id = ? AND created_at >= CURDATE()`, [tenant]),
        ]);
        return tarefasInventario(listas.map((l: any) => ({ id: Number(l.id_inventario), area: l.area, itens: n(l.itens), criadaEm: l.criada })), n(gerada.n) > 0, diaDeLoja, hoje);
      },
      caixa: async () => {
        const [rows]: any = await pool.execute(
          `SELECT id_caixa, operador, DATE_FORMAT(aberto_em, '%Y-%m-%d %H:%i') AS aberto FROM vendas_caixas WHERE tenant_id = ? AND status = 'ABERTO'`, [tenant]);
        return tarefasCaixa(rows.map((c: any) => ({ id: Number(c.id_caixa), operador: c.operador, abertoEm: c.aberto })), hoje);
      },
      'contas a pagar': async () => {
        const nome = `COALESCE(NULLIF(favorecido, ''), descricao)`;
        const [vencidas, deHoje, semana] = await Promise.all([
          titulos('financeiro_contas_pagar', nome, tenant, 'vencimento < CURDATE()'),
          titulos('financeiro_contas_pagar', nome, tenant, 'vencimento = CURDATE()'),
          titulos('financeiro_contas_pagar', nome, tenant, 'vencimento > CURDATE() AND vencimento <= CURDATE() + INTERVAL 7 DAY'),
        ]);
        return tarefasPagar(vencidas, deHoje, semana);
      },
      'contas a receber': async () => tarefasReceber(await titulos('financeiro_contas_receber', 'descricao', tenant, 'vencimento < CURDATE()')),
      'pedidos faturados': async () => {
        const [rows]: any = await pool.execute(
          `SELECT p.id_venda, p.cliente_nome, DATE_FORMAT(p.previsao_entrega, '%Y-%m-%d') AS previsao, p.total_liquido,
                  (SELECT COUNT(*) FROM financeiro_contas_receber t WHERE t.id_venda = p.id_venda AND t.status = 'ABERTO' AND t.forma = 'BOLETO' AND t.codigo_barras IS NULL) AS boletos
           FROM vendas_pedidos p WHERE p.tenant_id = ? AND p.origem = 'ERP' AND p.status IN ('PEDIDO', 'FATURADO') AND p.entregue_em IS NULL`, [tenant]);
        return tarefasPedidos(rows.map((p: any) => ({ id: Number(p.id_venda), cliente: p.cliente_nome, previsao: p.previsao, boletosFaltando: n(p.boletos), total: n(p.total_liquido) })), hoje);
      },
      'orçamentos e vendas suspensas': async () => {
        const [rows]: any = await pool.execute(
          `SELECT id_venda, status, cliente_nome, DATE_FORMAT(validade, '%Y-%m-%d') AS validade, total_liquido, DATE_FORMAT(created_at, '%Y-%m-%d') AS criado
           FROM vendas_pedidos WHERE tenant_id = ? AND status IN ('ORCAMENTO', 'SUSPENSA')`, [tenant]);
        return tarefasOrcamentos(rows.map((o: any) => ({
          id: Number(o.id_venda), cliente: o.cliente_nome || 'Consumidor', validade: o.validade, total: n(o.total_liquido), status: o.status, criadoEm: o.criado,
        })), hoje);
      },
      'pedidos de compra': async () => {
        const [rows]: any = await pool.execute(
          `SELECT p.id_pedido, COALESCE(NULLIF(pj.nome_fantasia, ''), pj.razao_social, 'Fornecedor') AS fornecedor, DATE_FORMAT(p.created_at, '%Y-%m-%d') AS criado,
                  COALESCE(p.total_estimado, 0) AS total
           FROM compras_pedidos p LEFT JOIN pessoas_pj pj ON pj.id_cliente = p.id_fornecedor
           WHERE p.tenant_id = ? AND p.status = 'RASCUNHO'`, [tenant]);
        return tarefasPedidosCompra(rows.map((p: any) => ({ id: Number(p.id_pedido), fornecedor: p.fornecedor, criadoEm: p.criado, total: n(p.total) })), hoje);
      },
      preços: async () => tarefasPrecos(await resumoPrecos(tenant)),
      'curva ABC': async () => {
        const curva = await carregarCurva(tenant, 90);
        return tarefasCurva(curva.itens.map((i: any) => ({
          nome: i.nome, venda: i.venda, situacao: i.situacao, estoque: n(i.estoque), valorEstoque: n(i.valorEstoque), lucro: n(i.lucro), margem: i.margem,
          lucroClasse: i.lucroClasse, decisaoCompra: i.decisaoCompra || null,
        })));
      },
      'estoque negativo': async () => {
        const [[r]]: any = await pool.execute(
          `SELECT COUNT(*) AS n FROM estoque_saldos_itens WHERE tenant_id = ? AND deposito = 'VENDA' AND quantidade_atual < 0`, [tenant]);
        return tarefasEstoqueNegativo(n(r.n));
      },
    };

    const nomes = Object.keys(fontes);
    const resultados = await Promise.allSettled(nomes.map(k => fontes[k]()));
    const fontesComErro: string[] = [];
    const tarefas: Tarefa[] = [];
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') tarefas.push(...r.value);
      else { fontesComErro.push(nomes[i]); console.error(`Central do dia: falha em ${nomes[i]}:`, r.reason); }
    });
    return res.json({ hoje, tarefas: ordenarTarefas(tarefas), fontesComErro });
  } catch (error: any) {
    console.error('Erro na central do dia:', error);
    return res.status(500).json({ error: 'Erro ao montar as tarefas do dia.', details: error?.message });
  }
};
