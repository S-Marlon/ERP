import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

/**
 * 🟡 [UPDATE / LINK] Atualizar Família e Atributos Comerciais do Produto 
 * (Busca e atualiza diretamente na tabela comercial, sem tocar em itens_core)
 */
export const updateProdutoFamiliaEAtributos = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
  const { isBatch, selectedRowKeys, familiaId, itemAttributesOverride, batchItemOverrides, sku, skusEmLote } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let itensParaProcessar: Array<{ 
      skuTarget: string; 
      atributos: Array<{ nome: string; valor: string }> 
    }> = [];

    if (isBatch) {
      // Modo Lote: espera uma lista de SKUs ou o mapeamento por SKU
      for (const [skuKey, attrs] of Object.entries(batchItemOverrides || skusEmLote || {})) {
        itensParaProcessar.push({
          skuTarget: skuKey,
          atributos: attrs as Array<{ nome: string; valor: string }>
        });
      }
    } else {
      // Modo Unitário: usa o SKU informado diretamente
      const skuTarget = sku || req.body.id_item;
      if (!skuTarget) {
        await connection.rollback();
        return res.status(400).json({ error: 'SKU do produto não informado para atualização.' });
      }
      itensParaProcessar.push({
        skuTarget: String(skuTarget),
        atributos: itemAttributesOverride || []
      });
    }

   for (const itemProc of itensParaProcessar) {
      const skuLimpo = itemProc.skuTarget.trim();

      // 1️⃣ Localiza o ID real do produto na `itens_core` usando o SKU informado pelo front
      const [checkItem] = await connection.execute(
        `SELECT id_item FROM itens_core WHERE sku = ? AND tenant_id = ? LIMIT 1`,
        [skuLimpo, tenantId]
      );

      const itemFound = (checkItem as any[])[0];

      if (!itemFound) {
        await connection.rollback();
        return res.status(404).json({ 
          error: `Produto com o SKU "${skuLimpo}" não foi encontrado na base de dados.` 
        });
      }

      const itemIdReal = itemFound.id_item;

      // 2️⃣ Verifica se já existe registro em `comercial_produtos_dados` para este item
      // 2️⃣ Verifica se já existe registro em `comercial_produtos_dados` para este item
      const [checkDados] = await connection.execute(
        `SELECT id_item FROM comercial_produtos_dados WHERE id_item = ? AND tenant_id = ?`,
        [itemIdReal, tenantId]
      );

      // Converte explicitamente para null caso venha vazio, undefined ou string vazia
      const familiaIdFinal = familiaId !== undefined && familiaId !== '' ? familiaId : null;

      if ((checkDados as any[]).length === 0) {
        // Se não existir, cria o registro comercial vinculado à família (ou null se for desagrupado)
        await connection.execute(
          `INSERT INTO comercial_produtos_dados (id_item, tenant_id, familia_id) VALUES (?, ?, ?)`,
          [itemIdReal, tenantId, familiaIdFinal]
        );
      } else {
        // Se já existir, atualiza o familia_id (aceitando NULL para desagrupar)
        await connection.execute(
          `UPDATE comercial_produtos_dados SET familia_id = ? WHERE id_item = ? AND tenant_id = ?`,
          [familiaIdFinal, itemIdReal, tenantId]
        );
      }

      // 3️⃣ Processamento dos atributos comerciais (mantém igual se houver atributos...)
      if (Array.isArray(itemProc.atributos) && itemProc.atributos.length > 0) {
        for (const attrUser of itemProc.atributos) {
          const [attrRows] = await connection.execute(
            `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND UPPER(nome) = UPPER(?) LIMIT 1`,
            [tenantId, attrUser.nome]
          );

          const attrFound = (attrRows as any[])[0];
          if (!attrFound) continue;

          const atributoId = attrFound.id;
          const valorFormatado = String(attrUser.valor).trim().toUpperCase();

          const [valCheck] = await connection.execute(
            `SELECT id FROM atributos_comercial_valores 
             WHERE tenant_id = ? AND tipo_entidade = 'produto' AND id_entidade = ? AND atributo_id = ?`,
            [tenantId, itemIdReal, atributoId]
          );

          if ((valCheck as any[]).length > 0) {
            await connection.execute(
              `UPDATE atributos_comercial_valores 
               SET valor_texto = ? 
               WHERE tenant_id = ? AND tipo_entidade = 'produto' AND id_entidade = ? AND atributo_id = ?`,
              [valorFormatado, tenantId, itemIdReal, atributoId]
            );
          } else {
            await connection.execute(
              `INSERT INTO atributos_comercial_valores 
               (tenant_id, atributo_id, tipo_entidade, id_entidade, valor_texto) 
               VALUES (?, ?, 'produto', ?, ?)`,
              [tenantId, atributoId, itemIdReal, valorFormatado]
            );
          }
        }
      }
    }  // 👈 Fechamento correto do loop `for (const itemProc of itensParaProcessar)`

    await connection.commit();// 2️⃣ Verifica se já existe registro em `comercial_produtos_dados` para este item
    return res.json({ 
      success: true, 
      message: isBatch ? 'Lote de produtos atualizado por SKU com sucesso!' : 'Família e atributos atualizados por SKU com sucesso!' 
    });

  } catch (error) {
    await connection.rollback();
    console.error('Erro ao atualizar por SKU:', error);
    return res.status(500).json({ error: 'Erro interno ao persistir dados comerciais do produto.' });
  } finally {
    connection.release();
  }
};

export const testarRotaProduto = async (req: Request, res: Response) => {
  return res.json({ 
    success: true, 
    message: 'A rota de produtos comerciais está ativa e funcionando!',
    timestamp: new Date().toISOString()
  });
};