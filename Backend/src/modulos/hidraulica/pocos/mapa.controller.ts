// Obras de poços › mapa regional (etapa 2): as camadas do mapa e a análise de um raio. Os poços de referência e o
// potencial hídrico vêm direto dos GeoJSON do maperf (pasta MAPERF_DIR do .env, ou Backend/dados/maperf), lidos em
// memória e relidos quando um arquivo muda; o banco guarda só os poços dos clientes. Nunca se misturam.
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ErroObra, lerGps } from './obras';
import { responderErro } from './obras.controller';
import { analisarRaio, caixaDoRaio, Celula, lerGeojson, lerRaio, PontoAnalise, Referencia } from './mapa';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Pasta do maperf: as subpastas com os .geojson são as mesmas do projeto maperf. */
const pastaMaperf = () => path.resolve(process.env.MAPERF_DIR || path.join(__dirname, '../../../../dados/maperf'));
const SUBPASTAS = ['get_pocos_with_center', 'get_hydric_potential_raster_with_center'];

interface Arquivo { caminho: string; tipo: 'POCOS' | 'POTENCIAL'; regiao: string; quantidade: number }
interface Camadas { assinatura: string; referencias: (Referencia & { regiao: string })[]; potencial: Celula[]; arquivos: Arquivo[]; erros: string[] }
let cache: Camadas | null = null;

const listarGeojson = () => {
  const base = pastaMaperf();
  return SUBPASTAS.flatMap(sub => {
    const dir = path.join(base, sub);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => /\.(geo)?json$/i.test(f)).sort().map(f => path.join(dir, f));
  });
};

/** Lê os arquivos (só de novo quando algum muda: nome, tamanho ou data). Arquivo com problema não derruba os outros. */
const camadas = (): Camadas => {
  const arquivos = listarGeojson();
  const assinatura = arquivos.map(a => { const s = fs.statSync(a); return `${a}:${s.size}:${s.mtimeMs}`; }).join('|');
  if (cache && cache.assinatura === assinatura) return cache;
  const novo: Camadas = { assinatura, referencias: [], potencial: [], arquivos: [], erros: [] };
  for (const caminho of arquivos) {
    try {
      const imp = lerGeojson(JSON.parse(fs.readFileSync(caminho, 'utf8')), caminho);
      if (imp.tipo === 'POCOS') novo.referencias.push(...imp.itens.map(r => ({ ...r, regiao: imp.regiao })));
      else novo.potencial.push(...imp.itens);
      novo.arquivos.push({ caminho: path.relative(pastaMaperf(), caminho), tipo: imp.tipo, regiao: imp.regiao, quantidade: imp.itens.length });
    } catch (e: any) { novo.erros.push(`${path.basename(caminho)}: ${e?.message || 'não deu para ler'}`); }
  }
  cache = novo;
  return novo;
};

// GET /mapa/resumo — de onde vêm os dados e o que foi lido
export const resumoMapa = async (req: Request, res: Response) => {
  try {
    const c = camadas();
    const [[nossos]]: any = await pool.execute(
      `SELECT COUNT(*) AS total, SUM(latitude IS NOT NULL) AS com_gps FROM modulo_hidraulica_pocos_pocos WHERE tenant_id = ?`, [tenantDe(req)]);
    return res.json({
      pasta: pastaMaperf(), arquivos: c.arquivos, erros: c.erros,
      referencias: c.referencias.length, potencial: c.potencial.length,
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

// GET /mapa/referencias — os poços de referência, em lista compacta [nº, lat, lon, profundidade, vazão m³/h, município]
export const referenciasDoMapa = async (_req: Request, res: Response) => {
  try { return res.json(camadas().referencias.map((r, i) => [i + 1, r.latitude, r.longitude, r.profundidadeM, r.vazaoM3h, r.municipio])); }
  catch (e) { return responderErro(res, e, 'Erro ao ler os poços de referência.'); }
};

// GET /mapa/potencial — a grade de potencial hídrico, compacta [latMin, latMax, lonMin, lonMax, valor]
export const potencialDoMapa = async (_req: Request, res: Response) => {
  try { return res.json(camadas().potencial.map(c => [c.latMin, c.latMax, c.lonMin, c.lonMax, c.valor])); }
  catch (e) { return responderErro(res, e, 'Erro ao ler o potencial hídrico.'); }
};

/** Resumo de um raio em volta do ponto: nossos poços (banco) + os de referência (arquivos), e o potencial do ponto. */
export const analisarPonto = async (tenant: number, latitude: number, longitude: number, raioM: number) => {
  const c = caixaDoRaio(latitude, longitude, raioM);
  const dentro = (lat: number, lon: number) => lat >= c.latMin && lat <= c.latMax && lon >= c.lonMin && lon <= c.lonMax;
  const arq = camadas();
  const [nossos]: any = await pool.execute(
    `SELECT latitude, longitude, profundidade_m, vazao_lh FROM modulo_hidraulica_pocos_pocos
     WHERE tenant_id = ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`, [tenant, c.latMin, c.latMax, c.lonMin, c.lonMax]);
  const pontos: PontoAnalise[] = [
    ...arq.referencias.filter(r => dentro(r.latitude, r.longitude))
      .map(r => ({ latitude: r.latitude, longitude: r.longitude, profundidadeM: r.profundidadeM, vazaoM3h: r.vazaoM3h, nosso: false })),
    ...nossos.map((r: any) => ({ latitude: Number(r.latitude), longitude: Number(r.longitude), profundidadeM: nulo(r.profundidade_m),
      vazaoM3h: r.vazao_lh === null ? null : Number(r.vazao_lh) / 1000, nosso: true })),
  ];
  const cel = arq.potencial.find(p => latitude >= p.latMin && latitude <= p.latMax && longitude >= p.lonMin && longitude <= p.lonMax);
  return { latitude, longitude, ...analisarRaio({ latitude, longitude }, raioM, pontos), potencial: cel ? cel.valor : null };
};

// GET /mapa/analise?gps=-23.1,-46.5&raio=2000 (ou lat=&lon=)
export const analiseDoMapa = async (req: Request, res: Response) => {
  try {
    const gps = req.query.gps ? lerGps(req.query.gps) : lerGps(`${req.query.lat}, ${req.query.lon}`);
    if (!gps) throw new ErroObra('Ponto sem GPS válido.');
    return res.json(await analisarPonto(tenantDe(req), gps.latitude, gps.longitude, lerRaio(req.query.raio)));
  } catch (e) { return responderErro(res, e, 'Erro ao analisar a região.'); }
};
