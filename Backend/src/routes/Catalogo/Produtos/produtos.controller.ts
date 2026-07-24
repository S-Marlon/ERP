import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

/**
 * 🔌 [READ] GET /produtos
 * Retorna itens_core com os dados comerciais prontos para o CatalogSku.service.ts
 */
export const getProdutos = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);

  try {
    const query = `
      SELECT 
        ic.id_item,
        ic.tenant_id,
        ic.sku,
        ic.nome_item,
        ic.tipo_recurso,
        ic.status,
        ic.descricao_variacao,
        cpd.categoria_id,
        cpd.familia_id,
        cpd.id_marca,
        cpd.custo_gerencial,
        cpd.preco_venda,
        fam.nome AS nome_familia
      FROM itens_core ic
      LEFT JOIN comercial_produtos_dados cpd 
        ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
      LEFT JOIN comercial_familias fam 
        ON cpd.familia_id = fam.id AND cpd.tenant_id = fam.tenant_id
      WHERE ic.tenant_id = ?
      ORDER BY cpd.familia_id ASC, ic.id_item ASC
    `;

    const [rows] = await pool.execute(query, [tenantId]);
    const itens = rows as any[];

    if (itens.length === 0) {
      return res.json([]);
    }

    const mapaFamilias = new Map<number, any>();
    const produtosIndividuais: any[] = [];

    for (const item of itens) {
      const idItem = Number(item.id_item);
      const familiaId = item.familia_id ? Number(item.familia_id) : null;

      // SKU Filho (Entra na sub-tabela expandida)
      const skuFilho = {
        key: `sku-${idItem}`,
        id_item: idItem,
        sku: item.sku || '',
        variacao: item.descricao_variacao || item.nome_item || 'Principal',
        marca: item.id_marca ? String(item.id_marca) : 'Própria',
        estoque: 0,
        preco_venda: Number(item.preco_venda || 0),
        custo_gerencial: Number(item.custo_gerencial || 0),
        status: String(item.status || 'ATIVO').toUpperCase()
      };

      if (familiaId) {
        if (mapaFamilias.has(familiaId)) {
          // Já existe o Pai da Família -> Adiciona mais este SKU
          mapaFamilias.get(familiaId).skus.push(skuFilho);
        } else {
          // Cria o Registro Pai da Família
          mapaFamilias.set(familiaId, {
            key: `fam-${familiaId}`,
            id_item: `FAM-${familiaId}`,
            tenant_id: Number(item.tenant_id || tenantId),
            sku: `FAM-${familiaId}`,
            nome_item: item.nome_familia || `Família #${familiaId}`, // Puxa "Motobombas" da comercial_familias
            tipo_recurso: 'PRODUTO',
            status: 'ATIVO',
            categoria_id: item.categoria_id ? Number(item.categoria_id) : null,
            familia_id: familiaId,
            id_marca: item.id_marca ? Number(item.id_marca) : null,
            skus: [skuFilho]
          });
        }
      } else {
        // Produto sem família vinculada (Ex: Óleo Lubrificante)
        produtosIndividuais.push({
          key: `prod-${idItem}`,
          id_item: idItem,
          tenant_id: Number(item.tenant_id || tenantId),
          sku: item.sku || '',
          nome_item: item.nome_item || 'Produto Solto',
          tipo_recurso: item.tipo_recurso || 'PRODUTO',
          status: String(item.status || 'ATIVO').toUpperCase(),
          categoria_id: item.categoria_id ? Number(item.categoria_id) : null,
          familia_id: null,
          id_marca: item.id_marca ? Number(item.id_marca) : null,
          skus: [skuFilho]
        });
      }
    }

    // Retorna as famílias agrupadas junto dos produtos sem família
    return res.json([
      ...Array.from(mapaFamilias.values()),
      ...produtosIndividuais
    ]);

  } catch (error) {
    console.error('Erro ao agrupar produtos do catálogo:', error);
    return res.status(500).json({ error: 'Erro ao carregar o catálogo.' });
  }
};

export const updateProduto = async (req: Request, res: Response) => {
  return res.status(501).json({ message: 'Endpoint de atualização em implementação.' });
};

export const saveProdutosLote = async (req: Request, res: Response) => {
  return res.status(501).json({ message: 'Endpoint de gravação em lote em implementação.' });
};