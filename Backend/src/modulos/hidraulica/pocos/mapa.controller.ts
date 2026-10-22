// Obras de poços › mapa regional (etapa 2): as camadas do mapa (nossos poços, poços de referência e potencial hídrico),
// a análise de um raio e a importação dos GeoJSON do maperf. Os poços de referência ficam em tabela própria e nunca se
// misturam com os poços dos clientes (modulo_hidraulica_pocos_referencias e _potencial).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ErroObra, lerGps } from './obras';
import { responderErro } from './obras.controller';
import { analisarRaio, caixaDoRaio, lerGeojson, lerRaio, PontoAnalise } from './mapa';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const LOTE = 500;

// GET /mapa/resumo — o que já foi importado (para a tela saber o que oferecer)
export const resumoMapa = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [ref]: any = await pool.execute(
      `SELECT regiao, COUNT(*) AS n FROM modulo_hidraulica_pocos_referencias WHERE tenant_id = ? GROUP BY regiao ORDER BY regiao`, [tenant]);
    const [pot]: any = await pool.execute(
      `SELECT regiao, COUNT(*) AS n FROM modulo_hidraulica_pocos_potencial WHERE tenant_id = ? GROUP BY regiao ORDER BY regiao`, [tenant]);
    const [[nossos]]: any = await pool.execute(
      `SELECT COUNT(*) AS total, SUM(latitude IS NOT NULL) AS com_gps FROM modulo_hidraulica_pocos_pocos WHERE tenant_id = ?`, [tenant]);
    return res.json({
      referencias: ref.map((r: any) => ({ regiao: r.regiao, quantidade: Number(r.n) })),
      potencial: pot.map((r: any) => ({ regiao: r.regiao, quantidade: Number(r.n) })),
      nossos: { total: Number(nossos.total) || 0, comGps: Number(nossos.com_gps) || 0 },
    });
  } catch (e) { return responderErro(res, e, 'Erro ao ler o resumo do mapa.'); }
};

// GET /mapa/pocos — os poços dos clientes que têm GPS, com o dono e a última obra (para o marcador e o balão)
export const pocosDoMapa = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [rows]: any = await pool.execute(
      `SELECT p.id_poco, p.identificacao, p.latitude, p.longitude, p.profundidade_m, p.vazao_lh, p.nivel_estatico_m, p.situacao, p.cidade,
              p.perfurado_por, p.id_proprietario, c.nome AS proprietario, c.telefone,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras o WHERE o.id_poco = p.id_poco) AS obras,
              u.id_obra AS ultima_obra, u.situacao AS ultima_situacao, u.servicos AS ultima_servicos
       FROM modulo_hidraulica_pocos_pocos p
       LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = p.id_proprietario
       LEFT JOIN modulo_hidraulica_pocos_obras u ON u.id_obra = (SELECT MAX(o2.id_obra) FROM modulo_hidraulica_pocos_obras o2 WHERE o2.id_poco = p.id_poco)
       WHERE p.tenant_id = ? AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL`,
      [tenant]
    );
    return res.json(rows.map((r: any) => ({
      idPoco: Number(r.id_poco), identificacao: r.identificacao, latitude: Number(r.latitude), longitude: Number(r.longitude),
      profundidadeM: nulo(r.profundidade_m), vazaoLh: nulo(r.vazao_lh), nivelEstaticoM: nulo(r.nivel_estatico_m), situacao: r.situacao,
      cidade: r.cidade || null, perfuradoPor: r.perfurado_por, idProprietario: nulo(r.id_proprietario), proprietario: r.proprietario || null,
      telefone: r.telefone || null, obras: Number(r.obras) || 0,
      ultimaObra: r.ultima_obra ? { idObra: Number(r.ultima_obra), situacao: r.ultima_situacao, servicos: String(r.ultima_servicos || '').split(',').filter(Boolean) } : null,
    })));
  } catch (e) { return responderErro(res, e, 'Erro ao carregar os poços do mapa.'); }
};

// GET /mapa/referencias — todos os poços de referência, em lista compacta [id, lat, lon, profundidade, vazão m³/h, município]
export const referenciasDoMapa = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT id_referencia, latitude, longitude, profundidade_m, vazao_m3h, municipio FROM modulo_hidraulica_pocos_referencias WHERE tenant_id = ?`, [tenantDe(req)]);
    return res.json(rows.map((r: any) => [Number(r.id_referencia), Number(r.latitude), Number(r.longitude), nulo(r.profundidade_m), nulo(r.vazao_m3h), r.municipio || null]));
  } catch (e) { return responderErro(res, e, 'Erro ao carregar os poços de referência.'); }
};

// GET /mapa/potencial — a grade de potencial hídrico, compacta [latMin, latMax, lonMin, lonMax, valor]
export const potencialDoMapa = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT lat_min, lat_max, lon_min, lon_max, valor FROM modulo_hidraulica_pocos_potencial WHERE tenant_id = ?`, [tenantDe(req)]);
    return res.json(rows.map((r: any) => [Number(r.lat_min), Number(r.lat_max), Number(r.lon_min), Number(r.lon_max), Number(r.valor)]));
  } catch (e) { return responderErro(res, e, 'Erro ao carregar o potencial hídrico.'); }
};

/** Resumo de um raio em volta do ponto: nossos poços + os de referência, e o potencial do quadradinho do ponto. */
export const analisarPonto = async (tenant: number, latitude: number, longitude: number, raioM: number) => {
  const c = caixaDoRaio(latitude, longitude, raioM);
  const [ref]: any = await pool.execute(
    `SELECT latitude, longitude, profundidade_m, vazao_m3h FROM modulo_hidraulica_pocos_referencias
     WHERE tenant_id = ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`, [tenant, c.latMin, c.latMax, c.lonMin, c.lonMax]);
  const [nossos]: any = await pool.execute(
    `SELECT latitude, longitude, profundidade_m, vazao_lh FROM modulo_hidraulica_pocos_pocos
     WHERE tenant_id = ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`, [tenant, c.latMin, c.latMax, c.lonMin, c.lonMax]);
  const pontos: PontoAnalise[] = [
    ...ref.map((r: any) => ({ latitude: Number(r.latitude), longitude: Number(r.longitude), profundidadeM: nulo(r.profundidade_m), vazaoM3h: nulo(r.vazao_m3h), nosso: false })),
    ...nossos.map((r: any) => ({ latitude: Number(r.latitude), longitude: Number(r.longitude), profundidadeM: nulo(r.profundidade_m),
      vazaoM3h: r.vazao_lh === null ? null : Number(r.vazao_lh) / 1000, nosso: true })),
  ];
  const [[cel]]: any = await pool.execute(
    `SELECT valor FROM modulo_hidraulica_pocos_potencial WHERE tenant_id = ? AND ? BETWEEN lat_min AND lat_max AND ? BETWEEN lon_min AND lon_max LIMIT 1`,
    [tenant, latitude, longitude]);
  return { latitude, longitude, ...analisarRaio({ latitude, longitude }, raioM, pontos), potencial: cel ? Number(cel.valor) : null };
};

// GET /mapa/analise?gps=-23.1,-46.5&raio=2000 (ou lat=&lon=)
export const analiseDoMapa = async (req: Request, res: Response) => {
  try {
    const gps = req.query.gps ? lerGps(req.query.gps) : lerGps(`${req.query.lat}, ${req.query.lon}`);
    if (!gps) throw new ErroObra('Ponto sem GPS válido.');
    return res.json(await analisarPonto(tenantDe(req), gps.latitude, gps.longitude, lerRaio(req.query.raio)));
  } catch (e) { return responderErro(res, e, 'Erro ao analisar a região.'); }
};

/**
 * POST /mapa/importar { arquivo, geojson } — reconhece se é de poços ou de potencial e grava em lotes. Importar o mesmo
 * arquivo de novo atualiza as linhas (chave única por origem + identificador), não duplica.
 */
export const importarGeojson = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const imp = lerGeojson(req.body?.geojson, String(req.body?.arquivo || ''));
    if (!imp.itens.length) throw new ErroObra('Nenhum ponto válido no arquivo.');
    await conn.beginTransaction();
    let gravados = 0;
    for (let i = 0; i < imp.itens.length; i += LOTE) {
      if (imp.tipo === 'POCOS') {
        const linhas = imp.itens.slice(i, i + LOTE).map(r => [tenant, 'MAPERF', r.idExterno, imp.regiao, r.municipio, r.latitude, r.longitude, r.profundidadeM, r.vazaoM3h]);
        await conn.query(
          `INSERT INTO modulo_hidraulica_pocos_referencias (tenant_id, origem, id_externo, regiao, municipio, latitude, longitude, profundidade_m, vazao_m3h)
           VALUES ? ON DUPLICATE KEY UPDATE regiao = VALUES(regiao), municipio = VALUES(municipio), latitude = VALUES(latitude), longitude = VALUES(longitude),
             profundidade_m = VALUES(profundidade_m), vazao_m3h = VALUES(vazao_m3h)`, [linhas]);
        gravados += linhas.length;
      } else {
        const linhas = imp.itens.slice(i, i + LOTE).map(c => [tenant, 'MAPERF', imp.regiao, c.idExterno, c.latMin, c.latMax, c.lonMin, c.lonMax, c.valor]);
        await conn.query(
          `INSERT INTO modulo_hidraulica_pocos_potencial (tenant_id, origem, regiao, id_externo, lat_min, lat_max, lon_min, lon_max, valor)
           VALUES ? ON DUPLICATE KEY UPDATE lat_min = VALUES(lat_min), lat_max = VALUES(lat_max), lon_min = VALUES(lon_min), lon_max = VALUES(lon_max), valor = VALUES(valor)`, [linhas]);
        gravados += linhas.length;
      }
    }
    await conn.commit();
    return res.json({ tipo: imp.tipo, regiao: imp.regiao, gravados });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao importar o arquivo.');
  } finally { conn.release(); }
};

// DELETE /mapa/importacoes?tipo=POCOS|POTENCIAL&regiao= — tira uma região importada (os poços dos clientes não são tocados)
export const removerImportacao = async (req: Request, res: Response) => {
  try {
    const tipo = String(req.query.tipo || '').toUpperCase();
    const regiao = String(req.query.regiao || '');
    if (!regiao || !['POCOS', 'POTENCIAL'].includes(tipo)) throw new ErroObra('Informe o tipo e a região.');
    const tabela = tipo === 'POCOS' ? 'modulo_hidraulica_pocos_referencias' : 'modulo_hidraulica_pocos_potencial';
    const [r]: any = await pool.execute(`DELETE FROM ${tabela} WHERE tenant_id = ? AND regiao = ?`, [tenantDe(req), regiao]);
    return res.json({ removidos: r.affectedRows });
  } catch (e) { return responderErro(res, e, 'Erro ao remover a região.'); }
};
