// Central de sugestões do ML: para cada linha ativa dos anúncios, o que dá para mudar para custar menos ou lucrar mais.
// Usa a mesma conta de preço e frete da aba Preço e lucro (conferida com o painel do ML); peso e medidas da embalagem
// vêm do anúncio no ML quando publicado e do cadastro do ERP quando ainda não.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { ItemAnuncio, precoNoMl } from './anuncios';
import { AnuncioCarregado, carregarAnuncios, responderErro, tenantDe } from './anuncios.controller';
import { contextoVenda } from './precificacao.controller';
import { freteDoEnvio, preferenciasEnvio } from './freteMl';
import { valorNaTabelaDeFrete } from './custosMl';
import { ml } from './mercadolivreApi';
import { foraDoMl } from './anuncios';
import { siglaDoKit } from './formasVenda';
import {
  Caixa, faixasAbaixo, lerMedidaMl, ordenarSugestoes, pesoVolumetrico, Sugestao, sugestaoCadastro, sugestaoCaixa, sugestaoFreteGratis,
  sugestaoFrete19, sugestaoKit, sugestaoPeso, sugestaoPreco, unidadesParaPassar79,
} from './sugestoes';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
type Embalagem = { pesoG: number | null; caixa: Caixa | null };

/** Peso e medidas da embalagem como estão nos anúncios do ML (atributos SELLER_PACKAGE_*). */
const embalagensNoMl = async (tenant: number, mlbs: string[]) => {
  const mapa = new Map<string, Embalagem>();
  for (let k = 0; k < mlbs.length; k += 20) {
    const parte: any[] = await ml(tenant, 'GET', `/items?ids=${mlbs.slice(k, k + 20).join(',')}&attributes=id,attributes`).catch(() => []);
    for (const r of parte || []) {
      const b = r?.body;
      if (!b?.id) continue;
      const at = (id: string) => lerMedidaMl((b.attributes || []).find((a: any) => a.id === id)?.value_name);
      const [a, l, c] = [at('SELLER_PACKAGE_HEIGHT'), at('SELLER_PACKAGE_WIDTH'), at('SELLER_PACKAGE_LENGTH')];
      mapa.set(String(b.id), { pesoG: at('SELLER_PACKAGE_WEIGHT'), caixa: a && l && c ? { altura: a, largura: l, comprimento: c } : null });
    }
  }
  return mapa;
};

const sugestoesDaLinha = async (tenant: number, c: AnuncioCarregado, item: ItemAnuncio, noMl: Embalagem | null): Promise<Sugestao[]> => {
  const b = { idAnuncio: Number(c.registro.id), idLinha: item.idLinha, sku: item.sku };
  const ctx = await contextoVenda(tenant, c, item);
  const preco = precoNoMl(item, c.dados.ajustePreco);
  if (!(preco > 0)) return [];
  const l = await ctx.avaliar(preco);
  const saida: (Sugestao | null)[] = [];

  // frete grátis ligado abaixo de R$ 79
  if (ctx.freteGratis) saida.push(sugestaoFreteGratis(b, { preco, freteComGratis: await ctx.freteDe(preco, 1, true), freteSemGratis: await ctx.freteDe(preco, 1, false) }));

  // embalagem: a do ML (publicado) ou a do cadastro (a do kit no cadastro é de uma unidade: só o peso multiplica)
  const fator = item.unidadeMl && item.unidadeMl.fator > 1 ? item.unidadeMl.fator : 1;
  const caixa = noMl?.caixa ?? (item.medidasCm && fator === 1 ? item.medidasCm : null);
  const pesoReal = noMl?.pesoG ?? (item.pesoKg ? Math.round(item.pesoKg * 1000 * fator) : null);
  const valorTabela = valorNaTabelaDeFrete(preco, ctx.freteGratis);
  const freteNoPeso = async (g: number) => (await freteDoEnvio(tenant, { pesoG: g, valorCompra: valorTabela, tipo: ctx.tipo, logistica: ctx.logistica }))?.valor ?? null;
  const pagaPorVolume = !!caixa && !!pesoReal && pesoVolumetrico(caixa) > pesoReal;
  if (caixa && pesoReal && pagaPorVolume) {
    saida.push(sugestaoCaixa(b, { caixa, pesoRealG: pesoReal, freteNoVolume: await freteNoPeso(pesoVolumetrico(caixa)), freteNoPeso: await freteNoPeso(pesoReal) }));
  } else if (ctx.peso) {
    // peso perto de uma faixa mais barata (quando a caixa já paga pelo peso)
    const cobrado = ctx.peso.pesoG;
    const faixas = [];
    for (const t of faixasAbaixo(cobrado)) faixas.push({ pesoG: t, frete: await freteNoPeso(t) });
    saida.push(sugestaoPeso(b, { pesoG: cobrado, frete: await freteNoPeso(cobrado), faixas }));
  }

  // kit que passa de R$ 79 (só a partir da linha da unidade)
  const n = !item.unidadeMl ? unidadesParaPassar79(preco) : null;
  const pesoUnidadeKg = item.pesoKg ?? (noMl?.pesoG ? noMl.pesoG / 1000 : null);
  if (n && pesoUnidadeKg && !c.itens.some(i => i.idItem === item.idItem && i.unidadeMl?.fator === n)) {
    const precoKit = r2(preco * n);
    const kit: ItemAnuncio = {
      ...item, idLinha: -n, linhaAtiva: true, precoMl: null, preco: precoKit, pesoKg: pesoUnidadeKg, medidasCm: null,
      unidadeMl: { idUnidade: 0, sigla: siglaDoKit(n), nome: `Kit c/${n}`, fator: n, preco: null },
    };
    const lk = await (await contextoVenda(tenant, c, kit)).avaliar(precoKit);
    if (!lk.freteDesconhecido) saida.push(sugestaoKit(b, { preco, unidades: n, lucroUnitario: l.lucro, lucroDoKit: lk.lucro, precoKit }));
  }

  // degrau dos R$ 19: subir um pouco e o comprador ganha frete grátis sem você ganhar menos
  const d19 = preco < 19 ? await ctx.degrau19(l.lucro) : null;
  if (d19) saida.push(sugestaoFrete19(b, { preco, freteGratis: ctx.freteGratis, ...d19 }));

  // preço abaixo do alvo ou prejuízo
  const precoAlvo = await ctx.precoAlvoDe(preco, l.frete);
  const noAlvo = precoAlvo !== null ? await ctx.avaliar(precoAlvo) : null;
  saida.push(sugestaoPreco(b, { preco, lucro: l.lucro, pct: l.lucroSobreCustoPct, nivel: l.nivel, precoAlvo, lucroNoAlvo: noAlvo?.lucro ?? null, alvoPct: ctx.alvo.alvoPct }));

  // peso e medidas do cadastro x ML
  saida.push(sugestaoCadastro(b, {
    pesoErpG: item.pesoKg ? Math.round(item.pesoKg * 1000) : null,
    caixaErp: item.medidasCm ? { altura: item.medidasCm.altura, largura: item.medidasCm.largura, comprimento: item.medidasCm.comprimento } : null,
    pesoMlG: noMl?.pesoG ?? null, caixaMl: noMl?.caixa ?? null,
  }));
  return saida.filter((s): s is Sugestao => !!s);
};

/** GET /anuncios/sugestoes?id= — sugestões de todos os anúncios (ou de um), mais economia primeiro. */
export const listarSugestoes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.query.id) || undefined;
    const anuncios = (await carregarAnuncios(pool as any, tenant, id)).filter(c => c.dados.categoriaMl && c.itens.length);
    const mlbs = anuncios.flatMap(c => [...c.noMl.values()].map(m => m.mlbId).filter((x): x is string => !!x));
    const embalagens = mlbs.length ? await embalagensNoMl(tenant, mlbs) : new Map<string, Embalagem>();
    const todas: Sugestao[] = [];
    for (const c of anuncios) {
      // as linhas de um anúncio em paralelo (cada uma consulta o frete no ML)
      const partes = await Promise.all(c.itens.map(async item => {
        const m = c.noMl.get(item.idLinha);
        if (item.linhaAtiva === false || (m?.mlbId && foraDoMl(m.status))) return [];
        try { return await sugestoesDaLinha(tenant, c, item, m?.mlbId ? embalagens.get(m.mlbId) || null : null); }
        catch { return []; /* linha sem dado suficiente: sem sugestão */ }
      }));
      todas.push(...partes.flat());
    }
    const titulos = Object.fromEntries(anuncios.map(c => [Number(c.registro.id), c.dados.titulo || `Anúncio #${c.registro.id}`]));
    return res.json({ sugestoes: ordenarSugestoes(todas), titulos });
  } catch (error) {
    return responderErro(res, error, 'Erro ao montar as sugestões.');
  }
};

/** GET /frete/faixas — quanto o ML cobra do vendedor por faixa de peso hoje (para o guia de frete). */
export const faixasDeFrete = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const { logistica } = await preferenciasEnvio(tenant);
    const custo = async (g: number, valor: number) => (await freteDoEnvio(tenant, { pesoG: g, valorCompra: valor, tipo: 'gold_special', logistica }))?.valor ?? null;
    const linhas = [];
    for (const g of [100, 300, 500, 1000, 2000, 5000]) {
      linhas.push({ ateG: g, gratisAbaixo79: await custo(g, 79), compradorPaga20: await custo(g, 20), compradorPaga50: await custo(g, 50), acima79: await custo(g, 100) });
    }
    return res.json({ logistica, linhas });
  } catch (error) {
    return responderErro(res, error, 'Erro ao ler as faixas de frete.');
  }
};
