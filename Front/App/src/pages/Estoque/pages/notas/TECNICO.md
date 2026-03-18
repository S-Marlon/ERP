# 🔧 Documentação Técnica - Tela de Notas Fiscais

## Visão Geral da Arquitetura

A tela de Notas é composta por componentes React que se comunicam com uma API REST para gerenciar e visualizar notas fiscais de entrada de estoque.

```
┌─────────────────────────────────────────────────────────┐
│                    Notas.tsx (Principal)                 │
│  - State Management (filtros, notas, loading, erro)      │
│  - Chamadas à API                                         │
│  - Renderização de componentes                           │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
  NotasStats      NotasDetailModal   NotasExport
  (Estatísticas)   (Modal Detalhes)   (Exportação)
```

## Estrutura de Pastas

```
src/pages/Estoque/pages/notas/
├── components/
│   ├── NotasDetailModal.tsx       # Modal com detalhes completos
│   ├── NotasExport.tsx            # Exportação CSV/Impressão
│   ├── NotasStats.tsx             # Cartões de estatísticas
│   └── SupplierSearch.tsx         # Busca de fornecedor
├── Notas.tsx                       # Componente principal
├── index.ts                        # Exports
└── README.md                       # Documentação de uso
```

## Fluxo de Dados

### 1. Inicialização
```
useEffect → loadNotes() → fetchStockEntryNotes() → setNotes()
```

### 2. Filtro e Busca
```
Usuário preenche filtros → handleApplyFilters() → loadNotes() → fetchStockEntryNotes(filters)
```

### 3. Visualizar Detalhes
```
Clique em "Ver Detalhes" → handleViewDetails() → fetchStockEntryDetails() → setSelectedNote() → Abre Modal
```

### 4. Exportação
```
Clique em "Exportar CSV" → exportToCSV() → Gera CSV → Download
```

## Endpoints da API Necessários

### 1. GET /api/stock-entry
**Descrição**: Busca notas fiscais com filtros opcionais

**Query Parameters**:
```typescript
{
  supplierCnpj?: string;      // CNPJ do fornecedor
  invoiceNumber?: string;     // Número da NF
  startDate?: string;         // Data inicial (YYYY-MM-DD)
  endDate?: string;          // Data final (YYYY-MM-DD)
}
```

**Response**:
```typescript
[
  {
    id: string | number;
    invoiceNumber: string;
    accessKey: string;
    entryDate: string;
    supplierCnpj: string;
    supplierName: string;
    totalFreight: number;
    totalIpi: number;
    totalIcmsST?: number;
    totalIBS?: number;
    totalCBS?: number;
    totalOtherExpenses: number;
    totalNoteValue: number;
    itemsCount?: number;
    status?: string;
  }
]
```

### 2. GET /api/stock-entry/{noteId}
**Descrição**: Busca detalhes completos de uma nota incluindo itens

**Response**:
```typescript
{
  id: string | number;
  invoiceNumber: string;
  accessKey: string;
  entryDate: string;
  supplierCnpj: string;
  supplierName: string;
  totalFreight: number;
  totalIpi: number;
  totalIcmsST?: number;
  totalIBS?: number;
  totalCBS?: number;
  totalOtherExpenses: number;
  totalNoteValue: number;
  items: [
    {
      id?: string;
      codigoInterno: string;
      skuFornecedor: string;
      quantidadeRecebida: number;
      unidade: string;
      custoUnitario: number;
      impostos?: {
        ipi?: number;
        icmsST?: number;
        ibs?: number;
        cbs?: number;
      };
      ncm?: string;
      cest?: string;
    }
  ];
  status?: string;
}
```

## Implementação do Backend

### Banco de Dados - Tabelas Necessárias

```sql
-- Tabela de Notas Fiscais
CREATE TABLE stock_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_number VARCHAR(20) NOT NULL,
    access_key VARCHAR(44),
    entry_date DATE,
    supplier_cnpj VARCHAR(18),
    supplier_name VARCHAR(255),
    total_freight DECIMAL(10, 2),
    total_ipi DECIMAL(10, 2),
    total_icms_st DECIMAL(10, 2),
    total_ibs DECIMAL(10, 2),
    total_cbs DECIMAL(10, 2),
    total_other_expenses DECIMAL(10, 2),
    total_note_value DECIMAL(12, 2),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_supplier_cnpj (supplier_cnpj),
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_entry_date (entry_date)
);

-- Tabela de Itens da Nota
CREATE TABLE stock_entry_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    stock_entry_id INT NOT NULL,
    codigo_interno VARCHAR(50),
    sku_fornecedor VARCHAR(100),
    quantidade_recebida DECIMAL(10, 3),
    unidade VARCHAR(10),
    custo_unitario DECIMAL(10, 2),
    ipi DECIMAL(10, 2),
    icms_st DECIMAL(10, 2),
    ibs DECIMAL(10, 2),
    cbs DECIMAL(10, 2),
    ncm VARCHAR(10),
    cest VARCHAR(10),
    FOREIGN KEY (stock_entry_id) REFERENCES stock_entries(id)
);
```

### Rotas Express/Node.js Exemplo

```typescript
// GET /api/stock-entry
app.get('/api/stock-entry', async (req, res) => {
    const { supplierCnpj, invoiceNumber, startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM stock_entries WHERE 1=1';
    const params: any[] = [];
    
    if (supplierCnpj) {
        query += ' AND supplier_cnpj LIKE ?';
        params.push(`%${supplierCnpj}%`);
    }
    
    if (invoiceNumber) {
        query += ' AND invoice_number LIKE ?';
        params.push(`%${invoiceNumber}%`);
    }
    
    if (startDate) {
        query += ' AND entry_date >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND entry_date <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY entry_date DESC';
    
    try {
        const results = await db.query(query, params);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stock-entry/:id
app.get('/api/stock-entry/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const noteQuery = 'SELECT * FROM stock_entries WHERE id = ?';
        const note = await db.query(noteQuery, [id]);
        
        const itemsQuery = 'SELECT * FROM stock_entry_items WHERE stock_entry_id = ?';
        const items = await db.query(itemsQuery, [id]);
        
        res.json({ ...note[0], items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

## Funcionalidades por Componente

### Notas.tsx
- **Estado**: notas, loading, error, filtros, selectedNote
- **Funções principais**:
  - `loadNotes()`: Carrega notas com filtros
  - `handleViewDetails()`: Abre detalhes
  - `handleApplyFilters()`: Aplica filtros
  - `handleClearFilters()`: Limpa filtros
- **Requisições**: 2 (listagem e detalhes)

### NotasDetailModal.tsx
- **Props**: note, onClose, formatters
- **Conteúdo**: Informações completas + tabela de itens
- **Funcionalidade**: Display apenas (sem edição)

### NotasStats.tsx
- **Props**: notes, formatCurrency
- **Cálculos**: Total de notas, itens, fornecedores, valores
- **Rendezação**: Cards informativos

### NotasExport.tsx
- **Funções**:
  - `exportToCSV()`: Exporta para CSV
  - `printNotes()`: Abre preview de impressão
- **Formatos**: CSV com headers

### SupplierSearch.tsx (Futuro)
- **Funcionalidade**: Busca com sugestões de fornecedores
- **Integração**: Pronto para integrar com API

## Tratamento de Erros

### Padrão de Erro
```typescript
try {
  const data = await fetchStockEntryNotes(filters);
  setNotes(Array.isArray(data) ? data : data.data || data.notas || []);
} catch (err) {
  setError(err instanceof Error ? err.message : 'Erro ao buscar notas');
}
```

### Mensagens de Erro Esperadas
- "Erro ao buscar notas" - Erro na requisição
- Detalhes específicos da API devem estar registrados no console

## Performance e Otimizações

### Otimizações Aplicadas
- ✅ Memoização de funções utilitárias (formatCurrency, formatDate, formatCnpj)
- ✅ Carregamento sob demanda (detalhes carregados ao clicar)
- ✅ Paginação possível (estrutura pronta)

### Melhorias Futuras
- [ ] Implementar paginação
- [ ] Cache de dados
- [ ] Lazy loading de itens da tabela
- [ ] Virtualização de tabelas grandes

## Testes Sugeridos

### Testes Unitários
```typescript
describe('Notas Component', () => {
  test('deve carregar notas ao montar', () => { /* ... */ });
  test('deve filtrar notas corretamente', () => { /* ... */ });
  test('deve abrir modal de detalhes', () => { /* ... */ });
  test('deve exportar para CSV', () => { /* ... */ });
});
```

### Testes de Integração
```typescript
test('fluxo completo: buscar, filtrar e visualizar detalhes', async () => {
  // 1. Buscar notas
  // 2. Aplicar filtro
  // 3. Clicar em detalhes
  // 4. Verificar dados no modal
});
```

## Troubleshooting do Desenvolvedor

### Problema: API retorna vazio
**Solução**: Verifique se os dados estão no banco e se a query do backend está correta

### Problema: Modal não carrega itens
**Solução**: Confirme se o endpoint `/stock-entry/{id}` está retornando o array `items`

### Problema: Filtros não funcionam
**Solução**: Verifique se os nomes dos query params estão corretos na API

## Próximas Funcionalidades Sugeridas

1. **Edição de Notas**: Permitir editar determinados campos
2. **Devolução**: Criar nota de devolução a partir de uma existente
3. **Relatórios**: Gráficos de notas por período/fornecedor
4. **Sincronização**: Importar notas automaticamente do banco
5. **Auditoria**: Histórico de alterações da nota
6. **Anexos**: Suportar upload de documentos
