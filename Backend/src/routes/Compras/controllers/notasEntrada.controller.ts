// Notas de entrada (modelo novo): registro das NF-e importadas (importacoes_lotes), com itens e a entrada no estoque.
// Valor, emissão e emitente vêm do XML salvo (dados_nota_fiscal); as colunas do lote nem sempre estão preenchidas.
import { Request, Response } from 'express';
import db from '../../Estoque/db.config';
import { alertasDaLinha, AlertaEntrada } from '../staging/auditoriaEntrada';
import { validarGtin } from '../staging/gtin';

const tenantDe = (req: Request) => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Number(v) || 0;

const JSON_NF = (caminho: string) => `JSON_UNQUOTE(JSON_EXTRACT(l.dados_nota_fiscal, '${caminho}'))`;

const CAMPOS_LOTE = `
  l.id, l.chave_acesso, l.numero_nf, l.serie, l.status, l.created_at, l.updated_at,
  l.cnpj_fornecedor,
  COALESCE(NULLIF(l.razao_social_fornecedor, ''), ${JSON_NF('$.emitente.xNome')}, ${JSON_NF('$.emitente.nome')}) AS fornecedor,
  COALESCE(NULLIF(l.nome_fantasia_fornecedor, ''), ${JSON_NF('$.emitente.xFant')}) AS fantasia,
  COALESCE(l.data_emissao, ${JSON_NF('$.dataEmissao')}) AS data_emissao,
  COALESCE(NULLIF(l.valor_total_nf, 0), CAST(${JSON_NF('$.totais.icmsTot.vNF')} AS DECIMAL(15,2))) AS valor_nf,
  COALESCE(l.frete_adicional_valor, 0) AS frete_adicional`;

// Situação da nota para a tela (RASCUNHO pode estar pronta para aprovar)
const situacao = (status: string, total: number, conferidos: number, semVinculo: number) => {
  if (status === 'IMPORTADO') return 'IMPORTADA';
  if (status === 'DESCARTADO') return 'DESCARTADA';
  if (total > 0 && conferidos === total && semVinculo === 0) return 'PRONTA';
  return 'EM_CONFERENCIA';
};

/**
 * GET /api/compras/notas?de&ate (data de entrada no sistema), situacao, busca (nº, fornecedor, CNPJ, chave)
 */
export const listarNotasEntrada = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const where = ['l.tenant_id = ?'];
    const params: any[] = [tenant];
    const data = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
    const de = data(req.query.de);
    const ate = data(req.query.ate);
    if (de) { where.push('l.created_at >= ?'); params.push(`${de} 00:00:00`); }
    if (ate) { where.push('l.created_at <= ?'); params.push(`${ate} 23:59:59`); }
    if (req.query.incluirDescartadas !== 'true') where.push(`l.status <> 'DESCARTADO'`);
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      const termo = `%${busca}%`;
      const digitos = busca.replace(/\D/g, '');
      where.push(`(l.numero_nf LIKE ? OR l.chave_acesso LIKE ? OR l.razao_social_fornecedor LIKE ?
                   OR ${JSON_NF('$.emitente.xNome')} LIKE ? OR ${JSON_NF('$.emitente.xFant')} LIKE ?
                   ${digitos.length >= 3 ? 'OR l.cnpj_fornecedor LIKE ?' : ''})`);
      params.push(termo, termo, termo, termo, termo);
      if (digitos.length >= 3) params.push(`%${digitos}%`);
    }

    const [rows] = await db.execute(
      `SELECT ${CAMPOS_LOTE},
              COUNT(p.id) AS total_itens,
              COALESCE(SUM(p.is_confirmed = 1), 0) AS conferidos,
              COALESCE(SUM(p.produto_id_sistema IS NULL AND COALESCE(TRIM(p.sku_sugerido), '') = ''), 0) AS sem_vinculo,
              (SELECT COALESCE(SUM(m.custo_total), 0) FROM estoque_movimentos m
                WHERE m.tenant_id = l.tenant_id AND m.origem = 'ENTRADA_NFE' AND m.id_origem = l.id) AS custo_entrada
       FROM importacoes_lotes l
       LEFT JOIN importacao_produtos_staging p ON p.lote_importacao_id = l.id AND p.tenant_id = l.tenant_id
       WHERE ${where.join(' AND ')}
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
      params
    );

    const filtro = String(req.query.situacao || '').toUpperCase();
    const notas = (rows as any[]).map(r => {
      const total = n(r.total_itens);
      const conferidos = n(r.conferidos);
      const semVinculo = n(r.sem_vinculo);
      return {
        idLote: Number(r.id),
        chave: r.chave_acesso,
        numero: r.numero_nf,
        serie: r.serie,
        fornecedor: r.fornecedor || 'Fornecedor não identificado',
        fantasia: r.fantasia || null,
        cnpj: r.cnpj_fornecedor,
        emissao: r.data_emissao,
        entradaEm: r.created_at,
        atualizadoEm: r.updated_at,
        valorNf: n(r.valor_nf),
        freteAdicional: n(r.frete_adicional),
        custoEntrada: n(r.custo_entrada),
        totalItens: total,
        conferidos,
        semVinculo,
        situacao: situacao(r.status, total, conferidos, semVinculo),
      };
    }).filter(nota => !filtro || nota.situacao === filtro);

    return res.json({
      data: notas,
      resumo: {
        notas: notas.length,
        importadas: notas.filter(x => x.situacao === 'IMPORTADA').length,
        pendentes: notas.filter(x => x.situacao === 'EM_CONFERENCIA' || x.situacao === 'PRONTA').length,
        valorImportado: Number(notas.filter(x => x.situacao === 'IMPORTADA').reduce((a, x) => a + x.valorNf, 0).toFixed(2)),
        valorPendente: Number(notas.filter(x => x.situacao === 'EM_CONFERENCIA' || x.situacao === 'PRONTA').reduce((a, x) => a + x.valorNf, 0).toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar notas de entrada:', error);
    return res.status(500).json({ error: 'Erro ao listar as notas de entrada.', details: error.message });
  }
};

/**
 * Auditoria das linhas já aprovadas: custo fora do padrão das outras compras do item, código do fornecedor
 * que já entrou como outro item, GTIN da nota diferente do cadastrado no item.
 */
const auditarLinhas = async (tenant: number, loteId: number, cnpj: string | null, itens: any[]) => {
  const resultado = new Map<number, AlertaEntrada[]>();
  const aprovadas = itens.filter(i => i.produto_id_sistema && i.custo_estoque !== null);
  if (aprovadas.length === 0) return resultado;
  const idsItens = [...new Set(aprovadas.map(i => Number(i.produto_id_sistema)))];
  const marcas = (lista: unknown[]) => lista.map(() => '?').join(',');

  // Custos das outras entradas por NF de cada item (mais recentes primeiro)
  const [custos]: any = await db.execute(
    `SELECT id_item, custo_unitario FROM estoque_movimentos
     WHERE tenant_id = ? AND origem = 'ENTRADA_NFE' AND id_origem <> ? AND custo_unitario > 0 AND id_item IN (${marcas(idsItens)})
     ORDER BY created_at DESC`,
    [tenant, loteId, ...idsItens]
  );
  const custosPorItem = new Map<number, number[]>();
  for (const c of custos) {
    const lista = custosPorItem.get(Number(c.id_item)) || [];
    if (lista.length < 6) lista.push(n(c.custo_unitario));
    custosPorItem.set(Number(c.id_item), lista);
  }

  // GTINs cadastrados nos itens
  const [gtins]: any = await db.execute(
    `SELECT id_item, gtin FROM comercial_unidades_venda
     WHERE tenant_id = ? AND NULLIF(TRIM(gtin), '') IS NOT NULL AND id_item IN (${marcas(idsItens)})`,
    [tenant, ...idsItens]
  );
  const gtinsPorItem = new Map<number, string[]>();
  for (const g of gtins) gtinsPorItem.set(Number(g.id_item), [...(gtinsPorItem.get(Number(g.id_item)) || []), String(g.gtin)]);

  // Mesmo código deste fornecedor que entrou como outro item em outras notas
  const codigos = [...new Set(aprovadas.map(i => String(i.codigo_fornecedor || '').trim()).filter(Boolean))];
  const itensPorCodigo = new Map<string, Map<number, string>>();
  if (cnpj && codigos.length > 0) {
    const [outros]: any = await db.execute(
      `SELECT s.codigo_fornecedor, s.produto_id_sistema AS id_item,
              COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku
       FROM importacao_produtos_staging s
       INNER JOIN importacoes_lotes l ON l.id = s.lote_importacao_id AND l.tenant_id = s.tenant_id
       LEFT JOIN itens_core ic ON ic.id_item = s.produto_id_sistema AND ic.tenant_id = s.tenant_id
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = s.produto_id_sistema AND cpd.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? AND l.cnpj_fornecedor = ? AND s.lote_importacao_id <> ? AND s.status = 'IMPORTADO'
         AND s.produto_id_sistema IS NOT NULL AND s.codigo_fornecedor IN (${marcas(codigos)})`,
      [tenant, cnpj, loteId, ...codigos]
    );
    for (const o of outros) {
      const chave = String(o.codigo_fornecedor).trim();
      if (!itensPorCodigo.has(chave)) itensPorCodigo.set(chave, new Map());
      itensPorCodigo.get(chave)!.set(Number(o.id_item), o.sku || `#${o.id_item}`);
    }
  }

  for (const i of aprovadas) {
    const idItem = Number(i.produto_id_sistema);
    let gtinManual: string | null = null;
    try { gtinManual = JSON.parse(i.mapeamento_json || '{}')?.gtin_manual || null; } catch { /* sem mapeamento */ }
    const gtinLinha = String(gtinManual || i.ean || '').replace(/\D/g, '');
    const outros = itensPorCodigo.get(String(i.codigo_fornecedor || '').trim());
    resultado.set(Number(i.id), alertasDaLinha({
      custoEntrada: n(i.custo_estoque) || null,
      custosAnteriores: custosPorItem.get(idItem) || [],
      custoGerencial: i.custo_gerencial !== null && i.custo_gerencial !== undefined ? n(i.custo_gerencial) : null,
      outrosItensMesmoCodigo: outros ? [...outros].filter(([id]) => id !== idItem).map(([, sku]) => sku) : [],
      gtinLinha: gtinLinha && validarGtin(gtinLinha) ? gtinLinha : null,
      gtinsDoItem: gtinsPorItem.get(idItem) || [],
    }));
  }
  return resultado;
};

/**
 * GET /api/compras/notas/:loteId — cabeçalho, totais do XML, itens (com o item do catálogo vinculado)
 * e o que entrou no estoque (movimentos ENTRADA_NFE).
 */
export const detalheNotaEntrada = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const loteId = Number(req.params.loteId);
  try {
    const [[lote]]: any = await db.execute(
      `SELECT ${CAMPOS_LOTE}, l.dados_nota_fiscal, l.frete_adicional_metodo
       FROM importacoes_lotes l WHERE l.id = ? AND l.tenant_id = ?`,
      [loteId, tenant]
    );
    if (!lote) return res.status(404).json({ error: 'Nota não encontrada.' });
    const dados = typeof lote.dados_nota_fiscal === 'string' ? JSON.parse(lote.dados_nota_fiscal || '{}') : (lote.dados_nota_fiscal || {});
    const t = dados?.totais?.icmsTot || {};

    const [itens] = await db.execute(
      `SELECT p.id, p.item_nfe_seq, p.codigo_fornecedor, COALESCE(p.descricao_xml, p.nome_fornecedor) AS descricao_nf, p.ean,
              p.unidade_original, p.quantidade, p.quantidade_recebida, p.preco_custo_unitario, p.valor_total_nfe,
              p.frete_rateado, p.ipi, p.icms_st, p.custo_unitario_final, p.custo_total_final, p.tipo_entrada,
              p.is_confirmed, p.status, p.produto_id_sistema, p.mapeamento_json, cpd.custo_gerencial,
              COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku, p.sku_sistema, p.sku_sugerido) AS sku_item,
              COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item, p.nome_item_sugerido) AS nome_item,
              um.sigla AS unidade_base,
              m.qtd_estoque, m.fator_conversao, m.custo_estoque, m.depositos
       FROM importacao_produtos_staging p
       LEFT JOIN itens_core ic ON ic.id_item = p.produto_id_sistema AND ic.tenant_id = p.tenant_id
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       -- Uma linha da NF pode ter entrado em mais de um depósito (ex.: 20 VENDA + 10 ALMOXARIFADO)
       LEFT JOIN (
         SELECT id_origem_item, SUM(quantidade) AS qtd_estoque, MAX(fator_conversao) AS fator_conversao,
                MAX(custo_unitario) AS custo_estoque, GROUP_CONCAT(CONCAT(deposito, ':', quantidade)) AS depositos
         FROM estoque_movimentos
         WHERE tenant_id = ? AND origem = 'ENTRADA_NFE' AND id_origem = ?
         GROUP BY id_origem_item
       ) m ON m.id_origem_item = p.id
       WHERE p.lote_importacao_id = ? AND p.tenant_id = ?
       ORDER BY p.item_nfe_seq, p.id`,
      [tenant, loteId, loteId, tenant]
    );

    // Linhas corrigidas depois da aprovação: o estoque atual é o da última correção
    const [correcoes]: any = await db.execute(
      `SELECT staging_id, fator_novo, detalhes_json FROM importacao_correcoes
       WHERE tenant_id = ? AND lote_importacao_id = ? ORDER BY id`,
      [tenant, loteId]
    );
    const correcoesPorLinha = new Map<number, number>();
    for (const c of correcoes) {
      correcoesPorLinha.set(Number(c.staging_id), (correcoesPorLinha.get(Number(c.staging_id)) || 0) + 1);
      let depois: any = null;
      try { depois = JSON.parse(c.detalhes_json || '{}')?.depois; } catch { /* sem detalhes */ }
      const linha = (itens as any[]).find(i => Number(i.id) === Number(c.staging_id));
      if (!linha || !depois?.posicao?.length) continue;
      linha.qtd_estoque = depois.posicao.reduce((a: number, p: any) => a + n(p.quantidade), 0);
      linha.fator_conversao = n(c.fator_novo);
      linha.custo_estoque = n(depois.posicao[0].custoUnitario);
      linha.depositos = depois.posicao.map((p: any) => `${p.deposito}:${p.quantidade}`).join(',');
    }

    const alertas = await auditarLinhas(tenant, loteId, lote.cnpj_fornecedor, itens as any[]);

    const total = (itens as any[]).length;
    const conferidos = (itens as any[]).filter(i => Number(i.is_confirmed) === 1).length;
    const semVinculo = (itens as any[]).filter(i => !i.produto_id_sistema && !i.sku_item).length;

    return res.json({
      idLote: Number(lote.id),
      chave: lote.chave_acesso,
      numero: lote.numero_nf,
      serie: lote.serie,
      fornecedor: lote.fornecedor,
      fantasia: lote.fantasia,
      cnpj: lote.cnpj_fornecedor,
      emitente: dados?.emitente ? {
        ie: dados.emitente.ie || null,
        municipio: dados.emitente.municipio || dados.emitente.enderEmit?.xMun || null,
        uf: dados.emitente.uf || null,
        fone: dados.emitente.fone || null,
      } : null,
      emissao: lote.data_emissao,
      entradaEm: lote.created_at,
      situacao: situacao(lote.status, total, conferidos, semVinculo),
      totais: {
        produtos: n(t.vProd),
        frete: n(t.vFrete),
        seguro: n(t.vSeg),
        desconto: n(t.vDesc),
        ipi: n(t.vIPI),
        icmsSt: n(t.vST),
        outros: n(t.vOutro),
        icms: n(t.vICMS),
        nota: n(lote.valor_nf),
        freteAdicional: n(lote.frete_adicional),
        freteAdicionalMetodo: lote.frete_adicional_metodo || null,
      },
      itens: (itens as any[]).map(i => ({
        idStaging: Number(i.id),
        seq: i.item_nfe_seq,
        codigoFornecedor: i.codigo_fornecedor,
        descricaoNf: i.descricao_nf,
        ean: i.ean,
        unidadeNf: i.unidade_original,
        quantidadeNf: n(i.quantidade),
        quantidadeRecebida: i.quantidade_recebida !== null ? n(i.quantidade_recebida) : null,
        custoUnitarioNf: n(i.preco_custo_unitario),
        valorNf: n(i.valor_total_nfe),
        freteRateado: n(i.frete_rateado),
        custoUnitarioFinal: n(i.custo_unitario_final),
        custoTotalFinal: n(i.custo_total_final),
        tipoEntrada: i.tipo_entrada || 'PRODUTO',
        conferido: Number(i.is_confirmed) === 1,
        idItem: i.produto_id_sistema ? Number(i.produto_id_sistema) : null,
        skuItem: i.sku_item || null,
        nomeItem: i.nome_item || null,
        unidadeBase: i.unidade_base || null,
        // O que entrou no estoque (na unidade base)
        quantidadeEstoque: i.qtd_estoque !== null ? n(i.qtd_estoque) : null,
        fatorConversao: i.fator_conversao !== null ? n(i.fator_conversao) : null,
        custoEstoque: i.custo_estoque !== null ? n(i.custo_estoque) : null,
        depositos: String(i.depositos || '').split(',').filter(Boolean).map((par: string) => {
          const [deposito, q] = par.split(':');
          return { deposito, quantidade: n(q) };
        }),
        alertas: alertas.get(Number(i.id)) || [],
        correcoes: correcoesPorLinha.get(Number(i.id)) || 0,
        status: i.status,
      })),
      resumo: { totalItens: total, conferidos, semVinculo, comAlerta: [...alertas.values()].filter(a => a.length > 0).length },
    });
  } catch (error: any) {
    console.error('Erro ao carregar a nota de entrada:', error);
    return res.status(500).json({ error: 'Erro ao carregar a nota.', details: error.message });
  }
};
