# 🏗️ Arquitetura Proposta - PDV + OS + Pagamentos

## Diagrama de Fluxo: Antes vs Depois

### ❌ ANTES (Atual - Problemático)

```
                    ┌─────────────────────┐
                    │      PDVContext     │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
         ┌──────▼────┐   ┌────▼─────┐  ┌────▼─────┐
         │  useCart  │   │useOSForm │  │usePDVState
         │           │   │          │  │
         │ ❌ Estado │   │ ❌ paid  │  │ OS state
         │ sem type  │   │ simples  │  │ duplicado
         └──────┬────┘   └────┬─────┘  └────┬─────┘
                │             │             │
                └─────────────┼─────────────┘
                              │
                    ┌─────────▼────────┐
                    │   CartAside      │
                    ├──────────────────┤
                    │ ❌ Permite:      │
                    │  - Edit OS qty   │
                    │  - Discount OS   │
                    │  - Partial pay   │
                    └────────┬─────────┘
                             │
                    ┌────────▼────────┐
                    │ FinalizarVenda  │
                    ├─────────────────┤
                    │ ❌ Sem source   │
                    │ ❌ Sem payments[]
                    │ ❌ Mistura OS+V │
                    └─────────────────┘
```

### ✅ DEPOIS (Proposto - Correto)

```
                    ┌─────────────────────────┐
                    │      PDVContext         │
                    └──────────┬──────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
    ┌────▼────────┐    ┌───────▼────────┐    ┌─────▼──────┐
    │   useCart   │    │ useOrderService│    │ useFilters │
    │             │    │                │    │            │
    │ ✅ Valida   │    │ ✅ State OS:   │    │ ✅ Isolado │
    │    - OS     │    │  - payment[]   │    │            │
    │    - qty    │    │  - paid derivado
    │    - disc   │    │  - remaining   │    │            │
    └────┬────────┘    └───────┬────────┘    └─────┬──────┘
         │                     │                    │
         │                ┌────▼────────────────┐   │
         │                │ OrderServiceModel   │   │
         │                ├────────────────────┤   │
         │                │ ✅ Lógica negócio: │   │
         │                │  - payments: []    │   │
         │                │  - paid (getter)   │   │
         │                │  - remaining (get) │   │
         │                │  - validações      │   │
         │                └────────────────────┘   │
         │                                         │
         └─────────────────┬───────────────────────┘
                           │
                    ┌──────▼────────┐
                    │  CartAside    │
                    ├───────────────┤
                    │ ✅ Protege:   │
                    │  - OS read-only
                    │  - Sem desconto│
                    │  - Sem edição  │
                    │  - Qtd fixa=1 │
                    └────────┬──────┘
                             │
                    ┌────────▼────────┐
                    │FinalizarVenda   │
                    ├─────────────────┤
                    │ ✅ Correto:     │
                    │  - source: 'os' │
                    │  - payments[]   │
                    │  - separação    │
                    │  - osId/saleId  │
                    └─────────────────┘
```

---

## 🗂️ Estrutura de Pastas Proposta (Fase 2)

```
src/pages/PDV/
├── types/
│   ├── cart.types.ts              (✅ CartItemOS guard)
│   ├── payment.types.ts           (✨ NOVO)
│   ├── product.types.ts
│   └── sale.types.ts              (✅ Com source)
│
├── models/                        (✨ NOVA PASTA)
│   ├── OrderService.model.ts      (✨ NOVO)
│   ├── Payment.model.ts           (✨ NOVO)
│   └── Cart.model.ts              (✨ NOVO)
│
├── services/
│   ├── ICart.ts                   (✨ NOVO interface)
│   ├── CartService.ts             (✨ NOVO - impl)
│   ├── OrderServiceService.ts     (✨ NOVO)
│   ├── pdvService.ts
│   ├── salesService.ts            (✅ Atualizar)
│   └── api/
│       ├── products.ts
│       └── sales.ts               (✅ Atualizar)
│
├── hooks/
│   ├── useCart.ts                 (✅ Validações)
│   ├── useOrderService.ts         (✨ NOVO - consolidado)
│   ├── useOSForm.ts               (⚠️ Deprecate - usar useOrderService)
│   ├── usePDVState.ts
│   ├── useFilters.ts
│   └── ...
│
├── contexts/
│   └── PDVContext.tsx             (✅ Usar novos hooks)
│
├── components/
│   ├── OSPanelRefactored_NEW.tsx  (✅ Validar remaining)
│   ├── CartAside.tsx              (✅ Proteger OS)
│   ├── ItemSelectorModal.tsx
│   ├── ServiceSelectorModal.tsx
│   └── ...
│
├── pages/
│   ├── PDV.tsx
│   ├── FinalizarVenda.tsx         (✅ Adicionar source)
│   └── ...
│
├── constants/
│   └── ...
│
├── utils/
│   ├── calculations.ts
│   └── formatters.ts
│
└── docs/
    ├── RELATORIO_ANALISE_VENDAS.md     (✨ NOVO)
    ├── IMPLEMENTACAO_RAPIDA.md          (✨ NOVO)
    ├── RESUMO_EXECUTIVO.md              (✨ NOVO)
    ├── ARQUITETURA.md                   (✨ NOVO - este arquivo)
    └── FLUXO_OS_PAGAMENTOS.md           (✨ NOVO)
```

---

## 📊 Modelo de Dados: OrderService

### Antes (Problemático)
```typescript
interface OSFormData {
  equipment: string;
  gauge: string;
  laborValue: number;
  // ❌ Sem payments[]
  // ❌ Sem paid derivado
  // ❌ Sem remaining derivado
}
```

### Depois (Correto)
```typescript
class OrderServiceModel {
  osNumber: string;
  customerId: string;
  
  // Dados técnicos
  equipment: string;
  gauge: string;
  // ...
  
  // Pagamentos (❌ ANTES: não existia)
  private _payments: Payment[] = [];
  
  // Getters derivados
  get paid(): number {
    return this._payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.valor, 0);
  }
  
  get total(): number { /* ... */ }
  
  get remaining(): number {
    return this.total - this.paid;
  }
  
  // Métodos de negócio
  addPayment(payment: Payment): void {
    if (this.isFullyPaid) throw new Error('...');
    this._payments.push(payment);
  }
  
  canBeAddedToCart(): boolean {
    return !this.isFullyPaid && this.total > 0;
  }
  
  toCartItem(): CartItemOS {
    return {
      price: this.remaining,  // ✅ Usar remaining
      quantity: 1,
      type: 'os',
      osData: { ... }
    };
  }
}
```

---

## 🔄 Fluxo de Integração: OS → Carrinho → Pagamento

### Passo 1: Criar OS

```typescript
// OSPanelRefactored.tsx
const os = new OrderServiceModel(osNumber, customerId);
os.equipment = 'Prensa';
os.gauge = '100mm';
os.addItem(item1, item2);
os.addService(service1);
os.laborType = 'fixed';
os.laborValue = 500;

console.log('Total:', os.total);        // 2500
console.log('Paid:', os.paid);          // 0
console.log('Remaining:', os.remaining); // 2500
```

### Passo 2: Validar e Adicionar ao Carrinho

```typescript
// OSPanelRefactored.tsx - handleGenerateSale
const validation = os.canBeAddedToCart();
if (!validation.valid) {
  Swal.fire('Erro: ' + validation.reason);
  return;
}

const cartItem = os.toCartItem();
// cartItem.price === os.remaining (✅ Correto!)

onSubmit(cartItem);
```

### Passo 3: Proteger no Carrinho

```typescript
// CartAside.tsx
{osItems.map(os => {
  return (
    <div key={os.id} className={styles.osHighlightItem}>
      {/* Exibir OS */}
      <strong>{os.name}</strong>
      <span>{money.format(os.price)}</span>
      
      {/* ✅ SEM botões de edição */}
      {/* ❌ Não há: quantity++/-- */}
      {/* ❌ Não há: desconto */}
    </div>
  );
})}
```

### Passo 4: Registrar Pagamento

```typescript
// FinalizarVenda.tsx - handleFinalizarVenda
const pagamentoOS: Payment = {
  id: crypto.randomUUID(),
  valor: os.remaining,  // ✅ Restante
  metodo: 'CASH',
  status: 'paid',
  source: 'os',         // ✅ Diferencia!
  osId: os.osNumber,    // ✅ Referência!
  createdAt: new Date()
};

// Adicionar pagamento ao servidor
os.addPayment(pagamentoOS);

// Agora:
console.log('Paid:', os.paid);        // 2500 (ou 0 se parcial)
console.log('Remaining:', os.remaining); // 0 (ou resto)
```

---

## 💾 Esquema de Banco de Dados (Backend)

### Tabela: `OrdensDeSevico`
```sql
CREATE TABLE OrdensDeSevico (
  id UUID PRIMARY KEY,
  osNumber VARCHAR(50) UNIQUE,
  customerId UUID,
  equipment VARCHAR(255),
  gauge VARCHAR(100),
  laborType ENUM('fixed', 'per_point', 'table'),
  laborValue DECIMAL(10,2),
  total DECIMAL(10,2),
  status ENUM('draft', 'in_progress', 'finished'),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- ✅ NOVO: Tabela de pagamentos de OS
CREATE TABLE OS_Payments (
  id UUID PRIMARY KEY,
  osId UUID NOT NULL,
  valor DECIMAL(10,2),
  metodo ENUM('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX'),
  source ENUM('os', 'sale') NOT NULL,  -- ✅ Diferencia origem
  saleId UUID,                         -- ✅ Se origin='sale'
  status ENUM('pending', 'paid', 'failed'),
  createdAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (osId) REFERENCES OrdensDeSevico(id),
  FOREIGN KEY (saleId) REFERENCES Vendas(id)
);

-- ✅ NOVO: Tabela de vendas generalizada
CREATE TABLE Vendas (
  id UUID PRIMARY KEY,
  numero VARCHAR(50) UNIQUE,
  clienteId UUID,
  totalBruto DECIMAL(10,2),
  totalDesconto DECIMAL(10,2),
  totalLiquido DECIMAL(10,2),
  createdAt TIMESTAMP DEFAULT NOW()
);

-- ✅ NOVO: Itens da venda (produtos + OS)
CREATE TABLE Vendas_Itens (
  id UUID PRIMARY KEY,
  vendaId UUID NOT NULL,
  tipo ENUM('produto', 'os'), -- ✅ Diferencia
  itemId UUID,                 -- productId ou osId
  quantidade INT,
  preco DECIMAL(10,2),
  subtotal DECIMAL(10,2),
  FOREIGN KEY (vendaId) REFERENCES Vendas(id)
);
```

---

## 🔗 Integração: Frontend ↔ Backend

### Request: POST `/api/sales` (Antes - Problemático)

```json
{
  "clienteNome": "João",
  "totalBruto": 5000,
  "totalLiquido": 4500,
  "itens": [
    {
      "productId": 1,
      "nome": "Parafuso",
      "quantidade": 100,
      "precoVenda": 10
    },
    {
      "productId": 2,
      "nome": "OS-000123",    // ❌ Misturado com produtos!
      "quantidade": 1,
      "precoVenda": 2500
    }
  ],
  "pagamentos": [
    {
      "metodo": "CASH",
      "valor": 4500
      // ❌ Sem source
      // ❌ Sem referência à OS
    }
  ]
}
```

### Request: POST `/api/sales` (Depois - Correto)

```json
{
  "clienteNome": "João",
  "totalBruto": 5000,
  "totalLiquido": 4500,
  
  "itens": [
    {
      "productId": 1,
      "nome": "Parafuso",
      "quantidade": 100,
      "precoVenda": 10,
      "type": "produto"  // ✅ Diferencia
    }
  ],
  
  "ordensServico": [
    {
      "osNumber": "OS-000123",
      "equipamento": "Prensa",
      "total": 2500,
      "remaining": 2500,  // ✅ Restante
      "items": [...],
      "services": [...]
    }
  ],
  
  "pagamentos": [
    {
      "id": "uuid",
      "metodo": "CASH",
      "valor": 2000,
      "source": "os",          // ✅ Origem!
      "osId": "OS-000123",     // ✅ Referência
      "status": "paid"
    },
    {
      "id": "uuid",
      "metodo": "CASH",
      "valor": 2500,
      "source": "sale",        // ✅ Origem!
      "saleId": "sale-12345",  // ✅ Referência
      "status": "paid"
    }
  ]
}
```

---

## ✅ Checklist de Validação: Antes vs Depois

| Cenário | Antes | Depois |
|---------|-------|--------|
| User tenta editar quantidade de OS | ✅ Permite (❌ BUG) | ❌ Bloqueia (✅ OK) |
| User tenta aplicar desconto em OS | ✅ Permite (❌ BUG) | ❌ Bloqueia (✅ OK) |
| OS já quitada readicionada | ✅ Permite (❌ BUG) | ❌ Bloqueia (✅ OK) |
| Pagamento registra origem | ❌ Sem source | ✅ `source: 'os'` ou `'sale'` |
| Relatório diferencia venda vs OS | ❌ Misturado | ✅ Separado |
| Auditoria de pagamentos | ❌ Incompleta | ✅ Completa |
| `paid` está consistente | ❌ Estado simples | ✅ Derivado |
| Pode rastrear OS → Pagamento | ❌ Impossível | ✅ Via `osId` |

---

## 🎓 Princípios de Design Aplicados

### 1. **Single Source of Truth**
```typescript
// ❌ Antes: paid como estado simples
const [paid, setPaid] = useState(0);

// ✅ Depois: paid derivado de payments
get paid(): number {
  return payments
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + p.valor, 0);
}
```

### 2. **Immutability**
```typescript
// ✅ OS no carrinho é imutável
if (item.type === 'os') {
  return item; // Sem modificações
}
```

### 3. **Type Safety**
```typescript
// ❌ Antes: osData?: any
// ✅ Depois: CartItemOS interface + guard
if (isCartItemOS(item)) { /* ... */ }
```

### 4. **Separation of Concerns**
```typescript
// ✅ Modelo de domínio
OrderServiceModel { paid, remaining, validate }

// ✅ Hook React
useOrderService() { state management }

// ✅ Serviço
OrderServiceService { API calls }
```

### 5. **Auditability**
```typescript
// ✅ Cada pagamento tem origem
Payment { source: 'sale' | 'os', saleId?, osId? }
```

---

## 📚 Documentação Relacionada

- `RELATORIO_ANALISE_VENDAS.md` — Análise detalhada
- `IMPLEMENTACAO_RAPIDA.md` — Snippets de código
- `RESUMO_EXECUTIVO.md` — Visão executiva
- `FLUXO_OS_PAGAMENTOS.md` — Diagrama de fluxo completo (próximo)

---

## 🚀 Implementação: Passo a Passo

### Semana 1: Fundação
1. Criar `types/payment.types.ts`
2. Criar `models/OrderService.model.ts`
3. Atualizar `types/cart.types.ts`

### Semana 2: Integração
4. Refatorar `useOrderService.ts`
5. Atualizar `CartAside.tsx` (proteger OS)
6. Atualizar `FinalizarVenda.tsx` (adicionar source)

### Semana 3: Testes
7. Testes unitários
8. Testes de integração
9. Validação com backend

---

## 💬 Conclusão

A arquitetura proposta estabelece:

✅ **Fonte única de verdade** para pagamentos  
✅ **Type safety** com interfaces específicas  
✅ **Rastreabilidade** com `source` e referências  
✅ **Imutabilidade** de OS no carrinho  
✅ **Separação** clara entre domínio e UI  
✅ **Auditoria** completa de transações  

Resultado: **Sistema confiável, manutenível e em conformidade com regras de negócio**.
