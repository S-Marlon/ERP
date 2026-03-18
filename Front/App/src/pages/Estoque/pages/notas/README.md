# 📋 Tela de Notas Fiscais

## Visão Geral

A tela de **Notas Fiscais** permite visualizar e gerenciar todas as notas de entrada de mercadorias registradas no sistema. É a continuação natural do fluxo de **Stock Entry**, apresentando uma interface consolidada para consultar notas anteriormente processadas.

## Funcionalidades

### 1. **Visualização de Notas**
- Tabela com todas as notas cadastradas
- Exibição de: NF, Data, Fornecedor, CNPJ, Quantidade de itens e Valor Total
- Indicador visual de quantidade de itens por nota

### 2. **Filtros de Busca**
- **Número da NF**: Busca por número da nota fiscal
- **CNPJ Fornecedor**: Filtro por CNPJ do fornecedor
- **Data Inicial/Final**: Intervalo de datas de entrada
- Botões de ação: "Buscar" e "Limpar"

### 3. **Estatísticas (quando há notas)**
Cartões informativos mostrando:
- Total de notas
- Total de itens
- Quantidade de fornecedores
- Valor total
- Total de frete
- Total de impostos

### 4. **Modal de Detalhes**
Ao clicar em "Ver Detalhes", abre um modal com:

#### Informações da Nota
- Data de entrada
- Chave de acesso

#### Dados do Fornecedor
- Razão social
- CNPJ

#### Totalizações
- Valor dos produtos
- IPI, ICMS ST, IBS, CBS
- Frete
- Outras despesas
- **Total da NF**

#### Tabela de Produtos
Detalhes de cada item:
- Código interno
- SKU do fornecedor
- Quantidade recebida
- Unidade de medida
- Custo unitário
- Total do item
- NCM

## Estrutura de Componentes

```
notas/
  ├── Notas.tsx                    # Tela principal
  ├── index.ts                      # Exportações
  └── components/
      ├── NotasDetailModal.tsx      # Modal de detalhes
      ├── NotasStats.tsx            # Componente de estatísticas
      └── SupplierSearch.tsx        # Busca de fornecedor (futuro uso)
```

## Integração com API

### Endpoints Utilizados

#### 1. **Buscar Notas**
```typescript
GET /api/stock-entry?supplierCnpj=xxx&invoiceNumber=xxx&startDate=xxx&endDate=xxx
```
Retorna array de notas com informações resumidas.

#### 2. **Detalhes da Nota**
```typescript
GET /api/stock-entry/{noteId}
```
Retorna informações completas da nota incluindo lista de itens.

## Tipos de Dados

### StockEntryNote
Interface que representa uma nota fiscal com os seguintes campos:
- `id`: Identificador único
- `invoiceNumber`: Número da NF
- `accessKey`: Chave de acesso
- `entryDate`: Data de entrada
- `supplierCnpj`: CNPJ do fornecedor
- `supplierName`: Nome do fornecedor
- `totalFreight`: Total de frete
- `totalIpi`: Total de IPI
- `totalNoteValue`: Valor total da nota
- `items`: Array de itens (opcional)
- `itemsCount`: Contagem de itens

### StockEntryItem
Representa um produto na nota:
- `codigoInterno`: Código interno do produto
- `skuFornecedor`: SKU do fornecedor
- `quantidadeRecebida`: Quantidade recebida
- `unidade`: Unidade de medida
- `custoUnitario`: Custo unitário
- `impostos`: Objeto com impostos (IPI, ICMS ST, IBS, CBS)
- `ncm`: Número de Classificação de Mercadoria

## Como Usar

### Buscar Notas
1. Acesse a aba "Notas Fiscais"
2. (Opcional) Configure filtros desejados
3. Clique em "🔍 Buscar"
4. A tabela será preenchida com as notas encontradas

### Ver Detalhes de uma Nota
1. Localize a nota desejada na tabela
2. Clique no botão "👁️ Ver Detalhes"
3. O modal contendo todos os detalhes será aberto
4. Analise as informações e produtos
5. Clique em "✕ Fechar" para retornar à lista

### Filtros Avançados
Os filtros podem ser combinados para refinar a busca:
- Filtro por período + fornecedor
- Filtro por número específico de NF
- Filtro por CNPJ exato

## Estilos e Design

A tela segue a paleta de cores do projeto:
- **Primária**: Azul (#3b82f6)
- **Sucesso**: Verde (#10b981)
- **Fundo**: Cinza claro (#f9fafb)
- **Destaque**: Amarelo (#f59e0b)

## Futuramente

Sugestões de melhorias:
- [ ] Exportar notas em PDF/Excel
- [ ] Gerar relatórios de notas
- [ ] Editar informações da nota (determinados campos)
- [ ] Devolução/Desmembramento de notas
- [ ] Visualização em gráficos de valor ao longo do tempo
- [ ] Integração com análise de divergências
- [ ] Rastreamento de status da nota

## Troubleshooting

### Nenhuma nota aparece
1. Verifique se há dados no banco de dados
2. Confirme se a URL da API está correta
3. Verifique a console do navegador para erros

### Modal não abre
1. Verifique se há conexão com a API
2. Confirme se o `noteId` está sendo obtido corretamente
3. Verifique o log de erros na console

### Filtros não funcionam
1. Verifique se os valores dos filtros estão corretos
2. Clique em "Buscar" após configurar os filtros
3. Use "Limpar" para resetar e começar novamente
