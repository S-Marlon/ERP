// Preço por quantidade (% B2B) no ML: envio das faixas do anúncio para cada item publicado e consulta
// do que o ML recomenda / do que já está lá.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ItemAnuncio, precoNoMl } from './anuncios';
import { AnuncioCarregado, carregarAnuncios, responderErro, tenantDe } from './anuncios.controller';
import { corpoFaixas, FaixaQuantidade, faixasDaLinha, faixasDoMl, lerFaixas } from './faixasQuantidade';
import { ErroML, ml } from './mercadolivreApi';

const versaoDosPrecos = async (tenant: number, mlb: string) => {
  const r: any = await ml(tenant, 'GET', `/items/${mlb}/prices?display_version=true`, undefined, { 'show-all-prices': 'true' });
  return { versao: r?.version, precos: r };
};

/** Recomendação do ML para as quantidades (obrigatória antes de gravar). 204 = sem recomendação (vale qualquer faixa). */
export const recomendacoes = async (tenant: number, mlb: string, preco: number, quantidades: number[]) => {
  const r: any = await ml(tenant, 'POST', '/prices-per-quantity/v1/recommendations', {
    item_id: mlb, range_item_quantities: quantidades.slice(0, 5), price: { standard_amount: preco, currency: 'BRL' },
  });
  return (r?.recommendations || []).map((x: any) => ({
    quantidade: Number(x.quantity), desconto: Math.round(Number(x?.discount?.percentage || 0) * 100) / 100,
    preco: Number(x.amount), incoerente: Boolean(x.is_incoherent_quantity),
  }));
};

/**
 * Escada que vale para a linha: a própria da forma; senão, a do anúncio na unidade e nenhuma no kit. null = nada definido
 * no ERP (nem no anúncio nem na forma): o ERP não mexe na escada que estiver no ML.
 */
export const faixasEfetivas = (c: AnuncioCarregado, item: ItemAnuncio): FaixaQuantidade[] | null => {
  const propria = item.faixasProprias ?? null;
  const doAnuncio = c.registro.faixas_quantidade === null || c.registro.faixas_quantidade === undefined ? null : lerFaixas(c.registro.faixas_quantidade);
  if (propria === null && doAnuncio === null) return null;
  return faixasDaLinha(doAnuncio || [], item.unidadeMl?.fator || 1, propria);
};

/** Manda as faixas para um item publicado (lista vazia apaga as faixas de empresa do item). */
export const enviarFaixas = async (tenant: number, mlb: string, faixas: FaixaQuantidade[], preco: number) => {
  if (faixas.length) {
    const rec = await recomendacoes(tenant, mlb, preco, faixas.map(f => f.minimo));
    const ruins = rec.filter((r: { incoerente: boolean }) => r.incoerente).map((r: { quantidade: number }) => r.quantidade);
    if (ruins.length) throw new ErroML(`O Mercado Livre não aceita faixa a partir de ${ruins.join(', ')} un. para este item (fica mais cara que a anterior com o frete). Ajuste as faixas.`);
  }
  const { versao } = await versaoDosPrecos(tenant, mlb);
  await ml(tenant, 'POST', `/items/${mlb}/prices/price-per-quantity`, corpoFaixas(faixas), { 'X-Version': String(versao ?? '') });
};

/**
 * Envia as faixas do anúncio aos itens já publicados e ativos/pausados: a forma unidade recebe a escada; o kit recebe
 * escada vazia (apaga a que estiver lá: a quantidade do kit conta em kits). Devolve as falhas por SKU.
 */
export const enviarFaixasDoAnuncio = async (tenant: number, c: AnuncioCarregado) => {
  const falhas: string[] = [];
  for (const item of c.itens) {
    const m = c.noMl.get(item.idLinha);
    if (!m?.mlbId || m.status === 'closed' || m.status === 'deleted') continue;
    const faixas = faixasEfetivas(c, item);
    if (faixas === null) continue;   // nada definido no ERP: não mexe na escada que estiver no ML
    try { await enviarFaixas(tenant, m.mlbId, faixas, precoNoMl(item, c.dados.ajustePreco)); }
    catch (e: any) { falhas.push(`${item.sku}: ${e?.message || 'erro'}`); }
  }
  return falhas;
};

/**
 * GET /anuncios/:id/faixas/ml — o que o ML já tem no primeiro item publicado e a recomendação dele para as
 * quantidades informadas (?quantidades=5,10,24,48,100).
 */
export const faixasNoMl = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    if (!c) throw new ErroML('Anúncio não encontrado.', 404);
    const item = c.itens.find(i => { const m = c.noMl.get(i.idLinha); return m?.mlbId && m.status !== 'closed' && m.status !== 'deleted'; });
    if (!item) throw new ErroML('Publique o anúncio primeiro: a sugestão do ML é calculada sobre um anúncio que já está lá.');
    const mlb = c.noMl.get(item.idLinha)!.mlbId!;
    const preco = precoNoMl(item, c.dados.ajustePreco);
    const quantidades = String(req.query.quantidades || '5,10,24,48,100').split(',').map(Number).filter(n => Number.isInteger(n) && n >= 2 && n <= 100);
    const [{ precos }, sugestao] = await Promise.all([
      versaoDosPrecos(tenant, mlb),
      recomendacoes(tenant, mlb, preco, quantidades).catch((e: any) => { throw new ErroML(`Sugestão do ML: ${e?.message || 'erro'}`); }),
    ]);
    return res.json({ mlbId: mlb, sku: item.sku, preco, noMl: faixasDoMl(precos), sugestao });
  } catch (error) {
    return responderErro(res, error, 'Erro ao consultar o preço por quantidade no Mercado Livre.');
  }
};
