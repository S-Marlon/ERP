/**
 * DOCUMENTAÇÃO: ARQUITETURA DO MINI ERP
 * 
 * Este documento descreve a estrutura, convenções e padrões
 * usados no sistema ERP de Ordem de Serviço e Vendas.
 */

/*
================================================================================
1. ESTRUTURA DE PASTAS
================================================================================

src/
├── types/
│   ├── order-service.types.ts     → Tipos de OS
│   ├── sale.types.ts              → Tipos de Venda
│   ├── customer.types.ts           → Tipos de Cliente
│   ├── technician.types.ts         → Tipos de Técnico
│   ├── payment.types.ts            → Tipos de Pagamento
│   ├── common.types.ts             → Tipos compartilhados
│   └── erp.types.ts                → Exportação centralizada
│
├── hooks/
│   ├── useOrderService.ts          → Gerencia OS com useReducer
│   ├── useSale.ts                  → Gerencia Vendas
│   ├── usePayment.ts               → Gerencia Pagamentos
│   └── index.ts                    → Exportação centralizada
│
├── utils/
│   ├── os-helpers.ts               → Funções puras de OS
│   ├── sale-helpers.ts             → Funções puras de Venda
│   ├── payment-helpers.ts          → Funções puras de Pagamento
│   ├── id-generator.ts             → Gerador de IDs legíveis
│   └── erp-helpers.ts              → Exportação centralizada
│
└── pages/PDV/components/OrderService/
    ├── OSItemList.tsx              → Lista de itens/serviços
    ├── OSForm.tsx                  → Formulário de configuração
    ├── LaborCalculator.tsx         → Calculadora de mão de obra
    ├── OSSummary.tsx               → Resumo financeiro
    ├── OSPanelRefactored.tsx       → Componente principal
    └── index.ts                    → Exportação centralizada


================================================================================
2. PADRÕES E CONVENÇÕES
================================================================================

2.1 TIPOS (NUNCA usar 'any')
----
✅ CORRETO:
  interface OrderService {
    id: string;
    items: OSLineItem[];
  }

❌ ERRADO:
  interface OrderService {
    id: any;
    items: any[];
  }

→ Sempre especificar tipos explícitos
→ Usar type unions para múltiplos estados
→ Usar Record<K, V> para objetos mapeados


2.2 HOOKS COM useReducer
----
✅ Usado para:
  • Estado complexo (múltiplos campos interdependentes)
  • Lógica de transição de estado
  • Reduzir re-renders desnecessários
  • Testar ações bem definidas

Exemplo:
  const { os, addItem, removeItem } = useOrderService(customerId);
  
  // useReducer garante que cada mutação é previsível e testável


2.3 COMPONENTES ISOLADOS
----
✅ Arquitetura:
  • Cada componente tem UMA responsabilidade
  • Props bem tipadas (nunca 'any')
  • Callbacks com useCallback
  • Memoizações com useMemo onde apropriado

Exemplo:
  interface OSItemListProps {
    items: OSLineItem[];
    onAddItem: (item: Omit<OSLineItem, 'id'>) => void;
    money: Intl.NumberFormat;
    readonly?: boolean;
  }


2.4 FUNÇÕES PURAS (Helpers)
----
✅ Características:
  • Sem efeitos colaterais
  • Mesmo input = sempre mesmo output
  • Fáceis de testar
  • Reutilizáveis em qualquer contexto

Exemplo:
  export const calculateTotal = (
    subtotal: number,
    discount?: number
  ): number => {
    if (!discount) return subtotal;
    return Math.max(0, subtotal - discount);
  };


================================================================================
3. FLUXOS DE DADOS
================================================================================

3.1 ORDEM DE SERVIÇO (OS)
----
draft → open → in_progress → finished → delivered
         ↓                    ↓
      cancelado           cancelado

Transições:
  • draft: Editável, pode voltar para draft
  • open: Pronta para começar
  • in_progress: Em execução
  • finished: Concluída (pronta para gerar venda)
  • delivered: Entregue ao cliente
  • canceled: Cancelada em qualquer ponto


3.2 ORDEM DE VENDA (Sale)
----
draft → sent → approved → in_progress → completed
  ↓                          ↓
cancelado                  cancelado

Transições:
  • draft: Editável
  • sent: Aguardando aprovação do cliente
  • approved: Aprovada
  • in_progress: Em execução
  • completed: Concluída
  • canceled: Cancelada


3.3 PAGAMENTOS
----
pending → processing → completed
  ↓         ↓
failed  refunded

Status:
  • pending: Aguardando processamento
  • processing: Em processamento
  • completed: Confirmado
  • failed: Falhou
  • refunded: Reembolsado


================================================================================
4. REGRAS DE NEGÓCIO
================================================================================

4.1 VALIDAÇÕES DE OS
----
✅ Uma OS é válida se:
  • Tem pelo menos 1 item OU 1 serviço
  • Equipamento está preenchido
  • Bitola está selecionada
  • Comprimento final > 0

→ Use: isOSValid(os) antes de enviar


4.2 CÁLCULOS FINANCEIROS
----
Total = (Produtos + Serviços + Mão de Obra) - Desconto + Imposto

Funções:
  • calculateItemsSubtotal(items) → soma todos os itens
  • calculateLaborTotal(labor, terminals) → calcula mão de obra
  • calculateTotal(...) → calcula total final
  • calculateSalePaymentSummary(...) → resumo de pagamento


4.3 MÃO DE OBRA
----
3 tipos de cálculo:
  • per_point: R$ por terminal (multiplicado pela quantidade)
  • fixed: Valor fixo
  • table: Valor da tabela (por bitola, já pré-definido)


================================================================================
5. COMO USAR OS HOOKS
================================================================================

5.1 useOrderService
----
// Criar uma nova OS
const os = useOrderService('customer-123');

// Adicionar produto
os.addItem({
  name: 'Mangueira 1/2"',
  price: 150,
  quantity: 1,
  itemType: 'product'
});

// Adicionar serviço
os.addService({
  name: 'Prensagem',
  price: 80,
  quantity: 1,
  itemType: 'service'
});

// Calcular mão de obra
os.setLabor({
  type: 'per_point',
  value: 25,  // R$ 25 por terminal
  total: 75   // 3 terminais = R$ 75
});

// Verificar permissões
if (os.canFinalize) {
  os.setStatus('finished');
}


5.2 useSale
----
// Criar venda a partir de OS
const sale = useSale(salesFromOrder);

// Adicionar pagamento
sale.addPayment({
  id: 'pay-123',
  saleId: sale.sale.id,
  method: 'pix',
  amount: 500,
  status: 'pending',
  createdAt: new Date()
});

// Verificar se está totalmente paga
if (sale.paymentSummary.isPaid) {
  sale.setStatus('completed');
}


5.3 usePayment
----
// Gerenciar pagamentos
const payments = usePayment(1000, []);  // Total, pagamentos iniciais

// Adicionar pagamento parcial
payments.addPayment('pix', 500);  // R$ 500 em PIX

// Verificar se pode adicionar mais
if (payments.canAddMorePayments) {
  payments.addPayment('cash', 500);
}

// Status
console.log(payments.summary);
// { total: 1000, paid: 1000, remaining: 0, isPaid: true, ... }


================================================================================
6. BOAS PRÁTICAS
================================================================================

6.1 PERFORMANCE
----
✅ Use useCallback para callbacks passados como props
✅ Use useMemo para objetos/arrays complexos
✅ Não crie novos arrays/objetos em cada render

❌ Evite:
  const handleAdd = () => { ... }  // Recriado a cada render
  const items = os.items.filter(...) // Recalculado a cada render


6.2 TIPAGEM
----
✅ Sempre tipar completamente
✅ Usar type unions ao invés de discriminated unions em alguns casos
✅ Exportar tipos para reutilizar

Exemplo:
  export type OSStatus = 'draft' | 'open' | 'in_progress' | ...;
  
  const statusLabel: Record<OSStatus, string> = {
    'draft': 'Rascunho',
    'open': 'Aberta',
    ...
  };


6.3 COMPONENTES
----
✅ Props bem definidas (interface)
✅ Usar readonly quando apropriado
✅ Separar lógica em hooks customizados
✅ Componentes devem ser pequenos (< 200 linhas)


6.4 TESTES
----
Para funções puras:
  test('calculateTotal with discount', () => {
    const result = calculateTotal(100, undefined, undefined, 10);
    expect(result).toBe(90);
  });

Para hooks:
  test('addItem increases count', () => {
    const { result } = renderHook(() => useOrderService('cust-123'));
    act(() => {
      result.current.addItem({ name: 'Test', price: 10, quantity: 1 });
    });
    expect(result.current.os.items).toHaveLength(1);
  });


================================================================================
7. INTEGRAÇÃO COM BACKEND
================================================================================

7.1 CHAMADAS API
----
→ Criar um arquivo: services/orderService.api.ts

export const api = {
  // OS
  createOS: (data: CreateOrderServiceInput) => POST('/api/os', data),
  updateOS: (id: string, data: UpdateOrderServiceInput) => PUT(`/api/os/${id}`, data),
  getOS: (id: string) => GET(`/api/os/${id}`),
  
  // Sale
  createSale: (data: CreateSaleFromOrderInput) => POST('/api/sales', data),
  
  // Payment
  addPayment: (data: CreatePaymentInput) => POST('/api/payments', data),
};

// No componente:
const handleSave = async () => {
  try {
    const savedOS = await api.createOS(os);
    setOS(savedOS);
  } catch (error) {
    alert('Erro ao salvar OS');
  }
};


7.2 SINCRONIZAÇÃO DE IDs
----
⚠️  IDs Temporários vs Permanentes:
  • No frontend: uuid (temporário)
  • No backend: uuid (permanente, enviado na resposta)

Quando salvar:
  1. Gerar OS com ID temporário
  2. Enviar para servidor
  3. Receber ID confirmado
  4. Atualizar estado local


================================================================================
8. EXEMPLO COMPLETO: Fluxo de Criação de OS
================================================================================

// 1. Usuário escolhe cliente
const customerId = 'cust-123';

// 2. Criar hook
const { os, addItem, addService, setLabor } = useOrderService(customerId);

// 3. Adicionar itens
addItem({
  name: 'Mangueira SAE 100 1/2"',
  price: 150,
  quantity: 1,
  itemType: 'product'
});

// 4. Adicionar serviço
addService({
  name: 'Prensagem de Terminais',
  price: 80,
  quantity: 1,
  itemType: 'service'
});

// 5. Configurar mão de obra
setLabor({
  type: 'per_point',
  value: 25,
  total: 25 * 2  // 2 terminais
});

// 6. Verificações
console.log(os);
// {
//   id: 'uuid-...',
//   number: 'OS-2026-0001',
//   status: 'draft',
//   subtotalProducts: 150,
//   subtotalServices: 80,
//   laborTotal: 50,
//   totalAmount: 280,
//   items: [...],
//   services: [...],
//   ...
// }

// 7. Salvar (quando pronto)
const savedOS = await api.createOS(os);

// 8. Gerar venda
const sale = await api.createSale({
  orderId: savedOS.id,
  customerId,
  notes: 'Venda gerada automaticamente'
});

// 9. Adicionar pagamento
const payment = await api.addPayment({
  saleId: sale.id,
  method: 'pix',
  amount: 280,
  status: 'pending'
});


================================================================================
9. TROUBLESHOOTING
================================================================================

❌ "Não consigo adicionar items"
→ Verificar se os.status permite edição (canEdit)
→ Verificar if (canEdit) addItem(...);

❌ "Total não está updated"
→ Verificar se setLabor foi chamado corretamente
→ Todos os subtotais devem ser recalculados

❌ "Type 'any' é necessário"
→ Não é. Sempre há uma forma melhor.
→ Use type unions, Partial<T>, Pick<T, K>, etc.

❌ "Re-render excessivo"
→ Usar useMemo e useCallback
→ Dividir em componentes menores


================================================================================
10. PRÓXIMOS PASSOS
================================================================================

1. ✅ Tipos completos
2. ✅ Hooks com useReducer
3. ✅ Componentes refatorados
4. ← VOCÊ ESTÁ AQUI
5. Criar API service
6. Criar testes unitários
7. Criar testes de integração
8. Implementar paginação e filtros
9. Adicionar suporte a histórico
10. Integração com nota fiscal


================================================================================

Dúvidas? Revise este arquivo ou verifique os exemplos nos tipos e hooks.
*/

// Este é um arquivo de documentação pura
export {};
