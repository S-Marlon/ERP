import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool from '../../Estoque/db.config';

// --- INTERFACES DE RETORNO DO BANCO (Tipagem TypeScript) ---

interface FornecedorRow extends RowDataPacket {
    id_pessoa: number;
    razao_social: string;
    nome_fantasia: string | null;
}

interface ItemFornecedorRow extends RowDataPacket {
    id_item: number;
}

interface ItemCodigoBarrasRow extends RowDataPacket {
    id_item: number;
}

// ==========================================
// PASSO 1: MÓDULO DE FORNECEDORES
// ==========================================

export async function verificarFornecedor(req: Request, res: Response): Promise<Response> {
    const tenant_id = req.query.tenant_id as string | undefined;
    const cnpj = req.query.cnpj as string | undefined;

    if (!tenant_id || !cnpj) {
        return res.status(400).json({ error: "Parâmetros tenant_id e cnpj são obrigatórios." });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, '');

    try {
        const [rows] = await pool.execute<FornecedorRow[]>(`
            SELECT 
                c.id_pessoa, 
                pj.razao_social, 
                pj.nome_fantasia 
            FROM pessoas_core c
            INNER JOIN pessoas_pj pj ON c.id_pessoa = pj.id_cliente
            WHERE c.tenant_id = ? 
              AND pj.cnpj = ? 
              AND c.deleted_at IS NULL
            LIMIT 1
        `, [Number(tenant_id), cnpjLimpo]);

        if (rows.length > 0) {
            const fornecedorEncontrado = rows[0];
            return res.status(200).json({
                exists: true,
                supplier: {
                    id: fornecedorEncontrado.id_pessoa,
                    name: fornecedorEncontrado.razao_social,       
                    fantasyName: fornecedorEncontrado.nome_fantasia || fornecedorEncontrado.razao_social
                }
            });
        }

        return res.status(200).json({ exists: false });

    } catch (error) {
        console.error("Erro ao checar fornecedor no banco de dados:", error);
        return res.status(500).json({ error: "Erro interno ao consultar fornecedor." });
    }
}

export async function criarFornecedor(req: Request, res: Response): Promise<Response> {
    const { tenant_id, cnpj, nome_razao, nome_fantasia } = req.body;

    if (!tenant_id || !cnpj || !nome_razao) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes: tenant_id, cnpj e nome_razao." });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, '');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [coreResult] = await connection.execute<ResultSetHeader>(`
            INSERT INTO pessoas_core (tenant_id, tipo_pessoa, status, created_at)
            VALUES (?, 'PJ', 'ATIVO', NOW())
        `, [Number(tenant_id)]);

        const novoIdPessoa = coreResult.insertId;

        await connection.execute(`
            INSERT INTO pessoas_pj (id_cliente, razao_social, nome_fantasia, cnpj, tenant_id, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [novoIdPessoa, nome_razao, nome_fantasia || nome_razao, cnpjLimpo, Number(tenant_id)]);

        const ID_PAPEL_FORNECEDOR = 2;
        await connection.execute(`
            INSERT INTO pessoas_papeis_atribuido (tenant_id, id_cliente, id_cliente_papel, created_at)
            VALUES (?, ?, ?, NOW())
        `, [Number(tenant_id), novoIdPessoa, ID_PAPEL_FORNECEDOR]);

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Fornecedor cadastrado com sucesso!",
            supplier: {
                id: novoIdPessoa,
                name: nome_razao,
                fantasyName: nome_fantasia || nome_razao
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error("Erro crítico ao cadastrar fornecedor:", error);
        return res.status(500).json({ error: "Erro interno do servidor ao salvar o fornecedor." });
    } finally {
        connection.release();
    }
}

// ==========================================
// PASSO 2: PROCESSAMENTO DOS ITENS DO XML
// ==========================================

export async function processarItemXML(req: Request, res: Response): Promise<Response> {
    const { tenant_id, id_fornecedor, cProd, cEAN, xProd } = req.body;

    // Validação de entrada das tags do <prod> do XML
    if (!tenant_id || !id_fornecedor || !cProd) {
        return res.status(400).json({ error: "Parâmetros obrigatórios ausentes: tenant_id, id_fornecedor ou cProd." });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // -------------------------------------------------------------------------
        // PASSO 2.1: Busca por Vínculo Direto Existente
        // -------------------------------------------------------------------------
       const [vinculoFornRows] = await connection.execute<any[]>(`
            SELECT 
                vf.id_item,
                ic.sku AS sku_interno
            FROM itens_fornecedores vf
            INNER JOIN itens_core ic ON vf.id_item = ic.id_item
            WHERE vf.tenant_id = ? 
              AND vf.id_fornecedor = ? 
              AND vf.codigo_fornecedor = ?
            LIMIT 1
        `, [Number(tenant_id), Number(id_fornecedor), String(cProd)]);

        if (vinculoFornRows.length > 0) {
            const idItemEncontrado = vinculoFornRows[0].id_item;
            const skuInterno = vinculoFornRows[0].sku_interno;
            
            console.log(`[XML] Vínculo Direto: Item ${idItemEncontrado} (SKU: ${skuInterno}) identificado para o Fornecedor ${id_fornecedor}`);

            await connection.commit();
            return res.status(200).json({
                status: "VINCULO_DIRETO_ENCONTRADO",
                message: `Produto identificado com sucesso.`,
                id_item: idItemEncontrado,
                codigo_interno: skuInterno, // 👈 Agora o Frontend recebe o seu SKU (ex: 'INT-100')
                proximo_passo: "Passo 3 (Atualização de Estoque e Custos)"
            });
        }

        // -------------------------------------------------------------------------
        // PASSO 2.2: Busca por Código de Barras (EAN / GTIN)
        // -------------------------------------------------------------------------
        const eanValido = cEAN && String(cEAN).trim() !== "" && String(cEAN).toUpperCase() !== "SEM GTIN";

        if (eanValido) {
            const [eanRows] = await connection.execute<ItemCodigoBarrasRow[]>(`
                SELECT id_item 
                FROM itens_core 
                WHERE tenant_id = ? 
                  AND sku = ? 
                LIMIT 1
            `, [Number(tenant_id), String(cEAN)]);

            if (eanRows.length > 0) {
                const idItemPorEAN = eanRows[0].id_item;

                // Cria o vínculo automático para acelerar as próximas compras
                await connection.execute(`
                    INSERT INTO itens_fornecedores 
                        (tenant_id, id_item, id_fornecedor, codigo_fornecedor, descricao_fornecedor, created_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `, [Number(tenant_id), idItemPorEAN, Number(id_fornecedor), String(cProd), xProd || null]);

                console.log(`[XML] Vínculo via EAN: Item ${idItemPorEAN} localizado pelo código de barras (${cEAN}). Novo código de fornecedor (${cProd}) associado.`);

                await connection.commit();
                return res.status(200).json({
                    status: "VINCULO_EAN_RESOLVIDO",
                    message: `Produto localizado pelo Código de Barras EAN (${cEAN}). O sistema criou o vínculo automático com o código do fornecedor (${cProd}).`,
                    id_item: idItemPorEAN,
                    proximo_passo: "Passo 3 (Atualização de Estoque e Custos)"
                });
            }
        }

        // -------------------------------------------------------------------------
        // PASSO 2.3: Busca por SKU de Controle Interno
        // -------------------------------------------------------------------------
        const [skuRows] = await connection.execute<ItemCodigoBarrasRow[]>(`
            SELECT id_item 
            FROM itens_core 
            WHERE tenant_id = ? 
              AND sku = ? 
            LIMIT 1
        `, [Number(tenant_id), String(cProd)]);

        if (skuRows.length > 0) {
            const idItemPorSKU = skuRows[0].id_item;

            // Se o cProd do fornecedor coincidir com o SEU SKU interno, cria o vínculo pivô
            await connection.execute(`
                INSERT INTO itens_fornecedores 
                    (tenant_id, id_item, id_fornecedor, codigo_fornecedor, descricao_fornecedor, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            `, [Number(tenant_id), idItemPorSKU, Number(id_fornecedor), String(cProd), xProd || null]);

            console.log(`[XML] Vínculo via SKU Interno: Item ${idItemPorSKU} localizado pelo SKU (${cProd}). Novo vínculo de fornecedor criado.`);

            await connection.commit();
            return res.status(200).json({
                status: "VINCULO_SKU_CONVERTIDO",
                message: `Produto localizado pelo SKU de controle interno (${cProd}). Vínculo com o fornecedor criado automaticamente.`,
                id_item: idItemPorSKU,
                proximo_passo: "Passo 3 (Atualização de Estoque e Custos)"
            });
        }

        // -------------------------------------------------------------------------
        // PASSO 2.4: Produto Realmente Inédito no Sistema
        // -------------------------------------------------------------------------
        console.log(`[XML] Produto Inédito: Código do Fornecedor [${cProd}] - Descrição: [${xProd}] não localizado.`);
        
        await connection.commit(); 
        return res.status(200).json({
            status: "PRODUTO_INEDITO",
            message: "Este item não pôde ser identificado por nenhum critério automático. Por favor, faça o mapeamento ou cadastre o novo produto.",
            dados_sugeridos: { cProd, cEAN, xProd },
            proximo_passo: "Passo 2.4 (Interface de conciliação / Cadastro Manual)"
        });

    } catch (error) {
        await connection.rollback();
        console.error("Erro crítico no processamento do item do XML:", error);
        return res.status(500).json({ error: "Erro interno ao processar validação do item." });
    } finally {
        connection.release();
    }
}