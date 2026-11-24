// Obras de poços › resultado e painel (etapa 8): números do próprio módulo (fora do Resultado do mês da loja).
// GET /painel?de=&ate= — situação das obras, a receber, recebido e faturado no período, metros perfurados, lucro de
// cada obra (contrato + adicionais aprovados − materiais − outros custos) e os alertas de obra parada ou atrasada.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ErroObra, pocoDoRelatorio } from './obras';
import { responderErro } from './obras.controller';
import { alertasDaObra, lucroDaObra, serieMensal } from './painel';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const dia = /^\d{4}-\d{2}-\d{2}$/;
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lerJson = (s: unknown) => { try { return s ? JSON.parse(String(s)) : {}; } catch { return {}; } };
const n = (v: unknown) => Number(v) || 0;
/** Margem que o orçamento estimava, na mesma conta do painel (preço − custo estimado, sobre o preço), em %. */
const margemDaEstimativa = (s: unknown) => {
  const e = lerJson(s); const preco = n(e?.entrada?.preco), custo = n(e?.resultado?.custo);
  return s && preco > 0 && custo > 0 ? Math.round(((preco - custo) / preco) * 1000) / 10 : null;
};

export const painelPocos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const hoje = hojeIso();
    const de = String(req.query.de || `${hoje.slice(0, 7)}-01`);
    const ate = String(req.query.ate || hoje);
    if (!dia.test(de) || !dia.test(ate) || ate < de) throw new ErroObra('Período inválido.');

    const [obras]: any = await pool.execute(
      `SELECT o.id_obra, o.titulo, o.servicos, o.situacao, o.valor_contratado, c.nome AS cliente,
              DATE_FORMAT(o.created_at, '%Y-%m-%d') AS criada, DATE_FORMAT(o.data_previsao, '%Y-%m-%d') AS previsao,
              DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS inicio, DATE_FORMAT(o.data_termino, '%Y-%m-%d') AS termino,
              CASE WHEN o.situacao = 'CONCLUIDA' AND o.data_termino BETWEEN ? AND ? THEN o.dados_relatorio ELSE NULL END AS relatorio_periodo,
              (SELECT COALESCE(SUM(a.valor), 0) FROM modulo_hidraulica_pocos_adicionais a WHERE a.id_obra = o.id_obra AND a.situacao = 'APROVADO') AS adicionais,
              (SELECT COALESCE(SUM(p.valor_pago), 0) FROM modulo_hidraulica_pocos_parcelas p WHERE p.id_obra = o.id_obra AND p.status <> 'CANCELADO') AS recebido,
              (SELECT COALESCE(SUM(p.valor), 0) FROM modulo_hidraulica_pocos_parcelas p WHERE p.id_obra = o.id_obra AND p.status <> 'CANCELADO') AS parcelado,
              (SELECT COALESCE(SUM(ROUND(COALESCE(l.qtd_usada, l.qtd_prevista) * l.custo_unitario, 2)), 0) FROM modulo_hidraulica_pocos_obras_materiais l WHERE l.id_obra = o.id_obra) AS custo,
              (SELECT COALESCE(SUM(x.valor), 0) FROM modulo_hidraulica_pocos_obras_custos x WHERE x.id_obra = o.id_obra) AS custo_outros,
              o.estimativa_custo,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras_materiais l WHERE l.id_obra = o.id_obra) AS linhas,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras_materiais l WHERE l.id_obra = o.id_obra AND l.qtd_usada IS NULL) AS sem_conferir
       FROM modulo_hidraulica_pocos_obras o
       LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
       WHERE o.tenant_id = ? ORDER BY o.id_obra DESC LIMIT 2000`,
      [de, ate, tenant]);

    const contagem: Record<string, number> = { ORCAMENTO: 0, AGUARDANDO_SINAL: 0, EM_EXECUCAO: 0, CONCLUIDA: 0, CANCELADA: 0 };
    const linhas: any[] = [];
    const alertas: any[] = [];
    let metrosPeriodo = 0, perfuracoesPeriodo = 0;
    for (const o of obras) {
      contagem[o.situacao] = (contagem[o.situacao] || 0) + 1;
      if (o.situacao === 'CANCELADA') continue;
      const total = n(o.valor_contratado) + n(o.adicionais);
      const titulo = o.titulo || `Obra ${o.id_obra} · ${o.cliente || ''}`;
      const l = lucroDaObra({ total, recebido: n(o.recebido), custoMateriais: n(o.custo), custoOutros: n(o.custo_outros), materiaisConferidos: n(o.sem_conferir) === 0, linhasMateriais: n(o.linhas) });
      const concluidaNoPeriodo = o.situacao === 'CONCLUIDA' && o.termino >= de && o.termino <= ate;
      linhas.push({
        idObra: Number(o.id_obra), titulo, cliente: o.cliente || null, situacao: o.situacao, servicos: String(o.servicos || '').split(',').filter(Boolean),
        inicio: o.inicio || null, termino: o.termino || null, concluidaNoPeriodo, ...l,
        margemEstimada: margemDaEstimativa(o.estimativa_custo),
      });
      alertas.push(...alertasDaObra({ idObra: Number(o.id_obra), titulo, situacao: o.situacao, criadaEm: o.criada, dataPrevisao: o.previsao || null,
        dataInicio: o.inicio || null, semParcela: Math.round((total - n(o.parcelado)) * 100) / 100, aReceber: l.aReceber }, hoje));
      if (concluidaNoPeriodo && String(o.servicos || '').includes('PERFURACAO')) {
        const m = Number(pocoDoRelatorio(lerJson(o.relatorio_periodo)).profundidadeM) || 0;
        if (m > 0) { metrosPeriodo += m; perfuracoesPeriodo++; }
      }
    }

    // recebido (sem estornos) e faturado (obras concluídas) mês a mês, nos últimos 12 meses
    const inicio12 = `${new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 12, 1).toISOString().slice(0, 7)}-01`;
    const [rec]: any = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes, SUM(valor) AS valor FROM modulo_hidraulica_pocos_recebimentos
       WHERE tenant_id = ? AND estornado_em IS NULL AND created_at >= ? GROUP BY mes`, [tenant, inicio12]);
    const [recPeriodo]: any = await pool.execute(
      `SELECT COALESCE(SUM(valor), 0) AS valor, COUNT(*) AS qtd FROM modulo_hidraulica_pocos_recebimentos
       WHERE tenant_id = ? AND estornado_em IS NULL AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`, [tenant, de, ate]);
    const [aRec]: any = await pool.execute(
      `SELECT COALESCE(SUM(valor - valor_pago), 0) AS total,
              COALESCE(SUM(CASE WHEN vencimento < CURDATE() THEN valor - valor_pago ELSE 0 END), 0) AS vencido
       FROM modulo_hidraulica_pocos_parcelas WHERE tenant_id = ? AND status = 'ABERTO'`, [tenant]);
    const faturadoMes = linhas.filter(l => l.situacao === 'CONCLUIDA' && l.termino).map(l => ({ mes: l.termino.slice(0, 7), valor: l.total }));
    const concluidas = linhas.filter(l => l.concluidaNoPeriodo);
    const soma = (xs: number[]) => Math.round(xs.reduce((s, x) => s + Math.round(x * 100), 0)) / 100;

    return res.json({
      periodo: { de, ate },
      contagem,
      aReceber: { total: n(aRec[0].total), vencido: n(aRec[0].vencido) },
      periodoResumo: {
        recebido: n(recPeriodo[0].valor), recebimentos: n(recPeriodo[0].qtd), concluidas: concluidas.length,
        faturado: soma(concluidas.map(l => l.total)), custo: soma(concluidas.map(l => l.custo)), lucro: soma(concluidas.map(l => l.lucro)),
        metrosPerfurados: Math.round(metrosPeriodo * 100) / 100, perfuracoes: perfuracoesPeriodo,
      },
      serie: serieMensal(hoje, 12, rec.map((x: any) => ({ mes: x.mes, valor: n(x.valor) })), faturadoMes),
      obras: linhas,
      alertas,
    });
  } catch (e) { return responderErro(res, e, 'Erro ao montar o painel das obras.'); }
};
