// Preço e lucro no ML de um item do anúncio: lucro depois da tarifa, preço mínimo para o alvo, comparação com o
// mercado (produtos parecidos do catálogo, por unidade), diferença para o preço da loja e as faixas por quantidade.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { alvoEfetivo } from '../../../areas/compras/inteligente/margemAlvo';
import { carregarComposicoes, carregarDadosComponentes } from '../../../areas/catalogo/kits/kitsBanco';
import { custoDoKit } from '../../../areas/catalogo/kits/kits';
import { normalizar, precoNoMl, resolverValor } from './anuncios';
import { carregarAnuncios, responderErro, taxaMl, tenantDe } from './anuncios.controller';
import { lerFaixas } from './faixasQuantidade';
import { compararAtributos } from './catalogo';
import {
  analisarFaixas, classificarLucro, classificarPreco, conselhos, estatisticas, lucroNoMl, precoParaAlvo, Tarifa, unidadesDoProduto,
} from './precificacao';
import { ErroML, ml } from './mercadolivreApi';

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

/** GET /anuncios/:id/itens/:idItem/preco?simular=&frete=&alvoPadrao=30 */
export const analisarPreco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    const item = c?.itens.find(i => i.idItem === Number(req.params.idItem));
    if (!c || !item) throw new ErroML('Item não encontrado no anúncio.', 404);
    if (!c.dados.categoriaMl) throw new ErroML('Escolha a categoria do ML primeiro: a tarifa depende dela.');
    const tipo = c.registro.tipo_anuncio;
    const frete = Math.max(0, Number(req.query.frete) || 0);
    const alvoPadrao = Math.min(1000, Math.max(0, Number(req.query.alvoPadrao) || 30));

    // custo da unidade vendida no ML (pacote = custo base × fator)
    const fator = item.unidadeMl?.fator || 1;
    const custo = r2((await custoBase(tenant, item.idItem)) * fator);
    const [[fam]]: any = await pool.execute(
      `SELECT f.margem_minima FROM comercial_produtos_dados cpd LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
       WHERE cpd.id_item = ? AND cpd.tenant_id = ?`, [item.idItem, tenant]
    );
    const alvo = alvoEfetivo(fam?.margem_minima !== null && fam?.margem_minima !== undefined ? Number(fam.margem_minima) : null, alvoPadrao);

    const tarifaDe = async (preco: number): Promise<Tarifa> => {
      const t = await taxaMl(tenant, r2(preco), c.dados.categoriaMl!, tipo);
      return { comissaoPct: t?.percentual ?? 17, fixa: t?.fixa ?? 0 };
    };
    const avaliar = async (preco: number) => {
      const l = lucroNoMl({ preco, custo, tarifa: await tarifaDe(preco), frete });
      return { ...l, nivel: classificarLucro(custo > 0 ? l.lucroSobreCustoPct : null, alvo.alvoPct) };
    };
    const precoAtual = precoNoMl(item, c.dados.ajustePreco);
    const atual = await avaliar(precoAtual);
    const simular = Number(req.query.simular) > 0 ? Number(req.query.simular) : null;
    const simulado = simular ? await avaliar(simular) : null;
    const tarifaAtual = await tarifaDe(precoAtual);
    const precoAlvo = custo > 0 ? precoParaAlvo({ custo, tarifa: tarifaAtual, frete, alvoPct: alvo.alvoPct }) : null;

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

    const faixas = analisarFaixas(lerFaixas(c.registro.faixas_quantidade), {
      preco: precoAtual, custo, frete, alvoPct: alvo.alvoPct, tarifaDaFaixa: () => tarifaAtual,
    });
    return res.json({
      idItem: item.idItem, sku: item.sku, titulo: item.tituloMl || item.nome, marca: marcaDoAnuncio,
      unidades, unidadeMl: item.unidadeMl?.sigla || null, custo, custoBase: fator > 1 ? r2(custo / fator) : custo,
      alvo: { pct: alvo.alvoPct, origem: alvo.origem },
      tarifa: tarifaAtual, frete,
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
