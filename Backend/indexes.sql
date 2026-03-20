-- ============================================================
-- SQL INDEXES PARA PERFORMANCE DO PDV
-- ============================================================

-- Categorias: Aceleração de queries hierárquicas
ALTER TABLE categorias ADD INDEX idx_categoria_pai (id_categoria_pai);
ALTER TABLE categorias ADD UNIQUE INDEX idx_nome_categoria (nome_categoria);

-- Produtos: Aceleração de buscas e filtros
ALTER TABLE produtos ADD INDEX idx_codigo_interno (codigo_interno);
ALTER TABLE produtos ADD INDEX idx_codigo_barras (codigo_barras);
ALTER TABLE produtos ADD FULLTEXT INDEX idx_descricao (descricao);
ALTER TABLE produtos ADD INDEX idx_id_categoria (id_categoria);
ALTER TABLE produtos ADD INDEX idx_status (status);
ALTER TABLE produtos ADD INDEX idx_preco_venda (preco_venda);
ALTER TABLE produtos ADD INDEX idx_id_marca (id_marca);

-- Estoque Atual: Aceleração de JOINs
ALTER TABLE estoque_atual ADD UNIQUE INDEX idx_produto (id_produto);

-- Produto Fornecedor: Aceleração de JOINs
ALTER TABLE produto_fornecedor ADD INDEX idx_produto (id_produto);
ALTER TABLE produto_fornecedor ADD INDEX idx_fornecedor (id_fornecedor);

-- Compras Notas: Para futuras queries
ALTER TABLE compras_notas ADD INDEX idx_data_entrada (data_entrada);
ALTER TABLE compras_notas ADD INDEX idx_id_fornecedor (id_fornecedor);

-- Vendas: Para relatórios
ALTER TABLE vendas ADD INDEX idx_data_venda (data_venda);

-- ============================================================
-- Verificar indexes criados
-- ============================================================
-- SHOW INDEX FROM categorias;
-- SHOW INDEX FROM produtos;
-- SHOW INDEX FROM estoque_atual;
