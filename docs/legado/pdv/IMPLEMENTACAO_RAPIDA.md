# 🔧 Guia Rápido de Implementação

Este documento contém snippets prontos para implementação das correções críticas (Fase 1).

---

## 1️⃣ Criar `types/payment.types.ts`

```typescript
// types/payment.types.ts
export type PaymentSource = 'sale' | 'os' | 'manual';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'STORE_CREDIT';

export interface Payment {
  id: string;
  valor: number;
  metodo: PaymentMethod;
  status: PaymentStatus;
  parcelas: number;
  source: PaymentSource;
  saleId?: string;
  osId?: string;
  detalhes?: {
    bandeira?: string;
    authCode?: string;
    nsu?: string;
    chavePix?: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}
```

---

## 2️⃣ Atualizar `types/cart.types.ts`

```typescript
// types/cart.types.ts (adicionar ao final)

import { Payment } from './payment.types';

// Guard function
export function isCartItemOS(item: CartItem): item is CartItemOS {
  return item.type === 'os' && item.osData?.osNumber !== undefined;
}

// Extended interface
export interface CartItemOS extends CartItem {
  type: 'os';
  quantity: 1;  // Sempre 1
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
    paid: number;
    remaining: number;
    payments: Payment[];
  };
}

// Factory function
export function createCartItemOS(osData: any): CartItemOS {
  return {
    id: `os-${Date.now()}`,
    name: `${osData.equipment} • ${osData.gauge}`,
    category: 'OS',
    price: osData.remaining,
    quantity: 1,
    type: 'os',
    osData
  } as CartItemOS;
}
```

---

## 3️⃣ Proteger OS em `hooks/useCart.ts`

```typescript
// hooks/useCart.ts (ATUALIZAR)

import { isCartItemOS } from '../types/cart.types';
import Swal from 'sweetalert2';

export const useCart = () => {
  // ... código existente ...

  const updateQuantity = useCallback((id: string | number, value: number | string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        // ✅ NOVO: Proteger OS
        if (isCartItemOS(item)) {
          console.warn('⚠️ Não é permitido alterar quantidade de OS');
          return item;
        }

        const canFractionate = ['MT', 'LT', 'KG', 'M', 'L'].includes(item.unitOfMeasure?.toUpperCase() || '');
        let newQty: number;
        if (typeof value === 'string') {
          newQty = parseFloat(value.replace(',', '.')) || 0;
        } else {
          newQty = item.quantity + value;
        }
        let clampedQty = Math.max(0, newQty);
        if (!canFractionate) {
          clampedQty = Math.floor(clampedQty);
        }
        if (item.type === 'part' && item.stock && clampedQty > item.stock) {
          alert("Quantidade excede o estoque disponível!");
          return item;
        }
        return { ...item, quantity: Number(clampedQty.toFixed(2)) };
      }
      return item;
    }));
  }, []);

  const applyIndividualDiscount = useCallback((id: string | number, newPrice: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === id) {
        // ✅ NOVO: Proteger OS
        if (isCartItemOS(item)) {
          Swal.fire({
            icon: 'error',
            title: 'Operação inválida',
            text: 'Não é permitido aplicar desconto em Ordens de Serviço',
            timer: 2000
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

  return {
    cart,
    addToCart,
    updateQuantity,
    removeItem,
    applyIndividualDiscount,
    clearCart
  };
};
```

---

## 4️⃣ Validar `remaining` em `OSPanelRefactored_NEW.tsx`

```typescript
// components/OSPanelRefactored_NEW.tsx (atualizar handleGenerateSale)

import { createCartItemOS } from '../types/cart.types';

const handleGenerateSale = useCallback(async () => {
  // Validações existentes...
  if (!osData.equipment || !osData.gauge) {
    Swal.fire({
      icon: 'warning',
      title: 'Dados incompletos',
      text: 'Preencha ao menos "Equipamento" e "Bitola"',
      confirmButtonText: 'Entendido',
    });
    return;
  }

  // ✅ NOVO: Validar remaining
  if (totals.remaining <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'OS já quitada',
      text: 'Esta Ordem de Serviço já foi integralmente paga e não pode ser readicionada ao carrinho.',
      confirmButtonText: 'Entendido',
    });
    return;
  }

  // ✅ NOVO: Usar createCartItemOS (factory)
  const osItem = createCartItemOS({
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
    paid: totals.paid,
    remaining: totals.remaining,
    payments: []  // ✅ NOVO
  });

  const result = await Swal.fire({
    icon: 'question',
    title: 'Gerar Venda da OS',
    html: `
      <div style="text-align: left; font-size: 14px;">
        <p><strong>OS:</strong> ${osNumber}</p>
        <p><strong>Cliente:</strong> ${osData.customerName || 'Não informado'}</p>
        <p><strong>Técnico:</strong> ${osData.technician || 'Não informado'}</p>
        <p><strong>Equipamento:</strong> ${osData.equipment}</p>
        <p><strong>Bitola:</strong> ${osData.gauge}</p>
        <p><strong>Itens:</strong> ${osItems.length}</p>
        <p><strong>Serviços:</strong> ${osServices.length}</p>
        <hr style="margin: 10px 0;" />
        <p style="font-size: 16px;">
          <strong>Total: ${money.format(totals.total)}</strong>
        </p>
        <p style="font-size: 12px; color: #666;">
          Pago: ${money.format(totals.paid)} | Restante: ${money.format(totals.remaining)}
        </p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Gerar venda',
    cancelButtonText: 'Revisar',
    confirmButtonColor: '#10b981',
  });

  if (!result.isConfirmed) {
    return;
  }

  try {
    if (onSubmit) {
      onSubmit(osItem);

      await Swal.fire({
        icon: 'success',
        title: 'OS gerada!',
        text: 'A ordem de serviço foi adicionada ao carrinho',
        timer: 2000,
      });

      setActiveTab?.('cart');
    } else {
      throw new Error('Callback onSubmit não fornecido');
    }
  } catch (error) {
    console.error('Erro ao gerar venda:', error);
    Swal.fire({
      icon: 'error',
      title: 'Erro ao gerar venda',
      text: 'Tente novamente ou contacte o suporte',
      confirmButtonText: 'Entendido',
    });
  }
}, [
  osData,
  osItems,
  osServices,
  totals,
  money,
  onSubmit,
  setActiveTab,
  osNumber,
]);
```

---

## 5️⃣ Adicionar `source` em `FinalizarVenda.tsx`

```typescript
// pages/FinalizarVenda.tsx (atualizar adicionarPagamento e handleFinalizarVenda)

import { isCartItemOS } from '../types/cart.types';
import { Payment, PaymentStatus } from '../types/payment.types';

const adicionarPagamento = () => {
  const valorNumerico = parseFloat(valorInput.replace(',', '.')) || 0;
  if (valorNumerico <= 0 || !metodoSelecionado) return;

  // ✅ NOVO: Incluir source
  const novoPagamento: Pagamento = {
    id: crypto.randomUUID(),
    metodo: metodoSelecionado,
    valor: valorNumerico,
    parcelas: metodoSelecionado === 'credit_card' ? parcelasInput : 1,
    status: 'pending' as PaymentStatus,
    source: 'sale',  // ✅ NOVO: Source padrão para pagamentos do PDV
    createdAt: new Date(),
  };

  setPagamentos([...pagamentos, novoPagamento]);
  setValorInput('');
  setParcelasInput(1);
  setMetodoSelecionado(null);
};

const handleFinalizarVenda = async () => {
  if (isEnviando) return;
  setIsEnviando(true);

  const totalCusto = itens.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);
  const lucroNominal = totalLiquido - totalCusto;
  const percentualLucro = totalLiquido > 0 ? (lucroNominal / totalLiquido) * 100 : 0;

  // ✅ NOVO: Separar itens normais de OS
  const itemsNormais = itens.filter(i => !isCartItemOS(i));
  const osItens = itens.filter(i => isCartItemOS(i));

  // ✅ NOVO: Para cada OS, criar pagamentos com source='os'
  const pagamentosOS: Payment[] = osItens.map(osItem => ({
    id: crypto.randomUUID(),
    valor: osItem.price * osItem.quantity,  // remaining
    metodo: metodoSelecionado || 'CASH' as any,
    status: 'paid' as PaymentStatus,
    parcelas: 1,
    source: 'os' as const,
    osId: osItem.osData?.osNumber,
    createdAt: new Date()
  }));

  // ✅ NOVO: Para itens normais, adicionar source='sale'
  const pagamentosSale: Payment[] = pagamentos.map(p => ({
    ...p,
    source: 'sale' as const
  }));

  const todosOsPagamentos = [...pagamentosOS, ...pagamentosSale];

  const numeroVenda = Date.now().toString();

  const itensParaImpressao = itemsNormais.map(item => ({
    codigo: String(item.id),
    name: item.name,
    quantity: item.quantity,
    price: item.salePrice,
    desconto: 0,
    unidade: item.unidade || 'UN'
  }));

  const pagamentosParaImpressao = todosOsPagamentos
    .filter(p => p.status === 'paid' || p.status === 'processing')
    .map(p => ({
      metodo: PAYMENT_METHOD_DETAILS[p.metodo]?.label || p.metodo,
      valor: p.valor,
      parcelas: p.parcelas
    }));

  // ✅ NOVO: VendaPayload com diferenciação
  const vendaCompleta: SalePayload = {
    data: new Date().toISOString(),
    clienteNome: cliente || "CONSUMIDOR",
    totalBruto: total,
    totalDesconto: descontoCalculado,
    totalLiquido: totalLiquido,
    totalCusto: totalCusto,
    lucroNominal: lucroNominal,
    percentualLucro: Number(percentualLucro.toFixed(2)),
    
    // ✅ NOVO: Separar itens normais
    itens: itemsNormais.map(item => ({
      productId: item.id,
      nome: item.name,
      quantidade: item.quantity,
      precoVenda: item.salePrice,
      precoCusto: item.costPrice || 0,
      subtotal: item.quantity * item.salePrice,
      lucroUnitario: item.salePrice - (item.costPrice || 0),
      type: 'produto'  // ✅ Diferencia
    })),
    
    // ✅ NOVO: Incluir OS separadamente
    ordensServico: osItens.map(osItem => ({
      osNumber: osItem.osData?.osNumber,
      equipamento: osItem.osData?.equipment,
      total: osItem.osData?.total,
      remaining: osItem.price,
      items: osItem.osData?.items,
      services: osItem.osData?.services
    })),
    
    // ✅ NOVO: Pagamentos com source
    pagamentos: todosOsPagamentos.map(p => ({
      id: p.id,
      metodo: p.metodo,
      valor: p.valor,
      parcelas: p.parcelas || 1,
      source: p.source,  // ✅ Diferencia
      saleId: p.saleId,
      osId: p.osId
    }))
  };

  console.log("🚀 Payload Final da Venda:", vendaCompleta);

  imprimirExtratoElgin({
    cliente: vendaCompleta.clienteNome,
    cpf: "",
    numero: numeroVenda,
    itens: itensParaImpressao,
    total: totalLiquido,
    pagamentos: pagamentosParaImpressao,
    troco: troco
  });

  try {
    console.log("⏳ Enviando...");
    await salesService.saveVenda(vendaCompleta);

    await Swal.fire({
      icon: 'success',
      title: 'Venda Finalizada!',
      text: `O valor de R$ ${totalLiquido.toFixed(2)} foi registrado com sucesso!`,
      confirmButtonColor: '#28a745',
      timer: 3000
    });

    onBack();
  } catch (error: any) {
    Swal.fire({
      icon: 'error',
      title: 'Erro ao salvar',
      text: error.message || 'Servidor offline ou falha na rede.',
      confirmButtonColor: '#d33'
    });
  } finally {
    setIsEnviando(false);
  }
};
```

---

## 6️⃣ Atualizar `types/sale.types.ts`

```typescript
// types/sale.types.ts (ATUALIZAR)

import { Payment } from './payment.types';

export interface VendaPayload {
  data: string;
  clienteId?: number;
  clienteNome: string;
  
  // Totais
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  totalCusto: number;
  lucroNominal: number;
  percentualLucro: number;
  
  // ✅ NOVO: Itens normais com type
  itens: {
    productId: number;
    nome: string;
    quantidade: number;
    precoVenda: number;
    precoCusto: number;
    subtotal: number;
    lucroUnitario: number;
    type: 'produto';
  }[];
  
  // ✅ NOVO: OS separadas
  ordensServico?: {
    osNumber: string;
    equipamento: string;
    total: number;
    remaining: number;
    items: any[];
    services: any[];
  }[];
  
  // ✅ NOVO: Pagamentos com source e references
  pagamentos: {
    id: string;
    metodo: string;
    valor: number;
    parcelas: number;
    source: 'sale' | 'os';
    saleId?: string;
    osId?: string;
  }[];
}
```

---

## 📋 Checklist Rápido

- [ ] Criar `types/payment.types.ts`
- [ ] Atualizar `types/cart.types.ts` com `CartItemOS` e guards
- [ ] Atualizar `hooks/useCart.ts` com validações para OS
- [ ] Atualizar `components/OSPanelRefactored_NEW.tsx` com validação de `remaining`
- [ ] Atualizar `pages/FinalizarVenda.tsx` com `source` e separação de itens
- [ ] Atualizar `types/sale.types.ts` com novo schema

---

## ✅ Testes Rápidos Após Implementação

```typescript
// ✅ Test 1: OS não pode ser editada
expect(updateQuantity(osItem.id, 2)).toBeFalse();

// ✅ Test 2: Desconto não pode ser aplicado em OS
expect(applyIndividualDiscount(osItem.id, 100)).toThrow();

// ✅ Test 3: OS já quitada não pode ser adicionada
expect(handleGenerateSale()).toBeFalse(); // Se remaining = 0

// ✅ Test 4: Pagamentos têm source correto
expect(pagamentos[0].source).toBe('sale'); // Para itens normais
expect(pagamentos[1].source).toBe('os');   // Para OS
```

---

## 🔗 Próximos Passos

Após implementar Fase 1:

1. Criar `models/OrderService.model.ts` (Fase 2)
2. Refatorar `useOSForm.ts` para usar novo modelo (Fase 2)
3. Consolidar estado OS em `useOrderService.ts` (Fase 2)
4. Escrever testes unitários (Fase 3)
5. Testar fluxo completo PDV + OS + Pagamento (Fase 3)
