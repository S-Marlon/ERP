// Obras de poços › busca geral (cliente, poço e contrato num campo só) e ficha completa do poço (dados, proprietário,
// contratos/obras do poço com o tipo do contrato, relatório e garantia). As regras ficam em busca.ts.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { garantiaAte, lerServicos } from './obras';
import { carregarPoco, formatarPoco, responderErro } from './obras.controller';
import { interpretarBusca, ordenarPorRelevancia, relatorioPreenchido, tipoDoContrato } from './busca';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const n = (v: unknown) => Number(v) || 0;
const lerJson = (s: unknown) => { try { return s ? JSON.parse(String(s)) : null; } catch { return null; } };

const ASSINADO = `EXISTS (SELECT 1 FROM modulo_hidraulica_pocos_processo pr WHERE pr.id_obra = o.id_obra AND pr.etapa = 'CONTRATO_ASSINADO' AND pr.situacao = 'FEITO')`;

// GET /busca?q=
export const buscar = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const t = interpretarBusca(req.query.q);
    if (!t) return res.json({ clientes: [], pocos: [], contratos: [] });
    const like = `%${t.texto}%`, dig = t.digitos ? `%${t.digitos}%` : null;
    const porDigitos = (cols: string[]) => (dig ? cols.map(c => ` OR ${c} LIKE ?`).join('') : '');
    const paramDigitos = (qtd: number) => (dig ? Array(qtd).fill(dig) : []);

    const [clientes]: any = await pool.execute(
      `SELECT c.id_cliente, c.nome, c.telefone, c.documento, c.cidade, c.uf, c.representante,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_pocos p WHERE p.id_proprietario = c.id_cliente) AS pocos,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras o WHERE o.id_cliente = c.id_cliente) AS obras
       FROM modulo_hidraulica_pocos_clientes c
       WHERE c.tenant_id = ? AND c.ativo = 1 AND (c.nome LIKE ? OR c.representante LIKE ? OR c.cidade LIKE ? OR c.endereco LIKE ?${porDigitos(['c.telefone', 'c.telefone2', 'c.documento'])})
       ORDER BY c.nome LIMIT 40`,
      [tenant, like, like, like, like, ...paramDigitos(3)]);
    const [pocos]: any = await pool.execute(
      `SELECT p.id_poco, p.identificacao, p.endereco, p.bairro, p.cidade, p.uf, p.latitude, p.longitude, p.profundidade_m, p.situacao,
              p.id_proprietario, c.nome AS proprietario, c.telefone
       FROM modulo_hidraulica_pocos_pocos p LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = p.id_proprietario
       WHERE p.tenant_id = ? AND (p.identificacao LIKE ? OR p.endereco LIKE ? OR p.bairro LIKE ? OR p.cidade LIKE ? OR c.nome LIKE ?${porDigitos(['c.telefone', 'c.documento'])})
       ORDER BY p.identificacao LIMIT 40`,
      [tenant, like, like, like, like, like, ...paramDigitos(2)]);
    const [obras]: any = await pool.execute(
      `SELECT o.id_obra, o.titulo, o.servicos, o.situacao, o.valor_contratado, o.id_cliente, c.nome AS cliente, c.telefone, o.id_poco,
              po.identificacao AS poco, po.cidade, ${ASSINADO} AS assinado, DATE_FORMAT(o.created_at, '%Y-%m-%d') AS criada
       FROM modulo_hidraulica_pocos_obras o
       LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
       LEFT JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = o.id_poco
       WHERE o.tenant_id = ? AND (o.id_obra = ? OR o.titulo LIKE ? OR c.nome LIKE ? OR po.identificacao LIKE ? OR po.cidade LIKE ?${porDigitos(['c.telefone', 'c.documento'])})
       ORDER BY o.id_obra = ? DESC, o.id_obra DESC LIMIT 40`,
      [tenant, t.numero ?? 0, like, like, like, like, ...paramDigitos(2), t.numero ?? 0]);

    return res.json({
      clientes: ordenarPorRelevancia(clientes, (c: any) => [c.nome, c.representante, c.cidade, c.telefone, c.documento], t).map((c: any) => ({
        idCliente: Number(c.id_cliente), nome: c.nome, telefone: c.telefone || null, documento: c.documento || null,
        cidade: c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ''}` : null, pocos: n(c.pocos), obras: n(c.obras),
      })),
      pocos: ordenarPorRelevancia(pocos, (p: any) => [p.identificacao, p.proprietario, p.endereco, p.bairro, p.cidade, p.telefone], t).map((p: any) => ({
        idPoco: Number(p.id_poco), identificacao: p.identificacao, proprietario: p.proprietario || null, idProprietario: nulo(p.id_proprietario),
        local: [p.endereco, p.cidade && `${p.cidade}${p.uf ? `/${p.uf}` : ''}`].filter(Boolean).join(' · ') || null,
        latitude: nulo(p.latitude), longitude: nulo(p.longitude), profundidadeM: nulo(p.profundidade_m), situacao: p.situacao,
      })),
      // o número exato do contrato vem sempre primeiro
      contratos: ordenarPorRelevancia(obras, (o: any) => [t.numero !== null && Number(o.id_obra) === t.numero ? t.texto : null, o.titulo, o.cliente, o.poco, o.cidade, o.telefone], t)
        .map((o: any) => ({
          idObra: Number(o.id_obra), titulo: o.titulo || null, servicos: lerServicos(o.servicos), situacao: o.situacao,
          tipoContrato: tipoDoContrato(o.situacao, !!Number(o.assinado)), cliente: o.cliente || null, idCliente: nulo(o.id_cliente),
          poco: o.poco || null, idPoco: nulo(o.id_poco), valor: nulo(o.valor_contratado), criadaEm: o.criada,
        })),
    });
  } catch (e) { return responderErro(res, e, 'Erro na busca.'); }
};

// GET /pocos/:id/completo
export const pocoCompleto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const p = await carregarPoco(tenant, id);
    const [[dono]]: any = p.id_proprietario ? await pool.execute(
      `SELECT id_cliente, nome, telefone, documento, cidade, uf FROM modulo_hidraulica_pocos_clientes WHERE id_cliente = ? AND tenant_id = ?`, [p.id_proprietario, tenant]) : [[]];
    const [obras]: any = await pool.execute(
      `SELECT o.id_obra, o.titulo, o.servicos, o.situacao, o.valor_contratado, o.garantia_meses, o.dados_relatorio, o.id_cliente, c.nome AS cliente,
              DATE_FORMAT(o.created_at, '%Y-%m-%d') AS criada, DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS inicio, DATE_FORMAT(o.data_termino, '%Y-%m-%d') AS termino,
              ${ASSINADO} AS assinado,
              (SELECT COALESCE(SUM(a.valor), 0) FROM modulo_hidraulica_pocos_adicionais a WHERE a.id_obra = o.id_obra AND a.situacao = 'APROVADO') AS adicionais,
              (SELECT COALESCE(SUM(pa.valor_pago), 0) FROM modulo_hidraulica_pocos_parcelas pa WHERE pa.id_obra = o.id_obra AND pa.status <> 'CANCELADO') AS recebido,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_aditivos ad WHERE ad.id_obra = o.id_obra) AS aditivos
       FROM modulo_hidraulica_pocos_obras o LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
       WHERE o.id_poco = ? AND o.tenant_id = ? ORDER BY o.id_obra DESC`, [id, tenant]);
    const [[iot]]: any = await pool.execute(
      `SELECT COUNT(*) AS q FROM modulo_hidraulica_pocos_dispositivos WHERE id_poco = ? AND situacao = 'ATIVO'`, [id]);

    const contratos = obras.map((o: any) => {
      const total = Math.round((n(o.valor_contratado) + n(o.adicionais)) * 100) / 100;
      const valendo = !['ORCAMENTO', 'CANCELADA'].includes(o.situacao);
      return {
        idObra: Number(o.id_obra), titulo: o.titulo || `Obra ${o.id_obra}`, servicos: lerServicos(o.servicos), situacao: o.situacao,
        tipoContrato: tipoDoContrato(o.situacao, !!Number(o.assinado)), cliente: o.cliente || null, idCliente: nulo(o.id_cliente),
        criadaEm: o.criada, dataInicio: o.inicio || null, dataTermino: o.termino || null, total, recebido: n(o.recebido),
        aReceber: valendo ? Math.round((total - n(o.recebido)) * 100) / 100 : 0, aditivos: n(o.aditivos),
        temRelatorio: relatorioPreenchido(lerJson(o.dados_relatorio)), garantiaAte: garantiaAte(o.termino || null, nulo(o.garantia_meses)),
      };
    });
    const hoje = new Date().toISOString().slice(0, 10);
    const garantia = contratos.map((c: any) => c.garantiaAte).filter(Boolean).sort().pop() || null;
    return res.json({
      poco: formatarPoco(p),
      proprietario: dono ? { idCliente: Number(dono.id_cliente), nome: dono.nome, telefone: dono.telefone || null, documento: dono.documento || null,
        cidade: dono.cidade ? `${dono.cidade}${dono.uf ? `/${dono.uf}` : ''}` : null } : null,
      contratos,
      resumo: { contratos: contratos.length, garantiaAte: garantia, emGarantia: !!garantia && garantia >= hoje, sensores: n(iot?.q) > 0 },
    });
  } catch (e) { return responderErro(res, e, 'Erro ao abrir a ficha do poço.'); }
};
