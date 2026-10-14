// Preço e lucro no ML de um item do anúncio: lucro depois da tarifa, preço mínimo para o alvo, comparação com o
// mercado (produtos parecidos do catálogo, por unidade), diferença para o preço da loja e as faixas por quantidade.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { alvoEfetivo } from '../../../areas/compras/inteligente/margemAlvo';
import { carregarComposicoes, carregarDadosComponentes } from '../../../areas/catalogo/kits/kitsBanco';
import { custoDoKit } from '../../../areas/catalogo/kits/kits';
import { ItemAnuncio, normalizar, precoNoMl, resolverValor } from './anuncios';
import { AnuncioCarregado, carregarAnuncios, responderErro, taxaMl, tenantDe } from './anuncios.controller';
import { lerFaixas } from './faixasQuantidade';
import { compararAtributos } from './catalogo';
import {
  classificarLucro, classificarPreco, conselhos, estatisticas, lucroNoMl, precoParaAlvo, Tarifa, unidadesDoProduto,
} from './precificacao';
import { ErroML, ml } from './mercadolivreApi';
import { acharLimiteTaxaFixa, alertasDePreco, avisosDeDegrau, LIMITE_FRETE_GRATIS, precoQueCompensaFrete, montarCenarios, quantidadesParaAnalise, resultadoVenda, vendedorPagaFrete } from './custosMl';
import { freteDoEnvio, freteGratisNoMl, pesoCobrado, preferenciasEnvio } from './freteMl';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

/** Custo da unidade base do item (custo médio do estoque; sem ele, o gerencial). Kit: soma dos componentes. */
const custoBase = async (tenant: number, idItem: number) => {
  const kits = await carregarComposicoes(pool as any, tenant, [idItem]);
  const comps = kits.get(idItem);
  if (comps?.length) return custoDoKit(comps, await carregarDadosComponentes(pool as any, tenant, comps.map(c => c.idItem)));
  const [[r]]: any = await pool.execute(
    `SELECT COALESCE(NULLIF(es.custo_medio, 0), cpd.custo_gerencial, 0) AS custo
     FROM itens_core ic
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
     WHERE ic.id_item = ? AND ic.tenant_id = ?`,
    [idItem, tenant]
  );
  return Number(r?.custo) || 0;
};

// Mercado: produtos parecidos do catálogo (cache de 1 h por busca, a pesquisa faz várias chamadas)
const cacheMercado = new Map<string, { em: number; valor: Promise<any[]> }>();
const IGNORAR_NO_MERCADO = new Set(['UNITS_PER_PACK', 'UNITS_PER_PACKAGE', 'SALE_FORMAT', 'IS_KIT', 'COLOR', 'MAIN_COLOR', 'LENGTH_UNIT']);
type Referencia = Record<string, { valor: string; unidade: string | null } | null>;

/** Produto parecido o bastante para servir de referência: nenhuma medida diferente e o mesmo tipo (*_TYPE). */
const mesmoProduto = (p: any, ref: Referencia) => {
  const r = compararAtributos(p.attributes || [], ref, IGNORAR_NO_MERCADO);
  const tipoDiferente = r.conferir.some(x => (p.attributes || []).find((a: any) => (a.name || a.id) === x.nome && /_TYPE$/.test(a.id)));
  return r.diferentes.length === 0 && !tipoDiferente;
};

const pesquisarMercado = (tenant: number, dominio: string | null, q: string, meuVendedor: number | null, ref: Referencia) => {
  const chave = `${dominio}|${normalizar(q)}|${JSON.stringify(ref)}`;
  const guardado = cacheMercado.get(chave);
  if (guardado && Date.now() - guardado.em < 60 * 60 * 1000) return guardado.valor;
  const valor = (async () => {
    const r: any = await ml(tenant, 'GET', `/products/search?status=active&site_id=MLB&limit=20${dominio ? `&domain_id=${dominio}` : ''}&q=${encodeURIComponent(q.slice(0, 120))}`);
    const produtos = [];
    for (const p of r?.results || []) {
      if (!mesmoProduto(p, ref)) continue;
      const at = (id: string) => p.attributes?.find((a: any) => a.id === id)?.value_name;
      const det: any = await ml(tenant, 'GET', `/products/${p.id}`).catch(() => null);
      let preco: number | null = det?.buy_box_winner?.price ?? null;
      let fonte = 'ganhador';
      if (preco === null) {
        const ofertas: any = await ml(tenant, 'GET', `/products/${p.id}/items?limit=10`).catch(() => null);
        const deOutros = (ofertas?.results || []).filter((o: any) => !meuVendedor || Number(o.seller_id) !== meuVendedor);
        preco = deOutros.length ? Math.min(...deOutros.map((o: any) => Number(o.price))) : null;
        fonte = 'menor oferta';
      } else if (meuVendedor && Number(det?.buy_box_winner?.seller_id) === meuVendedor) {
        continue;   // a página que eu mesmo ganho não é referência de mercado
      }
      if (!(preco && preco > 0)) continue;
      const unidades = unidadesDoProduto(at('UNITS_PER_PACK') || at('UNITS_PER_PACKAGE'), p.name);
      produtos.push({ produtoId: p.id, nome: p.name, marca: at('BRAND') || null, unidades, preco: r2(preco), porUnidade: r2(preco / unidades), fonte });
    }
    return produtos;
  })();
  valor.catch(() => cacheMercado.delete(chave));
  cacheMercado.set(chave, { em: Date.now(), valor });
  return valor;
};

const cacheLimiteFixa = new Map<string, { em: number; valor: Promise<number | null> }>();

/** Tudo o que entra no custo de uma venda do item no ML: custo do ERP, alvo, tarifa, frete grátis (com o peso cobrado). */
export const contextoVenda = async (
  tenant: number, c: AnuncioCarregado, item: ItemAnuncio, op: { informado?: number | null; alvoPadrao?: number } = {}
) => {
  const tipo: string = c.registro.tipo_anuncio;
  const informado = op.informado ?? null;
  // custo da unidade vendida no ML (pacote = custo base × fator)
  const fator = item.unidadeMl?.fator || 1;
  const custo = r2((await custoBase(tenant, item.idItem)) * fator);
  const [[fam]]: any = await pool.execute(
    `SELECT f.margem_minima FROM comercial_produtos_dados cpd LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
     WHERE cpd.id_item = ? AND cpd.tenant_id = ?`, [item.idItem, tenant]
  );
  const alvo = alvoEfetivo(fam?.margem_minima !== null && fam?.margem_minima !== undefined ? Number(fam.margem_minima) : null, op.alvoPadrao ?? 30);

  const tarifaDe = async (preco: number, tipoAnuncio = tipo): Promise<Tarifa> => {
    const t = await taxaMl(tenant, r2(preco), c.dados.categoriaMl!, tipoAnuncio);
    return { comissaoPct: t?.percentual ?? (tipoAnuncio === 'gold_pro' ? 17 : 12), fixa: t?.fixa ?? 0 };
  };

  // frete grátis: ligado no anúncio publicado (ou o padrão da conta), peso cobrado e o custo por valor de compra
  const mlb = c.noMl.get(item.idItem)?.mlbId || null;
  const pref = await preferenciasEnvio(tenant).catch(() => null);
  const noMlEnvio = mlb ? await freteGratisNoMl(tenant, mlb) : null;
  const freteGratis = noMlEnvio ? noMlEnvio.gratis : pref?.freteGratisPadrao ?? true;
  const logistica = noMlEnvio?.logistica || pref?.logistica || 'drop_off';
  const peso = pref ? await pesoCobrado(tenant, { mlbId: mlb, pesoKg: item.pesoKg, medidasCm: item.medidasCm, fator }).catch(() => null) : null;
  const envioDe = (valorCompra: number, quantidade = 1, tipoAnuncio = tipo) =>
    (peso ? freteDoEnvio(tenant, { pesoG: peso.pesoG * quantidade, valorCompra, tipo: tipoAnuncio, logistica }) : Promise.resolve(null));
  /** Frete que o vendedor paga numa compra (0 quando o comprador paga; null quando não deu para saber). */
  const freteDe = async (valorCompra: number, quantidade = 1, gratis = freteGratis) => {
    if (!vendedorPagaFrete(valorCompra, gratis)) return 0;
    if (informado !== null) return informado * quantidade;
    return (await envioDe(valorCompra, quantidade))?.valor ?? null;
  };
  const avaliar = async (preco: number) => {
    const frete = await freteDe(preco);
    const l = lucroNoMl({ preco, custo, tarifa: await tarifaDe(preco), frete: frete ?? 0 });
    return { ...l, freteDesconhecido: frete === null, nivel: classificarLucro(custo > 0 ? l.lucroSobreCustoPct : null, alvo.alvoPct) };
  };
  /**
   * Menor preço que dá o alvo sobre o custo. Tarifa (taxa fixa de item barato) e frete mudam com o preço, então recalcula
   * até firmar e confere o resultado; no degrau da taxa fixa a conta oscila e o mínimo real é o próprio limite.
   */
  const precoAlvoDe = async (precoAtual: number, freteAtual: number) => {
    if (!(custo > 0)) return null;
    let p = precoAtual;
    let frete = freteAtual;
    for (let k = 0; k < 6; k++) {
      const n = precoParaAlvo({ custo, tarifa: await tarifaDe(p), frete, alvoPct: alvo.alvoPct });
      if (n === null) return null;
      const f = (await freteDe(n)) ?? frete;
      const firmou = Math.abs(n - p) < 0.005 && f === frete;
      p = n;
      frete = f;
      if (firmou) break;
    }
    const atinge = async (x: number) => ((await avaliar(x)).lucroSobreCustoPct ?? -Infinity) >= alvo.alvoPct - 0.05;
    const limite = await limiteTaxaFixa();
    // acima do limite o lucro só cresce com o preço: se o limite já dá o alvo, ele é o mínimo
    if (limite !== null && p > limite && await atinge(limite)) return limite;
    if (await atinge(p)) return p;
    if (limite !== null && limite > p && await atinge(limite)) return limite;
    // ainda abaixo: sobe de 1 em 1% até atingir (casos raros de degrau)
    for (let x = p, k = 0; k < 60; k++) { x = r2(x * 1.01); if (await atinge(x)) return x; }
    return p;
  };
  /** Centavo exato em que a taxa fixa de item barato some (por categoria e tipo; guardado por 6 h). */
  const limiteTaxaFixa = () => {
    const chave = `${tenant}|${c.dados.categoriaMl}|${tipo}`;
    const g = cacheLimiteFixa.get(chave);
    if (g && Date.now() - g.em < 6 * 60 * 60 * 1000) return g.valor;
    const valor = acharLimiteTaxaFixa(async p => (await tarifaDe(p)).fixa).catch(() => null);
    cacheLimiteFixa.set(chave, { em: Date.now(), valor });
    return valor;
  };
  /** Avisos de degrau no preço: taxa fixa (com o lucro no limite) e o frete grátis a partir de R$ 79. */
  const alertasDe = async (preco: number, l: { lucro: number; lucroSobreCustoPct: number | null; frete: number }) => {
    const limite = await limiteTaxaFixa();
    const fixa = (await tarifaDe(preco)).fixa;
    let taxaFixa: Parameters<typeof alertasDePreco>[0]['taxaFixa'] = null;
    if (limite !== null) {
      const noLimite = preco < limite ? await avaliar(limite) : null;
      taxaFixa = { limite, fixa, noLimite: noLimite ? { lucro: noLimite.lucro, pct: noLimite.lucroSobreCustoPct } : null };
    }
    let frete: Parameters<typeof alertasDePreco>[0]['frete'] = null;
    if (preco >= LIMITE_FRETE_GRATIS && preco <= LIMITE_FRETE_GRATIS * 1.15) {
      const ab = await avaliar(78.9);
      frete = { abaixo: ab.freteDesconhecido ? null : { lucro: ab.lucro, pct: ab.lucroSobreCustoPct }, freteHoje: l.frete, freteAcima: null, compensaAPartir: null };
    } else if (preco < LIMITE_FRETE_GRATIS && preco >= LIMITE_FRETE_GRATIS * 0.8 && (freteGratis || informado !== null)) {
      const acima = await freteDe(LIMITE_FRETE_GRATIS);
      const comissaoPct = (await tarifaDe(preco)).comissaoPct;
      frete = {
        abaixo: null, freteHoje: l.frete, freteAcima: acima,
        compensaAPartir: acima === null ? null : precoQueCompensaFrete({ preco, comissaoPct, freteHoje: l.frete, freteAcima: acima }),
      };
    }
    return alertasDePreco({ preco, lucro: l.lucro, pct: l.lucroSobreCustoPct, taxaFixa, frete });
  };
  return { tipo, fator, custo, alvo, tarifaDe, envioDe, freteDe, avaliar, precoAlvoDe, limiteTaxaFixa, alertasDe, freteGratis, logistica, peso, noMlEnvio };
};

/** GET /anuncios/:id/itens/:idItem/preco?simular=&frete=&alvoPadrao=30 */
export const analisarPreco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    const item = c?.itens.find(i => i.idItem === Number(req.params.idItem));
    if (!c || !item) throw new ErroML('Item não encontrado no anúncio.', 404);
    if (!c.dados.categoriaMl) throw new ErroML('Escolha a categoria do ML primeiro: a tarifa depende dela.');
    // frete informado à mão vale para tudo; sem ele, o frete vem do ML para cada valor de compra
    const informado = req.query.frete !== undefined && req.query.frete !== '' ? Math.max(0, Number(req.query.frete) || 0) : null;
    const alvoPadrao = Math.min(1000, Math.max(0, Number(req.query.alvoPadrao) || 30));
    const ctx = await contextoVenda(tenant, c, item, { informado, alvoPadrao });
    const { tipo, fator, custo, alvo, tarifaDe, envioDe, freteDe, avaliar, freteGratis, logistica, peso, noMlEnvio } = ctx;
    const precoAtual = precoNoMl(item, c.dados.ajustePreco);
    const atual = await avaliar(precoAtual);
    const frete = atual.frete;
    const simular = Number(req.query.simular) > 0 ? Number(req.query.simular) : null;
    const simulado = simular ? await avaliar(simular) : null;
    const tarifaAtual = await tarifaDe(precoAtual);
    const precoAlvo = await ctx.precoAlvoDe(precoAtual, frete);

    const envioAtual = await envioDe(precoAtual);
    const [freteAbaixo, freteAcima] = await Promise.all([envioDe(78.9), envioDe(Math.max(LIMITE_FRETE_GRATIS, precoAtual))]);
    const precoSemFixa = tarifaAtual.fixa > 0 ? await ctx.limiteTaxaFixa() : null;
    const alertas = await ctx.alertasDe(precoAtual, atual);
    const alertasSimulado = simulado && simular ? await ctx.alertasDe(simular, simulado) : [];
    const tarifas = { gold_special: await tarifaDe(precoAtual, 'gold_special'), gold_pro: await tarifaDe(precoAtual, 'gold_pro') };
    const freteSeGratis = informado ?? envioAtual?.valor ?? null;
    const cenarios = montarCenarios({ preco: precoAtual, custoUnit: custo, tarifas, frete: freteSeGratis, tipoAtual: tipo, freteGratisAtual: freteGratis })
      .map(x => ({ ...x, nivel: classificarLucro(custo > 0 ? x.lucroSobreCustoPct : null, alvo.alvoPct) }));
    const degraus = avisosDeDegrau({
      preco: precoAtual, comissaoPct: tarifaAtual.comissaoPct, freteGratis,
      freteAbaixo: informado ?? freteAbaixo?.valor ?? null, freteAcima: informado ?? freteAcima?.valor ?? null,
      tarifaFixa: 0, precoSemFixa,   // a taxa fixa vai nos alertas (com o limite exato e o lucro)
    });

    // quantas unidades vêm no anúncio: atributo do ML (unidades por pacote), unidade do ML, ou o título
    const atributoUnidades = (c.categoria?.atributos || []).find(a => /^UNITS_PER_PACK(AGE)?$/.test(a.id));
    const valorUnidades = atributoUnidades ? resolverValor(atributoUnidades, c.dados.atributos[atributoUnidades.id], item)?.valor : null;
    const unidades = Number(String(valorUnidades ?? '').replace(/\D/g, '')) > 1
      ? Number(String(valorUnidades).replace(/\D/g, ''))
      : fator > 1 ? fator : unidadesDoProduto(null, item.tituloMl || item.nome);
    const porUnidade = r2(precoAtual / unidades);

    // mercado: produtos parecidos do catálogo, no domínio da categoria
    let mercado: any = { produtos: [], estatisticas: null, mesmaMarca: null, erro: null };
    let marcaDoAnuncio: string | null = item.marca;
    try {
      const cat: any = await ml(tenant, 'GET', `/categories/${c.dados.categoriaMl}`);
      const [[conta]]: any = await pool.execute(`SELECT ml_user_id FROM modulo_ecommerce_mercadolivre_contas WHERE tenant_id = ?`, [tenant]);
      const ref: Referencia = Object.fromEntries((c.categoria?.atributos || []).map(a => {
        const v = resolverValor(a, c.dados.atributos[a.id], item);
        return [a.id, v ? { valor: v.valor, unidade: v.unidade } : null];
      }));
      const mlb = c.noMl.get(item.idItem)?.mlbId;
      const noMl: any = mlb ? await ml(tenant, 'GET', `/items/${mlb}?attributes=catalog_product_id`).catch(() => null) : null;
      if (noMl?.catalog_product_id) {
        const prod: any = await ml(tenant, 'GET', `/products/${noMl.catalog_product_id}`).catch(() => null);
        for (const a of prod?.attributes || []) if (a?.value_name && !ref[a.id]) ref[a.id] = { valor: String(a.value_name), unidade: null };
      }
      const produtos = await pesquisarMercado(tenant, cat?.settings?.catalog_domain || null, item.tituloMl || item.nome, conta ? Number(conta.ml_user_id) : null, ref);
      marcaDoAnuncio = ref.BRAND?.valor || item.marca;
      const marca = normalizar(marcaDoAnuncio);
      // a régua: pacotes de tamanho parecido (metade ao dobro); kit grande sempre sai mais barato por unidade
      const parecidos = produtos.filter((p: any) => p.unidades >= unidades / 2 && p.unidades <= unidades * 2);
      const base = parecidos.length >= 3 ? parecidos : produtos;
      mercado = {
        produtos: [...produtos].sort((a, b) => a.porUnidade - b.porUnidade),
        estatisticas: estatisticas(base.map((p: any) => p.porUnidade)),
        regua: parecidos.length >= 3 ? 'PACOTE_PARECIDO' : 'TODOS',
        todos: estatisticas(produtos.map((p: any) => p.porUnidade)),
        mesmaMarca: estatisticas(produtos.filter((p: any) => marca && normalizar(p.marca) === marca).map((p: any) => p.porUnidade)),
        erro: null,
      };
    } catch (e: any) {
      mercado.erro = e?.message || 'Não deu para pesquisar o mercado.';
    }
    const posicao = classificarPreco(porUnidade, mercado.estatisticas);
    const precoMercado = mercado.estatisticas ? r2(mercado.estatisticas.mediana * unidades) : null;

    // por quantidade: preço da faixa, tarifa por unidade e um frete por envio (a compra maior pode passar do limite)
    const faixasAnuncio = lerFaixas(c.registro.faixas_quantidade);
    const porQuantidade = [];
    for (const q of quantidadesParaAnalise(precoAtual, faixasAnuncio)) {
      const precoUnit = r2(precoAtual * (1 - q.desconto / 100));
      const freteQ = await freteDe(r2(precoUnit * q.quantidade), q.quantidade);
      const r = resultadoVenda({ precoUnit, quantidade: q.quantidade, custoUnit: custo, tarifa: await tarifaDe(precoUnit), frete: freteQ ?? 0 });
      porQuantidade.push({ ...r, desconto: q.desconto, faixa: faixasAnuncio.some(f => f.minimo === q.quantidade), freteDesconhecido: freteQ === null, nivel: classificarLucro(custo > 0 ? r.lucroSobreCustoPct : null, alvo.alvoPct) });
    }
    const faixas = porQuantidade.filter(x => x.faixa).map(x => ({ minimo: x.quantidade, desconto: x.desconto, preco: x.precoUnit, lucro: x.lucroPorUnidade, lucroSobreCustoPct: x.lucroSobreCustoPct, nivel: x.nivel }));
    return res.json({
      idItem: item.idItem, sku: item.sku, titulo: item.tituloMl || item.nome, marca: marcaDoAnuncio,
      unidades, unidadeMl: item.unidadeMl?.sigla || null, custo, custoBase: fator > 1 ? r2(custo / fator) : custo,
      alvo: { pct: alvo.alvoPct, origem: alvo.origem },
      tarifa: tarifaAtual, frete,
      envio: {
        gratis: freteGratis, obrigatorio: precoAtual >= LIMITE_FRETE_GRATIS, informado: informado !== null, logistica,
        noAnuncio: !!noMlEnvio, peso, envio: envioAtual, limite: LIMITE_FRETE_GRATIS,
        acimaDoLimite: freteAcima, abaixoDoLimite: freteAbaixo,
      },
      cenarios, porQuantidade, degraus, alertas, alertasSimulado,
      atual, simulado, precoAlvo,
      loja: { preco: item.preco, difPct: item.preco > 0 ? r2((precoAtual / item.preco - 1) * 100) : null },
      mercado: { ...mercado, porUnidade, nivel: posicao.nivel, difMedianaPct: posicao.difMedianaPct, precoMercado },
      faixas,
      conselhos: conselhos({
        nivelLucro: custo > 0 ? atual.nivel : 'SEM_CUSTO', nivelPreco: posicao.nivel, difMedianaPct: posicao.difMedianaPct, precoAtual, precoAlvo,
        precoMercado, unidades, faixasNegativas: faixas.filter(f => f.lucro < 0).map(f => f.minimo),
        faixasAbaixoAlvo: faixas.filter(f => f.lucro >= 0 && f.nivel === 'BAIXO').map(f => f.minimo),
        mesmaMarcaMediana: mercado.mesmaMarca?.mediana ?? null, porUnidade, tarifaFixa: tarifaAtual.fixa, tarifaTotal: atual.tarifa,
        poucos: mercado.estatisticas && mercado.estatisticas.n < 3 ? { min: mercado.estatisticas.min, max: mercado.estatisticas.max, n: mercado.estatisticas.n } : null,
      }),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao analisar o preço.');
  }
};

/** Você recebe e lucro de cada item do anúncio ao preço de hoje (e o preço para o alvo). */
const financeiroDe = async (tenant: number, c: AnuncioCarregado) => {
  const itens = await Promise.all(c.itens.map(async item => {
    try {
      const ctx = await contextoVenda(tenant, c, item);
      const preco = precoNoMl(item, c.dados.ajustePreco);
      const l = await ctx.avaliar(preco);
      return {
        idItem: item.idItem, preco: l.preco, tarifa: l.tarifa, frete: l.frete, recebe: l.liquido, custo: l.custo, lucro: l.lucro,
        lucroSobreCustoPct: l.lucroSobreCustoPct, nivel: l.nivel, freteGratis: ctx.freteGratis, freteDesconhecido: l.freteDesconhecido, alvoPct: ctx.alvo.alvoPct,
        precoAlvo: await ctx.precoAlvoDe(preco, l.frete),
        alertas: await ctx.alertasDe(preco, l),
      };
    } catch {
      return null;
    }
  }));
  return { id: Number(c.registro.id), itens: itens.filter(Boolean) };
};

/** GET /anuncios/financeiro — quanto você recebe e o lucro de cada item ao preço de hoje (para a lista de anúncios). */
export const financeiroAnuncios = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const saida = [];
    for (const c of await carregarAnuncios(pool as any, tenant)) {
      if (c.dados.categoriaMl && c.itens.length) saida.push(await financeiroDe(tenant, c));
    }
    return res.json(saida);
  } catch (error) {
    return responderErro(res, error, 'Erro ao calcular o lucro dos anúncios.');
  }
};

/** GET /anuncios/:id/financeiro — o mesmo, de um anúncio (editor). */
export const financeiroAnuncio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    if (!c) throw new ErroML('Anúncio não encontrado.', 404);
    return res.json(c.dados.categoriaMl && c.itens.length ? await financeiroDe(tenant, c) : { id: Number(c.registro.id), itens: [] });
  } catch (error) {
    return responderErro(res, error, 'Erro ao calcular o lucro do anúncio.');
  }
};

/** GET /anuncios/:id/itens/:idItem/simular?preco= — você recebe e lucro a um preço (para ver enquanto digita) e o preço do alvo. */
export const simularPreco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    const item = c?.itens.find(i => i.idItem === Number(req.params.idItem));
    if (!c || !item) throw new ErroML('Item não encontrado no anúncio.', 404);
    if (!c.dados.categoriaMl) throw new ErroML('Escolha a categoria do ML primeiro: a tarifa depende dela.');
    const ctx = await contextoVenda(tenant, c, item);
    const atual = precoNoMl(item, c.dados.ajustePreco);
    const preco = Number(req.query.preco) > 0 ? r2(Number(req.query.preco)) : atual;
    const l = await ctx.avaliar(preco);
    const lAtual = preco === atual ? l : await ctx.avaliar(atual);
    return res.json({
      preco: l.preco, tarifa: l.tarifa, frete: l.frete, recebe: l.liquido, custo: l.custo, lucro: l.lucro, lucroSobreCustoPct: l.lucroSobreCustoPct,
      nivel: l.nivel, freteDesconhecido: l.freteDesconhecido, alvoPct: ctx.alvo.alvoPct, precoAlvo: await ctx.precoAlvoDe(atual, lAtual.frete),
      alertas: await ctx.alertasDe(preco, l),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao simular o preço.');
  }
};
