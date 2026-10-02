// Painel de precificação: itens de venda com custo (gerencial, médio, último), preço de varejo da unidade base,
// margem e situação (sem preço, custo defasado, margem baixa...). A edição do preço é feita pelo configurador do item.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { margemPct, SITUACOES_PRECO, SituacaoPreco, situacoesPreco } from './painelPrecos';
import { analisarDefasagem } from './precificacao';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const TIPOS_FORA_DA_VENDA = ['CONSUMO', 'INSUMO', 'ATIVO'];

/**
 * GET /catalogo/precos/painel?situacao=&busca=&page=&limit=
 */
export const painelPrecos = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const situacao = req.query.situacao ? String(req.query.situacao).toUpperCase() as SituacaoPreco : null;
    const busca = String(req.query.busca || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const filtros: string[] = ['ic.tenant_id = ?', "UPPER(COALESCE(ic.status, 'ATIVO')) <> 'INATIVO'"];
    const params: any[] = [tenant];
    if (busca) {
      filtros.push('(ic.sku LIKE ? OR cpd.sku_customizado LIKE ? OR ic.nome_item LIKE ? OR cpd.nome_comercial LIKE ?)');
      params.push(...Array(4).fill(`%${busca}%`));
    }

    const [rows]: any = await pool.execute(
      `SELECT ic.id_item, UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) AS tipo,
              COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
              COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
              f.nome AS familia, um.sigla AS unidade_base,
              cpd.custo_gerencial, es.custo_medio, es.ultimo_custo, es.quantidade_atual,
              (SELECT pf.preco_unitario FROM comercial_precos_faixas pf
               WHERE pf.tenant_id = ic.tenant_id AND pf.id_item = ic.id_item AND pf.id_unidade = ic.id_unidade AND pf.tipo_faixa = 'VAREJO'
               ORDER BY pf.ordem LIMIT 1) AS preco_varejo,
              (SELECT COUNT(*) FROM comercial_precos_faixas pf
               WHERE pf.tenant_id = ic.tenant_id AND pf.id_item = ic.id_item AND pf.tipo_faixa = 'ATACADO') AS faixas_atacado,
              (SELECT COUNT(*) FROM comercial_unidades_venda uv
               WHERE uv.tenant_id = ic.tenant_id AND uv.id_item = ic.id_item AND uv.permite_venda = 1) AS unidades_venda
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
       WHERE ${filtros.join(' AND ')}`,
      params
    );

    const itens = rows
      .filter((r: any) => !TIPOS_FORA_DA_VENDA.includes(r.tipo))
      .map((r: any) => {
        const preco = {
          custoGerencial: nulo(r.custo_gerencial),
          custoMedio: nulo(r.custo_medio),
          ultimoCusto: nulo(r.ultimo_custo),
          precoVarejo: nulo(r.preco_varejo),
        };
        const defasagem = analisarDefasagem(preco.custoGerencial, preco.custoMedio, preco.ultimoCusto);
        return {
          idItem: Number(r.id_item),
          sku: r.sku,
          nome: r.nome,
          familia: r.familia || null,
          unidadeBase: r.unidade_base || null,
          estoqueVenda: Number(r.quantidade_atual) || 0,
          ...preco,
          variacaoUltimoPct: defasagem.variacaoUltimoPct,
          margemPct: margemPct(preco),
          faixasAtacado: Number(r.faixas_atacado) || 0,
          unidadesVenda: Number(r.unidades_venda) || 0,
          situacoes: situacoesPreco(preco),
        };
      });

    // Resumo antes do filtro de situação (os cards mostram o todo)
    const resumo: Record<string, number> = {};
    for (const s of Object.keys(SITUACOES_PRECO)) resumo[s] = 0;
    for (const i of itens) for (const s of i.situacoes) resumo[s]++;
    const margens = itens.map((i: any) => i.margemPct).filter((m: number | null): m is number => m !== null);
    const margemMedia = margens.length ? Number((margens.reduce((a: number, b: number) => a + b, 0) / margens.length).toFixed(1)) : null;

    const filtrados = situacao ? itens.filter((i: any) => i.situacoes.includes(situacao)) : itens;
    // Críticos primeiro, depois atenção, depois o resto (por nome)
    const peso = (i: any) => (i.situacoes.some((s: SituacaoPreco) => SITUACOES_PRECO[s].nivel === 'critico') ? 0 : i.situacoes.length ? 1 : 2);
    filtrados.sort((a: any, b: any) => peso(a) - peso(b) || String(a.nome).localeCompare(String(b.nome)));

    return res.json({
      data: filtrados.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total: filtrados.length },
      resumo: { itensVenda: itens.length, margemMedia, comMargem: margens.length, porSituacao: resumo },
      situacoes: SITUACOES_PRECO,
    });
  } catch (error: any) {
    console.error('Erro ao montar o painel de preços:', error);
    return res.status(500).json({ error: error.message });
  }
};
