router.post('/api/compras/notas-fiscais/itens/mapear', async (req, res) => {
    const { 
        tenant_id, 
        id_item_nota, // O id_item da tabela compras_core_nota_itens
        id_fornecedor, // Vindo do cabeçalho da nota para o De-Para
        payload 
    } = req.body;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        const { mode, existingProductId, isDraft, productData, variantData, salesUnits } = payload;
        
        // Recupera dados brutos do item da nota fiscal para usar nas tabelas filhas
        const [[itemNota]] = await connection.execute(
            `SELECT sku_fornecedor, ean_fornecedor, descricao_fornecedor, valor_unitario_xml 
             FROM compras_core_nota_itens WHERE id_item = ?`, 
            [id_item_nota]
        );

        if (!itemNota) {
            throw new Error("Item da nota fiscal não encontrado.");
        }

        let targetProductId = existingProductId;

        // ==========================================
        // CENÁRIO A: CRIAÇÃO DE UM NOVO PRODUTO (DRAFT)
        // ==========================================
        if (mode === 'DRAFT' || isDraft) {
            // 1. Inserção na Tabela Core
            const [newProduct] = await connection.execute(`
                INSERT INTO produtos_core (tenant_id, codigo_interno, codigo_barras, descricao, tipo_produto, unidade, status)
                VALUES (?, ?, ?, ?, 'COMPRADO', ?, 'ATIVO')
            `, [
                tenant_id, 
                productData.sku, 
                itemNota.ean_fornecedor || null, 
                productData.descricao, 
                salesUnits[0]?.unit || '-'
            ]);

            targetProductId = newProduct.insertId;

            // 2. Inserção na Componente de Estoque
            await connection.execute(`
                INSERT INTO produtos_core_estoque (id_produto, estoque_minimo, estoque_maximo, dias_cobertura)
                VALUES (?, 0.000, 0.000, 30)
            `, [targetProductId]);

            // 3. Inserção na Componente Fiscal
            await connection.execute(`
                INSERT INTO produtos_core_fiscal (id_produto, origem_mercadoria)
                VALUES (?, 0)
            `, [targetProductId]);
        }

        // ==========================================
        // CENÁRIO B: TRATAMENTO DE GRADE / VARIAÇÕES
        // ==========================================
        if (variantData) {
            if (variantData.isNewVariant) {
                // Aqui você inseriria o registro na sua tabela de variações/grades.
                // Como essa tabela não estava no dump, representamos a intenção lógica:
                console.log(`Criando nova variação '${variantData.newVariantName}' para o produto Pai ${targetProductId}`);
                
                // Se a variante tem um SKU próprio, você usaria o variantData.newVariantSku
            } else {
                // Vincula ao id da variante existente escolhido no select (variantData.selectedVariantId)
                console.log(`Vinculando item à variante existente ID: ${variantData.selectedVariantId}`);
            }
        }

        // ==========================================
        // CÁLCULO E GRAVAÇÃO COMERCIAL (PRECIFICAÇÃO)
        // ==========================================
        if (salesUnits && salesUnits.length > 0) {
            // No seu Dump, a precificação é 1 para 1 com id_produto. 
            // Se houver mais de uma unidade (ex: Rolo e Metro), pegamos a principal ou a de maior valor.
            const unitData = salesUnits[0]; 

            // Verifica se o registro comercial já existe para decidir entre INSERT ou UPDATE
            const [[comercialExistente]] = await connection.execute(
                `SELECT id_produto FROM produtos_core_comercial WHERE id_produto = ?`, 
                [targetProductId]
            );

            if (comercialExistente) {
                // Atualiza o preço atualizando o histórico de auditoria
                await connection.execute(`
                    INSERT INTO produtos_core_precos_historico 
                        (tenant_id, id_produto, preco_custo_anterior, preco_custo_novo, preco_venda_anterior, preco_venda_novo, motivo)
                    SELECT ?, id_produto, preco_custo_oficial, ?, preco_venda, ?, 'Atualizado via Entrada de NF'
                    FROM produtos_core_comercial WHERE id_produto = ?
                `, [tenant_id, unitData.cost, unitData.price, targetProductId]);

                await connection.execute(`
                    UPDATE produtos_core_comercial 
                    SET preco_custo_nf = ?, preco_custo_oficial = ?, metodo_precificacao = 'MARKUP', markup_praticado = ?, preco_venda = ?
                    WHERE id_produto = ?
                `, [unitData.cost, unitData.cost, unitData.markup, unitData.price, targetProductId]);
            } else {
                // Carga Comercial Inicial
                await connection.execute(`
                    INSERT INTO produtos_core_comercial (id_produto, preco_custo_nf, preco_custo_oficial, metodo_precificacao, markup_praticado, preco_venda)
                    VALUES (?, ?, ?, 'MARKUP', ?, ?)
                `, [targetProductId, unitData.cost, unitData.cost, unitData.markup, unitData.price]);
                
                // Histórico de carga inicial
                await connection.execute(`
                    INSERT INTO produtos_core_precos_historico (tenant_id, id_produto, preco_custo_anterior, preco_custo_novo, preco_venda_anterior, preco_venda_novo, motivo)
                    VALUES (?, ?, 0.0000, ?, 0.00, ?, 'Carga inicial via Mapeamento de NF')
                `, [tenant_id, targetProductId, unitData.cost, unitData.price]);
            }

            // Grava o fator de conversão em suprimentos se for fracionado
            const fracUnit = salesUnits.find(u => u.type === 'FRAC');
            if (fracUnit) {
                await connection.execute(`
                    INSERT INTO produtos_core_suprimentos (id_produto, id_fornecedor_homologado, fator_conversao_compra)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE fator_conversao_compra = ?
                `, [targetProductId, id_fornecedor, fracUnit.conversion, fracUnit.conversion]);
            }
        }

        // ==========================================
        // CRIAÇÃO DO VÍNCULO DE-PARA & ATUALIZAÇÃO DA NF
        // ==========================================
        
        // 1. Cria a relação para que o sistema reconheça este produto automaticamente no próximo XML
        await connection.execute(`
            INSERT INTO produtos_core_fornecedores (id_produto, id_fornecedor, sku_fornecedor, ean_fornecedor, descricao_fornecedor, ativo)
            VALUES (?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE id_produto = ?, ean_fornecedor = ?
        `, [
            targetProductId, 
            id_fornecedor, 
            itemNota.sku_fornecedor, 
            itemNota.ean_fornecedor, 
            itemNota.descricao_fornecedor,
            targetProductId,
            itemNota.ean_fornecedor
        ]);

        // 2. Atualiza a FK nula na tabela de itens da nota fiscal, consolidando o vínculo do item
        await connection.execute(`
            UPDATE compras_core_nota_itens 
            SET id_produto = ?, valor_custo_real_unitario = ?
            WHERE id_item = ?
        `, [targetProductId, salesUnits[0]?.cost || itemNota.valor_unitario_xml, id_item_nota]);

        // Tudo ocorreu bem, persiste os dados no banco
        await connection.commit();
        res.status(200).json({ success: true, message: "Mapeamento e sincronização realizados com sucesso!", id_produto: targetProductId });

    } catch (error) {
        // Desfaz qualquer alteração se houver um erro no meio do processo
        await connection.rollback();
        console.error("Erro na transação de mapeamento:", error);
        res.status(500).json({ error: "Falha ao processar mapeamento do produto.", detalhes: error.message });
    } finally {
        connection.release();
    }
});