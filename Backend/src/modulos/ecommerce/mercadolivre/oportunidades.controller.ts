// Oportunidades: itens do catálogo que ainda não estão em nenhum anúncio do ML, com estoque, vendas no balcão, o que
// falta no cadastro e (para a página que está na tela) o lucro que dariam no ML pelo preço do ERP, com a mesma conta de
// tarifa e frete da aba Preço e lucro.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { AnuncioCarregado, carregarItens, responderErro, sugerirCategorias, tenantDe } from './anuncios.controller';
import { contextoVenda } from './precificacao.controller';
import { compararCandidatos, faltasDoCandidato, situacaoDoCandidato } from './oportunidades';

const DIAS_VENDAS = 90;
const TIPO_PADRAO = 'gold_special';   // Clássico: o rascunho nasce assim
const PESO_MINIMO_KG = 0.1;           // item sem peso: a menor faixa de frete do ML

/** GET /oportunidades — todos os itens ativos fora do ML, do mais promissor para o menos. */
export const listarOportunidades = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [linhas]: any = await pool.execute(
      `SELECT ic.id_item, f.id AS id_familia, f.nome AS familia, NULLIF(TRIM(f.imagem), '') IS NOT NULL AS familia_com_foto,
              (SELECT MIN(a.id) FROM modulo_ecommerce_mercadolivre_anuncios a WHERE a.tenant_id = ic.tenant_id AND a.id_familia = f.id) AS id_anuncio_familia,
              COALESCE((SELECT SUM(vi.quantidade_base) FROM vendas_pedidos_itens vi INNER JOIN vendas_pedidos v ON v.id_venda = vi.id_venda
                        WHERE vi.tenant_id = ic.tenant_id AND vi.id_item = ic.id_item AND v.status = 'CONCLUIDA'
                          AND v.created_at >= DATE_SUB(NOW(), INTERVAL ${DIAS_VENDAS} DAY)), 0) AS vendidos
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
       WHERE ic.tenant_id = ? AND ic.status = 'ATIVO' AND ic.tipo_recurso = 'PRODUTO'
         AND NOT EXISTS (SELECT 1 FROM modulo_ecommerce_mercadolivre_anuncios_itens ai WHERE ai.id_item = ic.id_item AND ai.tenant_id = ic.tenant_id)`,
      [tenant]
    );
    const ids = linhas.map((l: any) => Number(l.id_item));
    const { itens } = await carregarItens(pool as any, tenant, ids);
    const [anuncios]: any = ids.length
      ? await pool.execute(`SELECT id, titulo FROM modulo_ecommerce_mercadolivre_anuncios WHERE tenant_id = ?`, [tenant])
      : [[]];
    const tituloDo = new Map<number, string>(anuncios.map((a: any) => [Number(a.id), a.titulo || `Anúncio #${a.id}`]));

    const lista = linhas.map((l: any) => {
      const i = itens.get(Number(l.id_item))!;
      const candidato = {
        preco: i.preco, estoque: i.estoque, fotos: i.fotos, fotoFamilia: !!Number(l.familia_com_foto), pesoKg: i.pesoKg,
        medidas: !!i.medidasCm, gtin: !!i.gtin, motivosCadastro: i.motivosCadastro, vendidos90: Number(l.vendidos) || 0,
      };
      const faltas = faltasDoCandidato(candidato);
      const idAnuncio = l.id_anuncio_familia ? Number(l.id_anuncio_familia) : null;
      return {
        ...candidato, idItem: i.idItem, sku: i.sku, nome: i.nome, fotoUrl: i.fotoUrl, marca: i.marca,
        idFamilia: l.id_familia ? Number(l.id_familia) : null, familia: l.familia || null,
        familiaNoMl: idAnuncio ? { idAnuncio, titulo: tituloDo.get(idAnuncio) || `Anúncio #${idAnuncio}` } : null,
        faltas, situacao: situacaoDoCandidato(faltas),
      };
    }).sort(compararCandidatos);
    return res.json({ dias: DIAS_VENDAS, itens: lista });
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar as oportunidades.');
  }
};

// categoria sugerida pelo ML para o nome do item (guardada por 6 h: o domínio do ML não muda de uma hora para outra)
const cacheCategoria = new Map<string, { em: number; valor: Promise<{ id: string; nome: string } | null> }>();
const categoriaSugerida = (tenant: number, nome: string) => {
  const g = cacheCategoria.get(nome);
  if (g && Date.now() - g.em < 6 * 60 * 60 * 1000) return g.valor;
  const valor = sugerirCategorias(tenant, nome).then(r => (r[0] ? { id: r[0].id, nome: r[0].nome } : null)).catch(() => null);
  cacheCategoria.set(nome, { em: Date.now(), valor });
  return valor;
};

/**
 * GET /oportunidades/lucro?ids=1,2,3 — o lucro de cada item no ML pelo preço do ERP, como Clássico e com o frete grátis
 * padrão da conta. Categoria: a do anúncio da família, se houver; senão a que o ML sugere para o nome.
 */
export const lucroDasOportunidades = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const ids = String(req.query.ids || '').split(',').map(Number).filter(n => n > 0).slice(0, 30);
    if (!ids.length) return res.json([]);
    const { itens } = await carregarItens(pool as any, tenant, ids);
    const [familias]: any = await pool.execute(
      `SELECT cpd.id_item, (SELECT a.categoria_ml FROM modulo_ecommerce_mercadolivre_anuncios a
                            WHERE a.tenant_id = cpd.tenant_id AND a.id_familia = cpd.familia_id AND a.categoria_ml IS NOT NULL ORDER BY a.id LIMIT 1) AS categoria,
              (SELECT a.categoria_ml_nome FROM modulo_ecommerce_mercadolivre_anuncios a
                            WHERE a.tenant_id = cpd.tenant_id AND a.id_familia = cpd.familia_id AND a.categoria_ml IS NOT NULL ORDER BY a.id LIMIT 1) AS categoria_nome
       FROM comercial_produtos_dados cpd WHERE cpd.tenant_id = ? AND cpd.id_item IN (${ids.map(() => '?').join(',')})`,
      [tenant, ...ids]
    );
    const daFamilia = new Map<number, { id: string; nome: string }>(
      familias.filter((f: any) => f.categoria).map((f: any) => [Number(f.id_item), { id: String(f.categoria), nome: f.categoria_nome || String(f.categoria) }])
    );
    const saida = await Promise.all(ids.map(async idItem => {
      const item = itens.get(idItem);
      if (!item) return null;
      const familia = daFamilia.get(idItem);
      const categoria = familia ?? await categoriaSugerida(tenant, item.nome);
      if (!categoria) return { idItem, erro: 'O ML não sugeriu categoria para o nome do item.' };
      try {
        // anúncio "de mentira", só na memória: o rascunho que nasceria deste item
        const c = {
          registro: { id: 0, tipo_anuncio: TIPO_PADRAO }, dados: { categoriaMl: categoria.id, ajustePreco: 0 }, noMl: new Map(), itens: [item],
        } as unknown as AnuncioCarregado;
        if (!(item.preco > 0)) return { idItem, erro: 'Sem preço de venda no ERP.' };
        // sem peso no cadastro: a conta vai com a menor faixa de frete do ML (o lucro real é no máximo este)
        const freteMinimo = !item.pesoKg;
        const ctx = await contextoVenda(tenant, c, freteMinimo ? { ...item, idLinha: -1, pesoKg: PESO_MINIMO_KG, medidasCm: null } : { ...item, idLinha: -1 });
        const l = await ctx.avaliar(item.preco);
        const precoAlvo = l.lucroSobreCustoPct !== null && l.lucroSobreCustoPct < ctx.alvo.alvoPct ? await ctx.precoAlvoDe(item.preco, l.frete) : null;
        return {
          idItem, preco: l.preco, tarifa: l.tarifa, frete: l.frete, freteDesconhecido: l.freteDesconhecido, freteMinimo, freteGratis: ctx.freteGratis,
          custo: l.custo, lucro: l.lucro, lucroPct: l.lucroSobreCustoPct, nivel: l.nivel, alvoPct: ctx.alvo.alvoPct, precoAlvo,
          categoria: { ...categoria, fonte: familia ? 'FAMILIA' : 'SUGERIDA' },
        };
      } catch (e: any) {
        return { idItem, erro: e?.message || 'Não deu para calcular.' };
      }
    }));
    return res.json(saida.filter(Boolean));
  } catch (error) {
    return responderErro(res, error, 'Erro ao calcular o lucro das oportunidades.');
  }
};
