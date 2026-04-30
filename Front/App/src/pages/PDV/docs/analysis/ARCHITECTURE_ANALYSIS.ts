/**
 * ANÁLISE ESTRUTURAL: PDV + ORDEM DE SERVIÇO
 * ============================================
 * 
 * Diagnóstico completo do sistema e arquitetura proposta
 * Data: 2026-04-22
 * Status: EM ANÁLISE
 */

/*
═══════════════════════════════════════════════════════════════════════════════
PARTE 1: PROBLEMAS ATUAIS ENCONTRADOS
═══════════════════════════════════════════════════════════════════════════════

❌ PROBLEMA 1: Separação inadequada entre Carrinho PDV e OS
────────────────────────────────────────────────────────────────────────────────
Situação atual:
  • CartItem contém: produtos + serviços + OS
  • OS tem seus próprios items (osItems, osServices)
  • Quando você gera uma OS, cria um CartItem do tipo 'os'
  • Possível: adicionar o MESMO produto no carrinho E na OS

Consequência:
  ❌ Inconsistência de preços e quantidades
  ❌ Vendedor pode fazer preço diferente pro mesmo item
  ❌ Rastreamento de estoque fica confuso
  ❌ Relatórios incorretos

Exemplo de problema:
  PDV Carrinho: Mangueira 1/2" x R$ 150 (qtd: 2)
  OS dentro do carrinho: Mangueira 1/2" x R$ 140 (qtd: 1)
  Total incorreto = R$ 440 ao invés de R$ 440


❌ PROBLEMA 2: Sem State Machine (máquina de estados)
────────────────────────────────────────────────────────────────────────────────
Situação atual:
  • OS pode passar de um estado para outro SEM regras
  • Não existe validação automática
  • Você pode finalizar uma OS vazia
  • Mudança de estado é manual (componente decide)

Consequência:
  ❌ Inconsistências de dados
  ❌ Sem auditoria clara
  ❌ Fluxo não determinístico
  ❌ Backend não confia no que recebe

Exemplo:
  const handleGenerateSale = () => {
    // Nada valida se osItems.length > 0
    // Nada valida se total >= 0
    // Nada valida se pagamento é válido
    const osItem = { ... };
    onSubmit(osItem);
  };


❌ PROBLEMA 3: Contexto PDV gigante (200+ props)
────────────────────────────────────────────────────────────────────────────────
Situação atual:
  • PDVContext gerencia: cart, pdv state, filters, sale preparation, OS data
  • 40+ estados diferentes
  • 60+ setters
  • Tudo acoplado
  • Re-render excessivo quando qualquer coisa muda

Consequência:
  ❌ Performance ruim (re-render desnecessário)
  ❌ Difícil debugar (muitos props)
  ❌ Impossível testar isoladamente
  ❌ Acoplamento total

Exemplo do arquivo:
  const { cart, addToCart, updateQuantity, removeItem,
          estagio, setEstagio, cliente, ...60 props,
  } = usePDV();


❌ PROBLEMA 4: Lógica de negócio espalhada no componente
────────────────────────────────────────────────────────────────────────────────
Situação atual:
  • PDV.tsx tem 900+ linhas
  • Cálculos de total e labor feitos inline
  • Validações espalhadas
  • Sem service layer

Exemplo:
  const osTotal = useMemo(() => {
    const itemsTotal = osItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const servicesTotal = osServices.reduce((acc, s) => acc + s.price, 0);
    return itemsTotal + servicesTotal + calculatedLabor;
  }, [osItems, osServices, calculatedLabor]);


❌ PROBLEMA 5: CartItem é um "coringa" (qualquer tipo de coisa)
────────────────────────────────────────────────────────────────────────────────
Situação atual:
  export interface CartItem extends SaleItem {
    quantity: number;
    type: ItemType;     // ← 'product' | 'service' | 'os'
    osData?: any;       // ← QUALQUER COISA
    originalPrice?: number;
  }

Consequência:
  ❌ Sem discriminação de tipo
  ❌ osData é ANY (volta ao problema de tipagem)
  ❌ Impossível saber qual propriedade usar
  ❌ Sem type safety

Correto seria:

  type CartItem = 
    | { type: 'product'; id: string; quantity: number; price: number; ... }
    | { type: 'service'; id: string; price: number; ... }
    | { type: 'os'; osId: string; osNumber: string; osData: OrderService; ... }


❌ PROBLEMA 6: Sem conceito de "Montagem"
────────────────────────────────────────────────────────────────────────────────
Situação atual:
  • OS contém itens soltos
  • Sem agrupamento
  • Sem rastreamento de qual item é parte de qual montagem

Necessário:
  Montagem: "R1AT 5m JIC 06"
    ├─ Produto: Mangueira 1/2" x 5m
    ├─ Produto: Terminal JIC 06
    ├─ Produto: Terminal JIC 90 06
    └─ Serviço: Prensagem (2 pontos)

Consequência:
  ❌ Não pode gerar relatório de "quais itens foram gastos nesta montagem"
  ❌ Não pode re-usar montagens
  ❌ Sem padrão de orçamento
  ❌ Difícil de auditar


❌ PROBLEMA 7: Fluxo PDV → OS confuso
────────────────────────────────────────────────────────────────────────────────
Situação atual:
  
  PDV.tsx (aba Peças) → selecionar item → vai pro carrinho
  PDV.tsx (aba OS) → criar OS manualmente → adicionar itens do carrinho?
  
  ❓ Posso selecionar um item na aba Peças e ele vai direto pra OS?
  ❓ Ou tenho que ir no carrinho, copiar, e colar na OS?
  ❓ Se foi pro carrinho, depois que coloco na OS, continua no carrinho?

Problema:
  ❌ Fluxo não é claro
  ❌ Usuário fica confuso
  ❌ Muitos passos desnecessários


❌ PROBLEMA 8: Sem integração de pagamento
────────────────────────────────────────────────────────────────────────────────
Situação atual:
  • OS tem campo "paid" solto
  • Sem registro de qual método de pagamento
  • Sem rastreamento de múltiplos pagamentos
  • Sem status de pagamento

Necessário:
  OS.payments = [
    { method: 'pix', amount: 500, status: 'completed', date: '2026-04-22' },
    { method: 'boleto', amount: 300, status: 'pending', dueDate: '2026-05-05' }
  ]


═══════════════════════════════════════════════════════════════════════════════
PARTE 2: ARQUITETURA IDEAL PROPOSTA
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ VISÃO GERAL: Separação de Responsabilidades                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   UI Layer   │ ←---→  │State Machine │ ←---→  │Service Layer │
│  (React)     │        │  (State)     │        │(Business)    │
└──────────────┘        └──────────────┘        └──────────────┘
      ▲                        ▲                        ▲
      │                        │                        │
  ┌─────────────────────────────────────────────────────────┐
  │         Core Models (Types & Interfaces)               │
  └─────────────────────────────────────────────────────────┘


1️⃣ STATE MACHINE (O coração do sistema)
───────────────────────────────────────────────────────────────────────────────

Implementar usando XState ou máquina simples com switch:

OSStatus Flow:
  
  draft (inicial)
    │
    ├─→ in_progress (quando itens são adicionados)
    │     │
    │     ├─→ waiting_payment (quando tenta finalizar sem pagar)
    │     │     │
    │     │     ├─→ partially_paid (pagamento < total)
    │     │     │     └─→ completed (pagamento = total)
    │     │     │
    │     │     └─→ cancelled (cancelado)
    │     │
    │     └─→ completed (pagamento = total no mesmo momento)
    │
    └─→ cancelled (cancela antes de adicionar itens)

Transições automáticas:
  • addItem() → draft → in_progress
  • addPayment(amount) → waiting_payment | partially_paid | completed
  • removeAllItems() → in_progress → draft
  • cancel() → any → cancelled

Validações obrigatórias:
  • Não pode finalizar se items.length === 0
  • Não pode gerar venda se status !== 'completed'
  • Não pode adicionar itens se status === 'cancelled'


2️⃣ CAMADAS DO SISTEMA
───────────────────────────────────────────────────────────────────────────────

a) MODELS (Types & Interfaces)
   └─ src/models/
      ├── orderService.model.ts
      ├── cartItem.model.ts
      ├── assembly.model.ts
      ├── payment.model.ts
      └── index.ts

b) DOMAIN SERVICES (Lógica pura)
   └─ src/services/
      ├── domain/
      │   ├── OrderServiceService.ts
      │   ├── AssemblyService.ts
      │   ├── PaymentService.ts
      │   ├── CartService.ts
      │   └── StateTransitionService.ts (state machine)
      └── api/
          ├── orderServiceApi.ts
          ├── cartApi.ts
          └── paymentApi.ts

c) STATE MANAGEMENT (Redux / Zustand / Context)
   └─ src/store/
      ├── pdv/
      │   ├── pdvSlice.ts (estagio, cliente, etc)
      │   └── selectors.ts
      ├── orderService/
      │   ├── osSlice.ts (OS state machine)
      │   └── selectors.ts
      └── cart/
          ├── cartSlice.ts
          └── selectors.ts

d) COMPONENTS (UI pura)
   └─ src/pages/PDV/
      ├── PDVPage.tsx (orquestrador)
      ├── tabs/
      │   ├── PartsTab.tsx
      │   └── OSTab.tsx
      └── components/
          ├── OrderService/
          │   ├── OSForm.tsx
          │   ├── OSAssemblyList.tsx
          │   └── OSSummary.tsx
          └── Cart/
              └── CartAside.tsx

e) HOOKS (Custom hooks para simplificar)
   └─ src/hooks/
      ├── useOrderService.ts (acesso ao state machine da OS)
      ├── useCart.ts
      ├── usePayment.ts
      └── useAssembly.ts


3️⃣ TYPES/MODELS - Nova estrutura

// ❌ ATUAL (ruins)
export interface CartItem {
  id: string;
  name: string;
  type: 'product' | 'service' | 'os';
  osData?: any;
  ...
}

// ✅ NOVO (correto - Discriminated Union)

export type CartItem = 
  | ProductCartItem
  | ServiceCartItem
  | OSCartItem;

export interface ProductCartItem {
  id: string;
  type: 'product';
  name: string;
  sku: string;
  price: number;
  quantity: number;
  stock: number;
  category: string;
  pictureUrl: string;
}

export interface ServiceCartItem {
  id: string;
  type: 'service';
  name: string;
  description?: string;
  price: number;
  quantity: number;
  serviceType: 'labor' | 'installation' | 'maintenance';
}

export interface OSCartItem {
  id: string;
  type: 'os';
  osId: string;
  osNumber: string;
  status: OSStatus;
  customerId: string;
  orders: OrderService;     // ← snapshot completo
  finalPrice: number;
  createdAt: Date;
}

// Montagem (novo conceito)
export interface Assembly {
  id: string;
  name: string;
  description?: string;
  items: (ProductCartItem | ServiceCartItem)[]; // itens que compõem
  basePrice?: number;
  laborIncluded?: ServiceCartItem;
  createdAt: Date;
  isTemplate?: boolean; // se é um template reutilizável
}

// Order Service (melhorado)
export interface OrderService {
  // IDs e tracking
  id: string;
  number: string;
  
  // Relacionamentos
  customerId: string;
  technicianId?: string;
  
  // Estrutura
  assemblies: Assembly[]; // agroupamento de itens
  items: ProductCartItem[];
  services: ServiceCartItem[];
  config: HydraulicConfig;
  
  // Financeiro
  subtotal: number;
  laborTotal: number;
  discounts: Discount[];
  total: number;
  
  // Pagamentos
  payments: Payment[];
  paidAmount: number;
  remainingAmount: number;
  
  // Status (State Machine)
  status: OSStatus;
  statusHistory: StatusEvent[];
  
  // Auditoria
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  invoiceId?: string; // NF-e
}

export type OSStatus = 
  | 'draft'
  | 'in_progress'
  | 'waiting_payment'
  | 'partially_paid'
  | 'completed'
  | 'cancelled';

export interface Payment {
  id: string;
  method: 'pix' | 'credit_card' | 'cash' | 'boleto';
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
}


═══════════════════════════════════════════════════════════════════════════════
PARTE 3: IMPLEMENTAÇÃO DO STATE MACHINE
═══════════════════════════════════════════════════════════════════════════════

🔷 OPÇÃO A: Máquina simples com Switch (sem lib externa)

// services/domain/StateTransitionService.ts

export class StateTransitionService {
  
  static canTransition(
    from: OSStatus,
    to: OSStatus,
    os: OrderService
  ): { allowed: boolean; reason?: string } {
    
    const rules: Record<OSStatus, OSStatus[]> = {
      'draft': ['in_progress', 'cancelled'],
      'in_progress': ['waiting_payment', 'cancelled'],
      'waiting_payment': ['partially_paid', 'cancelled'],
      'partially_paid': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    const validTransitions = rules[from];
    if (!validTransitions.includes(to)) {
      return {
        allowed: false,
        reason: `Cannot transition from ${from} to ${to}`
      };
    }

    // Validações específicas
    if (to === 'in_progress' && os.items.length === 0 && os.services.length === 0) {
      return {
        allowed: false,
        reason: 'Cannot proceed without items or services'
      };
    }

    if (to === 'completed' && os.remainingAmount > 0) {
      return {
        allowed: false,
        reason: 'Cannot complete without full payment'
      };
    }

    return { allowed: true };
  }

  static getNextAutomaticStatus(os: OrderService): OSStatus | null {
    if (os.status === 'draft' && os.items.length > 0) {
      return 'in_progress';
    }
    
    if (os.status === 'in_progress' && os.paidAmount > 0 && os.paidAmount < os.total) {
      return 'partially_paid';
    }
    
    if (os.status === 'partially_paid' && os.remainingAmount === 0) {
      return 'completed';
    }
    
    return null;
  }
}


🔷 OPÇÃO B: XState (mais robusta, production-ready)

// machines/orderServiceMachine.ts

import { createMachine, assign } from 'xstate';

export const orderServiceMachine = createMachine({
  id: 'orderService',
  initial: 'draft',
  context: {
    os: null as OrderService | null,
  },
  states: {
    draft: {
      on: {
        ADD_ITEM: {
          target: 'in_progress',
          cond: 'hasItems',
        },
        CANCEL: 'cancelled',
      },
    },
    in_progress: {
      on: {
        ADD_PAYMENT: [
          {
            target: 'completed',
            cond: 'isFullyPaid',
          },
          {
            target: 'partially_paid',
            cond: 'isPartiallyPaid',
          },
        ],
        CANCEL: 'cancelled',
      },
    },
    partially_paid: {
      on: {
        ADD_PAYMENT: {
          target: 'completed',
          cond: 'isFullyPaid',
        },
        CANCEL: 'cancelled',
      },
    },
    completed: {
      type: 'final',
    },
    cancelled: {
      type: 'final',
    },
  },
});


═══════════════════════════════════════════════════════════════════════════════
PARTE 4: ESTRUTURA DE PASTAS PROPOSTA
═══════════════════════════════════════════════════════════════════════════════

src/
├── models/
│   ├── orderService.model.ts
│   ├── cartItem.model.ts
│   ├── assembly.model.ts
│   ├── payment.model.ts
│   ├── discount.model.ts
│   └── index.ts
│
├── services/
│   ├── domain/
│   │   ├── OrderServiceService.ts     ← Lógica de OS
│   │   ├── AssemblyService.ts         ← Lógica de montagens
│   │   ├── CartService.ts            ← Lógica de carrinho
│   │   ├── PaymentService.ts         ← Lógica de pagamentos
│   │   ├── StateTransitionService.ts ← State machine
│   │   └── index.ts
│   │
│   └── api/
│       ├── orderServiceApi.ts
│       ├── cartApi.ts
│       ├── paymentApi.ts
│       └── index.ts
│
├── store/
│   ├── rootReducer.ts
│   ├── pdv/
│   │   ├── pdvSlice.ts
│   │   ├── selectors.ts
│   │   └── thunks.ts
│   │
│   ├── orderService/
│   │   ├── osSlice.ts
│   │   ├── selectors.ts
│   │   └── thunks.ts
│   │
│   └── cart/
│       ├── cartSlice.ts
│       ├── selectors.ts
│       └── thunks.ts
│
├── hooks/
│   ├── useOrderService.ts (acesso ao state machine)
│   ├── useCart.ts
│   ├── usePayment.ts
│   ├── useAssembly.ts
│   └── index.ts
│
├── pages/
│   └── PDV/
│       ├── PDVPage.tsx (orquestrador principal)
│       │
│       ├── tabs/
│       │   ├── PartsTab.tsx (selecionr produtos)
│       │   ├── OSTab.tsx (criar/editar OS)
│       │   └── CartTab.tsx (visualizar carrinho)
│       │
│       ├── components/
│       │   ├── OrderService/
│       │   │   ├── OSForm.tsx
│       │   │   ├── OSAssemblyList.tsx
│       │   │   ├── OSAssemblyItem.tsx
│       │   │   ├── OSSummary.tsx
│       │   │   └── OSPaymentPanel.tsx
│       │   │
│       │   ├── Assembly/
│       │   │   ├── AssemblyBuilder.tsx (criar montagens)
│       │   │   ├── AssemblyTemplate.tsx (templates)
│       │   │   └── AssemblyPreview.tsx
│       │   │
│       │   ├── Cart/
│       │   │   ├── CartAside.tsx
│       │   │   ├── CartItem.tsx
│       │   │   └── CartSummary.tsx
│       │   │
│       │   └── Common/
│       │       ├── ItemSelector.tsx (selecionar produtos)
│       │       ├── PaymentForm.tsx
│       │       └── StatusBadge.tsx
│       │
│       └── PDV.module.css
│
├── utils/
│   ├── validators.ts (validações de OS, pagamento, etc)
│   ├── calculations.ts (cálculos de total, desconto)
│   ├── formatters.ts (formatação de valores)
│   └── index.ts
│
└── types/
    ├── common.ts
    └── index.ts


═══════════════════════════════════════════════════════════════════════════════
PARTE 5: FLUXO MELHORADO (UX)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ NOVO FLUXO: 3 Abas Independentes                                           │
└─────────────────────────────────────────────────────────────────────────────┘

1️⃣ ABA "PEÇAS" (PartsTab.tsx)
   └─ Apenas seleção de produtos
   └─ Botões: "+ Adicionar ao Carrinho" OU "+ Usar na OS"
   └─ Se clicar "+ Usar na OS":
       - Abre um seletor rápido
       - Adiciona direto na OS atual
       - Não vai pro carrinho general

2️⃣ ABA "ORDEM DE SERVIÇO" (OSTab.tsx)
   ├─ Painel esquerdo: ações + cliente + técnico
   ├─ Centro: lista de montagens + itens
   │  ├─ Botão "Nova Montagem"
   │  ├─ Botão "+ Adicionar Item"
   │  ├─ Botão "+ Adicionar Serviço"
   │  └─ Listagem com drag-drop (rearrange)
   │
   └─ Direita: resumo + pagamento + fechamento

3️⃣ ABA "CARRINHO" (CartTab.tsx)
   └─ Produtos normais
   └─ OS como item único
   └─ Descontos gerais
   └─ Cálculo de total geral
   └─ Botão "Ir para Pagamento"


┌─────────────────────────────────────────────────────────────────────────────┐
│ FLUXO DE VENDA (Caso de Uso Completo)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

CASO 1: Venda simples (sem OS)
  1. Cliente identifica
  2. Aba "Peças" → seleciona produtos
  3. Botão "+ Adicionar ao Carrinho"
  4. Carrinho acumula itens
  5. Aba "Carrinho" → Revisar
  6. Botão "Ir para Pagamento"
  7. Selecionar método + finalizar

CASO 2: Venda técnica (com OS)
  1. Cliente identifica
  2. Aba "OS" → Criar nova OS
  3. Preencher configuração (equipamento, bitola, etc)
  4. Aba "OS" → "+ Nova Montagem"
     - Nome: "R1AT 5m JIC 06"
     - Aba "Peças" → selecionar itens
     - "+ Usar na OS" em cada item
     - Volta automaticamente pra OS
     - Montagem criada com todos os itens
  5. Aba "OS" → "+ Adicionar Serviço"
     - Selecionar serviço (prensagem, etc)
  6. Aba "OS" → Painel direito → "Registrar Pagamento"
     - Entrada: R$ 500
     - Status muda: draft → in_progress → partially_paid
  7. Aba "OS" → "+ Gerar Venda"
     - Cria CartItem do tipo 'os'
     - Vai pro carrinho
  8. Aba "Carrinho"
     - Pode adicionar + produtos normais
     - Total = produtos normais + valor da OS
  9. Botão "Ir para Pagamento"
     - Selecionar método para o restante
     - Finalizar venda


═══════════════════════════════════════════════════════════════════════════════
PARTE 6: SERVIÇOS DE DOMÍNIO (Exemplos)
═══════════════════════════════════════════════════════════════════════════════

// services/domain/OrderServiceService.ts

export class OrderServiceService {
  
  static createFromTemplate(
    customerId: string,
    assemblyTemplate: Assembly
  ): OrderService {
    const id = generateUUID();
    const number = generateOSNumber();
    
    return {
      id,
      number,
      customerId,
      status: 'draft',
      assemblies: [{ ...assemblyTemplate, id: generateUUID() }],
      items: [],
      services: [],
      config: { ... },
      subtotal: 0,
      laborTotal: 0,
      discounts: [],
      total: 0,
      payments: [],
      paidAmount: 0,
      remainingAmount: 0,
      statusHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static addAssembly(os: OrderService, assembly: Assembly): OrderService {
    const newAssembly = { ...assembly, id: generateUUID() };
    const updatedOS = {
      ...os,
      assemblies: [...os.assemblies, newAssembly],
      updatedAt: new Date(),
    };
    
    return this.recalculateTotals(updatedOS);
  }

  static addPayment(os: OrderService, payment: Payment): OrderService {
    const newPayments = [...os.payments, { ...payment, id: generateUUID() }];
    const paidAmount = newPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const remainingAmount = Math.max(0, os.total - paidAmount);
    const newStatus = this.calculateStatus(os, paidAmount);
    
    return {
      ...os,
      payments: newPayments,
      paidAmount,
      remainingAmount,
      status: newStatus,
      statusHistory: [
        ...os.statusHistory,
        { from: os.status, to: newStatus, date: new Date() }
      ],
      updatedAt: new Date(),
    };
  }

  static recalculateTotals(os: OrderService): OrderService {
    const subtotal = os.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    const laborTotal = os.services
      .filter(s => s.serviceType === 'labor')
      .reduce((sum, s) => sum + s.price * s.quantity, 0);
    
    const discountAmount = os.discounts.reduce((sum, d) => sum + d.amount, 0);
    const total = Math.max(0, subtotal + laborTotal - discountAmount);
    
    return {
      ...os,
      subtotal,
      laborTotal,
      total,
      remainingAmount: Math.max(0, total - os.paidAmount),
    };
  }

  private static calculateStatus(os: OrderService, paidAmount: number): OSStatus {
    if (os.items.length === 0 && os.services.length === 0) {
      return 'draft';
    }
    
    if (paidAmount === 0) {
      return 'in_progress';
    }
    
    if (paidAmount > 0 && paidAmount < os.total) {
      return 'partially_paid';
    }
    
    if (paidAmount >= os.total) {
      return 'completed';
    }
    
    return os.status;
  }

  static generateSale(os: OrderService): CartItem {
    if (os.status !== 'completed') {
      throw new Error('Cannot generate sale from non-completed OS');
    }
    
    return {
      id: generateUUID(),
      type: 'os',
      osId: os.id,
      osNumber: os.number,
      status: os.status,
      customerId: os.customerId,
      orders: os,
      finalPrice: os.total,
      createdAt: new Date(),
    };
  }
}


═══════════════════════════════════════════════════════════════════════════════
PARTE 7: PLANO DE REFACTOR EM ETAPAS (SEM QUEBRAR NADA)
═══════════════════════════════════════════════════════════════════════════════

ETAPA 1: Preparação (1-2 dias)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Criar arquivos de modelos (models/)
□ Criar serviços de domínio (services/domain/)
□ Criar types discriminados (CartItem)
□ NÃO mexer em PDV.tsx ainda
□ Tudo rodando em paralelo

ETAPA 2: State Machines (2-3 dias)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Implementar StateTransitionService
□ Criar hooks: useOrderService, useStateTransition
□ Testar lógica isoladamente
□ Ainda sem mexer em PDV.tsx

ETAPA 3: Separação de Contexto (1-2 dias)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Dividir PDVContext em 3:
  - PDVContext (apenas estagio, cliente)
  - CartContext (cart, addToCart, removeItem)
  - OrderServiceContext (OS com state machine)
□ Cada um com seus selectors e reducers
□ Mantém compatibilidade com código antigo

ETAPA 4: Refactor de Componentes (2-3 dias)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Dividir PDV.tsx em tabs:
  - PartsTab.tsx
  - OSTab.tsx
  - CartTab.tsx
□ Cada tab independente
□ Reutilizar OSPanelRefactored (já existe!)
□ Testar cada aba isoladamente

ETAPA 5: Refactor de OSPanelAdapter (1 dia)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Conectar OSPanelAdapter ao novo state machine
□ Remover lógica local (state já vem do hook)
□ Apenas renderiza

ETAPA 6: Testes e Validações (2-3 dias)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Testes dos serviços de domínio
□ Testes do state machine
□ Teste e2e do fluxo completo
□ Validar que nada quebrou

ETAPA 7: Cleanup (1 dia)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Remover código antigo que não usa mais
□ Atualizar imports
□ Documentação


═══════════════════════════════════════════════════════════════════════════════
PARTE 8: RESOLUÇÃO DO ERRO ATUAL
═══════════════════════════════════════════════════════════════════════════════

Erro: "Uncaught ReferenceError: setCart is not defined"
Local: PDV.tsx:764

Causa:
  PDVContext não exporta setCart
  Apenas tem: addToCart, updateQuantity, removeItem

Solução imediata (opção 1 - rápida):
  └─ Remover a propriedade setCart do OSPanelAdapter
  └─ Usar addToCart(osItem) ao invés

Solução melhor (opção 2 - corretiva):
  └─ Adicionar clearCart ao contexto
  └─ Adicionar método que permite batch de operações

Veja: OSPanelAdapter.tsx comentei "// setCart={setCart}"
      Você precisa usar addToCart() no componente


═══════════════════════════════════════════════════════════════════════════════
RESUMO EXECUTIVO
═══════════════════════════════════════════════════════════════════════════════

Problemas encontrados:
  ❌ 8 problemas estruturais
  ❌ Sem state machine
  ❌ Contexto gigante
  ❌ Lógica espalhada
  ❌ Types fracos
  ❌ Fluxo confuso

Solução proposta:
  ✅ State machine para OS
  ✅ Serviços de domínio (lógica pura)
  ✅ Contextos menores e focados
  ✅ Types discriminados
  ✅ 3 abas independentes
  ✅ Fluxo claro (venda simples vs venda técnica)

Benefícios:
  ✨ Escalável
  ✨ Testável
  ✨ Manutenível
  ✨ Type-safe
  ✨ Performance melhor
  ✨ UX mais clara

Próximos passos:
  1. Corrigir erro atual (remover setCart)
  2. Implementar ETAPA 1 (models + services)
  3. Validar que nada quebrou
  4. Prosseguir com próximas etapas

*/

export {};
