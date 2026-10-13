// Catálogo do ML pelo ERP: para cada item publicado, se pode entrar no catálogo, os produtos que combinam
// e, para quem já está lá, a disputa pelo botão de compra (ganhando, preço para ganhar, oportunidades).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarAnuncios, responderErro, tenantDe } from './anuncios.controller';
import { AnuncioDados, AtributoML, ItemAnuncio, resolverValor } from './anuncios';
import { conferirCandidato, ELEGIBILIDADE, lerDisputa, ordenarCandidatos } from './catalogo';
import { ErroML, ml } from './mercadolivreApi';

const ativoNoMl = (status: string | null) => status !== 'closed' && status !== 'deleted';

/** Anúncio de catálogo ligado ao item tradicional (item_relations), quando houver. */
const anuncioDeCatalogo = async (tenant: number, mlb: string) => {
  const it: any = await ml(tenant, 'GET', `/items/${mlb}?attributes=id,catalog_listing,item_relations,catalog_product_id`).catch(() => null);
  if (it?.catalog_listing) return { mlbCatalogo: mlb, produtoId: it.catalog_product_id || null };
  const rel = (it?.item_relations || []).find((r: any) => r?.id);
  return rel ? { mlbCatalogo: String(rel.id), produtoId: it?.catalog_product_id || null } : null;
};

/** Produtos do catálogo que podem ser o item: pelo código de barras; sem ele, por marca + título no domínio. */
type ValoresItem = Record<string, { valor: string; unidade: string | null } | null>;

/** Valores do item nos atributos do ML (os que o anúncio liga), para comparar com o produto do catálogo. */
const valoresDoItem = (atributos: AtributoML[], dados: AnuncioDados, item: ItemAnuncio): ValoresItem =>
  Object.fromEntries(atributos.map(a => {
    const v = resolverValor(a, dados.atributos[a.id], item);
    return [a.id, v ? { valor: v.valor, unidade: v.unidade } : null];
  }));

const buscarCandidatos = async (tenant: number, dominio: string | null, item: { gtin: string | null; marca: string | null; titulo: string; valores: ValoresItem }) => {
  const base = `/products/search?status=active&site_id=MLB&limit=6${dominio ? `&domain_id=${dominio}` : ''}`;
  let r: any = null;
  if (item.gtin) r = await ml(tenant, 'GET', `${base}&product_identifier=${encodeURIComponent(item.gtin)}`).catch(() => null);
  if (!r?.results?.length) {
    const q = [item.marca && !/^(sem marca|gen[eé]ric[ao])$/i.test(item.marca) ? item.marca : '', item.titulo].filter(Boolean).join(' ');
    r = await ml(tenant, 'GET', `${base}&q=${encodeURIComponent(q.slice(0, 120))}`).catch(() => null);
  }
  const candidatos: ReturnType<typeof conferirCandidato>[] = (r?.results || []).map((p: any) => conferirCandidato(p, item));
  return ordenarCandidatos(candidatos);
};

/** GET /anuncios/:id/catalogo — situação de cada item publicado no catálogo do ML */
export const verificarCatalogo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    if (!c) throw new ErroML('Anúncio não encontrado.', 404);
    const publicados = c.itens.filter(i => { const m = c.noMl.get(i.idItem); return m?.mlbId && ativoNoMl(m.status); });
    if (!publicados.length) throw new ErroML('Publique o anúncio primeiro: o catálogo é verificado sobre o anúncio que já está no ML.');

    const mlbs = publicados.map(i => c.noMl.get(i.idItem)!.mlbId!);
    const elegibilidade = new Map<string, any>();
    for (let k = 0; k < mlbs.length; k += 20) {
      const r: any = await ml(tenant, 'GET', `/multiget/catalog_listing_eligibility?ids=${mlbs.slice(k, k + 20).join(',')}`).catch(() => []);
      for (const e of Array.isArray(r) ? r : []) {
        const corpo = e?.body || e;
        if (corpo?.id) elegibilidade.set(String(corpo.id), corpo);
      }
    }

    const itens = [];
    for (const item of publicados) {
      const mlb = c.noMl.get(item.idItem)!.mlbId!;
      const e = elegibilidade.get(mlb) || await ml(tenant, 'GET', `/items/${mlb}/catalog_listing_eligibility`).catch(() => null);
      const status = String(e?.status || '');
      let disputa = null;
      let candidatos: ReturnType<typeof conferirCandidato>[] = [];
      let mlbCatalogo: string | null = null;
      if (status === 'COMPETING' || status === 'ALREADY_OPTED_IN') {
        const cat = await anuncioDeCatalogo(tenant, mlb);
        mlbCatalogo = cat?.mlbCatalogo || null;
        if (mlbCatalogo) disputa = lerDisputa(await ml(tenant, 'GET', `/items/${mlbCatalogo}/price_to_win?siteId=MLB&version=v2`).catch(() => null));
      } else if (status === 'READY_FOR_OPTIN') {
        candidatos = await buscarCandidatos(tenant, e?.domain_id || null, {
          gtin: item.gtin, marca: item.marca, titulo: item.tituloMl || item.nome, valores: valoresDoItem(c.categoria?.atributos || [], c.dados, item),
        });
      }
      itens.push({
        idItem: item.idItem, sku: item.sku, mlbId: mlb, preco: item.precoMl ?? null, gtin: item.gtin, marca: item.marca,
        elegibilidade: status || null, elegibilidadeTexto: ELEGIBILIDADE[status]?.texto || (status ? status : 'Sem resposta do ML'),
        podeDisputar: Boolean(e?.buy_box_eligible), mlbCatalogo, disputa, candidatos,
      });
    }
    return res.json({ itens });
  } catch (error) {
    return responderErro(res, error, 'Erro ao verificar o catálogo do Mercado Livre.');
  }
};

/** POST /anuncios/:id/itens/:idItem/catalogo { produtoId } — entra no catálogo com o anúncio tradicional (optin) */
export const entrarNoCatalogo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const produtoId = String(req.body?.produtoId || '').trim().toUpperCase();
    if (!/^MLB\d+$/.test(produtoId)) throw new ErroML('Escolha o produto do catálogo.');
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    const item = c?.itens.find(i => i.idItem === Number(req.params.idItem));
    const mlb = item ? c!.noMl.get(item.idItem)?.mlbId : null;
    if (!item || !mlb) throw new ErroML('Item não publicado no ML.', 404);
    const e: any = await ml(tenant, 'GET', `/items/${mlb}/catalog_listing_eligibility`);
    if (e?.status !== 'READY_FOR_OPTIN') throw new ErroML(`O ML diz que este item não pode entrar agora: ${ELEGIBILIDADE[e?.status]?.texto || e?.status || 'sem resposta'}.`);
    // confere de novo a marca/código de barras do produto escolhido (produto de outra marca gera reclamação)
    const produto: any = await ml(tenant, 'GET', `/products/${produtoId}`);
    const conferencia = conferirCandidato(produto, { marca: item.marca, gtin: item.gtin, valores: valoresDoItem(c!.categoria?.atributos || [], c!.dados, item) });
    if (!conferencia.podeEntrar) {
      throw new ErroML(conferencia.diferentes.length
        ? `O produto "${conferencia.nome}" não é o mesmo item: ${conferencia.diferentes.map(x => `${x.nome} ${x.catalogo} no catálogo x ${x.item} no seu`).join('; ')}.`
        : `O produto "${conferencia.nome}" é da marca ${conferencia.marca || '—'} e o item é ${item.marca || 'sem marca'}: entrar nele geraria reclamação.`);
    }
    const criado: any = await ml(tenant, 'POST', '/items/catalog_listings', { item_id: mlb, catalog_product_id: produtoId });
    return res.json({ mlbCatalogo: criado?.id || null, permalink: criado?.permalink || null });
  } catch (error) {
    return responderErro(res, error, 'Erro ao entrar no catálogo do Mercado Livre.');
  }
};
