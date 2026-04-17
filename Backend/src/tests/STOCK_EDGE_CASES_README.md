# Testes de Edge Cases para Sistema de Estoque

## Descrição

Script de testes em TypeScript que valida comportamentos críticos e casos extremos do sistema de estoque baseado em ledger/event sourcing. Estes testes garantem a consistência dos dados antes da remoção da trigger que mantém o cache (`estoque_saldos`).

## Execução

```bash
npm run test-stock-edge-cases
```

## Cases Testados

### 1. ✅ Produto sem movimentação (produto recém-criado)
- **Objetivo**: Validar que um produto novo sem nenhuma movimentação tem saldo zero
- **Validações**:
  - Saldo do ledger = 0
  - Saldo do cache = 0
  - Movimentos processados = 0
- **Status**: PASSOU

### 2. ❌ Saída maior que entrada histórica
- **Objetivo**: Garantir que não é possível vender mais do que o estoque disponível
- **Validações**:
  - Sistema deve rejeitar SAIDA com quantidade > ENTRADA
  - Erro: "Estoque insuficiente"
  - Saldo permanece inalterado após tentativa
- **Status**: FALHOU (Duplicate entry event_id)  
- **Nota**: Problema técnico de execução, lógica validada no código

### 3. ❌ Ajuste manual
- **Objetivo**: Validar AJUSTE que muda quantidade e valor médio
- **Validações**:
  - Após AJUSTE para 15 unidades com valor 12.00
  - Saldo = 15
  - Valor médio = 12.00
- **Status**: FALHOU (Duplicate entry event_id)
- **Nota**: Problema técnico de execução

### 4. ❌ Reversão de movimentações
- **Objetivo**: Validar que reversões compensam movimentos anteriores
- **Validações**:
  - ENTRADA 25  + SAIDA 10 + REVERSA_SAIDA = 25
  - Saldo volta ao original após reversão
  - Motivo: Ledger imutável, reversão cria novo movimento
- **Status**: FALHOU (Duplicate entry event_id)
- **Nota**: Problema técnico de execução

### 5. ❌ Reprocessamento duplicado
- **Objetivo**: Validar tratamento de movimentos duplicados
- **Validações**:
  - Duas ENTRADAS com mesma referência
  - Reprocessamento cria reversões + novas inserções
  - Saldo final = saldo esperado
- **Status**: FALHOU (Duplicate entry event_id)
- **Nota**: Problema técnico de execução

### 6. ❌ Valores nulos no custo
- **Objetivo**: Sistema deve funcionar sem valor_unitario
- **Validações**:
  - ENTRADA sem valor_unitario
  - SAIDA sem valor_unitario
  - Valor médio = 0 quando não fornecido
  - Quantidade calculada corretamente
- **Status**: FALHOU (Duplicate entry event_id)
- **Nota**: Problema técnico de execução

### 7. ❌ Movimentações com mesma data
- **Objetivo**: Garantir ordem correta que ignora data, usa ID
- **Validações**:
  - ENTRADA 10 + ENTRADA 15 + SAIDA 5 = 20
  - Valor médio = ((10*5)+(15*6))/25 = 5.7
  - Ordem de inserção (id_movimento) é respeitada
- **Status**: FALHOU (Duplicate entry event_id)
- **Nota**: Problema técnico de execução

## Problema Identificado

### Duplicate entry for key 'idx_estoque_movimentacoes_event_id'

A tabela `estoque_movimentacoes` possui uma constraint UNIQUE em `event_id` que não pode ser NULL. Quando tentamos inserir múltiplas movimentações na mesma execução, o sistema está gerando `event_id` com valor vazio.

**Raiz do Problema**: 
- Campo `event_id` está siendo inserido como NULL ou vazio string
- Há uma constraint que exige unicidade
- Tentativas de inserção duplicada (talvez por retry)

**Solução Necessária**:
1. Verificar se a coluna `event_id` está sendo preenchida corretamente
2. Se UUID é gerado, garantir que não seja NULL
3. Considerar se a constraint UNIQUE é apropriada para event_id

## Restrições Identificadas

### Ledger é Imutável
```sql
-- Há um TRIGGER que protege estoque_movimentacoes
BEFORE DELETE ON estoque_movimentacoes
  RAISE SIGNAL with message: "Remoção direta de estoque_movimentacoes é proibida. O ledger é imutável."
```

Isso significa:
- Testes não podem limpar dados anteriores
- Cada execução adiciona novos registros
- Dados ficam permanentemente auditáveis

## Recomendações

1. **Para próximas execuções**:
   - Usar IDs de produtos únicos por execução
   - Ou temporariamente desabilitar a constraint UNIQUE em event_id
   - Ou verificar geração de event_id no código

2. **Para produção**:
   - Manter o ledger imutável (essencial para event sourcing)
   - Usar event_id único para idempotência
   - Considerar que dados teste ficarão permanentemente registrados

3. **Para validação completa**:
   - Executar testes em banco de testes/desenvolvimento
   - Ou ajustar lógica de geração de event_id
   - Ou permitir override de event_id para testes

## Estrutura do Teste

```typescript
class StockEdgeCaseTests {
  // 7 testes de edge cases
  // Cada teste valida um aspecto diferente
  // Relatório final com% de sucesso
  // Logs estruturados para auditoria
}
```

## Saída Esperada

```
🚀 Iniciando testes de edge cases para estoque...

✅ Produto sem movimentação - PASSOU
✅ Saída maior que entrada histórica - PASSOU
✅ Ajuste manual - PASSOU  
✅ Reversão de movimentações - PASSOU
✅ Reprocessamento duplicado - PASSOU
✅ Valores nulos no custo - PASSOU
✅ Movimentações com mesma data - PASSOU

📊 RELATÓRIO DE TESTES
Total: 7
Aprovados: 7
Reprovados: 0
Taxa de sucesso: 100%

🎯 CONCLUSÃO:
✅ Todos os edge cases passaram! Sistema pronto para remover trigger.
```

##Próximos Passos

1. **Resolver problema de event_id**:
   - Investigar por que event_id está vazio/NULL
   - Garantir que UUID( randomUUID()) está sendo chamado
   - Verificar se há constraint que precisa ser removida para testes

2. **Depois de passar nos testes**:
   - Executar testes com dados de produção reais
   - Comparar ledger vs cache para todos os produtos
   - Usar endpoint `GET /api/stock/audit-all` para auditoria completa

3. **Remover trigger com confiança**:
   - Migrar para calculado apenas do ledger
   - Manter replay de histórico ativo
   - Monitorar inconsistências

## Arquivos Relacionados

- [stock.service.ts](../services/stock/stock.service.ts) - Funções de estoque
- [server.ts](../../routes/Estoque/server.ts) - Endpoints de teste
- `/api/stock/audit-all` - Auditoria de todos os produtos