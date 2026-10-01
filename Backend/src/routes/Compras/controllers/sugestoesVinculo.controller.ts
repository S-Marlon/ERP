// Reconhecimento automático na entrada de NF-e: sugere o item do catálogo para cada linha da nota
// 1º pelo código do produto no fornecedor (comercial_fornecedores_produtos, gravado nas entradas anteriores),
// 2º pelo GTIN (comercial_unidades_venda). Traz também a conversão usada da última vez e o depósito da última entrada.
import { Request, Response } from 'express';
import db from '../../Estoque/db.config';
import { validarGtin } from '../staging/gtin';

const tenantDe = (req: Request) => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

const buscarFornecedorId = async (tenant: number, cnpj: unknown): Promise<number | null> => {
  const digitos = String(cnpj || '').replace(/\D/g, '');
  if (!digitos) return null;
  const [rows]: any = await db.execute(
    `SELECT c.id_pessoa AS id
     FROM pessoas_core c
     INNER JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa
     INNER JOIN pessoas_papeis_atribuido pa ON pa.id_cliente = c.id_pessoa
     INNER JOIN pessoas_papeis_definicao pd ON pd.id_cliente_papel = pa.id_cliente_papel
     WHERE REPLACE(REPLACE(REPLACE(pj.cnpj, '.', ''), '/', ''), '-', '') = ? AND c.tenant_id = ? AND pd.codigo = 'FORNECEDOR'
     LIMIT 1`,
    [digitos, tenant]
  );
  return rows[0]?.id ?? null;
};

const CAMPOS_ITEM = `
  ic.id_item, ic.status, ic.tipo_recurso, um.sigla AS unidade_base,
  COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
  COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
  (SELECT GROUP_CONCAT(DISTINCT m.deposito) FROM estoque_movimentos m
    WHERE m.tenant_id = ic.tenant_id AND m.id_item = ic.id_item AND m.origem = 'ENTRADA_NFE'
      AND m.id_origem = (SELECT MAX(m2.id_origem) FROM estoque_movimentos m2
                         WHERE m2.tenant_id = ic.tenant_id AND m2.id_item = ic.id_item AND m2.origem = 'ENTRADA_NFE')) AS ultimos_depositos`;

const JOINS_ITEM = `
  INNER JOIN itens_core ic ON ic.id_item = x.id_item AND ic.tenant_id = x.tenant_id
  LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
  LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade`;

const montar = (r: any, origem: 'FORNECEDOR' | 'GTIN', extra: Record<string, unknown>) => ({
  idItem: Number(r.id_item),
  sku: r.sku,
  nome: r.nome,
  status: r.status,
  tipoRecurso: r.tipo_recurso,
  unidadeBase: r.unidade_base || null,
  origem,
  ultimosDepositos: r.ultimos_depositos ? String(r.ultimos_depositos).split(',') : [],
  ...extra,
});

/**
 * POST /api/compras/sugestoes-vinculo
 * { cnpj, itens: [{ chave, codigo, ean }] } -> { sugestoes: { [chave]: { idItem, sku, nome, origem, unidadeCompra, fator, ... } } }
 */
export const sugerirVinculos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const itens: Array<{ chave: string; codigo?: string; ean?: string }> = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (itens.length === 0) return res.json({ sugestoes: {} });
    const idFornecedor = await buscarFornecedorId(tenant, req.body?.cnpj);
    const sugestoes: Record<string, any> = {};

    // 1) Código do produto no fornecedor (vínculo gravado nas entradas anteriores)
    const codigos = [...new Set(itens.map(i => String(i.codigo || '').trim()).filter(Boolean))];
    if (idFornecedor && codigos.length > 0) {
      const [rows]: any = await db.execute(
        `SELECT x.codigo_produto_fornecedor AS codigo, x.unidade_compra, x.fator_compra, x.preco_ultima_compra, ${CAMPOS_ITEM}
         FROM comercial_fornecedores_produtos x ${JOINS_ITEM}
         WHERE x.tenant_id = ? AND x.id_fornecedor = ? AND x.codigo_produto_fornecedor IN (${codigos.map(() => '?').join(',')})`,
        [tenant, idFornecedor, ...codigos]
      );
      const porCodigo = new Map<string, any>();
      for (const r of rows) if (!porCodigo.has(String(r.codigo))) porCodigo.set(String(r.codigo), r);
      for (const i of itens) {
        const r = porCodigo.get(String(i.codigo || '').trim());
        if (r) {
          sugestoes[i.chave] = montar(r, 'FORNECEDOR', {
            unidadeCompra: r.unidade_compra || null,
            fator: Number(r.fator_compra) > 0 ? Number(r.fator_compra) : 1,
            precoUltimaCompra: r.preco_ultima_compra !== null ? Number(r.preco_ultima_compra) : null,
          });
        }
      }
    }

    // 2) GTIN válido já cadastrado numa unidade de venda (só para quem não achou pelo código)
    const pendentes = itens.filter(i => !sugestoes[i.chave]);
    const gtins = [...new Set(pendentes.map(i => String(i.ean || '').trim()).filter(g => validarGtin(g)))];
    if (gtins.length > 0) {
      const [rows]: any = await db.execute(
        `SELECT x.gtin, u.sigla AS unidade_gtin, (x.id_unidade = ic.id_unidade) AS eh_base, conv.fator_conversao, ${CAMPOS_ITEM}
         FROM comercial_unidades_venda x ${JOINS_ITEM}
         INNER JOIN itens_unidades_medida u ON u.id_unidade = x.id_unidade
         LEFT JOIN itens_unidades_conversao conv ON conv.id_item = x.id_item AND conv.id_unidade_derivada = x.id_unidade AND conv.tenant_id = x.tenant_id
         WHERE x.tenant_id = ? AND x.gtin IN (${gtins.map(() => '?').join(',')})`,
        [tenant, ...gtins]
      );
      const porGtin = new Map<string, any>();
      for (const r of rows) porGtin.set(String(r.gtin), r);
      for (const i of pendentes) {
        const r = porGtin.get(String(i.ean || '').trim());
        if (r) {
          sugestoes[i.chave] = montar(r, 'GTIN', {
            unidadeCompra: r.unidade_gtin || null,
            fator: Number(r.eh_base) ? 1 : (Number(r.fator_conversao) > 0 ? Number(r.fator_conversao) : 1),
            precoUltimaCompra: null,
          });
        }
      }
    }

    return res.json({ fornecedorCadastrado: idFornecedor !== null, sugestoes });
  } catch (error: any) {
    console.error('Erro ao sugerir vínculos:', error);
    return res.status(500).json({ error: 'Erro ao sugerir vínculos.', details: error.message });
  }
};

/**
 * POST /compras/classificacao-itens  { ids: number[] }
 * Família e categoria atuais dos itens já cadastrados que aparecem na nota (vínculos), para a conferência
 * mostrar onde o item está no catálogo. A categoria da família prevalece (regra do PIM).
 */
export const classificacaoItens = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (ids.length === 0) return res.json({ itens: {} });
    const [rows]: any = await db.execute(
      `SELECT ic.id_item, f.id AS familia_id, f.nome AS familia_nome, f.status AS familia_status,
              cat.id AS categoria_id, cat.nome AS categoria_nome
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
       LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id)
       WHERE ic.tenant_id = ? AND ic.id_item IN (${ids.map(() => '?').join(',')})`,
      [tenant, ...ids]
    );
    const itens: Record<string, unknown> = {};
    for (const r of rows) {
      itens[String(r.id_item)] = {
        familia: r.familia_id ? { id: Number(r.familia_id), nome: r.familia_nome, status: r.familia_status } : null,
        categoria: r.categoria_id ? { id: Number(r.categoria_id), nome: r.categoria_nome } : null,
      };
    }
    return res.json({ itens });
  } catch (error: any) {
    console.error('Erro ao carregar a classificação dos itens:', error);
    return res.status(500).json({ error: error.message });
  }
};
