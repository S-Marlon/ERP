# 🧾 Relatório de Análise do Módulo de Vendas

**Data:** 29 de Abril de 2026  
**Versão:** 1.0  
**Escopo:** PDV + Ordem de Serviço (OS) + Integração de Pagamentos  

---

## 📌 Visão Geral

O módulo de vendas do projeto ERP possui uma arquitetura parcialmente refatorada com separação de responsabilidades por hooks e contextos. No entanto, **apresenta inconsistências críticas com as regras de negócio descritas**, especialmente na gestão de Ordens de Serviço (OS) e pagamentos.

**Status Atual:** ⚠️ **CRÍTICO** — Várias violações de regras de negócio permitem comportamentos indesejados (desconto em OS, pagamento parcial de OS no PDV, edição de preço de OS no carrinho).

---

## ❌ Problemas Encontrados

### 1. ❌ Estado `paid` incorretamente gerenciado como simples em vez de derivado

**Descrição:**  
No hook `useOSForm.ts`, `paid` é gerenciado como um estado independente com `useState`:

```typescript
const [paid, setPaid] = useState(0);
```

Isso viola a arquitetura financeira esperada, que deveria derivar `paid` da soma de pagamentos:

```typescript
paid = soma(payments[].valor)
remaining = total - paid
```

**Impacto:**
- Permite que o estado fica inconsistente (alguém pode alterar `paid` manualmente)
- Não há fonte única de verdade para pagamentos
- Impossível rastrear origem de pagamentos (sale vs os)
- OS pode ser "paga" sem gerar registros de transação reais

**Arquivos afetados:**
- `hooks/useOSForm.ts` (linhas 77, 130, etc.)
- `components/OSPanelRefactored_NEW.tsx` (linhas 47, 307, etc.)

**Severidade:** 🔴 CRÍTICO

---

### 2. ❌ Ausência de `payments[]` em Ordem de Serviço

**Descrição:**  
A interface `OSFormData` não mantém um registro de pagamentos realizados:

```typescript
export interface OSFormData {
  equipment: string;
  application: string;
  // ... outros campos
  // ❌ FALTA: payments: Payment[]
}
```

Regra de negócio esperada:
- Uma OS deve manter `payments: Payment[]`
- Cada pagamento deve ter `{ valor, método, source, saleId?, timestamp }`
- `paid` é derivado: `paid = sum(payments.valor)`

**Impacto:**
- Sem histórico de pagamentos
- Impossível rastrear quem/quando/como foi paga
- Não diferencia pagamentos internos (PDV) vs externos (caixa manual)
- Violação de princípios de auditoria

**Arquivos afetados:**
- `types/cart.types.ts` (CartItem com osData genérico)
- `hooks/useOSForm.ts` (UseOSFormReturn sem payments)
- `pages/VendaPayload.ts` (não inclui payments de OS)

**Severidade:** 🔴 CRÍTICO

---

### 3. ❌ OS adicionada ao carrinho é tratada como item normal

**Descrição:**  
Quando uma OS é adicionada ao carrinho via `onSubmit()`, ela é inserida como um `CartItem` padrão com `type: 'os'`:

```typescript
const osItem: CartItem = {
  id: `os-${Date.now()}`,
  name: `${osData.equipment} • ${osData.gauge}`,
  category: 'OS',
  price: totals.total,
  quantity: 1,  // ❌ PROBLEMA: Pode ser alterado
  type: 'os',
  osData: { ... }
};
```

No `CartAside`, ela pode sofrer operações normais:

```typescript
updateQuantity(item.id, -currentStep);  // ❌ Permite diminuir quantidade
applyIndividualDiscount(item.id, newPrice);  // ❌ Permite desconto
```

Regra de negócio esperada:
- OS no carrinho é imutável/read-only
- Quantidade sempre = 1
- Desconto não é permitido
- Apenas o `remaining` deve ser pago no PDV

**Impacto:**
- Usuário pode alterar valor total da OS no PDV
- Usuário pode "remover" parte da OS aumentando/diminuindo quantidade
- Desconto aplicado em OS não tem justificativa de negócio
- Carrinho fica inconsistente com banco de dados

**Arquivos afetados:**
- `components/OSPanelRefactored_NEW.tsx` (linhas 110-130)
- `pages/Cart/CartAside.tsx` (linhas 348-476)
- `hooks/useCart.ts` (updateQuantity e applyIndividualDiscount não validam tipo)

**Severidade:** 🔴 CRÍTICO

---

### 4. ❌ Falta de trava de edição para OS no carrinho

**Descrição:**  
Os métodos `updateQuantity()` e `applyIndividualDiscount()` do hook `useCart` não validam o tipo de item:

```typescript
export const updateQuantity = useCallback((id: string | number, value: number | string) => {
  setCart(prev => prev.map(item => {
    if (item.id === id) {
      // ❌ Sem validação: if (item.type === 'os') return item; // IMUTÁVEL
      const canFractionate = ['MT', 'LT', 'KG', 'M', 'L'].includes(...);
      // ... continua a editar
    }
    return item;
  }));
}, []);
```

**Impacto:**
- OS pode ser editada/desconto pode ser aplicado
- Violação da regra: "OS não pode ter desconto, alteração de preço ou quantidade"
- Impossível garantir integridade da OS no PDV

**Arquivos afetados:**
- `hooks/useCart.ts` (linhas 41-68, 71-89)
- `pages/Cart/CartAside.tsx` (linhas 329-330, 341-344)

**Severidade:** 🔴 CRÍTICO

---

### 5. ❌ Falta de diferenciação entre `source: sale` e `source: os` nos pagamentos

**Descrição:**  
Em `FinalizarVenda.tsx`, os pagamentos são criados sem informar a origem:

```typescript
const novoPagamento: Pagamento = {
  id: crypto.randomUUID(),
  metodo: metodoSelecionado,
  valor: parseFloat(valorInput.replace(',', '.')) || 0,
  parcelas: metodoSelecionado === 'credit_card' ? parcelasInput : 1,
  status: 'pending',
  createdAt: new Date(),
  // ❌ FALTA: source: 'sale' | 'os'
  // ❌ FALTA: saleId ou osId
};
```

Quando `vendaCompleta` é enviado ao servidor, não há distinção:

```typescript
const vendaCompleta: SalePayload = {
  // ... campos
  pagamentos: pagamentosParaImpressao.map(p => ({
    metodo: p.metodo,
    valor: p.valor,
    parcelas: p.parcelas || 1
    // ❌ FALTA: source, reference (saleId ou osId)
  }))
};
```

**Impacto:**
- Caixa não sabe se pagamento veio de venda ou OS
- Impossível reconciliar movimentação financeira
- Relatórios incorretos
- Auditoria comprometida

**Arquivos afetados:**
- `pages/FinalizarVenda.tsx` (linhas 96-107)
- `types/sale.types.ts` (VendaPayload.pagamentos sem source)
- `pages/VendaPayload.ts` (sem source ou reference)

**Severidade:** 🔴 CRÍTICO

---

### 6. ❌ Inconsistência: OS com pagamentos parciais no PDV (violação de regra)

**Descrição:**  
Uma OS pode ser adicionada ao carrinho com `paid > 0` (pagamentos anteriores):

```typescript
const osItem: CartItem = {
  // ...
  price: totals.total,  // ❌ DEVERIA SER: totals.remaining
  osData: {
    // ...
    paid,  // ❌ Incluído na OS
    total: totals.total
  }
};
```

No PDV, o usuário vê o valor total e não o restante. Além disso, o `remaining` é calculado como:

```typescript
const remaining = Math.max(0, parseFloat((totalLiquidoNum - totalPagoNum).toFixed(2)));
```

Isso mistura o `remaining` da OS com itens normais do carrinho.

Regra de negócio esperada:
- OS já paga (remaining = 0) não deve ser adicionada ao carrinho
- Se remaining > 0, apenas `remaining` é o preço no PDV
- Pagamento da OS no PDV quitaria completamente (sem parcial)

**Impacto:**
- Cálculo de totais incorreto
- User pode pagar parcialmente uma OS no PDV (violação)
- OS pode aparecer como "já paga" no carrinho mas com remaining > 0 no banco

**Arquivos afetados:**
- `components/OSPanelRefactored_NEW.tsx` (linhas 110-130)
- `pages/FinalizarVenda.tsx` (linhas 75-92)
- `utils/calculations.ts` (calculateCartTotals sem separação OS)

**Severidade:** 🔴 CRÍTICO

---

### 7. ⚠️ Tipagem genérica `osData?: any` viola type safety

**Descrição:**  
Em `cart.types.ts`:

```typescript
export interface CartItem extends SaleItem {
  quantity: number;
  type: ItemType;
  osData?: any;  // ❌ Muito genérico, sem validação
  originalPrice?: number;
}
```

E em `sale.types.ts`:

```typescript
interface OSData {
  equipment?: string;
  application?: string;
  gauge?: string;
  laborType?: string;
  laborValue?: number;
  // ❌ Sem total, remaining, paid, payments[]
}
```

**Impacto:**
- Sem validação de estrutura da OS
- TypeScript não protege contra campos faltantes
- Runtime errors possíveis
- Difícil de debugar

**Arquivos afetados:**
- `types/cart.types.ts` (CartItem)
- `contexts/PDVContext.tsx` (interface OSData)

**Severidade:** ⚠️ MÉDIO

---

### 8. ⚠️ Lógica de cálculo de `remaining` incompleta

**Descrição:**  
Em `useOSForm.ts`:

```typescript
const totals = useMemo(() => {
  // ... calcula productsTotal, servicesTotal, laborTotal
  const total = productsTotal + servicesTotal + laborTotal;
  const remaining = total - paid;  // ✅ Correto
  // ... return totals
}, [osItems, osServices, osData.laborType, osData.laborValue, paid]);
```

Mas em `FinalizarVenda.tsx`, o cálculo de saldo é:

```typescript
const totalLiquidoNum = Number(totalLiquido) || 0;
const saldoRestante = Math.max(0, parseFloat((totalLiquidoNum - totalPagoNum).toFixed(2)));
```

Mistura total da venda com saldo de OS se houver.

**Impacto:**
- Se houver OS + itens normais, o cálculo fica confuso
- Saldo mostrado pode estar incorreto se houver múltiplas OS

**Arquivos afetados:**
- `pages/FinalizarVenda.tsx` (linhas 75-92)
- `utils/calculations.ts` (sem lógica de OS)

**Severidade:** ⚠️ MÉDIO

---

### 9. ⚠️ Duplicação de estado: OS em múltiplos hooks

**Descrição:**  
Estado de OS é gerenciado em:
1. `useOSForm.ts` (osData, osItems, osServices, paid)
2. `usePDVState.ts` (osItems, osServices, osData)
3. `PDVContext.tsx` (combina ambos)

```typescript
// usePDVState.ts
const [osItems, setOsItems] = useState<CartItem[]>([]);
const [osServices, setOsServices] = useState<any[]>([]);
const [osData, setOsData] = useState({ ... });

// E em PDVContext.tsx:
osItems: CartItem[];
setOsItems: (items: CartItem[]) => void;
osServices: CartItem[];
setOsServices: (services: CartItem[]) => void;
```

**Impacto:**
- Difícil sincronizar estado
- Risco de inconsistência
- Código redundante
- Dificuldade de manutenção

**Arquivos afetados:**
- `hooks/useOSForm.ts`
- `hooks/usePDVState.ts`
- `contexts/PDVContext.tsx`

**Severidade:** ⚠️ MÉDIO

---

### 10. ⚠️ Validação de OS incompleta antes de adicionar ao carrinho

**Descrição:**  
Em `OSPanelRefactored_NEW.tsx`, validações ocorrem mas são incomplete:

```typescript
if (!osData.equipment || !osData.gauge) {
  Swal.fire({ /* ... */ });
  return;
}

if (osItems.length === 0 && osServices.length === 0) {
  // Permite apenas mão de obra — é válido?
}

if (osItems.length > 0 && osData.laborValue <= 0) {
  // Permite sem mão de obra — é válido?
}
```

Faltam validações:
- OS já quitada (remaining = 0) não deveria ser readicionada
- OS com desconto anterior deveria ser validada
- Total deve ser > 0 antes de adicionar

**Impacto:**
- OS inválida pode ser adicionada ao carrinho
- Carrinho fica inconsistente
- Erros em tempo de execução

**Arquivos afetados:**
- `components/OSPanelRefactored_NEW.tsx` (linhas 64-118)

**Severidade:** ⚠️ MÉDIO

---

### 11. ⚠️ VendaPayload não diferencia itens de OS vs produtos normais

**Descrição:**  
Em `VendaPayload.ts` e `FinalizarVenda.tsx`, itens são todos tratados igual:

```typescript
const vendaCompleta: SalePayload = {
  // ... campos
  itens: itens.map(item => ({
    productId: item.id,  // ❌ Não diferencia OS
    nome: item.name,
    quantidade: item.quantity,
    precoVenda: item.salePrice,
    precoCusto: item.costPrice || 0,
    subtotal: item.quantity * item.salePrice,
    lucroUnitario: item.salePrice - (item.costPrice || 0)
  }))
};
```

**Impacto:**
- Relatório de vendas mistura venda normal com OS
- BI não consegue separar receita de venda vs receita de OS
- Auditoria comprometida
- Análises de margem incorretas

**Arquivos afetados:**
- `pages/FinalizarVenda.tsx` (linhas 258-265)
- `types/sale.types.ts` (SalePayload)

**Severidade:** ⚠️ MÉDIO

---

## ⚠️ Inconsistências com as Regras de Negócio

| Regra | Código | Status |
|-------|--------|--------|
| OS NÃO pode ter modo ("integrated"/"standalone") | Não há modo em CartItem | ✅ OK |
| Controle via `payments[]` | Falta `payments[]` em OS | ❌ FALHA |
| `paid = soma(payments)` | `paid` é estado simples | ❌ FALHA |
| `remaining = total - paid` | Fórmula correta mas baseada em estado errado | ⚠️ PARCIAL |
| OS pode ser paga parcialmente FORA do PDV | Sem lógica de histórico | ❌ FALHA |
| OS pode ser quitada NO PDV (sem parcial) | Permite múltiplas adições | ❌ FALHA |
| Caixa registra `source: sale` ou `source: os` | Sem source no Pagamento | ❌ FALHA |
| Descontos NÃO em OS dentro do carrinho | `applyIndividualDiscount` funciona | ❌ FALHA |
| OS é imutável no carrinho | Pode ser editada | ❌ FALHA |
| Apenas `remaining` é considerado no PDV | Usa `total` completo | ❌ FALHA |
| Desconto pode ser por item/automático/global | Só individual por item | ⚠️ PARCIAL |

---

## ✅ Sugestões de Correção

### 1. Criar modelo de `Payment` centralizado com `source`

**Arquivo:** `types/payment.types.ts` (NOVO)

```typescript
export type PaymentSource = 'sale' | 'os' | 'manual';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'STORE_CREDIT';

export interface Payment {
  id: string;  // UUID
  valor: number;
  metodo: PaymentMethod;
  status: PaymentStatus;
  parcelas: number;
  source: PaymentSource;  // ✅ NOVO: Diferencia origem
  
  // Referências para reconciliação
  saleId?: string;        // Se source = 'sale'
  osId?: string;          // Se source = 'os'
  
  // Metadados
  detalhes?: {
    bandeira?: string;
    authCode?: string;
    nsu?: string;
    chavePix?: string;
  };
  
  createdAt: Date;
  updatedAt?: Date;
}

export interface OSPayment extends Payment {
  source: 'os';
  osId: string;  // ✅ OBRIGATÓRIO
}

export interface SalePayment extends Payment {
  source: 'sale';
  saleId: string;  // ✅ OBRIGATÓRIO
}
```

**Impacto:** ✅ Resolve problemas #2, #5

---

### 2. Refatorar `OSFormData` para usar `payments[]` em vez de `paid`

**Arquivo:** `hooks/useOSForm.ts` (REFACTOR)

```typescript
export interface OSFormData {
  equipment: string;
  application: string;
  gauge: string;
  layers: string;
  finalLength: number;
  laborType: LaborType;
  laborValue: number;
  customerName: string;
  technician: string;
  status: OSStatus;
  title: string;
  notes: string;
}

export interface OrderService extends OSFormData {
  osNumber: string;
  customerId: string;
  items: CartItem[];  // Itens da OS
  services: CartItem[];  // Serviços da OS
  payments: Payment[];  // ✅ NOVO: Histórico de pagamentos
  createdAt: Date;
  updatedAt?: Date;
  
  // Derivados (memoizados)
  get total(): number;
  get paid(): number;      // = sum(payments.valor)
  get remaining(): number; // = total - paid
}

interface UseOSFormReturn {
  osData: OSFormData;
  osItems: CartItem[];
  osServices: CartItem[];
  payments: Payment[];  // ✅ NOVO
  
  // Setters
  setOsData: (data: Partial<OSFormData>) => void;
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void;  // ✅ NOVO
  removePayment: (paymentId: string) => void;  // ✅ NOVO
  
  // Totals (derivados, não estado)
  totals: {
    products: number;
    services: number;
    labor: number;
    total: number;
    paid: number;        // ✅ DERIVADO de payments
    remaining: number;   // ✅ DERIVADO
  };
  
  // ... rest
}

export const useOSForm = (customerId: string, osNumber: string): UseOSFormReturn => {
  const [osData, setOsDataState] = useState<OSFormData>(INITIAL_STATE);
  const [osItems, setOsItems] = useState<CartItem[]>([]);
  const [osServices, setOsServices] = useState<CartItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);  // ✅ NOVO

  const setOsData = useCallback((updates: Partial<OSFormData>) => {
    setOsDataState(prev => ({ ...prev, ...updates }));
  }, []);

  // ✅ NOVO: Gerenciar pagamentos
  const addPayment = useCallback((payment: Omit<Payment, 'id' | 'createdAt'>) => {
    setPayments(prev => [...prev, {
      ...payment,
      id: crypto.randomUUID(),
      createdAt: new Date()
    }]);
  }, []);

  const removePayment = useCallback((paymentId: string) => {
    setPayments(prev => prev.filter(p => p.id !== paymentId));
  }, []);

  // ✅ NOVO: Calcular paid a partir de payments
  const totals = useMemo(() => {
    const productsTotal = osItems.reduce(
      (acc, i) => acc + i.price * (i.quantity || 1), 0
    );
    const servicesTotal = osServices.reduce(
      (acc, i) => acc + i.price * (i.quantity || 1), 0
    );
    
    let laborTotal = 0;
    if (osData.laborType === 'fixed') {
      laborTotal = osData.laborValue;
    } else if (osData.laborType === 'per_point') {
      const points = osItems.length * 2;
      laborTotal = points * osData.laborValue;
    }

    const total = productsTotal + servicesTotal + laborTotal;
    
    // ✅ DERIVADO: Somar apenas payments com status 'paid' ou 'processing'
    const paid = payments
      .filter(p => p.status === 'paid' || p.status === 'processing')
      .reduce((acc, p) => acc + p.valor, 0);
    
    const remaining = Math.max(0, total - paid);

    return {
      products: productsTotal,
      services: servicesTotal,
      labor: laborTotal,
      total,
      paid,     // ✅ DERIVADO
      remaining // ✅ DERIVADO
    };
  }, [osItems, osServices, osData.laborType, osData.laborValue, payments]); // ✅ Inclui payments

  return {
    osData,
    osItems,
    osServices,
    payments,      // ✅ NOVO
    setOsData,
    addPayment,    // ✅ NOVO
    removePayment, // ✅ NOVO
    totals,
    // ... resto
  };
};
```

**Impacto:** ✅ Resolve problemas #1, #2

---

### 3. Proteger OS no carrinho contra edição

**Arquivo:** `hooks/useCart.ts` (REFACTOR)

```typescript
const updateQuantity = useCallback((id: string | number, value: number | string) => {
  setCart(prev => prev.map(item => {
    if (item.id === id) {
      // ✅ NOVO: Validar tipo
      if (item.type === 'os') {
        console.warn('⚠️ Não é permitido alterar quantidade de OS');
        return item; // Imutável
      }

      const canFractionate = ['MT', 'LT', 'KG', 'M', 'L'].includes(item.unitOfMeasure?.toUpperCase() || '');
      // ... rest
    }
    return item;
  }));
}, []);

const applyIndividualDiscount = useCallback((id: string | number, newPrice: number) => {
  setCart(prevCart => prevCart.map(item => {
    if (item.id === id) {
      // ✅ NOVO: Validar tipo
      if (item.type === 'os') {
        Swal.fire({
          icon: 'error',
          title: 'Operação inválida',
          text: 'Não é permitido aplicar desconto em Ordens de Serviço'
        });
        return item;
      }

      return {
        ...item,
        originalPrice: item.originalPrice || item.price,
        price: newPrice
      };
    }
    return item;
  }));
}, []);
```

**Impacto:** ✅ Resolve problema #4

---

### 4. Validar `remaining` antes de adicionar OS ao carrinho

**Arquivo:** `components/OSPanelRefactored_NEW.tsx` (REFACTOR)

```typescript
const handleGenerateSale = useCallback(async () => {
  // ... validações existentes

  // ✅ NOVO: Validar se OS ainda precisa pagamento
  if (totals.remaining <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'OS já quitada',
      text: 'Esta Ordem de Serviço já foi integralmente paga e não pode ser readicionada ao carrinho.',
      confirmButtonText: 'Entendido',
    });
    return;
  }

  // ✅ NOVO: Usar apenas remaining como preço no carrinho
  const osItem: CartItem = {
    id: `os-${Date.now()}`,
    name: `${osData.equipment} • ${osData.gauge}`,
    category: 'OS',
    price: totals.remaining,  // ✅ MUDANÇA: Apenas remaining
    quantity: 1,
    type: 'os',
    osData: {
      osNumber,
      equipment: osData.equipment,
      application: osData.application,
      gauge: osData.gauge,
      layers: osData.layers,
      finalLength: osData.finalLength,
      laborType: osData.laborType,
      laborValue: osData.laborValue,
      customerName: osData.customerName,
      technician: osData.technician,
      status: osData.status,
      title: osData.title,
      notes: osData.notes,
      items: osItems,
      services: osServices,
      productsTotal: totals.products,
      servicesTotal: totals.services,
      laborTotal: totals.labor,
      total: totals.total,
      paid: totals.paid,        // ✅ Incluir paid
      remaining: totals.remaining,
      payments: payments,       // ✅ Incluir payments
    },
  };

  // ... resto do código
}, [/* ... */]);
```

**Impacto:** ✅ Resolve problema #6

---

### 5. Registrar `source` em pagamentos quando OS é quitada no PDV

**Arquivo:** `pages/FinalizarVenda.tsx` (REFACTOR)

```typescript
const handleFinalizarVenda = async () => {
  // ... código existente

  // ✅ NOVO: Separar itens normais de OS
  const itemsNormais = itens.filter(i => i.type !== 'os');
  const osItens = itens.filter(i => i.type === 'os');

  // ✅ NOVO: Para cada OS, criar pagamentos com source='os'
  const pagamentosOS: Payment[] = osItens.map(osItem => ({
    id: crypto.randomUUID(),
    valor: osItem.salePrice * osItem.quantity,  // remaining
    metodo: 'CASH',  // Padrão — ou detectar do primeiro pagamento?
    status: 'paid' as PaymentStatus,
    parcelas: 1,
    source: 'os' as const,  // ✅ Marcar como OS
    osId: osItem.osData?.osNumber,  // Referência
    createdAt: new Date()
  }));

  // ✅ NOVO: Para itens normais, source='sale'
  const pagamentosSale: Payment[] = pagamentos.map(p => ({
    ...p,
    source: 'sale' as const,  // ✅ Marcar como sale
    saleId: numeroVenda
  }));

  // Combinar pagamentos
  const todosOsPagamentos = [...pagamentosOS, ...pagamentosSale];

  // ✅ NOVO: Construir VendaPayload com diferenciação
  const vendaCompleta: SalePayload = {
    data: new Date().toISOString(),
    clienteNome: cliente || "CONSUMIDOR",
    totalBruto: total,
    totalDesconto: descontoCalculado,
    totalLiquido: totalLiquido,
    totalCusto: totalCusto,
    lucroNominal: lucroNominal,
    percentualLucro: Number(percentualLucro.toFixed(2)),
    
    // ✅ NOVO: Separar itens
    itens: itemsNormais.map(item => ({
      productId: item.id,
      nome: item.name,
      quantidade: item.quantity,
      precoVenda: item.salePrice,
      precoCusto: item.costPrice || 0,
      subtotal: item.quantity * item.salePrice,
      lucroUnitario: item.salePrice - (item.costPrice || 0),
      type: 'produto'  // ✅ NOVO: Tipo
    })),
    
    // ✅ NOVO: Incluir OS em formato estruturado
    ordensServico: osItens.map(osItem => ({
      osNumber: osItem.osData?.osNumber,
      equipamento: osItem.osData?.equipment,
      total: osItem.osData?.total,
      remaining: osItem.salePrice,  // O que foi pago no PDV
      items: osItem.osData?.items,
      services: osItem.osData?.services
    })),
    
    // ✅ NOVO: Pagamentos com source
    pagamentos: todosOsPagamentos.map(p => ({
      id: p.id,
      metodo: p.metodo,
      valor: p.valor,
      parcelas: p.parcelas || 1,
      source: p.source,  // ✅ Diferencia sale vs os
      saleId: p.saleId,
      osId: p.osId
    }))
  };

  // ... resto do código
};
```

**Impacto:** ✅ Resolve problema #5, #11

---

### 6. Consolidar estado de OS em um único hook

**Arquivo:** `hooks/useOrderService.ts` (REFACTOR/NOVO)

```typescript
/**
 * useOrderService
 * Hook centralizado para gerenciar estado completo da Ordem de Serviço
 * Consolidação de: useOSForm + usePDVState (parte de OS)
 */

import { useState, useCallback, useMemo } from 'react';
import { CartItem } from '../types/cart.types';
import { Payment } from '../types/payment.types';

export interface OrderService {
  // Identificação
  osNumber: string;
  customerId: string;
  
  // Dados técnicos
  equipment: string;
  application: string;
  gauge: string;
  layers: string;
  finalLength: number;
  
  // Mão de obra
  laborType: 'fixed' | 'per_point' | 'table';
  laborValue: number;
  
  // Pessoal
  customerName: string;
  technician: string;
  
  // Status
  status: 'draft' | 'in_progress' | 'finished';
  title: string;
  notes: string;
  
  // Conteúdo
  items: CartItem[];
  services: CartItem[];
  
  // Pagamentos
  payments: Payment[];
  
  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
}

export const useOrderService = (customerId: string, osNumber: string) => {
  const [orderService, setOrderService] = useState<OrderService>({
    osNumber,
    customerId,
    equipment: '',
    application: '',
    gauge: '',
    layers: '2',
    finalLength: 0,
    laborType: 'fixed',
    laborValue: 0,
    customerName: '',
    technician: '',
    status: 'draft',
    title: '',
    notes: '',
    items: [],
    services: [],
    payments: [],
    createdAt: new Date()
  });

  // Atualizar dados da OS
  const updateOrderService = useCallback((updates: Partial<OrderService>) => {
    setOrderService(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date()
    }));
  }, []);

  // Adicionar item
  const addItem = useCallback((item: CartItem) => {
    setOrderService(prev => ({
      ...prev,
      items: [...prev.items, item],
      updatedAt: new Date()
    }));
  }, []);

  // Remover item
  const removeItem = useCallback((itemId: string | number) => {
    setOrderService(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId),
      updatedAt: new Date()
    }));
  }, []);

  // Atualizar quantidade do item
  const updateItemQuantity = useCallback((itemId: string | number, quantity: number) => {
    setOrderService(prev => ({
      ...prev,
      items: prev.items.map(i =>
        i.id === itemId ? { ...i, quantity } : i
      ),
      updatedAt: new Date()
    }));
  }, []);

  // Adicionar serviço
  const addService = useCallback((service: CartItem) => {
    setOrderService(prev => ({
      ...prev,
      services: [...prev.services, service],
      updatedAt: new Date()
    }));
  }, []);

  // Remover serviço
  const removeService = useCallback((serviceId: string | number) => {
    setOrderService(prev => ({
      ...prev,
      services: prev.services.filter(s => s.id !== serviceId),
      updatedAt: new Date()
    }));
  }, []);

  // Adicionar pagamento
  const addPayment = useCallback((payment: Omit<Payment, 'id' | 'createdAt'>) => {
    setOrderService(prev => ({
      ...prev,
      payments: [...prev.payments, {
        ...payment,
        id: crypto.randomUUID(),
        createdAt: new Date()
      }],
      updatedAt: new Date()
    }));
  }, []);

  // Remover pagamento
  const removePayment = useCallback((paymentId: string) => {
    setOrderService(prev => ({
      ...prev,
      payments: prev.payments.filter(p => p.id !== paymentId),
      updatedAt: new Date()
    }));
  }, []);

  // Cálculos memoizados
  const totals = useMemo(() => {
    const productsTotal = orderService.items.reduce(
      (acc, i) => acc + i.price * (i.quantity || 1), 0
    );
    const servicesTotal = orderService.services.reduce(
      (acc, i) => acc + i.price * (i.quantity || 1), 0
    );
    
    let laborTotal = 0;
    if (orderService.laborType === 'fixed') {
      laborTotal = orderService.laborValue;
    } else if (orderService.laborType === 'per_point') {
      const points = orderService.items.length * 2;
      laborTotal = points * orderService.laborValue;
    }

    const total = productsTotal + servicesTotal + laborTotal;
    
    const paid = orderService.payments
      .filter(p => p.status === 'paid' || p.status === 'processing')
      .reduce((acc, p) => acc + p.valor, 0);
    
    const remaining = Math.max(0, total - paid);

    return {
      products: productsTotal,
      services: servicesTotal,
      labor: laborTotal,
      total,
      paid,
      remaining
    };
  }, [orderService.items, orderService.services, orderService.laborType, orderService.laborValue, orderService.payments]);

  return {
    orderService,
    updateOrderService,
    addItem,
    removeItem,
    updateItemQuantity,
    addService,
    removeService,
    addPayment,
    removePayment,
    totals
  };
};
```

**Impacto:** ✅ Resolve problema #9

---

### 7. Criar tipo específico e validação para CartItem OS

**Arquivo:** `types/cart.types.ts` (REFACTOR)

```typescript
export interface CartItemOS extends CartItem {
  type: 'os';
  quantity: 1;  // ✅ NUNCA pode ser alterada
  osData: {
    osNumber: string;
    equipment: string;
    application: string;
    gauge: string;
    layers: string;
    finalLength: number;
    laborType: string;
    laborValue: number;
    customerName: string;
    technician: string;
    status: string;
    title: string;
    notes: string;
    items: CartItem[];
    services: CartItem[];
    productsTotal: number;
    servicesTotal: number;
    laborTotal: number;
    total: number;
    paid: number;        // ✅ Incluir
    remaining: number;   // ✅ Incluir
    payments: Payment[]; // ✅ Incluir
  };
}

// ✅ NOVO: Guard para verificar se é OS
export function isCartItemOS(item: CartItem): item is CartItemOS {
  return item.type === 'os' && item.osData?.osNumber !== undefined;
}

// ✅ NOVO: Função para criar CartItem de OS
export function createCartItemOS(osData: any): CartItemOS {
  return {
    id: `os-${Date.now()}`,
    name: `${osData.equipment} • ${osData.gauge}`,
    category: 'OS',
    price: osData.remaining,
    quantity: 1,
    type: 'os',
    osData
  };
}
```

**Impacto:** ✅ Resolve problema #7

---

## 🚀 Melhorias Arquiteturais

### A. Criar modelo de domínio `OrderServiceModel` com lógica de negócio

**Arquivo:** `models/OrderService.model.ts` (NOVO)

```typescript
import { Payment } from '../types/payment.types';

export class OrderServiceModel {
  osNumber: string;
  customerId: string;
  equipment: string;
  application: string;
  gauge: string;
  layers: string;
  finalLength: number;
  laborType: 'fixed' | 'per_point' | 'table';
  laborValue: number;
  customerName: string;
  technician: string;
  status: 'draft' | 'in_progress' | 'finished';
  title: string;
  notes: string;
  items: CartItem[];
  services: CartItem[];
  private _payments: Payment[];
  createdAt: Date;
  updatedAt?: Date;

  constructor(osNumber: string, customerId: string) {
    this.osNumber = osNumber;
    this.customerId = customerId;
    this.equipment = '';
    this.application = '';
    this.gauge = '';
    this.layers = '2';
    this.finalLength = 0;
    this.laborType = 'fixed';
    this.laborValue = 0;
    this.customerName = '';
    this.technician = '';
    this.status = 'draft';
    this.title = '';
    this.notes = '';
    this.items = [];
    this.services = [];
    this._payments = [];
    this.createdAt = new Date();
  }

  // ✅ Getter para payments (somente leitura)
  get payments(): ReadonlyArray<Payment> {
    return Object.freeze([...this._payments]);
  }

  // ✅ Getter para paid (derivado)
  get paid(): number {
    return this._payments
      .filter(p => p.status === 'paid' || p.status === 'processing')
      .reduce((acc, p) => acc + p.valor, 0);
  }

  // ✅ Getter para total
  get total(): number {
    const itemsTotal = this.items.reduce((acc, i) => acc + i.price * (i.quantity || 1), 0);
    const servicesTotal = this.services.reduce((acc, s) => acc + s.price, 0);
    
    let laborTotal = 0;
    if (this.laborType === 'fixed') {
      laborTotal = this.laborValue;
    } else if (this.laborType === 'per_point') {
      const points = this.items.length * 2;
      laborTotal = points * this.laborValue;
    }

    return itemsTotal + servicesTotal + laborTotal;
  }

  // ✅ Getter para remaining (derivado)
  get remaining(): number {
    return Math.max(0, this.total - this.paid);
  }

  // ✅ Getter para isFullyPaid
  get isFullyPaid(): boolean {
    return this.remaining === 0;
  }

  // ✅ Getter para isPartiallyPaid
  get isPartiallyPaid(): boolean {
    return this.paid > 0 && !this.isFullyPaid;
  }

  // ✅ Método para adicionar pagamento com validação
  addPayment(payment: Omit<Payment, 'id' | 'createdAt'>): void {
    if (this.isFullyPaid) {
      throw new Error('Não é permitido adicionar pagamento a uma OS já quitada');
    }

    this._payments.push({
      ...payment,
      id: crypto.randomUUID(),
      createdAt: new Date()
    });

    this.updatedAt = new Date();
  }

  // ✅ Método para remover pagamento
  removePayment(paymentId: string): void {
    this._payments = this._payments.filter(p => p.id !== paymentId);
    this.updatedAt = new Date();
  }

  // ✅ Método para validar se pode ser adicionada ao carrinho
  canBeAddedToCart(): { valid: boolean; reason?: string } {
    if (this.isFullyPaid) {
      return { valid: false, reason: 'OS já foi integralmente paga' };
    }

    if (this.total <= 0) {
      return { valid: false, reason: 'Total da OS deve ser maior que zero' };
    }

    if (!this.equipment || !this.gauge) {
      return { valid: false, reason: 'Equipamento e Bitola são obrigatórios' };
    }

    return { valid: true };
  }

  // ✅ Serializar para CartItem
  toCartItem() {
    if (!this.canBeAddedToCart().valid) {
      throw new Error(this.canBeAddedToCart().reason);
    }

    return {
      id: `os-${Date.now()}`,
      name: `${this.equipment} • ${this.gauge}`,
      category: 'OS',
      price: this.remaining,  // ✅ Usar remaining
      quantity: 1,
      type: 'os' as const,
      osData: {
        osNumber: this.osNumber,
        equipment: this.equipment,
        application: this.application,
        gauge: this.gauge,
        layers: this.layers,
        finalLength: this.finalLength,
        laborType: this.laborType,
        laborValue: this.laborValue,
        customerName: this.customerName,
        technician: this.technician,
        status: this.status,
        title: this.title,
        notes: this.notes,
        items: [...this.items],
        services: [...this.services],
        total: this.total,
        paid: this.paid,
        remaining: this.remaining,
        payments: [...this._payments]
      }
    };
  }
}
```

**Impacto:** ✅ Melhora encapsulamento e lógica de domínio

---

### B. Criar interface `ICart` com validações

**Arquivo:** `services/ICart.ts` (NOVO)

```typescript
import { CartItem, CartItemOS } from '../types/cart.types';

export interface ICart {
  // ✅ Operações com validação de tipo
  updateQuantity(id: string | number, value: number | string): void;
  applyDiscount(id: string | number, newPrice: number): void;
  removeItem(id: string | number): void;
  
  // ✅ Métodos específicos que sabem sobre OS
  canModifyItem(item: CartItem): boolean;
  getOSItems(): CartItemOS[];
  getNormalItems(): CartItem[];
  
  // ✅ Validações
  validateBeforeCheckout(): { valid: boolean; errors: string[] };
}

export class CartService implements ICart {
  // ... implementação
  
  canModifyItem(item: CartItem): boolean {
    // ✅ Validação centralizada
    if (item.type === 'os') {
      return false; // OS é imutável
    }
    return true;
  }

  updateQuantity(id: string | number, value: number | string): void {
    if (!this.canModifyItem(item)) {
      throw new Error('Item não pode ser modificado');
    }
    // ... resto
  }
}
```

**Impacto:** ✅ Melhora extensibilidade e validação

---

### C. Refatorar `VendaPayload` para diferenciar OS vs Venda

**Arquivo:** `types/sale.types.ts` (REFACTOR)

```typescript
export interface SalePayload {
  data: string;
  clienteNome: string;
  
  // Totais
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  totalCusto: number;
  lucroNominal: number;
  percentualLucro: number;
  
  // ✅ NOVO: Separar itens normais de OS
  itens: {
    productId: number;
    nome: string;
    quantidade: number;
    precoVenda: number;
    precoCusto: number;
    subtotal: number;
    lucroUnitario: number;
    type: 'produto';  // ✅ Diferencia
  }[];
  
  // ✅ NOVO: OS separadas
  ordensServico?: {
    osNumber: string;
    equipamento: string;
    total: number;
    remaining: number;  // O que foi pago no PDV
    items: CartItem[];
    services: CartItem[];
  }[];
  
  // ✅ Pagamentos com source
  pagamentos: {
    id: string;
    metodo: string;
    valor: number;
    parcelas: number;
    source: 'sale' | 'os';  // ✅ Diferencia origem
    saleId?: string;
    osId?: string;
  }[];
}
```

**Impacto:** ✅ Melhora rastreabilidade financeira

---

## 📈 Próximos Passos

### Fase 1: Correções Críticas (Sprint atual)

| # | Tarefa | Prioridade | Impacto | Esforço |
|---|--------|-----------|---------|---------|
| 1 | Criar `Payment` com `source` | 🔴 CRÍTICO | Rastreabilidade financeira | M |
| 2 | Refatorar `useOSForm` com `payments[]` | 🔴 CRÍTICO | Estado correto | M |
| 3 | Proteger OS no carrinho (imutável) | 🔴 CRÍTICO | Integridade de dados | P |
| 4 | Validar `remaining` antes de adicionar ao carrinho | 🔴 CRÍTICO | Regra de negócio | P |
| 5 | Registrar `source` em pagamentos | 🔴 CRÍTICO | Auditoria | P |

**Tempo estimado:** 2-3 dias

---

### Fase 2: Melhorias Arquiteturais (Sprint seguinte)

| # | Tarefa | Prioridade | Impacto | Esforço |
|---|--------|-----------|---------|---------|
| 6 | Criar `OrderServiceModel` com lógica de domínio | ⚠️ MÉDIO | Encapsulamento | G |
| 7 | Consolidar estado OS em `useOrderService` | ⚠️ MÉDIO | Simplicidade | M |
| 8 | Criar `ICart` interface com validações | ⚠️ MÉDIO | Extensibilidade | M |
| 9 | Refatorar `VendaPayload` com diferenciação | ⚠️ MÉDIO | BI/Relatórios | M |

**Tempo estimado:** 3-4 dias

---

### Fase 3: Testes e Documentação (Sprint seguinte)

| # | Tarefa | Prioridade | Impacto | Esforço |
|---|--------|-----------|---------|---------|
| 10 | Criar testes unitários para `OrderServiceModel` | 🟡 NORMAL | Confiabilidade | G |
| 11 | Criar testes de integração PDV + OS + Pagamento | 🟡 NORMAL | Confiabilidade | G |
| 12 | Documentar fluxo de OS no PDV | 🟡 NORMAL | Manutenibilidade | P |

**Tempo estimado:** 2-3 dias

---

## 🎯 Checklist de Implementação

```markdown
### Fase 1: Correções Críticas

- [ ] Criar `types/payment.types.ts` com `Payment`, `OSPayment`, `SalePayment`
- [ ] Refatorar `useOSForm.ts` para usar `payments[]` em vez de `paid`
- [ ] Adicionar validação de `isCartItemOS()` e `createCartItemOS()` em `cart.types.ts`
- [ ] Atualizar `useCart.ts` para proteger OS (não permitir edição)
- [ ] Adicionar validação `remaining > 0` antes de adicionar OS ao carrinho
- [ ] Incluir `source` e `saleId`/`osId` no `Pagamento` em `FinalizarVenda.tsx`
- [ ] Separar itens normais de OS em `VendaPayload`

### Fase 2: Melhorias Arquiteturais

- [ ] Criar `models/OrderService.model.ts` com lógica de domínio
- [ ] Criar `hooks/useOrderService.ts` consolidado
- [ ] Criar `services/ICart.ts` interface com validações
- [ ] Refatorar `PDVContext.tsx` para usar novos hooks

### Fase 3: Testes

- [ ] Criar testes para `OrderServiceModel`
- [ ] Criar testes para fluxo PDV + OS + Pagamento
- [ ] Validar endpoints do backend
```

---

## 📝 Notas Finais

1. **Ordem de Implementação:** Seguir Fase 1 → Fase 2 → Fase 3
2. **Comunicação com Backend:** Verificar se backend também precisa ser atualizado para suportar `payments[]` e `source`
3. **Retrocompatibilidade:** Manter suporte a dados antigos (migração de dados se necessário)
4. **Testes:** Cada mudança deve ter testes correspondentes
5. **Documentação:** Atualizar guias de fluxo conforme implementações

---

## 🔗 Referências

- **Regras de Negócio:** Descrito no início deste relatório
- **Arquivos Principais:** Listados em cada problema
- **Próximas Ações:** Criar Issues no GitHub para cada item da Fase 1
