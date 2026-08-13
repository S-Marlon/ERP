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

/**
 * 🔄 [UPDATE] PUT /produtos/:id_item
 * Atualiza um produto ou variação existente no catálogo
 */
export const updateProduto = async (req: Request, res: Response) => {
  const { id_item } = req.params;
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || req.body.tenant_id || 1;
  const tenantId = Number(rawTenantId);
  const payload = req.body;

  if (!id_item) {
    return res.status(400).json({ error: 'ID do item não informado para atualização.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Atualiza os dados básicos em itens_core (caso tenham sido enviados)
    const updateCoreFields: string[] = [];
    const updateCoreValues: any[] = [];

    if (payload.sku !== undefined) {
      updateCoreFields.push('sku = ?');
      updateCoreValues.push(payload.sku);
    }
    if (payload.nome_item !== undefined || payload.nome !== undefined) {
      updateCoreFields.push('nome_item = ?');
      updateCoreValues.push(payload.nome_item || payload.nome);
    }
    if (payload.status !== undefined) {
      updateCoreFields.push('status = ?');
      updateCoreValues.push(payload.status);
    }
    if (payload.variacao !== undefined || payload.descricao_variacao !== undefined) {
      updateCoreFields.push('descricao_variacao = ?');
      updateCoreValues.push(payload.descricao_variacao || payload.variacao);
    }

    if (updateCoreFields.length > 0) {
      updateCoreValues.push(id_item, tenantId);
      await connection.execute(
        `UPDATE itens_core SET ${updateCoreFields.join(', ')} WHERE id_item = ? AND tenant_id = ?`,
        updateCoreValues
      );
    }

    // 2. Atualiza os dados comerciais em comercial_produtos_dados
    const updateComercialFields: string[] = [];
    const updateComercialValues: any[] = [];

    if (payload.categoria_id !== undefined) {
      updateComercialFields.push('categoria_id = ?');
      updateComercialValues.push(payload.categoria_id ? Number(payload.categoria_id) : null);
    }
    if (payload.familia_id !== undefined) {
      updateComercialFields.push('familia_id = ?');
      updateComercialValues.push(payload.familia_id ? Number(payload.familia_id) : null);
    }
    if (payload.id_marca !== undefined) {
      updateComercialFields.push('id_marca = ?');
      updateComercialValues.push(payload.id_marca ? Number(payload.id_marca) : null);
    }
    if (payload.custo_gerencial !== undefined) {
      updateComercialFields.push('custo_gerencial = ?');
      updateComercialValues.push(Number(payload.custo_gerencial));
    }
    if (payload.preco_venda !== undefined) {
      updateComercialFields.push('preco_venda = ?');
      updateComercialValues.push(Number(payload.preco_venda));
    }

    if (updateComercialFields.length > 0) {
      updateComercialValues.push(id_item, tenantId);
      
      // Verifica se já existe registro comercial para este id_item
      const [rows]: any = await connection.execute(
        `SELECT id_item FROM comercial_produtos_dados WHERE id_item = ? AND tenant_id = ?`,
        [id_item, tenantId]
      );

      if (rows.length > 0) {
        await connection.execute(
          `UPDATE comercial_produtos_dados SET ${updateComercialFields.join(', ')} WHERE id_item = ? AND tenant_id = ?`,
          updateComercialValues
        );
      } else {
        // Se não existir, faz um INSERT preventivo
        await connection.execute(
          `INSERT INTO comercial_produtos_dados (id_item, tenant_id, categoria_id, familia_id, id_marca, custo_gerencial, preco_venda) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id_item,
            tenantId,
            payload.categoria_id ? Number(payload.categoria_id) : null,
            payload.familia_id ? Number(payload.familia_id) : null,
            payload.id_marca ? Number(payload.id_marca) : null,
            Number(payload.custo_gerencial || 0),
            Number(payload.preco_venda || 0)
          ]
        );
      }
    }

    await connection.commit();
    connection.release();

    return res.status(200).json({
      success: true,
      message: 'Produto atualizado com sucesso!'
    });

  } catch (error: any) {
    await connection.rollback();
    connection.release();
    console.error('Erro ao atualizar produto:', error);
    return res.status(500).json({ error: 'Erro ao atualizar produto.', details: error.message });
  }
};

/**
 * 💾 [CREATE/BATCH] POST /produtos/lote
 * Grava um lote de produtos (pais/famílias e suas variações) enviado pela tela CatalogSku
 */
export const saveProdutosLote = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || req.body.tenant_id || 1;
  const tenantId = Number(rawTenantId);
  const itensLote = req.body.produtos || req.body; // Aceita tanto array direto quanto objeto envelopado

  if (!Array.isArray(itensLote) || itensLote.length === 0) {
    return res.status(400).json({ error: 'Nenhum produto enviado no lote.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const idsCriados: any[] = [];

    for (const itemPai of itensLote) {
      const categoriaId = itemPai.categoria_id ? Number(itemPai.categoria_id) : null;
      const familiaId = itemPai.familia_id ? Number(itemPai.familia_id) : null;
      const idMarca = itemPai.id_marca ? Number(itemPai.id_marca) : null;
      const skusLista = itemPai.skus || [];

      // Se o lote veio estruturado com múltiplas variações (skus)
      if (skusLista.length > 0) {
        for (const skuFilho of skusLista) {
          // 1. Insere o SKU filho na itens_core
          const [resultCore] = await connection.execute(
            `INSERT INTO itens_core (tenant_id, sku, nome_item, tipo_recurso, status, descricao_variacao) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              tenantId,
              skuFilho.sku,
              itemPai.nome_item || skuFilho.variacao,
              itemPai.tipo_recurso || 'PRODUTO',
              skuFilho.status || 'ATIVO',
              skuFilho.variacao || null
            ]
          );

          const novoIdItem = (resultCore as any).insertId;

          // 2. Insere os dados comerciais correspondentes
          await connection.execute(
            `INSERT INTO comercial_produtos_dados (id_item, tenant_id, categoria_id, familia_id, id_marca, custo_gerencial, preco_venda, exibir_no_pdv, pode_vender_sem_estoque) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
            [
              novoIdItem,
              tenantId,
              categoriaId,
              familiaId,
              idMarca,
              Number(skuFilho.custo_gerencial || 0),
              Number(skuFilho.preco_venda || 0)
            ]
          );

          idsCriados.push(novoIdItem);
        }
      } else {
        // Produto isolado sem array de SKUs complexo
        const [resultCore] = await connection.execute(
          `INSERT INTO itens_core (tenant_id, sku, nome_item, tipo_recurso, status, descricao_variacao) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            itemPai.sku,
            itemPai.nome_item,
            itemPai.tipo_recurso || 'PRODUTO',
            itemPai.status || 'ATIVO',
            itemPai.variacao || null
          ]
        );

        const novoIdItem = (resultCore as any).insertId;

        await connection.execute(
          `INSERT INTO comercial_produtos_dados (id_item, tenant_id, categoria_id, familia_id, id_marca, custo_gerencial, preco_venda, exibir_no_pdv, pode_vender_sem_estoque) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
          [
            novoIdItem,
            tenantId,
            categoriaId,
            familiaId,
            idMarca,
            Number(itemPai.custo_gerencial || 0),
            Number(itemPai.preco_venda || 0)
          ]
        );

        idsCriados.push(novoIdItem);
      }
    }

    await connection.commit();
    connection.release();

    return res.status(201).json({
      success: true,
      message: `Lote processado com sucesso! ${idsCriados.length} itens gravados.`,
      ids: idsCriados
    });

  } catch (error: any) {
    await connection.rollback();
    connection.release();
    console.error('Erro na gravação do lote de produtos:', error);
    return res.status(500).json({ error: 'Erro ao salvar lote de produtos.', details: error.message });
  }
};

