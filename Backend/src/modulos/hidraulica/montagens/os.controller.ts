// OS de montagem (modulo_hidraulica_montagens_os): mangueiras (ficha + materiais), itens avulsos, etapas,
// sinal (adiantamento do núcleo) e entrega (vira venda no PDV). Os materiais saem do estoque só na venda.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { calcularItensDoPedido } from '../../../areas/vendas/pdv/vendas.controller';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { devolverAdiantamento, registrarAdiantamento } from '../../../areas/vendas/adiantamentos/adiantamentos.controller';
import { FichaEntrada, inserirFichas } from './fichas.controller';

export const ORIGEM_ADIANTAMENTO_OS = 'HIDRAULICA_MONTAGENS_OS';
const ETAPAS = ['ABERTA', 'AGUARDANDO_MATERIAL', 'EM_MONTAGEM', 'PRONTA'] as const;
const FINALIZADAS = ['ENTREGUE', 'CANCELADA'];

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null;

class ErroOs extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroOs || typeof error?.status === 'number') return res.status(error.status || 400).json({ error: error.message, detalhes: error.detalhes });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

// unidadeBase: usa a unidade de estoque do item (ex.: metro da mangueira, mesmo que o PDV venda em rolo)
interface ItemOsEntrada { idItem: number; idUnidade?: number | null; quantidade: number; precoUnitario?: number | null; unidadeBase?: boolean }
interface MangueiraOsEntrada extends FichaEntrada { itens?: ItemOsEntrada[] }

/** Grava mangueiras (ficha + materiais) e itens avulsos; o preço não informado vem da tabela atual. */
const gravarConteudo = async (conn: any, tenant: number, idOs: number, idCliente: number | null, mangueiras: MangueiraOsEntrada[], avulsos: ItemOsEntrada[]) => {
  const todos = [...mangueiras.flatMap(m => m.itens || []), ...avulsos];
  if (todos.length === 0) return;
  const pedemBase = [...new Set(todos.filter(i => i.unidadeBase && !i.idUnidade).map(i => Number(i.idItem)))];
  const unidadeBase = new Map<number, number>();
  if (pedemBase.length) {
    const [rows]: any = await conn.execute(`SELECT id_item, id_unidade FROM itens_core WHERE id_item IN (${pedemBase.map(() => '?').join(',')})`, pedemBase);
    rows.forEach((r: any) => { if (r.id_unidade) unidadeBase.set(Number(r.id_item), Number(r.id_unidade)); });
  }
  const { itensBanco, linhas } = await calcularItensDoPedido(conn, tenant, todos.map(i => ({
    idItem: i.idItem, quantidade: i.quantidade, idUnidade: i.idUnidade ?? (i.unidadeBase ? unidadeBase.get(Number(i.idItem)) ?? null : null),
    precoUnitario: i.precoUnitario === undefined || i.precoUnitario === null ? null : i.precoUnitario,
  })));
  let k = 0;
  const gravarItem = async (idMangueira: number | null) => {
    const l = linhas[k++];
    const item = itensBanco.get(l.idItem);
    await conn.execute(
      `INSERT INTO modulo_hidraulica_montagens_os_itens (tenant_id, id_os, id_mangueira, id_item, id_unidade, descricao, quantidade, preco_unitario)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idOs, idMangueira, l.idItem, l.idUnidade, String(item.nome_comercial || item.nome_item).slice(0, 255), f4(l.quantidade), f4(l.precoPraticado)]
    );
  };
  for (const m of mangueiras) {
    const [idMangueira] = await inserirFichas(conn, tenant, [m], { idOs, idCliente });
    for (let i = 0; i < (m.itens || []).length; i++) await gravarItem(idMangueira);
  }
  for (let i = 0; i < avulsos.length; i++) await gravarItem(null);
};

const lerEntrada = (body: any) => ({
  idCliente: Number(body?.idCliente) || null,
  clienteNome: txt(body?.clienteNome, 150) || 'CONSUMIDOR',
  contato: txt(body?.contato, 100),
  equipamento: txt(body?.equipamento, 150),
  previsao: /^\d{4}-\d{2}-\d{2}$/.test(String(body?.previsao || '')) ? String(body.previsao) : null,
  observacao: txt(body?.observacao, 500),
  mangueiras: (Array.isArray(body?.mangueiras) ? body.mangueiras : []) as MangueiraOsEntrada[],
  avulsos: (Array.isArray(body?.itensAvulsos) ? body.itensAvulsos : []) as ItemOsEntrada[],
});

/** POST /os — abre a OS */
export const criarOs = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const e = lerEntrada(req.body);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [ins]: any = await connection.execute(
      `INSERT INTO modulo_hidraulica_montagens_os (tenant_id, status, id_cliente, cliente_nome, contato, equipamento, previsao, observacao, operador)
       VALUES (?, 'ABERTA', ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, e.idCliente, e.clienteNome, e.contato, e.equipamento, e.previsao, e.observacao, operadorDe(req)]
    );
    const idOs = Number(ins.insertId);
    await gravarConteudo(connection, tenant, idOs, e.idCliente, e.mangueiras, e.avulsos);
    await connection.commit();
    return res.status(201).json({ success: true, idOs });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao abrir a OS.');
  } finally {
    connection.release();
  }
};

const carregarOs = async (conn: any, tenant: number, idOs: number, trava = false) => {
  const [[os]]: any = await conn.execute(
    `SELECT *, DATE_FORMAT(previsao, '%Y-%m-%d') AS previsao_txt FROM modulo_hidraulica_montagens_os WHERE id_os = ? AND tenant_id = ? ${trava ? 'FOR UPDATE' : ''}`,
    [idOs, tenant]
  );
  if (!os) throw new ErroOs('OS não encontrada.', 404);
  return os;
};

/** PUT /os/:id — edita cabeçalho e conteúdo (substitui mangueiras e itens) enquanto não entregue/cancelada */
export const atualizarOs = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idOs = Number(req.params.id);
  const e = lerEntrada(req.body);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const os = await carregarOs(connection, tenant, idOs, true);
    if (FINALIZADAS.includes(os.status)) throw new ErroOs(`OS ${String(os.status).toLowerCase()}: não pode ser alterada.`, 409);
    await connection.execute(
      `UPDATE modulo_hidraulica_montagens_os SET id_cliente = ?, cliente_nome = ?, contato = ?, equipamento = ?, previsao = ?, observacao = ? WHERE id_os = ?`,
      [e.idCliente, e.clienteNome, e.contato, e.equipamento, e.previsao, e.observacao, idOs]
    );
    await connection.execute(`DELETE FROM modulo_hidraulica_montagens_os_itens WHERE id_os = ?`, [idOs]);
    await connection.execute(`DELETE FROM modulo_hidraulica_montagens_mangueiras WHERE id_os = ?`, [idOs]);
    await gravarConteudo(connection, tenant, idOs, e.idCliente, e.mangueiras, e.avulsos);
    await connection.commit();
    return res.json({ success: true, idOs });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao salvar a OS.');
  } finally {
    connection.release();
  }
};

/** GET /os?status=ABERTAS|ABERTA|...|ENTREGUE|CANCELADA|TODAS&busca= */
export const listarOs = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const status = String(req.query.status || 'ABERTAS').toUpperCase();
    const filtros = ['o.tenant_id = ?'];
    const params: any[] = [tenant];
    if (status === 'ABERTAS') filtros.push(`o.status IN ('ABERTA', 'AGUARDANDO_MATERIAL', 'EM_MONTAGEM', 'PRONTA')`);
    else if (status !== 'TODAS') { filtros.push('o.status = ?'); params.push(status); }
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      filtros.push(`(o.cliente_nome LIKE ? OR o.contato LIKE ? OR o.equipamento LIKE ? OR o.id_os = ?)`);
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, Number(busca) || 0);
    }
    const [rows]: any = await pool.execute(
      `SELECT o.*, DATE_FORMAT(o.previsao, '%Y-%m-%d') AS previsao_txt,
              (SELECT COALESCE(SUM(ROUND(i.quantidade * i.preco_unitario, 2)), 0) FROM modulo_hidraulica_montagens_os_itens i WHERE i.id_os = o.id_os) AS total,
              (SELECT COUNT(*) FROM modulo_hidraulica_montagens_mangueiras m WHERE m.id_os = o.id_os) AS qtd_mangueiras,
              (SELECT COALESCE(SUM(a.valor - a.valor_usado), 0) FROM vendas_adiantamentos a
                WHERE a.origem = ? AND a.id_origem = o.id_os AND a.status = 'ABERTO') AS sinal
       FROM modulo_hidraulica_montagens_os o WHERE ${filtros.join(' AND ')} ORDER BY o.id_os DESC LIMIT 300`,
      [ORIGEM_ADIANTAMENTO_OS, ...params]
    );
    return res.json(rows.map((o: any) => ({
      idOs: Number(o.id_os), status: o.status, idCliente: o.id_cliente ? Number(o.id_cliente) : null, cliente: o.cliente_nome,
      contato: o.contato, equipamento: o.equipamento, previsao: o.previsao_txt, observacao: o.observacao, operador: o.operador,
      idVenda: o.id_venda ? Number(o.id_venda) : null, total: Number(o.total), sinal: Number(o.sinal), qtdMangueiras: Number(o.qtd_mangueiras),
      criadoEm: o.created_at, entregueEm: o.entregue_em,
    })));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar as OS.');
  }
};

/** GET /os/:id — cabeçalho, mangueiras (ficha + materiais), avulsos, sinais e estoque de cada material */
export const detalheOs = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const idOs = Number(req.params.id);
    const os = await carregarOs(pool, tenant, idOs);
    const [mangueiras]: any = await pool.execute(`SELECT * FROM modulo_hidraulica_montagens_mangueiras WHERE id_os = ? ORDER BY id_mangueira`, [idOs]);
    const [itens]: any = await pool.execute(
      `SELECT i.*, COALESCE(s.quantidade_atual, 0) AS estoque_base, ic.tipo_recurso, um.sigla AS sigla_base,
              COALESCE(uv.sigla, um.sigla) AS sigla, CASE WHEN i.id_unidade IS NULL OR i.id_unidade = ic.id_unidade THEN 1 ELSE COALESCE(conv.fator_conversao, 1) END AS fator
       FROM modulo_hidraulica_montagens_os_itens i
       INNER JOIN itens_core ic ON ic.id_item = i.id_item
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       LEFT JOIN itens_unidades_medida uv ON uv.id_unidade = i.id_unidade
       LEFT JOIN itens_unidades_conversao conv ON conv.id_item = i.id_item AND conv.id_unidade_derivada = i.id_unidade
       LEFT JOIN estoque_saldos_itens s ON s.id_item = i.id_item AND s.deposito = 'VENDA' AND s.tenant_id = i.tenant_id
       WHERE i.id_os = ? ORDER BY i.id_os_item`,
      [idOs]
    );
    const [sinais]: any = await pool.execute(
      `SELECT * FROM vendas_adiantamentos WHERE origem = ? AND id_origem = ? AND tenant_id = ? ORDER BY id_adiantamento`,
      [ORIGEM_ADIANTAMENTO_OS, idOs, tenant]
    );
    const item = (i: any) => {
      const qtdBase = Number(i.quantidade) * Number(i.fator);
      const servico = String(i.tipo_recurso).toUpperCase() === 'SERVICO';
      return {
        idOsItem: Number(i.id_os_item), idItem: Number(i.id_item), idUnidade: i.id_unidade ? Number(i.id_unidade) : null, descricao: i.descricao,
        quantidade: Number(i.quantidade), unidade: i.sigla || '', precoUnitario: Number(i.preco_unitario),
        total: Math.round(Number(i.quantidade) * Number(i.preco_unitario) * 100) / 100, servico,
        estoque: Number(i.estoque_base), faltaMaterial: !servico && Number(i.estoque_base) < qtdBase - 1e-9,
      };
    };
    // Igual à venda: cada linha arredondada em centavos antes de somar
    const total = itens.reduce((a: number, i: any) => a + Math.round(Number(i.quantidade) * Number(i.preco_unitario) * 100) / 100, 0);
    const sinalAberto = sinais.filter((s: any) => s.status === 'ABERTO').reduce((a: number, s: any) => a + Number(s.valor) - Number(s.valor_usado), 0);
    return res.json({
      idOs, status: os.status, idCliente: os.id_cliente ? Number(os.id_cliente) : null, cliente: os.cliente_nome, contato: os.contato,
      equipamento: os.equipamento, previsao: os.previsao_txt, observacao: os.observacao, operador: os.operador,
      idVenda: os.id_venda ? Number(os.id_venda) : null, criadoEm: os.created_at, entregueEm: os.entregue_em,
      canceladoEm: os.cancelado_em, motivoCancelamento: os.motivo_cancelamento,
      mangueiras: mangueiras.map((m: any) => ({
        idMangueira: Number(m.id_mangueira), equipamento: m.equipamento, posicao: m.posicao, bitola: m.bitola,
        comprimentoM: m.comprimento_m === null ? null : Number(m.comprimento_m), quantidade: Number(m.quantidade),
        terminalA: m.terminal_a, terminalB: m.terminal_b, angulo: m.angulo, pressaoTrabalho: m.pressao_trabalho, observacao: m.observacao,
        itens: itens.filter((i: any) => Number(i.id_mangueira) === Number(m.id_mangueira)).map(item),
      })),
      itensAvulsos: itens.filter((i: any) => !i.id_mangueira).map(item),
      sinais: sinais.map((s: any) => ({
        idAdiantamento: Number(s.id_adiantamento), valor: Number(s.valor), saldo: Number((Number(s.valor) - Number(s.valor_usado)).toFixed(2)),
        status: s.status, forma: s.forma, criadoEm: s.created_at,
      })),
      total: Number(total.toFixed(2)),
      sinalAberto: Number(sinalAberto.toFixed(2)),
      saldoAPagar: Number(Math.max(0, total - sinalAberto).toFixed(2)),
      faltaMaterial: itens.some((i: any) => item(i).faltaMaterial),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar a OS.');
  }
};

/** POST /os/:id/status { status: ABERTA | AGUARDANDO_MATERIAL | EM_MONTAGEM | PRONTA } */
export const mudarEtapaOs = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const status = String(req.body?.status || '').toUpperCase();
    if (!(ETAPAS as readonly string[]).includes(status)) throw new ErroOs('Etapa inválida.');
    const os = await carregarOs(pool, tenant, Number(req.params.id));
    if (FINALIZADAS.includes(os.status)) throw new ErroOs(`OS ${String(os.status).toLowerCase()}.`, 409);
    await pool.execute(`UPDATE modulo_hidraulica_montagens_os SET status = ? WHERE id_os = ?`, [status, os.id_os]);
    return res.json({ success: true, status });
  } catch (error) {
    return responderErro(res, error, 'Erro ao mudar a etapa.');
  }
};

/** POST /os/:id/sinal { valor, forma } — adiantamento do núcleo ligado à OS (entra no caixa) */
export const receberSinalOs = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const os = await carregarOs(connection, tenant, Number(req.params.id), true);
    if (FINALIZADAS.includes(os.status)) throw new ErroOs(`OS ${String(os.status).toLowerCase()}.`, 409);
    const id = await registrarAdiantamento(connection, tenant, {
      idCliente: os.id_cliente ? Number(os.id_cliente) : null, clienteNome: os.cliente_nome, valor: Number(req.body?.valor),
      forma: req.body?.forma, observacao: `Sinal da OS ${os.id_os}`, origem: ORIGEM_ADIANTAMENTO_OS, idOrigem: Number(os.id_os), operador: operadorDe(req),
    });
    await connection.commit();
    return res.status(201).json({ success: true, idAdiantamento: id });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao receber o sinal.');
  } finally {
    connection.release();
  }
};

/** POST /os/:id/cancelar { motivo, devolverSinal } — sem devolver, o sinal fica como crédito do cliente */
export const cancelarOs = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return res.status(400).json({ error: 'Informe o motivo do cancelamento.' });
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const os = await carregarOs(connection, tenant, Number(req.params.id), true);
    if (FINALIZADAS.includes(os.status)) throw new ErroOs(`OS já ${String(os.status).toLowerCase()}.`, 409);
    let devolvido = 0;
    if (req.body?.devolverSinal) {
      const [sinais]: any = await connection.execute(
        `SELECT id_adiantamento FROM vendas_adiantamentos WHERE origem = ? AND id_origem = ? AND tenant_id = ? AND status = 'ABERTO' AND valor > valor_usado`,
        [ORIGEM_ADIANTAMENTO_OS, os.id_os, tenant]
      );
      for (const s of sinais) devolvido += await devolverAdiantamento(connection, tenant, Number(s.id_adiantamento), `OS ${os.id_os} cancelada: ${motivo}`, operadorDe(req));
    }
    await connection.execute(
      `UPDATE modulo_hidraulica_montagens_os SET status = 'CANCELADA', cancelado_em = NOW(), motivo_cancelamento = ? WHERE id_os = ?`,
      [motivo.slice(0, 255), os.id_os]
    );
    await connection.commit();
    return res.json({ success: true, devolvido: Number(devolvido.toFixed(2)) });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao cancelar a OS.');
  } finally {
    connection.release();
  }
};

/** POST /os/:id/entregar { idVenda } — chamado depois que a venda da entrega foi gravada no PDV */
export const entregarOs = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const idVenda = Number(req.body?.idVenda);
    const os = await carregarOs(pool, tenant, Number(req.params.id));
    if (FINALIZADAS.includes(os.status)) throw new ErroOs(`OS já ${String(os.status).toLowerCase()}.`, 409);
    const [[venda]]: any = await pool.execute(`SELECT id_venda FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ? AND status = 'CONCLUIDA'`, [idVenda, tenant]);
    if (!venda) throw new ErroOs('Venda da entrega não encontrada.', 404);
    await pool.execute(`UPDATE modulo_hidraulica_montagens_os SET status = 'ENTREGUE', id_venda = ?, entregue_em = NOW() WHERE id_os = ?`, [idVenda, os.id_os]);
    // As fichas da OS passam a apontar também para a venda (histórico)
    await pool.execute(`UPDATE modulo_hidraulica_montagens_mangueiras SET id_venda = ? WHERE id_os = ?`, [idVenda, os.id_os]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao registrar a entrega.');
  }
};
