import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

/**
 * 🔌 [READ] GET /produtos/:id_item_ou_sku/atributos
 * Retorna os atributos comerciais de um produto separados por escopo (ficha, dna, grade)
 */
export const getAtributosPorProduto = async (req: Request, res: Response) => {
  const param = req.params.id_item ?? req.params.idItem;
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);

  if (!param) {
    return res.status(400).json({ error: 'ID ou SKU do item não informado para buscar atributos.' });
  }

  const isNumeric = /^\d+$/.test(String(param));
  const idItem = isNumeric ? Number(param) : null;
  const skuString = !isNumeric ? String(param) : null;

  try {
    // Query completa trazendo todos os escopos (ficha, dna, grade)
    const query = `
      SELECT 
        cpd.sku_customizado, 
        ic.sku AS sku_global, 
        ic.nome_item, 
        ac.id AS atributo_id,
        ac.nome AS atributo_nome, 
        ac.tipo AS atributo_tipo, 
        ac.sufixo, 
        COALESCE(ace.escopo_comercial, ac.escopo_padrao) AS escopo, 
        ace.gera_variacao,
        COALESCE(
          ac_op.valor, 
          acv.valor_texto, 
          CAST(acv.valor_numero AS CHAR), 
          CAST(acv.valor_decimal AS CHAR), 
          CAST(acv.valor_data AS CHAR), 
          CASE 
            WHEN acv.valor_boolean = 1 THEN 'Sim' 
            WHEN acv.valor_boolean = 0 THEN 'Não' 
            ELSE NULL 
          END
        ) AS valor_atributo 
      FROM comercial_produtos_dados cpd 
      JOIN itens_core ic 
        ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id 
      JOIN atributos_comercial_valores acv 
        ON acv.id_entidade = cpd.id_item AND acv.tipo_entidade = 'produto' AND acv.tenant_id = cpd.tenant_id 
      JOIN atributos_comercial ac 
        ON ac.id = acv.atributo_id AND ac.tenant_id = cpd.tenant_id 
      LEFT JOIN atributos_comercial_opcoes ac_op 
        ON ac_op.id = acv.opcao_id AND ac_op.tenant_id = cpd.tenant_id
      LEFT JOIN atributos_core_entidades ace 
        ON ace.tenant_id = cpd.tenant_id 
        AND ace.atributo_id = ac.id 
        AND ace.tipo_entidade = 'familia' 
        AND ace.id_entidade = cpd.familia_id
      WHERE ${isNumeric ? 'cpd.id_item = ?' : '(cpd.sku_customizado = ? OR ic.sku = ?)'} 
        AND cpd.tenant_id = ?
    `;

    const queryParams = isNumeric ? [idItem, tenantId] : [skuString, skuString, tenantId];
    const [rows] = await pool.execute(query, queryParams);
    const registros = rows as any[];

    const atributosFicha: any[] = [];
    const atributosDna: any[] = [];
    const atributosGrade: any[] = [];

    // Classificação dinâmica baseada no escopo retornado pela tabela/família
    registros.forEach((row) => {
      const itemFormatado = {
        atributoId: Number(row.atributo_id),
        nome: row.atributo_nome,
        tipoAtributo: row.atributo_tipo,
        sufixo: row.sufixo || '',
        escopo: row.escopo,
        gera_variacao: row.gera_variacao,
        valor: row.valor_atributo
      };

      const escopoLower = String(row.escopo || '').toLowerCase();

      if (escopoLower.includes('dna')) {
        atributosDna.push(itemFormatado);
      } else if (escopoLower.includes('grade') || row.gera_variacao === 1) {
        atributosGrade.push(itemFormatado);
      } else {
        atributosFicha.push(itemFormatado);
      }
    });

    return res.json({
      identificador: param,
      sku: registros[0]?.sku_customizado || registros[0]?.sku_global || '',
      nome_item: registros[0]?.nome_item || '',
      total_atributos: registros.length,
      atributos: {
        ficha: atributosFicha,
        dna: atributosDna,
        grade: atributosGrade
      }
    });

  } catch (error: any) {
    console.error('Erro ao buscar atributos comerciais do produto:', error);
    return res.status(500).json({ error: 'Erro ao carregar os atributos do produto.', details: error.message });
  }
};