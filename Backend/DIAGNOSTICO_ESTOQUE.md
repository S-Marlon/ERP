# Diagnóstico e Plano de Ação - Sistema de Estoque

## Status Atual

### ✅ RESOLVIDO: Problema de event_id
- **Problema**: Campo `event_id` não estava sendo inserido, causando violação de constraint UNIQUE
- **Solução**: Atualizar INSERT em `stock.service.ts` para incluir `event_id` gerado com `randomUUID()`
- **Status**: CORRIGIDO - Testes agora compilam e executam sem erro de duplicação

### ✅ VERIFICADO: UUID Geração
- O sistema gera UUIDs únicos para cada movimentação
- Exemplo: `294e5354-6ce4-4787-b486-6821b9e784c4`
- Nenhuma colisão detectada nos testes

### ❌ IDENTIFIED: Cache (estoque_saldos) Não Está Sendo Atualizado
- **Sintoma**: Movimentações são inseridas no ledger (estoque_movimentacoes)
- **Sintoma**: Mas estoque_saldos permanece com quantidade = 0
- **Causa CONFIRMADA**: NÃO EXISTE TRIGGER para atualizar estoque_saldos!

**Triggers Encontradas no Banco:**
- ✅ tr_prevent_estoque_movimentacoes_update (protege ledger contra UPDATE)
- ✅ tr_prevent_estoque_movimentacoes_delete (protege ledger contra DELETE)
- ✅ Triggers em outras tabelas (compras, produtos)
- ❌ **FALTA**: Trigger AFTER INSERT em estoque_movimentacoes que atualiza estoque_saldos

**Exemplo de Falha:**
```
[STOCK_LEDGER] ENTRADA inserida: produto=999000, quantidade=10, eventId=294e5354...
Saldo no cache: 0  ❌ (deveria ser 10, mas não há trigger para inserir)

## Análise Técnica

### Fluxo Esperado (Híbrido)
1. ✅ INSERT em `estoque_movimentacoes` com `event_id`
2. ❌ TRIGGER inicia em `estoque_movimentacoes`
3. ❌ TRIGGER atualiza/insere em `estoque_saldos`
4. ❌ SELECT retorna saldo atualizado

### Verificar Trigger
```sql
-- Verificar se trigger existe e está ativa
SHOW TRIGGERS FROM macso037_ERP LIKE '%estoque_movimentacoes%';

-- Verificar conteúdo da trigger
SELECT TRIGGER_SCHEMA, TRIGGER_NAME, ACTION_STATEMENT 
FROM INFORMATION_SCHEMA.TRIGGERS 
WHERE TRIGGER_SCHEMA = 'macso037_ERP' 
AND EVENT_OBJECT_TABLE = 'estoque_movimentacoes';
```

## Próximos Passos

### Fase 1: Diagnóstico (IMEDIATO)
- [ ] Verificar se trigger existe no banco
- [ ] Verificar se trigger está habilitada
- [ ] Verificar logs de erro da trigger
- [ ] Testar inserção manual para confirmar trigger

**Comando de Teste:**
```sql
-- Inserir teste direto
INSERT INTO estoque_movimentacoes (
  event_id, id_produto, tipo, origem, quantidade, valor_unitario
) VALUES (
  UUID(), 999, 'ENTRADA', 'TESTE', 5, 10.00
);

-- Verificar se criou registro em estoque_saldos
SELECT * FROM estoque_saldos WHERE id_produto = 999;
```

### Fase 2: Correção (BASEADO EM DIAGNÓSTICO)

**Opção A: Trigger Não Existe ou Está Desabilitada**
- Criar/habilitar trigger usando schema atual da tabela
- Trigger deve atualizar `estoque_saldos` após INSERT em `estoque_movimentacoes`

**Opção B: Trigger Existe mas Tem Bug**
- Analisar lógica da trigger
- Verificar se campos estão com nomes corretos
- Verificar se há erro de tipo de dados

**Opção C: Trigger Desabilitada Propositalmente**
- Se é intencional (para transição step-by-step), então:
  - Implementar cálculo manual em `getCurrentStock()` usando ledger
  - Usar `recalculateStockForProduct()` como fonte de verdade
  - Manter ledger como único registro de transações

### Fase 3: Validação Completa

Após resolver, reexecutar testes:
```bash
# Limpar dados de teste anteriores
npm run audit-stock
npm run test-stock-edge-cases
```

Resultado esperado: **Taxa de Sucesso = 100%**

## Recomendações Arquiteturais

### Cenário 1: Manter Trigger Temporariamente
```
PROS:
- Código existente não muda muito
- Transição gradual
- Fallback disponível

CONS:
- Dupla manutenção de dados
- Possíveis inconsistências
- Trigger pode falhar silenciosamente
```

### Cenário 2: Migrar para Ledger-Only (Recomendado)
```
PROS:
- Fonte única de verdade
- Sim para event sourcing
- Auditoria completa permanente
- Sem sincronização de trigger

CONS:
- Refatorar queries que consultam estoque_saldos
- Criar view com estoque_saldos baseada em ledger
- Impacto de performance em queries complexas

IMPLEMENTAÇÃO:
1. CREATE VIEW estoque_saldos AS SELECT ... FROM estoque_movimentacoes
2. Ajustar índices para performance
3. Remover trigger completamente
4. Monitorar performance
```

## Métricas de Sucesso

| Métrica | Alvo | Status |
|---------|------|--------|
| Taxa de sucesso dos testes | 100% | ❌ 14.3% |
| Event_id gerados corretamente | 100% | ✅ 100% |
| Consistência Ledger vs Cache | 100% | ❌ 0% |
| Nenhum erro de chave duplicada | 0 | ✅ 0 |

## Timeline Recomendada

| Fase | Atividade | Duração | Bloqueador |
|------|-----------|---------|-----------|
| 1 | Diagnóstico de trigger | 1h | Acesso ao banco |
| 2 | Implementar solução | 2-4h | Complexidade do bug |
| 3 | Testes de validação | 1h | Testes passando |
| 4 | Auditoria de dados reais | 2h | Performance |
| 5 | Preparação para produção | 4h | Documentação |

## Arquivos Relacionados

- `src/services/stock/stock.service.ts` - Lógica de movimentação (ATUALIZADO)
- `src/routes/Estoque/server.ts` - Endpoints de teste
- `src/tests/stock-edge-cases.test.ts` - Testes unitários
- `src/tests/stock-audit.ts` - Script de auditoria
- `package.json` - Scripts de execução

## Comandos Úteis

```bash
# Executar testes
npm run test-stock-edge-cases

# Executar auditoria (quando servidor estiver rodando)
npm run audit-stock

# Iniciar servidor
npm run start-estoque

# Verificar status
curl http://localhost:3001/api/stock/audit-all
```

## Próxima Reunião

- **Objetivo**: Diagnosticar status da trigger e definir caminho
- **Artefato**: Saída de SHOW TRIGGERS
- **Decisão**: Manter trigger vs Migrar para ledger-only
- **Ação**: Implementar solução escolhida