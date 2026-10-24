// Obras de poços › ficha completa do cliente de poço: os dados (com a qualificação para o contrato), os contratos (obras
// com valores, recebido e a receber), os poços com a ficha técnica, o financeiro (parcelas e recebimentos de todas as
// obras), a linha do tempo (contato de origem, obras, etapas do processo, alertas dos sensores) e a prévia do plano mensal.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ErroObra, garantiaAte, lerServicos } from './obras';
import { responderErro } from './obras.controller';
import { calcularCentral } from './central.controller';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const n = (v: unknown) => Number(v) || 0;

// GET /clientes/:id/completo
export const clienteCompleto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const [[c]]: any = await pool.execute(`SELECT * FROM modulo_hidraulica_pocos_clientes WHERE id_cliente = ? AND tenant_id = ?`, [id, tenant]);
    if (!c) throw new ErroObra('Cliente não encontrado.', 404);
    const [obras]: any = await pool.execute(
      `SELECT o.*, DATE_FORMAT(o.created_at, '%Y-%m-%d') AS criada_txt, DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS inicio_txt,
              DATE_FORMAT(o.data_termino, '%Y-%m-%d') AS termino_txt, po.identificacao AS poco,
              (SELECT COALESCE(SUM(a.valor), 0) FROM modulo_hidraulica_pocos_adicionais a WHERE a.id_obra = o.id_obra AND a.situacao = 'APROVADO') AS adicionais,
              (SELECT COALESCE(SUM(p.valor_pago), 0) FROM modulo_hidraulica_pocos_parcelas p WHERE p.id_obra = o.id_obra AND p.status <> 'CANCELADO') AS recebido,
              (SELECT COALESCE(SUM(p.valor - p.valor_pago), 0) FROM modulo_hidraulica_pocos_parcelas p WHERE p.id_obra = o.id_obra AND p.status = 'ABERTO' AND p.vencimento < CURDATE()
                 AND o.situacao NOT IN ('ORCAMENTO', 'CANCELADA')) AS vencido,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_aditivos ad WHERE ad.id_obra = o.id_obra) AS aditivos,
              EXISTS (SELECT 1 FROM modulo_hidraulica_pocos_processo pr WHERE pr.id_obra = o.id_obra AND pr.etapa = 'CONTRATO_ASSINADO' AND pr.situacao = 'FEITO') AS contrato_assinado
       FROM modulo_hidraulica_pocos_obras o LEFT JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = o.id_poco
       WHERE o.id_cliente = ? AND o.tenant_id = ? ORDER BY o.id_obra DESC`, [id, tenant]);
    const [pocos]: any = await pool.execute(
      `SELECT p.*, DATE_FORMAT(p.data_perfuracao, '%Y-%m-%d') AS perfuracao_txt,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras o WHERE o.id_poco = p.id_poco) AS obras,
              EXISTS (SELECT 1 FROM modulo_hidraulica_pocos_dispositivos d WHERE d.id_poco = p.id_poco AND d.situacao = 'ATIVO') AS iot,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_planos_manutencao pm WHERE pm.id_poco = p.id_poco AND pm.ativo = 1) AS planos
       FROM modulo_hidraulica_pocos_pocos p WHERE p.id_proprietario = ? AND p.tenant_id = ? ORDER BY p.identificacao`, [id, tenant]);
    const ids = obras.map((o: any) => Number(o.id_obra));
    const marcas = ids.map(() => '?').join(',') || '0';
    const [parcelas]: any = ids.length ? await pool.execute(
      `SELECT p.*, DATE_FORMAT(p.vencimento, '%Y-%m-%d') AS venc_txt FROM modulo_hidraulica_pocos_parcelas p
       JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = p.id_obra AND o.situacao NOT IN ('ORCAMENTO', 'CANCELADA')
       WHERE p.id_obra IN (${marcas}) AND p.status = 'ABERTO' ORDER BY p.vencimento IS NULL, p.vencimento`, ids) : [[]];
    const [recebimentos]: any = ids.length ? await pool.execute(
      `SELECT r.*, DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') AS em_txt, p.descricao FROM modulo_hidraulica_pocos_recebimentos r
       JOIN modulo_hidraulica_pocos_parcelas p ON p.id_parcela = r.id_parcela WHERE r.id_obra IN (${marcas}) AND r.estornado_em IS NULL ORDER BY r.id_recebimento DESC LIMIT 100`, ids) : [[]];
    const [eventos]: any = ids.length ? await pool.execute(
      `SELECT id_obra, etapa, situacao, DATE_FORMAT(feito_em, '%Y-%m-%d') AS dia, observacao FROM modulo_hidraulica_pocos_processo WHERE id_obra IN (${marcas})`, ids) : [[]];
    const [leads]: any = await pool.execute(
      `SELECT id_lead, origem, indicado_por, necessidade, DATE_FORMAT(recebido_em, '%Y-%m-%d') AS dia, id_obra FROM modulo_hidraulica_pocos_leads WHERE id_cliente = ? AND tenant_id = ?`, [id, tenant]);
    const idsPocos = pocos.map((p: any) => Number(p.id_poco));
    const [alertas]: any = idsPocos.length ? await pool.execute(
      `SELECT a.tipo, a.mensagem, DATE_FORMAT(a.inicio, '%Y-%m-%d') AS dia, a.fim IS NULL AS aberto, d.id_poco FROM modulo_hidraulica_pocos_alertas a
       JOIN modulo_hidraulica_pocos_dispositivos d ON d.id_dispositivo = a.id_dispositivo WHERE d.id_poco IN (${idsPocos.map(() => '?').join(',')}) ORDER BY a.inicio DESC LIMIT 50`, idsPocos) : [[]];

    const contratos = obras.map((o: any) => {
      const total = Math.round((n(o.valor_contratado) + n(o.adicionais)) * 100) / 100;
      const valendo = !['ORCAMENTO', 'CANCELADA'].includes(o.situacao);   // orçamento não aprovado e obra cancelada não têm nada a receber
      return {
        idObra: Number(o.id_obra), titulo: o.titulo || `Obra ${o.id_obra}`, servicos: lerServicos(o.servicos), situacao: o.situacao, poco: o.poco || null, idPoco: nulo(o.id_poco),
        criadaEm: o.criada_txt, dataInicio: o.inicio_txt || null, dataTermino: o.termino_txt || null, total, recebido: n(o.recebido),
        aReceber: valendo ? Math.round((total - n(o.recebido)) * 100) / 100 : 0, vencido: n(o.vencido), aditivos: n(o.aditivos), contratoAssinado: !!Number(o.contrato_assinado),
        garantiaAte: garantiaAte(o.termino_txt || null, nulo(o.garantia_meses)),
      };
    });
    const titulo = new Map(contratos.map((o: any) => [o.idObra, o.titulo]));
    const ETAPA: Record<string, string> = {
      VISITA: 'Visita técnica', ORCAMENTO_ENVIADO: 'Orçamento enviado', CONTRATO_ASSINADO: 'Contrato assinado', LAUDO_ENTREGUE: 'Laudo entregue',
      ADESIVO_QUADRO: 'Adesivo no quadro', AVALIACAO_PEDIDA: 'Avaliação pedida', AVALIACAO_RECEBIDA: 'Cliente avaliou', REVISAO_LEMBRADA: 'Revisão lembrada',
    };
    const linha = [
      ...leads.map((l: any) => ({ data: l.dia, tipo: 'CONTATO', titulo: `Primeiro contato (${String(l.origem).toLowerCase()}${l.indicado_por ? `: ${l.indicado_por}` : ''})`, detalhe: l.necessidade || null, idObra: nulo(l.id_obra) })),
      ...contratos.flatMap((o: any) => [
        { data: o.criadaEm, tipo: 'OBRA', titulo: `Orçamento nº ${o.idObra}`, detalhe: o.titulo, idObra: o.idObra },
        ...(o.dataInicio ? [{ data: o.dataInicio, tipo: 'OBRA', titulo: `Início da obra nº ${o.idObra}`, detalhe: o.titulo, idObra: o.idObra }] : []),
        ...(o.dataTermino ? [{ data: o.dataTermino, tipo: 'OBRA', titulo: `Conclusão da obra nº ${o.idObra}`, detalhe: o.garantiaAte ? `garantia até ${o.garantiaAte.split('-').reverse().join('/')}` : null, idObra: o.idObra }] : []),
      ]),
      ...eventos.filter((e: any) => e.situacao === 'FEITO').map((e: any) => ({ data: e.dia, tipo: 'PROCESSO', titulo: ETAPA[e.etapa] || e.etapa, detalhe: `${titulo.get(Number(e.id_obra)) || ''}${e.observacao ? ` · ${e.observacao}` : ''}`, idObra: Number(e.id_obra) })),
      ...alertas.map((a: any) => ({ data: a.dia, tipo: 'ALERTA', titulo: `Alerta do sensor${Number(a.aberto) ? ' (aberto)' : ''}`, detalhe: a.mensagem, idObra: null })),
    ].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

    const central = await calcularCentral(tenant);
    const plano = central.plano.clientes.find((x: any) => x.idCliente === id) || null;
    return res.json({
      cliente: {
        idCliente: id, nome: c.nome, tipoPessoa: c.tipo_pessoa || 'PF', telefone: c.telefone || null, telefone2: c.telefone2 || null, documento: c.documento || null,
        rgIe: c.rg_ie || null, estadoCivil: c.estado_civil || null, profissao: c.profissao || null, email: c.email || null, endereco: c.endereco || null,
        bairro: c.bairro || null, cidade: c.cidade || null, uf: c.uf || null, cep: c.cep || null, representante: c.representante || null,
        representanteDocumento: c.representante_documento || null, observacao: c.observacao || null,
      },
      resumo: {
        contratos: contratos.length, abertos: contratos.filter((o: any) => ['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO'].includes(o.situacao)).length,
        valorTotal: contratos.filter((o: any) => o.situacao !== 'CANCELADA' && o.situacao !== 'ORCAMENTO').reduce((s: number, o: any) => s + o.total, 0),
        recebido: contratos.reduce((s: number, o: any) => s + o.recebido, 0), aReceber: parcelas.reduce((s: number, p: any) => s + n(p.valor) - n(p.valor_pago), 0),
        vencido: contratos.reduce((s: number, o: any) => s + o.vencido, 0), pocos: pocos.length,
      },
      contratos,
      pocos: pocos.map((p: any) => ({
        idPoco: Number(p.id_poco), identificacao: p.identificacao, endereco: p.endereco || null, cidade: p.cidade || null, latitude: nulo(p.latitude), longitude: nulo(p.longitude),
        profundidadeM: nulo(p.profundidade_m), diametro: p.diametro || null, vazaoLh: nulo(p.vazao_lh), nivelEstaticoM: nulo(p.nivel_estatico_m),
        nivelDinamicoM: nulo(p.nivel_dinamico_m), dataPerfuracao: p.perfuracao_txt || null, perfuradoPor: p.perfurado_por, situacao: p.situacao,
        obras: n(p.obras), iot: !!Number(p.iot), planos: n(p.planos),
      })),
      parcelas: parcelas.map((p: any) => ({ idParcela: Number(p.id_parcela), idObra: Number(p.id_obra), descricao: p.descricao, vencimento: p.venc_txt || null,
        saldo: Math.round((n(p.valor) - n(p.valor_pago)) * 100) / 100, vencida: !!p.venc_txt && p.venc_txt < new Date().toISOString().slice(0, 10) })),
      recebimentos: recebimentos.map((r: any) => ({ idObra: Number(r.id_obra), descricao: r.descricao, forma: r.forma, valor: n(r.valor), em: r.em_txt })),
      linhaDoTempo: linha, plano,
    });
  } catch (e) { return responderErro(res, e, 'Erro ao abrir a ficha do cliente.'); }
};
