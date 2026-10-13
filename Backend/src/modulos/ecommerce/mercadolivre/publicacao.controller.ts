// Publicação no Mercado Livre e importação dos anúncios que já existem na conta.
// Conta com User Products: cada item vira um anúncio (MLB) e o ML agrupa os da mesma família pelo family_name.
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { caminhoLocalDaUrl } from '../../../infra/arquivos';
import {
  corpoDoItem, cortarTitulo, errosDoValidador, FotoEnvio, fotoPequena, ItemAnuncio, ligarPorSku, SITUACAO_POR_STATUS, ValorAtributo,
} from './anuncios';
import {
  AnuncioCarregado, carregarAnuncios, carregarCategoria, detalhe, lista, responderErro, tenantDe,
} from './anuncios.controller';
import { contaPorFamilia, enviarFotoMl, ErroML, ml } from './mercadolivreApi';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const TIPO_POR_EXTENSAO: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

const carregarOuErro = async (tenant: number, id: number) => {
  const [c] = await carregarAnuncios(pool as any, tenant, id);
  if (!c) throw new ErroML('Anúncio não encontrado.', 404);
  return c;
};

const aPublicar = (c: AnuncioCarregado) => c.itens.filter(i => !c.noMl.get(i.idItem)?.mlbId);

/**
 * Fotos do item no formato do ML. Arquivo do servidor sobe para o ML (e o id fica guardado para não subir de novo);
 * link https vai como "source". Foto pequena demais volta como problema.
 */
const fotosDoItem = async (tenant: number, c: AnuncioCarregado, item: ItemAnuncio) => {
  const [anexos]: any = await pool.execute(
    `SELECT id_anexo, url_anexo, nome_arquivo FROM itens_anexos
     WHERE tenant_id = ? AND id_item = ? AND tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA')
     ORDER BY (tipo_anexo = 'IMAGEM_PRINCIPAL') DESC, ordem, id_anexo`,
    [tenant, item.idItem]
  );
  const guardadas = { ...(c.noMl.get(item.idItem)?.fotosMl || {}) };
  const fotos: FotoEnvio[] = [];
  const problemas: string[] = [];
  let mudou = false;
  for (const a of anexos.slice(0, c.categoria?.info.maxFotos || 10)) {
    const chave = String(a.id_anexo);
    if (guardadas[chave]) { fotos.push({ id: guardadas[chave] }); continue; }
    const local = caminhoLocalDaUrl(a.url_anexo);
    if (local) {
      const tipo = TIPO_POR_EXTENSAO[path.extname(local).toLowerCase()] || 'image/jpeg';
      const r = await enviarFotoMl(tenant, fs.readFileSync(local), a.nome_arquivo || path.basename(local), tipo);
      if (fotoPequena(r.maxSize)) {
        problemas.push(`foto "${a.nome_arquivo || path.basename(local)}" tem ${r.maxSize} px: o ML pede ao menos 500 px num dos lados`);
        continue;
      }
      guardadas[chave] = r.id;
      mudou = true;
      fotos.push({ id: r.id });
    } else if (/^https:\/\//i.test(a.url_anexo)) {
      fotos.push({ source: a.url_anexo });
    }
  }
  if (mudou) {
    await pool.execute(
      `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens SET fotos_ml = ? WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
      [JSON.stringify(guardadas), Number(c.registro.id), tenant, item.idItem]
    );
    const m = c.noMl.get(item.idItem);
    if (m) m.fotosMl = guardadas;
  }
  if (fotos.length === 0 && problemas.length === 0) problemas.push('nenhuma foto que o ML consiga ler (envie a foto pelo ERP ou use link https)');
  return { fotos, problemas };
};

const montarCorpo = async (tenant: number, c: AnuncioCarregado, item: ItemAnuncio, porFamilia: boolean) => {
  const { fotos, problemas } = await fotosDoItem(tenant, c, item);
  const corpo = corpoDoItem({
    dados: c.dados, tipoAnuncio: c.registro.tipo_anuncio, condicao: c.registro.condicao, item,
    atributos: c.categoria?.atributos || [], temGtin: c.categoria?.temGtin ?? true, fotos, porFamilia,
  });
  return { corpo, problemas };
};

const conferirAntes = (c: AnuncioCarregado) => {
  if (!c.dados.categoriaMl || !c.categoria) throw new ErroML('Escolha a categoria do Mercado Livre antes.');
  if (aPublicar(c).length === 0) throw new ErroML('Todos os itens deste anúncio já estão no Mercado Livre.');
};

/** POST /anuncios/:id/validar — o ML confere cada item sem publicar (fotos sobem e ficam guardadas) */
export const validarAnuncio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const c = await carregarOuErro(tenant, Number(req.params.id));
    conferirAntes(c);
    const porFamilia = await contaPorFamilia(tenant);
    const resultado = [];
    for (const item of aPublicar(c)) {
      const { corpo, problemas } = await montarCorpo(tenant, c, item, porFamilia);
      let erros: string[] = [...problemas];
      try {
        await ml(tenant, 'POST', '/items/validate', corpo);
      } catch (e: any) {
        if (!(e instanceof ErroML)) throw e;
        erros = [...erros, ...(errosDoValidador(e.detalhes).length ? errosDoValidador(e.detalhes) : [e.message])];
      }
      resultado.push({ idItem: item.idItem, sku: item.sku, ok: erros.length === 0, erros });
    }
    return res.json({ itens: resultado, detalhe: await detalhe(tenant, await carregarOuErro(tenant, Number(req.params.id))) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao conferir no Mercado Livre.');
  }
};

/** POST /anuncios/:id/publicar — cria no ML os itens que ainda não estão lá */
export const publicarAnuncio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  try {
    const c = await carregarOuErro(tenant, id);
    conferirAntes(c);
    const travas = c.pendencias.filter(p => p.nivel === 'erro');
    if (travas.length) throw new ErroML(`Resolva antes: ${travas.slice(0, 3).map(p => p.texto).join(' · ')}${travas.length > 3 ? ' …' : ''}`);
    const porFamilia = await contaPorFamilia(tenant);
    const descricao = String(c.dados.descricao || '').trim();
    const publicados: { sku: string; mlbId: string }[] = [];
    const falhas: { sku: string; erro: string }[] = [];

    for (const item of aPublicar(c)) {
      try {
        const { corpo, problemas } = await montarCorpo(tenant, c, item, porFamilia);
        if (corpo.pictures.length === 0) throw new ErroML(problemas.join('; ') || 'sem foto');
        const criado: any = await ml(tenant, 'POST', '/items', corpo);
        if (descricao) await ml(tenant, 'POST', `/items/${criado.id}/description`, { plain_text: descricao }).catch(() => null);
        await pool.execute(
          `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens
           SET mlb_id = ?, status_ml = ?, permalink = ?, preco_enviado = ?, estoque_enviado = ?, sincronizado_em = NOW(), ultimo_erro = NULL
           WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
          [criado.id, criado.status || null, criado.permalink || null, corpo.price, corpo.available_quantity, id, tenant, item.idItem]
        );
        publicados.push({ sku: item.sku, mlbId: criado.id });
      } catch (e: any) {
        const erro = e instanceof ErroML && errosDoValidador(e.detalhes).length ? errosDoValidador(e.detalhes).join('; ') : (e?.message || 'erro');
        falhas.push({ sku: item.sku, erro });
        await pool.execute(
          `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens SET ultimo_erro = ? WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
          [erro.slice(0, 500), id, tenant, item.idItem]
        );
      }
    }

    if (publicados.length) {
      const [[primeiro]]: any = await pool.execute(
        `SELECT mlb_id, status_ml, permalink FROM modulo_ecommerce_mercadolivre_anuncios_itens
         WHERE id_anuncio = ? AND tenant_id = ? AND mlb_id IS NOT NULL ORDER BY ordem, id_item LIMIT 1`,
        [id, tenant]
      );
      await pool.execute(
        `UPDATE modulo_ecommerce_mercadolivre_anuncios
         SET situacao = 'PUBLICADO', mlb_id = COALESCE(mlb_id, ?), status_ml = ?, permalink = COALESCE(permalink, ?), sincronizado_em = NOW(), ultimo_erro = ?
         WHERE id = ? AND tenant_id = ?`,
        [primeiro.mlb_id, primeiro.status_ml, primeiro.permalink, falhas.length ? `${falhas.length} item(ns) não subiram` : null, id, tenant]
      );
    } else if (falhas.length) {
      await pool.execute(`UPDATE modulo_ecommerce_mercadolivre_anuncios SET ultimo_erro = ? WHERE id = ? AND tenant_id = ?`,
        [`Nenhum item subiu: ${falhas[0].erro}`.slice(0, 500), id, tenant]);
    }
    return res.json({ publicados, falhas, detalhe: await detalhe(tenant, await carregarOuErro(tenant, id)) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao publicar no Mercado Livre.');
  }
};

// ---------------------------------------------------------------------------
// Importação dos anúncios que já estão no ML
// ---------------------------------------------------------------------------

const lerItensMl = async (tenant: number, ids: string[]) => {
  const saida: any[] = [];
  for (let k = 0; k < ids.length; k += 20) {
    const parte: any[] = await ml(tenant, 'GET', `/items?ids=${ids.slice(k, k + 20).join(',')}`);
    for (const r of parte) if (r?.code === 200 && r.body) saida.push(r.body);
  }
  return saida;
};

const skuDoItemMl = (b: any): string | null =>
  (b.attributes || []).find((a: any) => a.id === 'SELLER_SKU')?.value_name || b.seller_custom_field || null;

const ATRIBUTOS_NAO_IMPORTAR = /^(SELLER_SKU|GTIN|EMPTY_GTIN_REASON|ITEM_CONDITION|SELLER_PACKAGE_.*|PACKAGE_.*)$/;

interface ItemErpSku { idItem: number; sku: string; skuRaiz: string; nome: string; idAnuncio: number | null }

const itensErpPorSku = async (conn: Conn, tenant: number, skus: string[]): Promise<ItemErpSku[]> => {
  if (skus.length === 0) return [];
  const [rows] = await conn.execute(
    `SELECT ic.id_item, COALESCE(cpd.sku_customizado, ic.sku) AS sku, ic.sku AS sku_raiz,
            COALESCE(cpd.nome_comercial, ic.nome_item) AS nome, ai.id_anuncio
     FROM itens_core ic
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN modulo_ecommerce_mercadolivre_anuncios_itens ai ON ai.id_item = ic.id_item AND ai.tenant_id = ic.tenant_id
     WHERE ic.tenant_id = ? AND (cpd.sku_customizado IN (${lista(skus as any)}) OR ic.sku IN (${lista(skus as any)}))`,
    [tenant, ...skus, ...skus]
  );
  return rows.map((r: any) => ({ idItem: Number(r.id_item), sku: r.sku, skuRaiz: r.sku_raiz, nome: r.nome, idAnuncio: r.id_anuncio ? Number(r.id_anuncio) : null }));
};

/** GET /importar — anúncios da conta que ainda não estão ligados ao ERP, com o item sugerido pelo SKU */
export const previaImportacao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const eu: any = await ml(tenant, 'GET', '/users/me');
    const ids: string[] = [];
    for (let offset = 0; offset < 1000; offset += 50) {
      const r: any = await ml(tenant, 'GET', `/users/${eu.id}/items/search?limit=50&offset=${offset}`);
      ids.push(...(r.results || []));
      if (offset + 50 >= Number(r.paging?.total || 0)) break;
    }
    const [ligados]: any = await pool.execute(
      `SELECT mlb_id FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE tenant_id = ? AND mlb_id IS NOT NULL`, [tenant]
    );
    const jaLigados = new Set(ligados.map((l: any) => String(l.mlb_id)));
    const itensMl = await lerItensMl(tenant, ids.filter(i => !jaLigados.has(i)));
    const skus = [...new Set(itensMl.map(skuDoItemMl).filter(Boolean) as string[])];
    const erp = await itensErpPorSku(pool as any, tenant, skus);
    return res.json({
      jaLigados: jaLigados.size,
      itens: itensMl.map(b => {
        const sku = skuDoItemMl(b);
        const sugestao = ligarPorSku(sku, erp);
        return {
          mlbId: b.id, titulo: b.title, familia: b.family_name || null, status: b.status, preco: Number(b.price) || 0,
          estoque: Number(b.available_quantity) || 0, vendidos: Number(b.sold_quantity) || 0, permalink: b.permalink,
          fotoUrl: b.thumbnail ? String(b.thumbnail).replace(/^http:/, 'https:') : null, sku, catalogo: Boolean(b.catalog_listing),
          tipoAnuncio: b.listing_type_id,
          sugestao: sugestao ? { idItem: sugestao.idItem, sku: sugestao.sku, nome: sugestao.nome, idAnuncio: sugestao.idAnuncio } : null,
        };
      }),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao ler os anúncios do Mercado Livre.');
  }
};

/** POST /importar { ligacoes: [{ mlbId, idItem }] } — liga os anúncios do ML aos itens (mesma família no ML = um anúncio aqui) */
export const importarAnuncios = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const ligacoes: { mlbId: string; idItem: number }[] = (req.body?.ligacoes || [])
    .map((l: any) => ({ mlbId: String(l?.mlbId || '').trim().toUpperCase(), idItem: Number(l?.idItem) }))
    .filter((l: any) => /^MLB\d+$/.test(l.mlbId) && l.idItem > 0);
  const connection = await pool.getConnection();
  try {
    if (ligacoes.length === 0) throw new ErroML('Escolha ao menos um anúncio e o item do ERP.');
    const repetidos = ligacoes.filter((l, k) => ligacoes.findIndex(x => x.idItem === l.idItem) !== k);
    if (repetidos.length) throw new ErroML('O mesmo item do ERP foi escolhido para dois anúncios do ML.');
    const conn = connection as unknown as Conn;
    const idsItens = ligacoes.map(l => l.idItem);
    const [ocupados] = await conn.execute(
      `SELECT ai.id_item, ai.id_anuncio, COALESCE(cpd.sku_customizado, ic.sku) AS sku
       FROM modulo_ecommerce_mercadolivre_anuncios_itens ai
       INNER JOIN itens_core ic ON ic.id_item = ai.id_item
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ai.id_item AND cpd.tenant_id = ai.tenant_id
       WHERE ai.tenant_id = ? AND ai.id_item IN (${lista(idsItens)})`,
      [tenant, ...idsItens]
    );
    if (ocupados.length) throw new ErroML(`${ocupados[0].sku} já está no anúncio #${ocupados[0].id_anuncio} do ERP: exclua o rascunho ou escolha outro item.`, 409);

    const itensMl = await lerItensMl(tenant, ligacoes.map(l => l.mlbId));
    const porMlb = new Map(itensMl.map(b => [String(b.id), b]));
    const grupos = new Map<string, { mlbId: string; idItem: number; b: any }[]>();
    for (const l of ligacoes) {
      const b = porMlb.get(l.mlbId);
      if (!b) throw new ErroML(`Não achei ${l.mlbId} na sua conta do ML.`, 404);
      const chave = `${b.category_id}|${(b.family_name || b.id).toLowerCase()}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push({ ...l, b });
    }

    await connection.beginTransaction();
    const criados: number[] = [];
    for (const grupo of grupos.values()) {
      const b0 = grupo[0].b;
      const status = grupo.map(g => String(g.b.status));
      const situacao = status.some(s => SITUACAO_POR_STATUS[s] === 'PUBLICADO') ? 'PUBLICADO'
        : status.some(s => SITUACAO_POR_STATUS[s] === 'PAUSADO') ? 'PAUSADO' : 'ENCERRADO';
      const caminho = await carregarCategoria(tenant, b0.category_id).then(c => c.caminho).catch(() => null);
      const descricao = await ml(tenant, 'GET', `/items/${b0.id}/description`).then((d: any) => d?.plain_text || null).catch(() => null);
      const atributos: Record<string, ValorAtributo> = {};
      for (const a of b0.attributes || []) {
        if (ATRIBUTOS_NAO_IMPORTAR.test(a.id) || !a.value_name) continue;
        atributos[a.id] = { origem: 'fixo', valor: String(a.value_name), valorId: a.value_id ? String(a.value_id) : null };
      }
      const [ins] = await conn.execute(
        `INSERT INTO modulo_ecommerce_mercadolivre_anuncios
           (tenant_id, titulo, categoria_ml, categoria_ml_nome, tipo_anuncio, condicao, descricao, atributos, situacao, mlb_id, status_ml, permalink, sincronizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [tenant, cortarTitulo(b0.family_name || b0.title), b0.category_id, caminho, b0.listing_type_id || 'gold_special',
          b0.condition === 'used' ? 'used' : 'new', descricao, JSON.stringify(atributos), situacao, b0.id, b0.status, b0.permalink]
      );
      const idAnuncio = Number(ins.insertId);
      let ordem = 0;
      for (const g of grupo) {
        // o preço que está no ML fica como preço próprio do item (o ERP não muda o preço sozinho)
        await conn.execute(
          `INSERT INTO modulo_ecommerce_mercadolivre_anuncios_itens
             (id_anuncio, tenant_id, id_item, ordem, mlb_id, status_ml, permalink, preco, preco_enviado, estoque_enviado, sincronizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [idAnuncio, tenant, g.idItem, ordem++, g.b.id, g.b.status, g.b.permalink, Number(g.b.price) || null, Number(g.b.price) || null, Number(g.b.available_quantity) || 0]
        );
      }
      criados.push(idAnuncio);
    }
    await connection.commit();
    return res.status(201).json({ ids: criados, ligados: ligacoes.length });
  } catch (error) {
    await connection.rollback().catch(() => null);
    return responderErro(res, error, 'Erro ao importar do Mercado Livre.');
  } finally {
    connection.release();
  }
};

