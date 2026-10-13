// Central de anúncios do Mercado Livre: o anúncio nasce como rascunho a partir de uma família (com variações) ou de
// itens avulsos, e o ERP aponta o que falta (categoria, atributos, fotos, preço) antes de publicar.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { avaliarPublicacaoItens } from '../../../areas/catalogo/produtos/publicacaoProdutos';
import { carregarComposicoes, carregarDadosComponentes } from '../../../areas/catalogo/kits/kitsBanco';
import { estoqueDoKit } from '../../../areas/catalogo/kits/kits';
import {
  AnuncioDados, AtributoML, categoriaInfo, CategoriaInfo, cortarTitulo, eixosDeVariacao, filtrarAtributosCategoria,
  ItemAnuncio, Pendencia, pendenciasAnuncio, precoNoMl, resolverValor, situacaoPreparo, sugerirAtributos, tituloLegivel, ValorAtributo, modoPublicacao, tituloPeloModelo, estoqueParaMl, regraDoItem, RegraEstoque, saldoNaUnidade, UnidadeVenda, foraDoMl,
} from './anuncios';
import { ErroML, ml } from './mercadolivreApi';
import { sincronizarAnuncios } from './sincronizacao';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

export const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

export const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroML) return res.status(error.status).json({ error: error.message, detalhes: error.detalhes });
  if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Um dos itens já está em outro anúncio do Mercado Livre.' });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

const TIPOS_ANUNCIO = ['gold_special', 'gold_pro'];

// ---------------------------------------------------------------------------
// Categorias do ML (dados públicos, guardados em memória por algumas horas)
// ---------------------------------------------------------------------------

export interface CategoriaML { info: CategoriaInfo; nome: string; caminho: string; atributos: AtributoML[]; temGtin: boolean; filhos: { id: string; nome: string }[] }
const cacheCategorias = new Map<string, { em: number; valor: Promise<CategoriaML> }>();
const VALIDADE_CACHE = 6 * 60 * 60 * 1000;

export const carregarCategoria = (tenant: number, id: string): Promise<CategoriaML> => {
  const guardado = cacheCategorias.get(id);
  if (guardado && Date.now() - guardado.em < VALIDADE_CACHE) return guardado.valor;
  const valor = (async () => {
    const [c, brutos]: [any, any[]] = await Promise.all([ml(tenant, 'GET', `/categories/${id}`), ml(tenant, 'GET', `/categories/${id}/attributes`)]);
    return {
      info: categoriaInfo(c),
      nome: c.name,
      caminho: (c.path_from_root || []).map((p: any) => p.name).join(' › ') || c.name,
      atributos: filtrarAtributosCategoria(brutos),
      temGtin: brutos.some(a => a.id === 'GTIN'),
      filhos: (c.children_categories || []).map((f: any) => ({ id: String(f.id), nome: f.name })),
    };
  })();
  valor.catch(() => cacheCategorias.delete(id));
  cacheCategorias.set(id, { em: Date.now(), valor });
  return valor;
};

const categoriaOuErro = async (tenant: number, id: string | null): Promise<{ categoria: CategoriaML | null; erro: string | null }> => {
  if (!id) return { categoria: null, erro: null };
  try { return { categoria: await carregarCategoria(tenant, id), erro: null }; }
  catch (e: any) { return { categoria: null, erro: e?.message || 'Não deu para ler a categoria no Mercado Livre.' }; }
};

const sugerirCategorias = async (tenant: number, texto: string) => {
  const q = String(texto || '').trim();
  if (!q) return [];
  const r: any[] = await ml(tenant, 'GET', `/sites/MLB/domain_discovery/search?limit=6&q=${encodeURIComponent(q)}`);
  return (r || []).map(x => ({ id: String(x.category_id), nome: x.category_name, dominio: x.domain_name }));
};

// ---------------------------------------------------------------------------
// Itens do catálogo como o anúncio precisa
// ---------------------------------------------------------------------------

export const lista = (ids: number[]) => ids.map(() => '?').join(',');

const valorExibicao = (r: any): string | null => {
  if (r.opcao_valor !== null && r.opcao_valor !== undefined) return String(r.opcao_valor);
  if (r.valor_texto !== null && r.valor_texto !== undefined && String(r.valor_texto).trim() !== '') return String(r.valor_texto);
  if (r.valor_numero !== null && r.valor_numero !== undefined) return String(r.valor_numero);
  if (r.valor_decimal !== null && r.valor_decimal !== undefined) return String(Number(r.valor_decimal));
  if (r.valor_boolean !== null && r.valor_boolean !== undefined) return Number(r.valor_boolean) === 1 ? 'Sim' : 'Não';
  return null;
};

export const carregarItens = async (conn: Conn, tenant: number, ids: number[]) => {
  const itens = new Map<number, ItemAnuncio>();
  const atributosErp = new Map<number, string>();
  const unidades = new Map<number, UnidadeVenda[]>();
  if (ids.length === 0) return { itens, atributosErp, unidades };

  const [base] = await conn.execute(
    `SELECT ic.id_item, ic.status, ic.nome_item, ic.sku AS sku_core, ic.peso_bruto, ic.peso_liquido, umb.sigla AS sigla_base,
            cpd.sku_customizado, cpd.nome_comercial, cpd.preco_venda,
            COALESCE(mi.nome, mf.nome) AS marca, lg.altura_cm, lg.largura_cm, lg.comprimento_cm, es.quantidade_atual
     FROM itens_core ic
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
     LEFT JOIN comercial_marcas mi ON mi.id = cpd.id_marca
     LEFT JOIN comercial_marcas mf ON mf.id = f.id_marca
     LEFT JOIN itens_dados_logisticos lg ON lg.id_item = ic.id_item
     LEFT JOIN itens_unidades_medida umb ON umb.id_unidade = ic.id_unidade
     LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
     WHERE ic.tenant_id = ? AND ic.id_item IN (${lista(ids)})`,
    [tenant, ...ids]
  );
  const [fotos] = await conn.execute(
    `SELECT id_item, url_anexo FROM itens_anexos
     WHERE tenant_id = ? AND id_item IN (${lista(ids)}) AND tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA')
     ORDER BY (tipo_anexo = 'IMAGEM_PRINCIPAL') DESC, ordem, id_anexo`,
    [tenant, ...ids]
  );
  const [gtins] = await conn.execute(
    `SELECT id_item, gtin FROM comercial_unidades_venda
     WHERE tenant_id = ? AND id_item IN (${lista(ids)}) AND NULLIF(TRIM(gtin), '') IS NOT NULL
     ORDER BY padrao_pdv DESC`,
    [tenant, ...ids]
  );
  const [valores] = await conn.execute(
    `SELECT v.id_entidade, v.atributo_id, a.nome, v.valor_texto, v.valor_numero, v.valor_decimal, v.valor_boolean, o.valor AS opcao_valor
     FROM atributos_comercial_valores v
     INNER JOIN atributos_comercial a ON a.id = v.atributo_id AND a.tenant_id = v.tenant_id
     LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
     WHERE v.tenant_id = ? AND v.tipo_entidade = 'produto' AND v.id_entidade IN (${lista(ids)})`,
    [tenant, ...ids]
  );
  const publicacao = await avaliarPublicacaoItens(conn, tenant, ids);
  // Unidades derivadas (ex.: pacote c/12) com o preço de varejo de cada uma
  const [derivadas] = await conn.execute(
    `SELECT conv.id_item, conv.id_unidade_derivada AS id_unidade, um.sigla, COALESCE(NULLIF(cuv.nome_exibicao, ''), um.descricao, um.sigla) AS nome,
            conv.fator_conversao AS fator,
            (SELECT f.preco_unitario FROM comercial_precos_faixas f
             WHERE f.tenant_id = conv.tenant_id AND f.id_item = conv.id_item AND f.id_unidade = conv.id_unidade_derivada AND f.tipo_faixa = 'VAREJO'
             ORDER BY f.ordem LIMIT 1) AS preco
     FROM itens_unidades_conversao conv
     INNER JOIN itens_unidades_medida um ON um.id_unidade = conv.id_unidade_derivada
     LEFT JOIN comercial_unidades_venda cuv ON cuv.tenant_id = conv.tenant_id AND cuv.id_item = conv.id_item AND cuv.id_unidade = conv.id_unidade_derivada
     WHERE conv.tenant_id = ? AND conv.id_item IN (${lista(ids)}) AND conv.fator_conversao > 0
     ORDER BY conv.fator_conversao`,
    [tenant, ...ids]
  );
  for (const u of derivadas) {
    const id = Number(u.id_item);
    if (!unidades.has(id)) unidades.set(id, []);
    unidades.get(id)!.push({ idUnidade: Number(u.id_unidade), sigla: u.sigla, nome: u.nome, fator: Number(u.fator), preco: u.preco === null ? null : Number(u.preco) });
  }

  for (const r of base) {
    const id = Number(r.id_item);
    const alt = Number(r.altura_cm), lar = Number(r.largura_cm), com = Number(r.comprimento_cm);
    const peso = Number(r.peso_bruto) || Number(r.peso_liquido) || null;
    itens.set(id, {
      idItem: id,
      sku: r.sku_customizado || r.sku_core,
      nome: r.nome_comercial || r.nome_item,
      ativo: r.status === 'ATIVO',
      preco: Number(r.preco_venda) || 0,
      precoMl: null,
      estoque: Number(r.quantidade_atual) || 0,
      fotos: 0,
      fotoUrl: null,
      gtin: null,
      pesoKg: peso,
      medidasCm: alt > 0 && lar > 0 && com > 0 ? { altura: alt, largura: lar, comprimento: com } : null,
      marca: r.marca || null,
      siglaBase: r.sigla_base || null,
      valoresErp: {},
      motivosCadastro: publicacao.get(id)?.motivos || [],
    });
  }
  for (const f of fotos) {
    const i = itens.get(Number(f.id_item));
    if (!i) continue;
    i.fotos++;
    if (!i.fotoUrl) i.fotoUrl = f.url_anexo;
  }
  for (const g of gtins) {
    const i = itens.get(Number(g.id_item));
    if (i && !i.gtin) i.gtin = String(g.gtin).trim();
  }
  for (const v of valores) {
    const i = itens.get(Number(v.id_entidade));
    const valor = valorExibicao(v);
    if (!i || valor === null) continue;
    i.valoresErp[String(v.atributo_id)] = valor;
    atributosErp.set(Number(v.atributo_id), v.nome);
  }
  // Kit não tem saldo próprio: vale quantos dá para montar com os componentes (o mais escasso manda)
  const kits = await carregarComposicoes(conn, tenant, ids);
  if (kits.size) {
    const componentes = await carregarDadosComponentes(conn, tenant, [...kits.values()].flat().map(c => c.idItem));
    for (const [idKit, comps] of kits) {
      const i = itens.get(idKit);
      if (!i) continue;
      i.kit = true;
      i.estoque = estoqueDoKit(comps, componentes) ?? 0;
    }
  }
  return { itens, atributosErp, unidades };
};

// ---------------------------------------------------------------------------
// Anúncio completo (dados + itens + categoria + pendências)
// ---------------------------------------------------------------------------

export const lerJson = <T,>(s: string | null, padrao: T): T => { try { return s ? JSON.parse(s) : padrao; } catch { return padrao; } };

const dadosDoAnuncio = (a: any): AnuncioDados => ({
  titulo: a.titulo,
  categoriaMl: a.categoria_ml,
  descricao: a.descricao,
  ajustePreco: Number(a.ajuste_preco) || 0,
  modeloTitulo: a.modelo_titulo || null,
  fotoFamilia: a.familia_imagem || null,
  atributos: lerJson<Record<string, ValorAtributo>>(a.atributos, {}),
});

/** O que já está no ML de cada item (na conta com User Products cada item é um anúncio MLB). */
export interface ItemNoMl {
  mlbId: string | null; status: string | null; permalink: string | null; erro: string | null; fotosMl: Record<string, string>;
  estoqueEnviado: number | null; precoEnviado: number | null; sincronizadoEm: string | null;
  regra: { reserva: number | null; maximo: number | null };   // exceção do item (vazio = regra do anúncio)
}

export interface AnuncioCarregado {
  registro: any;
  dados: AnuncioDados;
  regraEstoque: RegraEstoque;
  unidades: Map<number, UnidadeVenda[]>;   // unidades derivadas de cada item (para escolher a do ML)
  itens: ItemAnuncio[];
  noMl: Map<number, ItemNoMl>;
  categoria: CategoriaML | null;
  pendencias: Pendencia[];      // só dos itens que ainda não estão no ML
  modo: 'FAMILIA' | 'SEPARADO'; // página única com opções ou um anúncio por item
  atributosErp: { id: number; nome: string }[];
}

export const carregarAnuncios = async (conn: Conn, tenant: number, idAnuncio?: number): Promise<AnuncioCarregado[]> => {
  const [anuncios] = await conn.execute(
    `SELECT a.*, f.nome AS familia_nome, NULLIF(TRIM(f.imagem), '') AS familia_imagem,
            DATE_FORMAT(a.atualizado_em, '%Y-%m-%d %H:%i') AS atualizado_fmt,
            DATE_FORMAT(a.sincronizado_em, '%Y-%m-%d %H:%i') AS sincronizado_fmt
     FROM modulo_ecommerce_mercadolivre_anuncios a
     LEFT JOIN comercial_familias f ON f.id = a.id_familia AND f.tenant_id = a.tenant_id
     WHERE a.tenant_id = ? ${idAnuncio ? 'AND a.id = ?' : ''}
     ORDER BY a.atualizado_em DESC, a.id DESC`,
    idAnuncio ? [tenant, idAnuncio] : [tenant]
  );
  if (anuncios.length === 0) return [];
  const idsAnuncios = anuncios.map((a: any) => Number(a.id));
  const [vinculos] = await conn.execute(
    `SELECT id_anuncio, id_item, id_unidade, preco, mlb_id, status_ml, permalink, ultimo_erro, fotos_ml, estoque_reserva, estoque_maximo,
            estoque_enviado, preco_enviado, DATE_FORMAT(sincronizado_em, '%Y-%m-%d %H:%i') AS sincronizado_fmt
     FROM modulo_ecommerce_mercadolivre_anuncios_itens
     WHERE tenant_id = ? AND id_anuncio IN (${lista(idsAnuncios)}) ORDER BY ordem, id_item`,
    [tenant, ...idsAnuncios]
  );
  const { itens, atributosErp, unidades } = await carregarItens(conn, tenant, [...new Set<number>(vinculos.map((v: any) => Number(v.id_item)))]);

  return Promise.all(anuncios.map(async (a: any) => {
    const dados = dadosDoAnuncio(a);
    const meus = vinculos.filter((v: any) => Number(v.id_anuncio) === Number(a.id) && itens.has(Number(v.id_item)));
    const regraEstoque: RegraEstoque = { reserva: Number(a.estoque_reserva) || 0, maximo: a.estoque_maximo === null ? null : Number(a.estoque_maximo) };
    const numeroOuNulo = (x: any) => (x === null || x === undefined ? null : Number(x));
    const noMl = new Map<number, ItemNoMl>(meus.map((v: any) => [Number(v.id_item), {
      mlbId: v.mlb_id || null, status: v.status_ml || null, permalink: v.permalink || null, erro: v.ultimo_erro || null,
      fotosMl: lerJson<Record<string, string>>(v.fotos_ml, {}),
      estoqueEnviado: numeroOuNulo(v.estoque_enviado), precoEnviado: numeroOuNulo(v.preco_enviado), sincronizadoEm: v.sincronizado_fmt || null,
      regra: { reserva: numeroOuNulo(v.estoque_reserva), maximo: numeroOuNulo(v.estoque_maximo) },
    }]));
    const itensDoAnuncio: ItemAnuncio[] = meus.map((v: any) => {
      const base = itens.get(Number(v.id_item))!;
      const regra = regraDoItem(regraEstoque, noMl.get(base.idItem)!.regra);
      // Vendido no ML em outra unidade (ex.: pacote c/12): saldo e preço nessa unidade
      const unidade = v.id_unidade ? (unidades.get(base.idItem) || []).find(u => u.idUnidade === Number(v.id_unidade)) || null : null;
      const noAnuncio: ItemAnuncio = unidade
        ? { ...base, unidadeMl: unidade, estoqueBase: base.estoque, estoque: saldoNaUnidade(base.estoque, unidade.fator),
            preco: unidade.preco ?? Math.round(base.preco * unidade.fator * 100) / 100 }
        : { ...base, unidadeMl: null };
      return { ...noAnuncio, precoMl: v.preco === null ? null : Number(v.preco), estoqueMl: estoqueParaMl(noAnuncio.estoque, regra) };
    });
    const aPublicar = itensDoAnuncio.filter(i => !noMl.get(i.idItem)?.mlbId);
    const { categoria, erro } = await categoriaOuErro(tenant, dados.categoriaMl);
    const idsErp = new Set(itensDoAnuncio.flatMap(i => Object.keys(i.valoresErp)));
    const listaErp = [...idsErp].map(id => ({ id: Number(id), nome: atributosErp.get(Number(id)) || `#${id}` })).sort((x, y) => x.nome.localeCompare(y.nome));
    // Página única (o ML junta pelo título da família) ou um anúncio por item, com o título dele pelo modelo
    const modo = modoPublicacao(categoria?.atributos || [], dados, itensDoAnuncio);
    for (const i of itensDoAnuncio) {
      if (modo === 'FAMILIA') { i.tituloMl = (dados.titulo || '').trim(); i.tituloCortado = false; continue; }
      const t = tituloPeloModelo(dados.modeloTitulo, i, { familia: a.familia_nome, titulo: dados.titulo, atributosErp: listaErp }, categoria?.info.maxTitulo || 60);
      i.tituloMl = t.titulo;
      i.tituloCortado = t.cortado;
    }
    const pendencias = itensDoAnuncio.length > 0 && aPublicar.length === 0
      ? []
      : pendenciasAnuncio(dados, aPublicar, categoria?.info || null, categoria?.atributos || [], categoria?.temGtin ?? true, modo);
    if (erro) pendencias.unshift({ nivel: 'aviso', area: 'dados', texto: `Não deu para conferir a categoria no Mercado Livre: ${erro}` });
    return {
      registro: a, dados, regraEstoque, unidades, itens: itensDoAnuncio, noMl, categoria, pendencias, modo,
      atributosErp: listaErp,
    };
  }));
};

export const resumo = (c: AnuncioCarregado) => {
  const a = c.registro;
  const erros = c.pendencias.filter(p => p.nivel === 'erro').length;
  const publicados = c.itens.filter(i => c.noMl.get(i.idItem)?.mlbId).length;
  const aPublicar = c.itens.length - publicados;
  const primeiro = c.itens.map(i => c.noMl.get(i.idItem)).find(m => m?.mlbId);
  return {
    id: Number(a.id),
    titulo: a.titulo,
    idFamilia: a.id_familia ? Number(a.id_familia) : null,
    familia: a.familia_nome || null,
    categoriaMl: a.categoria_ml,
    categoriaNome: a.categoria_ml_nome,
    tipoAnuncio: a.tipo_anuncio,
    situacao: a.situacao,
    preparo: aPublicar > 0 || c.itens.length === 0 ? situacaoPreparo(c.pendencias) : null,
    mlbId: a.mlb_id || primeiro?.mlbId || null,
    permalink: a.permalink || primeiro?.permalink || null,
    qtdItens: c.itens.length,
    publicados,
    aPublicar,
    fotoUrl: c.itens.find(i => i.fotoUrl)?.fotoUrl || c.dados.fotoFamilia || null,
    estoque: c.itens.reduce((s, i) => s + Math.max(0, i.estoque), 0),
    precoMin: c.itens.length ? Math.min(...c.itens.map(i => precoNoMl(i, c.dados.ajustePreco))) : null,
    precoMax: c.itens.length ? Math.max(...c.itens.map(i => precoNoMl(i, c.dados.ajustePreco))) : null,
    erros,
    avisos: c.pendencias.length - erros,
    atualizadoEm: a.atualizado_fmt,
    ultimoErro: a.ultimo_erro,
  };
};

// Comissão do ML por preço (cache curto: muda pouco)
const cacheTaxas = new Map<string, { em: number; valor: Promise<{ percentual: number; comissao: number; fixa: number } | null> }>();
const taxaMl = (tenant: number, preco: number, categoria: string, tipo: string) => {
  const chave = `${preco}|${categoria}|${tipo}`;
  const guardado = cacheTaxas.get(chave);
  if (guardado && Date.now() - guardado.em < 60 * 60 * 1000) return guardado.valor;
  const valor = ml(tenant, 'GET', `/sites/MLB/listing_prices?price=${preco}&category_id=${categoria}&listing_type_id=${tipo}`)
    .then((r: any) => ({
      percentual: Number(r?.sale_fee_details?.percentage_fee) || 0,
      comissao: Number(r?.sale_fee_amount) || 0,
      fixa: Number(r?.sale_fee_details?.fixed_fee) || 0,
    }))
    .catch(() => null);
  cacheTaxas.set(chave, { em: Date.now(), valor });
  return valor;
};

export const detalhe = async (tenant: number, c: AnuncioCarregado) => {
  const a = c.registro;
  const atributosCat = c.categoria?.atributos || [];
  const eixos = c.itens.length > 1 ? eixosDeVariacao(atributosCat, c.dados, c.itens).map(x => x.id) : [];
  const precos = [...new Set(c.itens.map(i => precoNoMl(i, c.dados.ajustePreco)).filter(p => p > 0))].slice(0, 30);
  const taxas = new Map<number, Awaited<ReturnType<typeof taxaMl>>>();
  if (c.dados.categoriaMl) {
    const r = await Promise.all(precos.map(p => taxaMl(tenant, p, c.dados.categoriaMl!, a.tipo_anuncio)));
    precos.forEach((p, k) => taxas.set(p, r[k]));
  }
  return {
    ...resumo(c),
    condicao: a.condicao,
    descricao: a.descricao || '',
    fotoFamilia: c.dados.fotoFamilia || null,
    ajustePreco: c.dados.ajustePreco,
    modo: c.modo,
    modeloTitulo: c.dados.modeloTitulo || '',
    estoqueReserva: c.regraEstoque.reserva,
    estoqueMaximo: c.regraEstoque.maximo,
    estoqueAutomatico: Boolean(Number(a.estoque_automatico)),
    sincronizadoEm: a.sincronizado_fmt || null,
    atributos: c.dados.atributos,
    categoria: c.categoria
      ? { id: c.categoria.info.id, nome: c.categoria.nome, caminho: c.categoria.caminho, final: c.categoria.info.final, maxTitulo: c.categoria.info.maxTitulo, maxFotos: c.categoria.info.maxFotos, filhos: c.categoria.filhos }
      : null,
    atributosCategoria: atributosCat,
    atributosErp: c.atributosErp,
    eixos,
    itens: c.itens.map(i => {
      const preco = precoNoMl(i, c.dados.ajustePreco);
      const taxa = taxas.get(preco) || null;
      return {
        ...i,
        precoAnuncio: preco,
        comissao: taxa ? taxa.comissao : null,
        percentualComissao: taxa ? taxa.percentual : null,
        valores: Object.fromEntries(atributosCat.map(at => [at.id, resolverValor(at, c.dados.atributos[at.id], i)])),
        ml: (({ fotosMl, ...m }) => m)(c.noMl.get(i.idItem)!),
        unidades: c.unidades.get(i.idItem) || [],
      };
    }),
    pendencias: c.pendencias,
  };
};

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

/** GET /anuncios — todos os anúncios (rascunhos e publicados) com o resumo das pendências */
export const listarAnuncios = async (req: Request, res: Response) => {
  try {
    const todos = await carregarAnuncios(pool as any, tenantDe(req));
    return res.json(todos.map(resumo));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os anúncios.');
  }
};

/** GET /anuncios/:id */
export const detalheAnuncio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [c] = await carregarAnuncios(pool as any, tenant, Number(req.params.id));
    if (!c) throw new ErroML('Anúncio não encontrado.', 404);
    return res.json(await detalhe(tenant, c));
  } catch (error) {
    return responderErro(res, error, 'Erro ao abrir o anúncio.');
  }
};

/** GET /candidatos?busca= — famílias e itens do catálogo para anunciar */
export const candidatos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const busca = `%${String(req.query.busca || '').trim()}%`;
  try {
    const [familias]: any = await pool.execute(
      `SELECT f.id, f.nome, COUNT(ic.id_item) AS itens, SUM(ai.id_item IS NOT NULL) AS anunciados,
              SUM(EXISTS(SELECT 1 FROM itens_anexos x WHERE x.tenant_id = f.tenant_id AND x.id_item = ic.id_item
                         AND x.tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA'))) AS com_foto,
              SUM(COALESCE(es.quantidade_atual, 0) > 0) AS com_estoque
       FROM comercial_familias f
       INNER JOIN comercial_produtos_dados cpd ON cpd.familia_id = f.id AND cpd.tenant_id = f.tenant_id
       INNER JOIN itens_core ic ON ic.id_item = cpd.id_item AND ic.tenant_id = f.tenant_id AND ic.status = 'ATIVO'
       LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = f.tenant_id AND es.deposito = 'VENDA'
       LEFT JOIN modulo_ecommerce_mercadolivre_anuncios_itens ai ON ai.id_item = ic.id_item AND ai.tenant_id = f.tenant_id
       WHERE f.tenant_id = ? AND f.status <> 'INATIVO' AND f.nome LIKE ?
       GROUP BY f.id, f.nome
       ORDER BY f.nome
       LIMIT 60`,
      [tenant, busca]
    );
    const [itens]: any = await pool.execute(
      `SELECT ic.id_item, COALESCE(cpd.sku_customizado, ic.sku) AS sku, COALESCE(cpd.nome_comercial, ic.nome_item) AS nome,
              cpd.preco_venda, COALESCE(es.quantidade_atual, 0) AS estoque, f.nome AS familia, ai.id_anuncio,
              (SELECT x.url_anexo FROM itens_anexos x WHERE x.tenant_id = ic.tenant_id AND x.id_item = ic.id_item
                 AND x.tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA')
               ORDER BY (x.tipo_anexo = 'IMAGEM_PRINCIPAL') DESC, x.ordem, x.id_anexo LIMIT 1) AS foto_url
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
       LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
       LEFT JOIN modulo_ecommerce_mercadolivre_anuncios_itens ai ON ai.id_item = ic.id_item AND ai.tenant_id = ic.tenant_id
       WHERE ic.tenant_id = ? AND ic.status = 'ATIVO'
         AND (cpd.sku_customizado LIKE ? OR cpd.nome_comercial LIKE ? OR ic.nome_item LIKE ? OR ic.sku LIKE ?)
       ORDER BY nome
       LIMIT 60`,
      [tenant, busca, busca, busca, busca]
    );
    return res.json({
      familias: familias.map((f: any) => ({
        id: Number(f.id), nome: f.nome, itens: Number(f.itens), anunciados: Number(f.anunciados) || 0,
        comFoto: Number(f.com_foto) || 0, comEstoque: Number(f.com_estoque) || 0,
      })),
      itens: itens.map((i: any) => ({
        idItem: Number(i.id_item), sku: i.sku, nome: i.nome, preco: Number(i.preco_venda) || 0, estoque: Number(i.estoque) || 0,
        familia: i.familia || null, idAnuncio: i.id_anuncio ? Number(i.id_anuncio) : null, fotoUrl: i.foto_url || null,
      })),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar itens do catálogo.');
  }
};

/** Cria um rascunho e já tenta achar a categoria e ligar os atributos. */
const criarRascunho = async (conn: Conn, tenant: number, r: { titulo: string; idFamilia: number | null; descricao: string | null; idItens: number[] }) => {
  const titulo = cortarTitulo(tituloLegivel(r.titulo));
  let categoria: CategoriaML | null = null;
  let categoriaId: string | null = null;
  try {
    const [primeira] = await sugerirCategorias(tenant, titulo);
    if (primeira) { categoria = await carregarCategoria(tenant, primeira.id); categoriaId = primeira.id; }
  } catch { /* sem sugestão: o operador escolhe */ }
  const { atributosErp } = await carregarItens(conn, tenant, r.idItens);
  const atributos = categoria
    ? sugerirAtributos(categoria.atributos, [...atributosErp].map(([id, nome]) => ({ id, nome })), {})
    : {};
  const [ins] = await conn.execute(
    `INSERT INTO modulo_ecommerce_mercadolivre_anuncios (tenant_id, id_familia, titulo, categoria_ml, categoria_ml_nome, descricao, atributos)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenant, r.idFamilia, titulo, categoriaId, categoria?.caminho || null, r.descricao, JSON.stringify(atributos)]
  );
  const id = Number(ins.insertId);
  let ordem = 0;
  for (const idItem of r.idItens) {
    await conn.execute(
      `INSERT INTO modulo_ecommerce_mercadolivre_anuncios_itens (id_anuncio, tenant_id, id_item, ordem) VALUES (?, ?, ?, ?)`,
      [id, tenant, idItem, ordem++]
    );
  }
  return id;
};

/** POST /anuncios { idFamilia, separados? } ou { idItens: [...] } */
export const criarAnuncio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const conn = connection as unknown as Conn;
    const idFamilia = Number(req.body?.idFamilia) || null;
    const separados = Boolean(req.body?.separados);
    const criados: number[] = [];

    if (idFamilia) {
      const [[familia]] = await conn.execute(
        `SELECT id, nome, descricao_comercial_padrao FROM comercial_familias WHERE id = ? AND tenant_id = ?`, [idFamilia, tenant]
      );
      if (!familia) throw new ErroML('Família não encontrada.', 404);
      const [livres] = await conn.execute(
        `SELECT ic.id_item, COALESCE(cpd.nome_comercial, ic.nome_item) AS nome, cpd.descricao_comercial
         FROM comercial_produtos_dados cpd
         INNER JOIN itens_core ic ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id AND ic.status = 'ATIVO'
         LEFT JOIN modulo_ecommerce_mercadolivre_anuncios_itens ai ON ai.id_item = ic.id_item AND ai.tenant_id = cpd.tenant_id
         WHERE cpd.tenant_id = ? AND cpd.familia_id = ? AND ai.id_item IS NULL
         ORDER BY nome`,
        [tenant, idFamilia]
      );
      if (livres.length === 0) throw new ErroML('Todos os itens ativos desta família já estão em anúncios.');
      if (separados) {
        for (const i of livres) {
          criados.push(await criarRascunho(conn, tenant, {
            titulo: i.nome, idFamilia, descricao: i.descricao_comercial || familia.descricao_comercial_padrao || null, idItens: [Number(i.id_item)],
          }));
        }
      } else {
        criados.push(await criarRascunho(conn, tenant, {
          titulo: familia.nome, idFamilia, descricao: familia.descricao_comercial_padrao || null, idItens: livres.map((i: any) => Number(i.id_item)),
        }));
      }
    } else {
      const ids = [...new Set<number>((req.body?.idItens || []).map(Number).filter(Boolean))];
      if (ids.length === 0) throw new ErroML('Escolha uma família ou ao menos um item.');
      const [rows] = await conn.execute(
        `SELECT ic.id_item, COALESCE(cpd.nome_comercial, ic.nome_item) AS nome, cpd.descricao_comercial, ai.id_anuncio
         FROM itens_core ic
         LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
         LEFT JOIN modulo_ecommerce_mercadolivre_anuncios_itens ai ON ai.id_item = ic.id_item AND ai.tenant_id = ic.tenant_id
         WHERE ic.tenant_id = ? AND ic.id_item IN (${lista(ids)})`,
        [tenant, ...ids]
      );
      const ocupado = rows.find((r: any) => r.id_anuncio);
      if (ocupado) throw new ErroML(`"${ocupado.nome}" já está no anúncio #${ocupado.id_anuncio}.`, 409);
      if (separados || rows.length === 1) {
        for (const r of rows) {
          criados.push(await criarRascunho(conn, tenant, { titulo: r.nome, idFamilia: null, descricao: r.descricao_comercial || null, idItens: [Number(r.id_item)] }));
        }
      } else {
        criados.push(await criarRascunho(conn, tenant, {
          titulo: String(req.body?.titulo || rows[0].nome), idFamilia: null, descricao: null, idItens: rows.map((r: any) => Number(r.id_item)),
        }));
      }
    }
    await connection.commit();
    return res.status(201).json({ ids: criados });
  } catch (error) {
    await connection.rollback();
    return responderErro(res, error, 'Erro ao criar o anúncio.');
  } finally {
    connection.release();
  }
};

const anuncioEditavel = async (conn: Conn, tenant: number, id: number) => {
  const [[a]] = await conn.execute(
    `SELECT id, situacao, categoria_ml, atributos FROM modulo_ecommerce_mercadolivre_anuncios WHERE id = ? AND tenant_id = ?`, [id, tenant]
  );
  if (!a) throw new ErroML('Anúncio não encontrado.', 404);
  return a;
};

const validarAtributos = (v: any): Record<string, ValorAtributo> => {
  const saida: Record<string, ValorAtributo> = {};
  if (!v || typeof v !== 'object') return saida;
  for (const [id, x] of Object.entries<any>(v)) {
    if (!x || typeof x !== 'object') continue;
    if (x.origem === 'marca') saida[id] = { origem: 'marca' };
    else if (x.origem === 'erp' && Number(x.atributoId)) saida[id] = { origem: 'erp', atributoId: Number(x.atributoId) };
    else if (x.origem === 'fixo' && String(x.valor ?? '').trim()) {
      saida[id] = { origem: 'fixo', valor: String(x.valor).trim(), valorId: x.valorId ? String(x.valorId) : null, unidade: x.unidade ? String(x.unidade) : null };
    }
  }
  return saida;
};

/** PUT /anuncios/:id — dados do anúncio (título, categoria, tipo, descrição, ajuste de preço, atributos) */
export const salvarAnuncio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  try {
    const a = await anuncioEditavel(pool as any, tenant, id);
    const b = req.body || {};
    const campos: string[] = [];
    const valores: any[] = [];
    const definir = (campo: string, valor: any) => { campos.push(`${campo} = ?`); valores.push(valor); };

    if (b.titulo !== undefined) {
      const t = String(b.titulo || '').replace(/\s+/g, ' ').trim();
      if (t.length > 60) throw new ErroML(`O título tem ${t.length} caracteres: o máximo é 60.`);
      definir('titulo', t || null);
    }
    if (b.tipoAnuncio !== undefined) {
      if (!TIPOS_ANUNCIO.includes(b.tipoAnuncio)) throw new ErroML('Tipo de anúncio inválido.');
      definir('tipo_anuncio', b.tipoAnuncio);
    }
    if (b.condicao !== undefined) definir('condicao', b.condicao === 'used' ? 'used' : 'new');
    if (b.descricao !== undefined) definir('descricao', String(b.descricao || '').trim() || null);
    const quantidade = (v: any, nome: string) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      if (!(n >= 0)) throw new ErroML(`${nome} inválido.`);
      return Math.floor(n);
    };
    if (b.modeloTitulo !== undefined) {
      const m = String(b.modeloTitulo || '').trim();
      if (m.length > 255) throw new ErroML('Modelo do título muito longo (máximo 255).');
      definir('modelo_titulo', m || null);
    }
    if (b.estoqueReserva !== undefined) definir('estoque_reserva', quantidade(b.estoqueReserva, 'Reserva da loja') ?? 0);
    if (b.estoqueMaximo !== undefined) definir('estoque_maximo', quantidade(b.estoqueMaximo, 'Teto no ML'));
    if (b.estoqueAutomatico !== undefined) definir('estoque_automatico', b.estoqueAutomatico ? 1 : 0);
    if (b.ajustePreco !== undefined) {
      const ajuste = Number(b.ajustePreco) || 0;
      if (ajuste < -50 || ajuste > 300) throw new ErroML('Ajuste de preço fora do razoável (-50% a 300%).');
      definir('ajuste_preco', ajuste);
    }
    let atributos = b.atributos !== undefined ? validarAtributos(b.atributos) : lerJson<Record<string, ValorAtributo>>(a.atributos, {});
    if (b.categoriaMl !== undefined && (b.categoriaMl || null) !== a.categoria_ml) {
      const idCat = b.categoriaMl ? String(b.categoriaMl).trim().toUpperCase() : null;
      if (idCat) {
        const cat = await carregarCategoria(tenant, idCat).catch((e: any) => { throw new ErroML(`Categoria ${idCat}: ${e?.message || 'não encontrada'}`); });
        // mantém o que já foi ligado e que existe na categoria nova; sugere o resto pelo nome
        const ids = new Set(cat.atributos.map(x => x.id));
        const mantidos = Object.fromEntries(Object.entries(atributos).filter(([k]) => ids.has(k)));
        const [vinc] = await pool.execute(`SELECT id_item FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE id_anuncio = ?`, [id]) as any;
        const { atributosErp } = await carregarItens(pool as any, tenant, vinc.map((v: any) => Number(v.id_item)));
        atributos = sugerirAtributos(cat.atributos, [...atributosErp].map(([i, nome]) => ({ id: i, nome })), mantidos);
        definir('categoria_ml', idCat);
        definir('categoria_ml_nome', cat.caminho.slice(0, 255));
      } else {
        definir('categoria_ml', null);
        definir('categoria_ml_nome', null);
      }
    }
    definir('atributos', JSON.stringify(atributos));
    await pool.execute(`UPDATE modulo_ecommerce_mercadolivre_anuncios SET ${campos.join(', ')} WHERE id = ? AND tenant_id = ?`, [...valores, id, tenant]);
    // divisão do estoque ou ajuste de preço mudou: os itens já no ML recebem na hora
    if (b.estoqueReserva !== undefined || b.estoqueMaximo !== undefined || b.ajustePreco !== undefined) {
      const recusado = (await sincronizarAnuncios(tenant, { idAnuncio: id })).find(r => r.erro);
      if (recusado) throw new ErroML(`Salvo no ERP, mas o ML recusou ${recusado.sku}: ${recusado.erro}`);
    }
    const [c] = await carregarAnuncios(pool as any, tenant, id);
    return res.json(await detalhe(tenant, c));
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar o anúncio.');
  }
};

/** POST /anuncios/:id/itens { idItens } */
export const adicionarItens = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  try {
    // em anúncio já publicado o item novo fica "a publicar" e sobe pelo botão Publicar
    await anuncioEditavel(pool as any, tenant, id);
    const ids = [...new Set<number>((req.body?.idItens || []).map(Number).filter(Boolean))];
    if (ids.length === 0) throw new ErroML('Escolha ao menos um item.');
    const [[{ proxima }]]: any = await pool.execute(
      `SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE id_anuncio = ?`, [id]
    );
    let ordem = Number(proxima);
    for (const idItem of ids) {
      await pool.execute(
        `INSERT INTO modulo_ecommerce_mercadolivre_anuncios_itens (id_anuncio, tenant_id, id_item, ordem) VALUES (?, ?, ?, ?)`,
        [id, tenant, idItem, ordem++]
      );
    }
    await pool.execute(`UPDATE modulo_ecommerce_mercadolivre_anuncios SET atualizado_em = NOW() WHERE id = ?`, [id]);
    const [c] = await carregarAnuncios(pool as any, tenant, id);
    return res.json(await detalhe(tenant, c));
  } catch (error) {
    return responderErro(res, error, 'Erro ao adicionar itens.');
  }
};

/** DELETE /anuncios/:id/itens/:idItem */
export const removerItem = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  try {
    await anuncioEditavel(pool as any, tenant, id);
    const [[vinculo]]: any = await pool.execute(
      `SELECT mlb_id, status_ml FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
      [id, tenant, Number(req.params.idItem)]
    );
    if (vinculo?.mlb_id && !foraDoMl(vinculo.status_ml)) throw new ErroML(`Este item já está no ML (${vinculo.mlb_id}): pause ou encerre o anúncio lá antes de tirar daqui.`);
    await pool.execute(
      `DELETE FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
      [id, tenant, Number(req.params.idItem)]
    );
    const [c] = await carregarAnuncios(pool as any, tenant, id);
    return res.json(await detalhe(tenant, c));
  } catch (error) {
    return responderErro(res, error, 'Erro ao tirar o item.');
  }
};

/**
 * PUT /anuncios/:id/itens/:idItem { preco?, estoqueReserva?, estoqueMaximo? } — preço só no ML e a divisão do estoque
 * do item (null volta à regra do anúncio). Item já no ML: a mudança vai na hora.
 */
export const salvarItem = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  try {
    await anuncioEditavel(pool as any, tenant, id);
    const idItem = Number(req.params.idItem);
    const b = req.body || {};
    const campos: string[] = [];
    const valores: any[] = [];
    if ('idUnidade' in b) {
      const idUnidade = b.idUnidade ? Number(b.idUnidade) : null;
      if (idUnidade) {
        const [[existe]]: any = await pool.execute(
          `SELECT 1 FROM itens_unidades_conversao WHERE tenant_id = ? AND id_item = ? AND id_unidade_derivada = ? AND fator_conversao > 0`,
          [tenant, idItem, idUnidade]
        );
        if (!existe) throw new ErroML('Essa unidade não tem conversão cadastrada no item (Catálogo › Preços & Comercial).');
      }
      campos.push('id_unidade = ?');
      valores.push(idUnidade);
    }
    if ('preco' in b) {
      const preco = b.preco === null || b.preco === '' ? null : Math.round(Number(b.preco) * 100) / 100;
      if (preco !== null && !(preco > 0)) throw new ErroML('Preço inválido.');
      campos.push('preco = ?');
      valores.push(preco);
    }
    const regras: [string, string, string][] = [['estoqueReserva', 'estoque_reserva', 'Reserva da loja'], ['estoqueMaximo', 'estoque_maximo', 'Teto no ML']];
    for (const [chave, coluna, nome] of regras) {
      if (!(chave in b)) continue;
      const v = b[chave] === null || b[chave] === '' ? null : Number(b[chave]);
      if (v !== null && !(v >= 0)) throw new ErroML(`${nome} inválido.`);
      campos.push(`${coluna} = ?`);
      valores.push(v === null ? null : Math.floor(v));
    }
    if (campos.length) {
      await pool.execute(
        `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens SET ${campos.join(', ')} WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
        [...valores, id, tenant, idItem]
      );
    }
    const enviados = await sincronizarAnuncios(tenant, { idAnuncio: id, idItem });
    const recusado = enviados.find(r => r.erro);
    if (recusado) throw new ErroML(`Salvo no ERP, mas o ML recusou: ${recusado.erro}`);
    const [c] = await carregarAnuncios(pool as any, tenant, id);
    return res.json(await detalhe(tenant, c));
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar o item.');
  }
};

/**
 * DELETE /anuncios/:id/itens/:idItem/ml — desliga do ML o item que foi excluído ou encerrado lá:
 * ele volta a "a publicar" (pode ser publicado de novo ou tirado do anúncio).
 */
export const desligarDoMl = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  const idItem = Number(req.params.idItem);
  try {
    await anuncioEditavel(pool as any, tenant, id);
    const [[v]]: any = await pool.execute(
      `SELECT mlb_id, status_ml FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
      [id, tenant, idItem]
    );
    if (!v?.mlb_id) throw new ErroML('Este item não está ligado a um anúncio do ML.');
    if (!foraDoMl(v.status_ml)) throw new ErroML(`O anúncio ${v.mlb_id} ainda está ativo ou pausado no ML: exclua ou encerre lá antes de desligar.`);
    await pool.execute(
      `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens
       SET mlb_id = NULL, status_ml = NULL, permalink = NULL, estoque_enviado = NULL, preco_enviado = NULL, sincronizado_em = NULL, ultimo_erro = NULL
       WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
      [id, tenant, idItem]
    );
    // o anúncio fica com o MLB de outro item ainda ligado; sem nenhum, volta a rascunho
    const [[outro]]: any = await pool.execute(
      `SELECT mlb_id, status_ml, permalink FROM modulo_ecommerce_mercadolivre_anuncios_itens
       WHERE id_anuncio = ? AND tenant_id = ? AND mlb_id IS NOT NULL ORDER BY ordem, id_item LIMIT 1`,
      [id, tenant]
    );
    await pool.execute(
      `UPDATE modulo_ecommerce_mercadolivre_anuncios SET mlb_id = ?, status_ml = ?, permalink = ?, situacao = ? WHERE id = ? AND tenant_id = ?`,
      outro
        ? [outro.mlb_id, outro.status_ml, outro.permalink, foraDoMl(outro.status_ml) ? 'ENCERRADO' : 'PUBLICADO', id, tenant]
        : [null, null, null, 'RASCUNHO', id, tenant]
    );
    const [c] = await carregarAnuncios(pool as any, tenant, id);
    return res.json(await detalhe(tenant, c));
  } catch (error) {
    return responderErro(res, error, 'Erro ao desligar do Mercado Livre.');
  }
};

/**
 * POST /anuncios/:id/encerrar — encerra e exclui no ML os anúncios dos itens (não dá para desfazer lá) e devolve os
 * itens para "a publicar", para publicar de novo do jeito certo (ex.: título por item). Nada fica sobrando nos finalizados.
 */
export const encerrarNoMl = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  try {
    await anuncioEditavel(pool as any, tenant, id);
    const [vinculos]: any = await pool.execute(
      `SELECT id_item, mlb_id, status_ml FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE id_anuncio = ? AND tenant_id = ? AND mlb_id IS NOT NULL`,
      [id, tenant]
    );
    if (!vinculos.length) throw new ErroML('Nenhum item deste anúncio está no Mercado Livre.');
    const falhas: string[] = [];
    for (const v of vinculos) {
      if (!foraDoMl(v.status_ml)) {
        try { await ml(tenant, 'PUT', `/items/${v.mlb_id}`, { status: 'closed' }); }
        catch (e: any) { falhas.push(`${v.mlb_id}: ${e?.message || 'erro'}`); continue; }
      }
      // encerrado pode ser excluído (o ML pede encerrar antes); se a exclusão falhar ele só fica nos finalizados
      if (v.status_ml !== 'deleted') await ml(tenant, 'PUT', `/items/${v.mlb_id}`, { deleted: 'true' }).catch(() => null);
      await pool.execute(
        `UPDATE modulo_ecommerce_mercadolivre_anuncios_itens
         SET mlb_id = NULL, status_ml = NULL, permalink = NULL, estoque_enviado = NULL, preco_enviado = NULL, sincronizado_em = NULL, ultimo_erro = NULL
         WHERE id_anuncio = ? AND tenant_id = ? AND id_item = ?`,
        [id, tenant, v.id_item]
      );
    }
    const [[resta]]: any = await pool.execute(
      `SELECT COUNT(*) AS n FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE id_anuncio = ? AND tenant_id = ? AND mlb_id IS NOT NULL`, [id, tenant]
    );
    if (!Number(resta.n)) {
      await pool.execute(
        `UPDATE modulo_ecommerce_mercadolivre_anuncios SET situacao = 'RASCUNHO', mlb_id = NULL, status_ml = NULL, permalink = NULL WHERE id = ? AND tenant_id = ?`,
        [id, tenant]
      );
    }
    if (falhas.length) throw new ErroML(`O ML não encerrou ${falhas.length} anúncio(s): ${falhas[0]}`);
    const [c] = await carregarAnuncios(pool as any, tenant, id);
    return res.json(await detalhe(tenant, c));
  } catch (error) {
    return responderErro(res, error, 'Erro ao encerrar no Mercado Livre.');
  }
};

/** DELETE /anuncios/:id — só rascunho (o publicado se encerra no ML, na etapa de sincronização) */
export const excluirAnuncio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  try {
    const a = await anuncioEditavel(pool as any, tenant, id);
    const [[{ noMl }]]: any = await pool.execute(
      `SELECT COUNT(mlb_id) AS noMl FROM modulo_ecommerce_mercadolivre_anuncios_itens
       WHERE id_anuncio = ? AND tenant_id = ? AND COALESCE(status_ml, '') NOT IN ('closed', 'deleted')`, [id, tenant]
    );
    if (Number(noMl) > 0) throw new ErroML('Só rascunho pode ser excluído. Anúncio publicado se encerra pelo ML.');
    await pool.execute(`DELETE FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE id_anuncio = ? AND tenant_id = ?`, [id, tenant]);
    await pool.execute(`DELETE FROM modulo_ecommerce_mercadolivre_anuncios WHERE id = ? AND tenant_id = ?`, [id, tenant]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir o anúncio.');
  }
};

/** GET /categorias/sugerir?q= — categorias do ML pelo título */
export const sugerirCategoria = async (req: Request, res: Response) => {
  try {
    return res.json(await sugerirCategorias(tenantDe(req), String(req.query.q || '')));
  } catch (error) {
    return responderErro(res, error, 'Erro ao sugerir categorias.');
  }
};

/** GET /categorias (raiz) ou /categorias/:id (caminho e subcategorias) */
export const navegarCategorias = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    if (!req.params.id) {
      const raiz: any[] = await ml(tenant, 'GET', '/sites/MLB/categories');
      return res.json({ id: null, nome: 'Todas', caminho: '', final: false, filhos: raiz.map(r => ({ id: String(r.id), nome: r.name })) });
    }
    const c = await carregarCategoria(tenant, String(req.params.id).toUpperCase());
    return res.json({ id: c.info.id, nome: c.nome, caminho: c.caminho, final: c.info.final, filhos: c.filhos });
  } catch (error) {
    return responderErro(res, error, 'Erro ao ler as categorias do Mercado Livre.');
  }
};
