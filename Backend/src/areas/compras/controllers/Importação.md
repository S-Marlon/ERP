# Arquitetura de Importação de NF-e e Entrada em Estoque (ERP)

Este documento descreve a arquitetura de dados e o fluxo de processamento para a importação de Notas Fiscais Eletrônicas (NF-e), salvamento em staging (rascunho) e consolidação final no estoque oficial do ERP.

---

## 1. Visão Geral da Arquitetura

O objetivo principal desta arquitetura é garantir **resiliência contra quedas de conexão do usuário**, facilidade de auditoria e consistência transacional (ACID) ao dar entrada em grandes volumes de itens (ex: notas com centenas de produtos).

O fluxo divide-se em 3 pilares:
1. **Staging (Rascunho Persistido):** O front-end salva as alterações de conferência, custos e mapeamentos progressivamente. Se a internet cair, o progresso não é perdido.
2. **Payload Estruturado via JSON:** Armazenamento flexível dos blocos do XML e dados fiscais sem engessar o banco com dezenas de colunas relacionais prematuras.
3. **Consolidação Atômica (Backend/Procedure):** Processamento final seguro em transação única, evitando dependência de Triggers passivas e garantindo rastreabilidade (Kardex).

---

## 2. Modelagem do Banco de Dados

### Tabela 1: `importacoes_lotes` (Cabeçalho da Nota e Controle)
Armazena os dados gerais do lote, status de progresso, e blobs estruturados do XML e totais.

```sql
CREATE TABLE IF NOT EXISTS importacoes_lotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    status_lote VARCHAR(50) DEFAULT 'EM_CONFERENCIA', -- 'EM_CONFERENCIA', 'PROCESSANDO', 'FINALIZADO', 'CANCELADO'
    chave_acesso VARCHAR(44),
    numero_nf VARCHAR(20),
    dados_nota_fiscal JSON,      -- Guarda todo o objeto de cabeçalho e emitente da NF
    frete_adicional JSON,        -- Guarda regras de frete aplicadas
    resumo_conferencia JSON,     -- Totais de conferência, divergências e valores gerais
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);