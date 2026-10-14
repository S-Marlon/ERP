// Fotos entre o ML e o ERP: as fotos que cada item usa no anúncio do ML (e quais já estão no cadastro), trazer fotos do
// ML para o cadastro do ERP (links https, que voltam ao ML como estão) e buscar fotos de outro anúncio ou do catálogo.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarAnuncios, responderErro, tenantDe } from './anuncios.controller';
import { ErroML, ml } from './mercadolivreApi';
import { referenciaDeFoto, urlPublicaDeImagem } from './fotos';

interface FotoMl { id: string; url: string; tamanho: string | null }

const fotoDoMl = (p: any): FotoMl | null => {
  const url = String(p?.secure_url || p?.url || '').replace(/^http:/, 'https:');
  return url ? { id: String(p?.id || ''), url, tamanho: p?.max_size || p?.size || null } : null;
};

/** Fotos dos anúncios do ML (até 20 por chamada). */
const fotosDosAnuncios = async (tenant: number, mlbs: string[]) => {
  const mapa = new Map<string, FotoMl[]>();
  for (let i = 0; i < mlbs.length; i += 20) {
    const lote = mlbs.slice(i, i + 20);
    const r: any = await ml(tenant, 'GET', `/items?ids=${lote.join(',')}&attributes=id,pictures`);
    for (const x of r || []) {
      const corpo = x?.body;
      if (corpo?.id) mapa.set(String(corpo.id), (corpo.pictures || []).map(fotoDoMl).filter(Boolean));
    }
  }
  return mapa;
};

/** Fotos do cadastro (anexos de imagem) dos itens. */
const fotosDoErp = async (tenant: number, ids: number[]) => {
  const mapa = new Map<number, { idAnexo: number; url: string; principal: boolean }[]>();
  if (!ids.length) return mapa;
  const [rows]: any = await pool.query(
    `SELECT id_anexo, id_item, url_anexo, tipo_anexo FROM itens_anexos
     WHERE tenant_id = ? AND id_item IN (?) AND tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA')
     ORDER BY (tipo_anexo = 'IMAGEM_PRINCIPAL') DESC, ordem, id_anexo`,
    [tenant, ids]
  );
  for (const r of rows) {
    const lista = mapa.get(Number(r.id_item)) || [];
    lista.push({ idAnexo: Number(r.id_anexo), url: r.url_anexo, principal: r.tipo_anexo === 'IMAGEM_PRINCIPAL' });
    mapa.set(Number(r.id_item), lista);
  }
  return mapa;
};

/** GET /anuncios/:id/fotos — cada item com as fotos do ERP e as do anúncio no ML (marcando as que já estão no ERP). */
export const fotosDoAnuncio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    if (!c) throw new ErroML('Anúncio não encontrado.', 404);
    const mlbs = c.itens.map(i => c.noMl.get(i.idItem)?.mlbId).filter((x): x is string => !!x);
    const [doMl, doErp] = await Promise.all([mlbs.length ? fotosDosAnuncios(tenant, mlbs) : new Map<string, FotoMl[]>(), fotosDoErp(tenant, c.itens.map(i => i.idItem))]);
    return res.json(c.itens.map(i => {
      const m = c.noMl.get(i.idItem);
      const erp = doErp.get(i.idItem) || [];
      const urlsErp = new Set(erp.map(f => f.url));
      const idsEnviados = new Set(Object.values(m?.fotosMl || {}));   // fotos do ERP que o ERP mesmo subiu ao ML
      return {
        idItem: i.idItem, sku: i.sku, nome: i.tituloMl || i.nome, mlbId: m?.mlbId || null, erp,
        ml: (m?.mlbId ? doMl.get(m.mlbId) || [] : []).map(f => ({ ...f, noErp: urlsErp.has(f.url) || idsEnviados.has(f.id) })),
      };
    }));
  } catch (error) {
    return responderErro(res, error, 'Erro ao ler as fotos do anúncio.');
  }
};

/** GET /fotos-ml/buscar?ref= — fotos de um anúncio (MLB…, link do anúncio) ou de um produto do catálogo (link /p/MLB…). */
export const buscarFotosMl = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const ref = referenciaDeFoto(String(req.query.ref || ''));
    if (!ref) throw new ErroML('Cole o link do anúncio ou do produto do ML, ou o código (ex.: MLB5384283051).');
    const [[conta]]: any = await pool.execute(`SELECT ml_user_id FROM modulo_ecommerce_mercadolivre_contas WHERE tenant_id = ?`, [tenant]);
    if (ref.tipo === 'CATALOGO') {
      const p: any = await ml(tenant, 'GET', `/products/${ref.id}`);
      return res.json({ origem: 'CATALOGO', id: ref.id, titulo: p?.name || ref.id, proprio: false, fotos: (p?.pictures || []).map(fotoDoMl).filter(Boolean) });
    }
    const it: any = await ml(tenant, 'GET', `/items/${ref.id}?attributes=id,title,pictures,seller_id,catalog_product_id`);
    return res.json({
      origem: 'ANUNCIO', id: ref.id, titulo: it?.title || ref.id, proprio: !!conta && Number(it?.seller_id) === Number(conta.ml_user_id),
      catalogo: it?.catalog_product_id || null, fotos: (it?.pictures || []).map(fotoDoMl).filter(Boolean),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar as fotos no ML.');
  }
};

/**
 * POST /anuncios/:id/fotos/importar { itens: [{ idItem, fotos: [{ url, idMl? }] }] } — põe as fotos no cadastro de cada
 * item (a primeira vira principal se o item não tem foto). Foto do próprio anúncio fica ligada ao id do ML (não sobe de novo).
 */
export const importarFotos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    if (!c) throw new ErroML('Anúncio não encontrado.', 404);
    const pedidos: { idItem: number; fotos: { url: string; idMl?: string }[] }[] = Array.isArray(req.body?.itens) ? req.body.itens : [];
    const doErp = await fotosDoErp(tenant, c.itens.map(i => i.idItem));
    await conn.beginTransaction();
    let total = 0;
    for (const p of pedidos) {
      const item = c.itens.find(i => i.idItem === Number(p.idItem));
      if (!item) continue;
      const existentes = new Set((doErp.get(item.idItem) || []).map(f => f.url));
      let temPrincipal = (doErp.get(item.idItem) || []).some(f => f.principal);
      const [[ordem]]: any = await conn.execute(`SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima FROM itens_anexos WHERE tenant_id = ? AND id_item = ?`, [tenant, item.idItem]);
      let proxima = Number(ordem.proxima);
      const m = c.noMl.get(item.idItem);
      const ligadas: Record<string, string> = { ...(m?.fotosMl || {}) };
      for (const f of p.fotos || []) {
        const url = String(f.url || '').trim();
        if (!/^https:\/\/\S+$/i.test(url) || url.length > 500 || existentes.has(url)) continue;
        const tipo = temPrincipal ? 'FOTO_GALERIA' : 'IMAGEM_PRINCIPAL';
        const nome = decodeURIComponent(url.split('?')[0].split('/').pop() || 'foto-ml').slice(0, 255);
        const [r]: any = await conn.execute(
          `INSERT INTO itens_anexos (tenant_id, id_item, tipo_anexo, nome_arquivo, url_anexo, ordem) VALUES (?, ?, ?, ?, ?, ?)`,
          [tenant, item.idItem, tipo, nome, url, proxima++]
        );
        temPrincipal = true;
        existentes.add(url);
        total++;
        // foto que já está neste anúncio no ML: liga o anexo ao id de lá (atualizar o anúncio não sobe a foto de novo)
        if (f.idMl && m?.mlbId) ligadas[String(r.insertId)] = String(f.idMl);
      }
      if (m?.mlbId && Object.keys(ligadas).length !== Object.keys(m.fotosMl || {}).length) {
        await conn.execute(
          `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens SET fotos_ml = ? WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
          [JSON.stringify(ligadas), Number(c.registro.id), tenant, item.idItem]
        );
      }
    }
    await conn.commit();
    return res.json({ importadas: total });
  } catch (error) {
    await conn.rollback().catch(() => null);
    return responderErro(res, error, 'Erro ao trazer as fotos para o ERP.');
  } finally {
    conn.release();
  }
};

/** GET /fotos-ml/imagem?url= — repassa uma imagem pública (fornecedor, ML) para o gerador de imagens desenhar por cima. */
export const repassarImagem = async (req: Request, res: Response) => {
  const url = urlPublicaDeImagem(String(req.query.url || ''));
  if (!url) return res.status(400).json({ error: 'Endereço de imagem inválido.' });
  try {
    const controle = new AbortController();
    const espera = setTimeout(() => controle.abort(), 15000);
    const r = await fetch(url, { signal: controle.signal, headers: { 'User-Agent': 'Mozilla/5.0 (ERP gerador de imagens)' } });
    clearTimeout(espera);
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || !/^image\//i.test(tipo)) return res.status(400).json({ error: 'O endereço não devolveu uma imagem.' });
    const dados = Buffer.from(await r.arrayBuffer());
    if (dados.length > 15 * 1024 * 1024) return res.status(400).json({ error: 'Imagem grande demais (máximo 15 MB).' });
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(dados);
  } catch {
    return res.status(502).json({ error: 'Não foi possível buscar a imagem.' });
  }
};
