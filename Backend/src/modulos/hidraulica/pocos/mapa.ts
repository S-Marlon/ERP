// Obras de poços › mapa regional (etapa 2): regras puras. Lê os GeoJSON do maperf (poços de referência da base pública
// e a grade de potencial hídrico, usados direto dos arquivos, fora do banco), mede distâncias e resume os poços num raio
// para estimar a profundidade da obra nova. A referência tem a vazão em m³/h (como na origem); os nossos poços, em L/h.
import { ErroObra } from './obras';

export interface Referencia { idExterno: string; municipio: string | null; latitude: number; longitude: number; profundidadeM: number | null; vazaoM3h: number | null }
export interface Celula { idExterno: string; latMin: number; latMax: number; lonMin: number; lonMax: number; valor: number }
export type Importacao = { tipo: 'POCOS'; regiao: string; itens: Referencia[] } | { tipo: 'POTENCIAL'; regiao: string; itens: Celula[] };

const numOuNull = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const coord = (v: unknown, max: number) => { const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 1e7) / 1e7 : null; };

/** Nome da região a partir do arquivo ("get_pocos/jundiai.geojson" → "jundiai"). */
export const regiaoDoArquivo = (nome: string) =>
  String(nome || '').split(/[\\/]/).pop()!.replace(/\.(geo)?json$/i, '').trim().toLowerCase().slice(0, 60) || 'sem-nome';

/**
 * Reconhece o arquivo: pontos com profundidade/vazão são poços de referência; polígonos com `data` são o potencial.
 * Aceita a FeatureCollection solta ou dentro de `{ geojson: ... }` (como vem o potencial do maperf).
 */
export const lerGeojson = (json: any, nomeArquivo: string): Importacao => {
  const fc = json?.geojson ?? json;
  const features: any[] = Array.isArray(fc?.features) ? fc.features : [];
  if (!features.length) throw new ErroObra('Arquivo sem pontos nem áreas (não é um GeoJSON do mapa).');
  const regiao = regiaoDoArquivo(nomeArquivo);
  const tipo = features[0]?.geometry?.type;
  if (tipo === 'Point') {
    const itens: Referencia[] = [];
    features.forEach((f, i) => {
      const [lon, lat] = f?.geometry?.coordinates || [];
      const latitude = coord(lat, 90), longitude = coord(lon, 180);
      if (latitude === null || longitude === null) return;
      const p = f.properties || {};
      itens.push({
        idExterno: String(p.id_ponto ?? p.id ?? f.id ?? `${regiao}-${i}`).slice(0, 30),
        municipio: p.municipio ? String(p.municipio).slice(0, 60) : null, latitude, longitude,
        profundidadeM: numOuNull(p.profundida ?? p.profundidade), vazaoM3h: numOuNull(p.vazao),
      });
    });
    return { tipo: 'POCOS', regiao, itens };
  }
  if (tipo === 'Polygon') {
    const itens: Celula[] = [];
    features.forEach((f, i) => {
      const valor = numOuNull(f?.properties?.data);
      const anel: any[] = f?.geometry?.coordinates?.[0] || [];
      if (valor === null || !anel.length) return;
      const lons = anel.map(c => Number(c[0])), lats = anel.map(c => Number(c[1]));
      const c = [coord(Math.min(...lats), 90), coord(Math.max(...lats), 90), coord(Math.min(...lons), 180), coord(Math.max(...lons), 180)];
      if (c.some(x => x === null)) return;
      itens.push({ idExterno: String(f.properties?.id ?? f.id ?? i).slice(0, 30), latMin: c[0]!, latMax: c[1]!, lonMin: c[2]!, lonMax: c[3]!, valor: Math.round(valor * 10000) / 10000 });
    });
    return { tipo: 'POTENCIAL', regiao, itens };
  }
  throw new ErroObra(`Tipo de geometria não reconhecido (${tipo || 'vazio'}): o mapa lê pontos (poços) ou polígonos (potencial).`);
};

/** Distância em metros entre dois pontos (fórmula de haversine). */
export const distanciaM = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Retângulo que contém o círculo (para filtrar no banco antes de medir a distância). */
export const caixaDoRaio = (latitude: number, longitude: number, raioM: number) => {
  const dLat = raioM / 111320;
  const dLon = raioM / (111320 * Math.max(Math.cos(latitude * Math.PI / 180), 0.01));
  return { latMin: latitude - dLat, latMax: latitude + dLat, lonMin: longitude - dLon, lonMax: longitude + dLon };
};

export interface PontoAnalise { latitude: number; longitude: number; profundidadeM: number | null; vazaoM3h: number | null; nosso: boolean }

const media = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b), m = Math.floor(o.length / 2);
  return Math.round((o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2) * 10) / 10;
};

/**
 * Resumo dos poços dentro do raio: quantos (nossos e de referência), profundidade média/mediana/mín./máx. e vazão média.
 * A sugestão de metros para o orçamento é a mediana (não se deixa levar por um poço fora da curva) arredondada para
 * cima de 10 em 10 m.
 */
export const analisarRaio = (centro: { latitude: number; longitude: number }, raioM: number, pontos: PontoAnalise[]) => {
  const dentro = pontos.filter(p => distanciaM(centro, p) <= raioM);
  const prof = dentro.map(p => p.profundidadeM).filter((x): x is number => x !== null && x > 0);
  const vazao = dentro.map(p => p.vazaoM3h).filter((x): x is number => x !== null && x >= 0);
  const med = mediana(prof);
  return {
    raioM, quantidade: dentro.length, nossos: dentro.filter(p => p.nosso).length,
    profundidadeMedia: media(prof), profundidadeMediana: med,
    profundidadeMin: prof.length ? Math.min(...prof) : null, profundidadeMax: prof.length ? Math.max(...prof) : null,
    vazaoMediaM3h: media(vazao), metrosSugeridos: med === null ? null : Math.ceil(med / 10) * 10,
  };
};

/** Raio pedido pela tela, entre 200 m e 20 km (padrão 2 km, como no maperf). */
export const lerRaio = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.round(n), 200), 20000) : 2000;
};
