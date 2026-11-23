// Central do dia (GET /api/inicio/tarefas): junta as pendências de cada área numa lista só. Cada fonte é consultada à
// parte e, se uma falhar, as outras continuam (a falha volta em `fontesComErro`). Regras em tarefasDoDia.ts.
import { Request, Response } from 'express';
import pool from '../../infra/db';
import { carregarCurva } from '../estoque/curvaAbc/curvaAbc.controller';
import { painelPrecos } from '../catalogo/precos/painelPrecos.controller';
import {
  dataDoAdiamento, ErroTarefa, Lembrete, ordenarTarefas, semAdiadas, Tarefa, tarefasLembretes, validarLembrete, tarefasCaixa, tarefasCurva, tarefasEstoqueNegativo, tarefasInventario, tarefasNotas, tarefasOrcamentos,
  tarefasPagar, tarefasPedidos, tarefasPedidosCompra, tarefasPrecos, tarefasReceber, Titulos,
} from './tarefasDoDia';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const operadorDe = (req: Request) => String(req.body?.operador || req.query.operador || '').trim().slice(0, 60) || 'ADM';
const hojeDoBanco = async () => { const [[d]]: any = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoje`); return String(d.hoje); };
const responder = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroTarefa) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};
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
    // Lembretes do operador e as tarefas automáticas adiadas (tabela inicio_tarefas)
    const [registros]: any = await pool.execute(
      `SELECT id_tarefa, origem, chave, titulo, descricao, DATE_FORMAT(vencimento, '%Y-%m-%d') AS vencimento, prioridade, responsavel,
              DATE_FORMAT(adiada_ate, '%Y-%m-%d') AS adiada_ate
       FROM inicio_tarefas WHERE tenant_id = ? AND status = 'ABERTA'`, [tenant]);
    const lembretes: Lembrete[] = registros.filter((r: any) => r.origem === 'MANUAL').map((r: any) => ({
      id: Number(r.id_tarefa), titulo: r.titulo, descricao: r.descricao, vencimento: r.vencimento, prioridade: r.prioridade, responsavel: r.responsavel,
    }));
    const { visiveis: dosLembretes, agendados } = tarefasLembretes(lembretes, hoje);
    const adiamentos = registros.filter((r: any) => r.origem === 'AUTOMATICA' && r.adiada_ate && r.adiada_ate > hoje);
    const { visiveis } = semAdiadas(tarefas, new Map<string, string>(adiamentos.map((r: any) => [r.chave, r.adiada_ate])), hoje);
    const existentes = new Set(tarefas.map(t => t.chave));
    const [[feitas]]: any = await pool.execute(
      `SELECT COUNT(*) AS n FROM inicio_tarefas WHERE tenant_id = ? AND origem = 'MANUAL' AND status = 'FEITA' AND concluida_em >= CURDATE()`, [tenant]);
    return res.json({
      hoje, tarefas: ordenarTarefas([...dosLembretes, ...visiveis]), fontesComErro, agendados,
      // Só os adiamentos de pendências que ainda existem (a resolvida some de vez)
      adiadas: adiamentos.filter((r: any) => existentes.has(r.chave)).map((r: any) => ({ chave: r.chave, titulo: r.titulo, ate: r.adiada_ate })),
      feitasHoje: n(feitas.n),
    });
  } catch (error: any) {
    console.error('Erro na central do dia:', error);
    return res.status(500).json({ error: 'Erro ao montar as tarefas do dia.', details: error?.message });
  }
};

// ---------------------------------------------------------------- lembretes do operador
/** POST /api/inicio/lembretes { titulo, descricao?, vencimento?, prioridade?, responsavel? } */
export const criarLembrete = async (req: Request, res: Response) => {
  try {
    const l = validarLembrete(req.body);
    const [r]: any = await pool.execute(
      `INSERT INTO inicio_tarefas (tenant_id, origem, titulo, descricao, vencimento, prioridade, responsavel, operador) VALUES (?, 'MANUAL', ?, ?, ?, ?, ?, ?)`,
      [tenantDe(req), l.titulo, l.descricao, l.vencimento, l.prioridade, l.responsavel, operadorDe(req)]);
    return res.status(201).json({ id: Number(r.insertId) });
  } catch (error) { return responder(res, error, 'Erro ao criar o lembrete.'); }
};

/** PUT /api/inicio/lembretes/:id — mesmos campos da criação. */
export const editarLembrete = async (req: Request, res: Response) => {
  try {
    const l = validarLembrete(req.body);
    const [r]: any = await pool.execute(
      `UPDATE inicio_tarefas SET titulo = ?, descricao = ?, vencimento = ?, prioridade = ?, responsavel = ?
       WHERE id_tarefa = ? AND tenant_id = ? AND origem = 'MANUAL'`,
      [l.titulo, l.descricao, l.vencimento, l.prioridade, l.responsavel, Number(req.params.id), tenantDe(req)]);
    if (!r.affectedRows) throw new ErroTarefa('Lembrete não encontrado.', 404);
    return res.json({ success: true });
  } catch (error) { return responder(res, error, 'Erro ao salvar o lembrete.'); }
};

/** POST /api/inicio/lembretes/:id/situacao { situacao: FEITA | CANCELADA | ABERTA } — concluir, excluir ou reabrir. */
export const situacaoLembrete = async (req: Request, res: Response) => {
  try {
    const situacao = String(req.body?.situacao || '').toUpperCase();
    if (!['FEITA', 'CANCELADA', 'ABERTA'].includes(situacao)) throw new ErroTarefa('Situação inválida.');
    const feita = situacao === 'FEITA';
    const [r]: any = await pool.execute(
      `UPDATE inicio_tarefas SET status = ?, concluida_em = ${feita ? 'NOW()' : 'NULL'}, concluida_por = ?
       WHERE id_tarefa = ? AND tenant_id = ? AND origem = 'MANUAL'`,
      [situacao, feita ? operadorDe(req) : null, Number(req.params.id), tenantDe(req)]);
    if (!r.affectedRows) throw new ErroTarefa('Lembrete não encontrado.', 404);
    return res.json({ success: true });
  } catch (error) { return responder(res, error, 'Erro ao mudar o lembrete.'); }
};

/** POST /api/inicio/lembretes/:id/adiar { para: AMANHA | SEMANA | AAAA-MM-DD } — o lembrete passa a vencer nessa data. */
export const adiarLembrete = async (req: Request, res: Response) => {
  try {
    const ate = dataDoAdiamento(req.body?.para, await hojeDoBanco());
    const [r]: any = await pool.execute(
      `UPDATE inicio_tarefas SET vencimento = ? WHERE id_tarefa = ? AND tenant_id = ? AND origem = 'MANUAL' AND status = 'ABERTA'`,
      [ate, Number(req.params.id), tenantDe(req)]);
    if (!r.affectedRows) throw new ErroTarefa('Lembrete não encontrado.', 404);
    return res.json({ success: true, ate });
  } catch (error) { return responder(res, error, 'Erro ao adiar o lembrete.'); }
};

/** GET /api/inicio/lembretes/feitos — concluídos nos últimos 7 dias (para conferir e reabrir). */
export const lembretesFeitos = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT id_tarefa, titulo, concluida_por, DATE_FORMAT(concluida_em, '%Y-%m-%d %H:%i') AS concluida_em
       FROM inicio_tarefas WHERE tenant_id = ? AND origem = 'MANUAL' AND status = 'FEITA' AND concluida_em >= CURDATE() - INTERVAL 7 DAY
       ORDER BY concluida_em DESC LIMIT 50`, [tenantDe(req)]);
    return res.json(rows.map((r: any) => ({ id: Number(r.id_tarefa), titulo: r.titulo, concluidaPor: r.concluida_por, concluidaEm: r.concluida_em })));
  } catch (error) { return responder(res, error, 'Erro ao listar os lembretes feitos.'); }
};

// ---------------------------------------------------------------- adiar tarefa automática
/** POST /api/inicio/adiar { chave, titulo, para: AMANHA | SEMANA | AAAA-MM-DD } — some da central até a data (volta se ainda existir). */
export const adiarTarefa = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const chave = String(req.body?.chave || '').trim().slice(0, 120);
    if (!chave || chave.startsWith('LEMBRETE:')) throw new ErroTarefa('Tarefa inválida.');
    const ate = dataDoAdiamento(req.body?.para, await hojeDoBanco());
    const titulo = String(req.body?.titulo || chave).trim().slice(0, 150);
    const [[existe]]: any = await pool.execute(
      `SELECT id_tarefa FROM inicio_tarefas WHERE tenant_id = ? AND origem = 'AUTOMATICA' AND chave = ? ORDER BY id_tarefa DESC LIMIT 1`, [tenant, chave]);
    if (existe) {
      await pool.execute(`UPDATE inicio_tarefas SET adiada_ate = ?, titulo = ?, status = 'ABERTA', operador = ? WHERE id_tarefa = ?`,
        [ate, titulo, operadorDe(req), existe.id_tarefa]);
    } else {
      await pool.execute(`INSERT INTO inicio_tarefas (tenant_id, origem, chave, titulo, adiada_ate, operador) VALUES (?, 'AUTOMATICA', ?, ?, ?, ?)`,
        [tenant, chave, titulo, ate, operadorDe(req)]);
    }
    return res.json({ success: true, ate });
  } catch (error) { return responder(res, error, 'Erro ao adiar a tarefa.'); }
};

/** POST /api/inicio/adiar/desfazer { chave } — a tarefa volta para a central agora. */
export const desfazerAdiamento = async (req: Request, res: Response) => {
  try {
    await pool.execute(`UPDATE inicio_tarefas SET adiada_ate = NULL WHERE tenant_id = ? AND origem = 'AUTOMATICA' AND chave = ?`,
      [tenantDe(req), String(req.body?.chave || '')]);
    return res.json({ success: true });
  } catch (error) { return responder(res, error, 'Erro ao desfazer o adiamento.'); }
};
