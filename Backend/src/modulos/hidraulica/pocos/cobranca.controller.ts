// Obras de poços › orçamento, sinal e cobrança (etapa 3): adicionais com aprovação do cliente, parcelas do saldo,
// recebimentos (entram no caixa aberto, como no contas a receber da loja) e a lista "a receber de obras".
// Tabelas modulo_hidraulica_pocos_adicionais, _parcelas e _recebimentos.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarCaixaAberto, operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { aplicarBaixa, diasDeAtraso, estornarBaixa, gerarParcelas, parcelaSemPrazo, situacaoTitulo } from '../../../areas/financeiro/receber/receber';
import { ErroObra, pocoDoRelatorio } from './obras';
import { responderErro } from './obras.controller';
import { adicionalPodeIr, descricaoParcela, resumoCobranca, SituacaoAdicional, SITUACOES_ADICIONAL, sugestaoExcedente, validarAdicional, validarAprovacao } from './cobranca';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Math.round(v * 10000) / 10000;
const lerJson = (s: unknown) => { try { return s ? JSON.parse(String(s)) : {}; } catch { return {}; } };

const carregarObra = async (conn: any, tenant: number, id: number, trava = '') => {
  const [[o]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ? ${trava}`, [id, tenant]);
  if (!o) throw new ErroObra('Obra não encontrada.', 404);
  return o;
};
const naoCancelada = (o: any) => { if (o.situacao === 'CANCELADA') throw new ErroObra('A obra está cancelada.', 409); };

const formatarParcela = (p: any, hoje: Date) => ({
  idParcela: Number(p.id_parcela), idObra: Number(p.id_obra), tipo: p.tipo, parcela: Number(p.parcela), totalParcelas: Number(p.total_parcelas),
  descricao: p.descricao, vencimento: p.vencimento_txt || null, valor: Number(p.valor), valorPago: Number(p.valor_pago),
  saldo: Math.round((Number(p.valor) - Number(p.valor_pago)) * 100) / 100, status: p.status,
  situacao: situacaoTitulo(p.status, p.vencimento_txt || null, hoje), diasAtraso: p.status === 'ABERTO' ? diasDeAtraso(p.vencimento_txt || null, hoje) : 0,
});
const formatarAdicional = (a: any) => ({
  idAdicional: Number(a.id_adicional), tipo: a.tipo, descricao: a.descricao, quantidade: Number(a.quantidade), valorUnitario: Number(a.valor_unitario),
  valor: Number(a.valor), situacao: a.situacao as SituacaoAdicional, aprovacaoMeio: a.aprovacao_meio || null, aprovadoEm: a.aprovado_txt || null,
  aprovacaoObs: a.aprovacao_obs || null, operador: a.operador, criadoEm: a.criado_txt,
});

/** GET /obras/:id/cobranca — a conta da obra: resumo, adicionais, parcelas, recebimentos e a sugestão do metro excedente. */
export const cobrancaDaObra = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const o = await carregarObra(pool, tenant, id);
    const hoje = new Date();
    const [ad]: any = await pool.execute(
      `SELECT a.*, DATE_FORMAT(a.aprovado_em, '%Y-%m-%d %H:%i') AS aprovado_txt, DATE_FORMAT(a.created_at, '%Y-%m-%d') AS criado_txt
       FROM modulo_hidraulica_pocos_adicionais a WHERE a.id_obra = ? ORDER BY a.id_adicional`, [id]);
    const [pa]: any = await pool.execute(
      `SELECT p.*, DATE_FORMAT(p.vencimento, '%Y-%m-%d') AS vencimento_txt FROM modulo_hidraulica_pocos_parcelas p
       WHERE p.id_obra = ? ORDER BY p.tipo = 'SALDO', p.status = 'CANCELADO', p.vencimento IS NULL, p.vencimento, p.parcela, p.id_parcela`, [id]);
    const [re]: any = await pool.execute(
      `SELECT r.*, p.descricao AS parcela_descricao, DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS criado_txt, DATE_FORMAT(r.estornado_em, '%Y-%m-%d %H:%i') AS estornado_txt
       FROM modulo_hidraulica_pocos_recebimentos r JOIN modulo_hidraulica_pocos_parcelas p ON p.id_parcela = r.id_parcela
       WHERE r.id_obra = ? ORDER BY r.id_recebimento DESC`, [id]);
    const adicionais = ad.map(formatarAdicional);
    const parcelas = pa.map((p: any) => formatarParcela(p, hoje));
    const medido = pocoDoRelatorio(lerJson(o.dados_relatorio)).profundidadeM;
    const perfurado = medido === undefined || medido === null ? null : Number(medido);
    const jaTemExcedente = adicionais.some((a: any) => a.tipo === 'METRO_EXCEDENTE' && (a.situacao === 'PENDENTE' || a.situacao === 'APROVADO'));
    const caixa = await carregarCaixaAberto(pool as any, tenant);
    return res.json({
      resumo: resumoCobranca({ valorContratado: o.valor_contratado === null ? null : Number(o.valor_contratado), valorSinal: o.valor_sinal === null ? null : Number(o.valor_sinal) }, adicionais, parcelas),
      sinalQuando: o.sinal_quando, adicionais, parcelas,
      recebimentos: re.map((r: any) => ({
        idRecebimento: Number(r.id_recebimento), idParcela: Number(r.id_parcela), parcela: r.parcela_descricao, forma: r.forma, valor: Number(r.valor),
        observacao: r.observacao || null, operador: r.operador, em: r.criado_txt, estornadoEm: r.estornado_txt || null, estornoMotivo: r.estorno_motivo || null,
      })),
      metrosPerfurados: perfurado,
      sugestao: sugestaoExcedente(o.metros_previstos === null ? null : Number(o.metros_previstos), perfurado,
        o.valor_metro_excedente === null ? null : Number(o.valor_metro_excedente), jaTemExcedente),
      caixaAberto: !!caixa,
    });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar a cobrança da obra.'); }
};

// POST /obras/:id/adicionais { tipo, descricao, quantidade, valorUnitario } — nasce pendente (o cliente ainda aprova)
export const criarAdicional = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    naoCancelada(await carregarObra(pool, tenant, id));
    const a = validarAdicional(req.body);
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_adicionais (tenant_id, id_obra, tipo, descricao, quantidade, valor_unitario, valor, operador) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, id, a.tipo, a.descricao, a.quantidade, a.valorUnitario, a.valor, operadorDe(req)]);
    return res.status(201).json({ idAdicional: Number(ins.insertId) });
  } catch (e) { return responderErro(res, e, 'Erro ao lançar o adicional.'); }
};

const carregarAdicional = async (conn: any, tenant: number, id: number) => {
  const [[a]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_adicionais WHERE id_adicional = ? AND tenant_id = ? FOR UPDATE`, [id, tenant]);
  if (!a) throw new ErroObra('Adicional não encontrado.', 404);
  return a;
};

// PUT /adicionais/:id — só o pendente muda (o aprovado é o que o cliente aceitou)
export const salvarAdicional = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const a0 = await carregarAdicional(pool, tenant, Number(req.params.id));
    if (a0.situacao !== 'PENDENTE') throw new ErroObra('Só dá para mudar o adicional pendente (o aprovado foi o que o cliente aceitou: cancele e lance outro).', 409);
    const a = validarAdicional(req.body);
    await pool.execute(
      `UPDATE modulo_hidraulica_pocos_adicionais SET tipo = ?, descricao = ?, quantidade = ?, valor_unitario = ?, valor = ?, operador = ? WHERE id_adicional = ?`,
      [a.tipo, a.descricao, a.quantidade, a.valorUnitario, a.valor, operadorDe(req), a0.id_adicional]);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o adicional.'); }
};

// POST /adicionais/:id/situacao { situacao, meio?, observacao? } — aprovar exige o meio (mensagem, assinatura...)
export const mudarAdicional = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const a = await carregarAdicional(pool, tenant, Number(req.params.id));
    const para = String(req.body?.situacao || '').toUpperCase() as SituacaoAdicional;
    if (!(SITUACOES_ADICIONAL as readonly string[]).includes(para) || !adicionalPodeIr(a.situacao, para)) {
      throw new ErroObra(`O adicional não pode ir de "${a.situacao}" para "${para}".`, 409);
    }
    if (para === 'APROVADO') {
      const ap = validarAprovacao(req.body);
      await pool.execute(
        `UPDATE modulo_hidraulica_pocos_adicionais SET situacao = 'APROVADO', aprovacao_meio = ?, aprovacao_obs = ?, aprovado_em = NOW(), operador = ? WHERE id_adicional = ?`,
        [ap.meio, ap.observacao, operadorDe(req), a.id_adicional]);
    } else {
      const limpa = para === 'PENDENTE' ? ', aprovacao_meio = NULL, aprovacao_obs = NULL, aprovado_em = NULL' : '';
      await pool.execute(`UPDATE modulo_hidraulica_pocos_adicionais SET situacao = ?, operador = ?${limpa} WHERE id_adicional = ?`, [para, operadorDe(req), a.id_adicional]);
    }
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao mudar o adicional.'); }
};

/**
 * POST /obras/:id/parcelas { valor?, quantidade, primeiroVencimento?, intervaloDias?, semPrazo? } — lança o saldo (o que
 * ainda não está em parcela) à vista ou parcelado; sem prazo = uma parcela sem vencimento (paga quando puder).
 */
export const lancarParcelas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await conn.beginTransaction();
    const o = await carregarObra(conn, tenant, id, 'FOR UPDATE');
    naoCancelada(o);
    const [ad]: any = await conn.execute(`SELECT valor, situacao FROM modulo_hidraulica_pocos_adicionais WHERE id_obra = ?`, [id]);
    const [pa]: any = await conn.execute(`SELECT tipo, valor, valor_pago, status FROM modulo_hidraulica_pocos_parcelas WHERE id_obra = ?`, [id]);
    const resumo = resumoCobranca({ valorContratado: o.valor_contratado === null ? null : Number(o.valor_contratado), valorSinal: null },
      ad.map((a: any) => ({ valor: Number(a.valor), situacao: a.situacao })),
      pa.map((p: any) => ({ tipo: p.tipo, valor: Number(p.valor), valorPago: Number(p.valor_pago), status: p.status })));
    const valor = req.body?.valor === undefined || req.body?.valor === null || req.body?.valor === '' ? resumo.semParcela : Number(req.body.valor);
    if (!(valor > 0)) throw new ErroObra('Não há saldo para parcelar (o total da obra já está em parcelas).');
    if (Math.round(valor * 100) > Math.round(resumo.semParcela * 100)) {
      throw new ErroObra(`O valor passa do saldo que falta parcelar (R$ ${resumo.semParcela.toFixed(2).replace('.', ',')}).`);
    }
    const plano = req.body?.semPrazo ? parcelaSemPrazo(valor)
      : gerarParcelas(valor, Number(req.body?.quantidade ?? 1), new Date(), Number(req.body?.intervaloDias || 30), req.body?.primeiroVencimento || null);
    const operador = operadorDe(req);
    for (const p of plano) {
      await conn.execute(
        `INSERT INTO modulo_hidraulica_pocos_parcelas (tenant_id, id_obra, tipo, parcela, total_parcelas, descricao, vencimento, valor, operador)
         VALUES (?, ?, 'SALDO', ?, ?, ?, ?, ?, ?)`,
        [tenant, id, p.parcela, p.totalParcelas, descricaoParcela(id, 'SALDO', p.parcela, p.totalParcelas), p.vencimento, p.valor, operador]);
    }
    await conn.commit();
    return res.status(201).json({ parcelas: plano.length });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao lançar as parcelas.');
  } finally { conn.release(); }
};

// POST /parcelas/:id/cancelar — só parcela do saldo sem pagamento (o sinal acompanha o valor do sinal da obra)
export const cancelarParcela = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [[p]]: any = await pool.execute(`SELECT * FROM modulo_hidraulica_pocos_parcelas WHERE id_parcela = ? AND tenant_id = ?`, [Number(req.params.id), tenant]);
    if (!p) throw new ErroObra('Parcela não encontrada.', 404);
    if (p.tipo === 'SINAL') throw new ErroObra('O sinal muda pelo valor do sinal nos dados da obra.', 409);
    if (p.status !== 'ABERTO') throw new ErroObra('Só dá para cancelar parcela em aberto.', 409);
    if (Number(p.valor_pago) > 0) throw new ErroObra('A parcela já tem pagamento: estorne o recebimento antes.', 409);
    await pool.execute(`UPDATE modulo_hidraulica_pocos_parcelas SET status = 'CANCELADO', operador = ? WHERE id_parcela = ?`, [operadorDe(req), p.id_parcela]);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao cancelar a parcela.'); }
};

// POST /parcelas/:id/receber { forma, valor, observacao } — entra no caixa aberto (movimento RECEBIMENTO)
export const receberParcela = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const caixa = await carregarCaixaAberto(conn, tenant, 'LOCK IN SHARE MODE');
    if (!caixa) throw new ErroObra('Abra o caixa para receber (o valor entra no caixa do dia).', 409);
    const [[p]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_parcelas WHERE id_parcela = ? AND tenant_id = ? FOR UPDATE`, [Number(req.params.id), tenant]);
    if (!p) throw new ErroObra('Parcela não encontrada.', 404);
    const baixa = aplicarBaixa(Number(p.valor), Number(p.valor_pago), Number(req.body?.valor), req.body?.forma, p.status);
    const operador = operadorDe(req);
    const [ins]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_recebimentos (tenant_id, id_parcela, id_obra, forma, valor, id_caixa, observacao, operador) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, p.id_parcela, p.id_obra, baixa.forma, f4(baixa.valor), caixa.id_caixa, String(req.body?.observacao || '').trim().slice(0, 255) || null, operador]);
    await conn.execute(`UPDATE modulo_hidraulica_pocos_parcelas SET valor_pago = ?, status = ? WHERE id_parcela = ?`, [f4(baixa.valorPago), baixa.status, p.id_parcela]);
    await conn.execute(
      `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, id_origem, motivo, operador) VALUES (?, ?, 'RECEBIMENTO', ?, ?, ?, ?, ?)`,
      [tenant, caixa.id_caixa, baixa.forma, f4(baixa.valor), Number(ins.insertId), `Poço: ${p.descricao || `parcela ${p.id_parcela}`}`.slice(0, 255), operador]);
    await conn.commit();
    return res.status(201).json({ idRecebimento: Number(ins.insertId), status: baixa.status, valorPago: baixa.valorPago });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao registrar o recebimento.');
  } finally { conn.release(); }
};

// POST /recebimentos/:id/estornar { motivo } — o valor sai do caixa aberto e a parcela reabre
export const estornarRecebimento = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const motivo = String(req.body?.motivo || '').trim();
  const conn: any = await pool.getConnection();
  try {
    if (!motivo) throw new ErroObra('Informe o motivo do estorno.');
    await conn.beginTransaction();
    const caixa = await carregarCaixaAberto(conn, tenant, 'LOCK IN SHARE MODE');
    if (!caixa) throw new ErroObra('Abra o caixa para estornar (o valor sai do caixa do dia).', 409);
    const [[r]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_recebimentos WHERE id_recebimento = ? AND tenant_id = ? FOR UPDATE`, [Number(req.params.id), tenant]);
    if (!r) throw new ErroObra('Recebimento não encontrado.', 404);
    if (r.estornado_em) throw new ErroObra('Recebimento já estornado.', 409);
    const [[p]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_parcelas WHERE id_parcela = ? FOR UPDATE`, [r.id_parcela]);
    if (p.status === 'CANCELADO') throw new ErroObra('A parcela está cancelada.', 409);
    const novo = estornarBaixa(Number(p.valor), Number(p.valor_pago), Number(r.valor));
    const operador = operadorDe(req);
    await conn.execute(`UPDATE modulo_hidraulica_pocos_recebimentos SET estornado_em = NOW(), estorno_motivo = ? WHERE id_recebimento = ?`, [motivo.slice(0, 255), r.id_recebimento]);
    await conn.execute(`UPDATE modulo_hidraulica_pocos_parcelas SET valor_pago = ?, status = ? WHERE id_parcela = ?`, [f4(novo.valorPago), novo.status, p.id_parcela]);
    await conn.execute(
      `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, id_origem, motivo, operador) VALUES (?, ?, 'ESTORNO_RECEBIMENTO', ?, ?, ?, ?, ?)`,
      [tenant, caixa.id_caixa, r.forma, f4(Number(r.valor)), r.id_recebimento, `Poço: estorno ${p.descricao || ''} (${motivo})`.slice(0, 255), operador]);
    await conn.commit();
    return res.json({ status: novo.status, valorPago: novo.valorPago });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao estornar o recebimento.');
  } finally { conn.release(); }
};

// GET /receber?todas=1 — "a receber de obras": parcelas em aberto (vencidas primeiro), com a obra e o cliente
export const aReceberDeObras = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const hoje = new Date();
    const [rows]: any = await pool.execute(
      `SELECT p.*, DATE_FORMAT(p.vencimento, '%Y-%m-%d') AS vencimento_txt, o.titulo, o.situacao AS obra_situacao, o.id_cliente, c.nome AS cliente, c.telefone
       FROM modulo_hidraulica_pocos_parcelas p
       JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = p.id_obra
       LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
       WHERE p.tenant_id = ? AND p.status = 'ABERTO'
       ORDER BY p.vencimento IS NULL, p.vencimento, p.id_obra, p.parcela LIMIT 1000`, [tenant]);
    return res.json(rows.map((r: any) => ({
      ...formatarParcela(r, hoje), obra: r.titulo || null, obraSituacao: r.obra_situacao, idCliente: Number(r.id_cliente), cliente: r.cliente, telefone: r.telefone || null,
    })));
  } catch (e) { return responderErro(res, e, 'Erro ao listar o a receber das obras.'); }
};
