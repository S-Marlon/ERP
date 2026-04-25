/**
 * HOOK PARA ORDEM DE VENDA
 * Gerencia estado e lógica de uma Sale
 */

import { useReducer, useCallback, useMemo } from 'react';
import type { Sale, SaleStatus, Payment } from '../types/erp.types';
import {
  canEditSale,
  canApproveSale,
  canCompleteSale,
  canCancelSale,
  calculateSalePaymentSummary,
  calculateSaleTotal,
} from '../utils/sale-helpers';
import { generateSaleNumber, generateUUID } from '../utils/id-generator';

type SaleAction =
  | { type: 'INIT'; payload: Sale }
  | { type: 'SET_STATUS'; payload: SaleStatus }
  | { type: 'ADD_PAYMENT'; payload: Payment }
  | { type: 'REMOVE_PAYMENT'; payload: string }
  | { type: 'UPDATE_PAYMENT'; payload: Payment }
  | { type: 'SET_DISCOUNT'; payload: { percentage?: number; amount?: number } }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'CLEAR' };

/**
 * Reducer para Sale
 */
const saleReducer = (state: Sale, action: SaleAction): Sale => {
  switch (action.type) {
    case 'INIT':
      return action.payload;

    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload,
      };

    case 'ADD_PAYMENT': {
      const payments = [...state.payments, action.payload];
      const total = calculateSaleTotal(state);
      return {
        ...state,
        payments,
        totalAmount: total,
      };
    }

    case 'REMOVE_PAYMENT': {
      const payments = state.payments.filter(p => p.id !== action.payload);
      return {
        ...state,
        payments,
      };
    }

    case 'UPDATE_PAYMENT': {
      const payments = state.payments.map(p =>
        p.id === action.payload.id ? action.payload : p
      );
      return {
        ...state,
        payments,
      };
    }

    case 'SET_DISCOUNT': {
      const { percentage, amount } = action.payload;
      const total = calculateSaleTotal({
        ...state,
        discountPercentage: percentage,
        discountAmount: amount,
      });
      return {
        ...state,
        discountPercentage: percentage,
        discountAmount: amount,
        totalAmount: total,
      };
    }

    case 'SET_NOTES':
      return {
        ...state,
        notes: action.payload,
      };

    case 'CLEAR':
      return {
        ...state,
        payments: [],
        discountPercentage: undefined,
        discountAmount: undefined,
        notes: '',
      };

    default:
      return state;
  }
};

/**
 * Hook useSale
 */
export const useSale = (initialSale?: Sale) => {
  const defaultSale: Sale = initialSale || {
    id: generateUUID(),
    number: generateSaleNumber(),
    orderId: '',
    customerId: '',
    status: 'draft',
    order: {},
    items: [],
    subtotal: 0,
    totalAmount: 0,
    payments: [],
    createdAt: new Date(),
  };

  const [sale, dispatch] = useReducer(saleReducer, defaultSale);

  // Métodos
  const setStatus = useCallback((status: SaleStatus) => {
    dispatch({ type: 'SET_STATUS', payload: status });
  }, []);

  const addPayment = useCallback((payment: Payment) => {
    dispatch({ type: 'ADD_PAYMENT', payload: payment });
  }, []);

  const removePayment = useCallback((paymentId: string) => {
    dispatch({ type: 'REMOVE_PAYMENT', payload: paymentId });
  }, []);

  const updatePayment = useCallback((payment: Payment) => {
    dispatch({ type: 'UPDATE_PAYMENT', payload: payment });
  }, []);

  const setDiscount = useCallback(
    (percentage?: number, amount?: number) => {
      dispatch({ type: 'SET_DISCOUNT', payload: { percentage, amount } });
    },
    []
  );

  const setNotes = useCallback((notes: string) => {
    dispatch({ type: 'SET_NOTES', payload: notes });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  // Verificações de estado
  const canEdit = useMemo(() => canEditSale(sale.status), [sale.status]);
  const canApprove = useMemo(() => canApproveSale(sale.status), [sale.status]);
  const canComplete = useMemo(() => canCompleteSale(sale.status), [sale.status]);
  const canCancel = useMemo(() => canCancelSale(sale.status), [sale.status]);

  // Cálculos
  const paymentSummary = useMemo(
    () => calculateSalePaymentSummary(sale),
    [sale.totalAmount, sale.payments]
  );

  return {
    sale,
    setStatus,
    addPayment,
    removePayment,
    updatePayment,
    setDiscount,
    setNotes,
    clear,
    canEdit,
    canApprove,
    canComplete,
    canCancel,
    paymentSummary,
  };
};

export type UseSaleReturn = ReturnType<typeof useSale>;
