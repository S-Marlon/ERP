/**
 * HOOK PARA PAGAMENTOS
 * Gerencia múltiplos pagamentos de uma venda
 */

import { useState, useCallback, useMemo } from 'react';
import type { Payment, PaymentMethod, PaymentStatus, SaleFinancialSummary } from '../types/erp.types';
import {
  calculatePaymentSummary,
  canAcceptPayment,
  canRefundPayment,
} from '../utils/payment-helpers';
import { generateUUID } from '../utils/id-generator';

/**
 * Hook usePayment
 */
export const usePayment = (saleTotal: number, initialPayments: Payment[] = []) => {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);

  // Métodos
  const addPayment = useCallback(
    (
      method: PaymentMethod,
      amount: number,
      dueDate?: Date,
      notes?: string
    ): boolean => {
      // Validar se pode aceitar este valor
      const currentPaid = payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);

      if (!canAcceptPayment(amount, saleTotal, currentPaid)) {
        return false;
      }

      const newPayment: Payment = {
        id: generateUUID(),
        saleId: '', // Será preenchido quando associado a uma venda
        method,
        amount,
        status: 'pending',
        createdAt: new Date(),
        dueDate,
        notes,
      };

      setPayments([...payments, newPayment]);
      return true;
    },
    [payments, saleTotal]
  );

  const removePayment = useCallback((paymentId: string) => {
    setPayments(payments.filter(p => p.id !== paymentId));
  }, [payments]);

  const updatePaymentStatus = useCallback(
    (paymentId: string, status: PaymentStatus) => {
      setPayments(
        payments.map(p =>
          p.id === paymentId
            ? {
                ...p,
                status,
                paidAt: status === 'completed' ? new Date() : p.paidAt,
              }
            : p
        )
      );
    },
    [payments]
  );

  const updatePayment = useCallback((paymentId: string, updates: Partial<Payment>) => {
    setPayments(
      payments.map(p =>
        p.id === paymentId
          ? { ...p, ...updates }
          : p
      )
    );
  }, [payments]);

  const refundPayment = useCallback((paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment || !canRefundPayment(payment)) {
      return false;
    }

    updatePaymentStatus(paymentId, 'refunded');
    return true;
  }, [payments, updatePaymentStatus]);

  const clearPayments = useCallback(() => {
    setPayments([]);
  }, []);

  // Cálculos
  const summary = useMemo(
    (): SaleFinancialSummary => calculatePaymentSummary(saleTotal, payments),
    [saleTotal, payments]
  );

  const totalPaid = useMemo(
    () => payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  const totalPending = useMemo(
    () => payments
      .filter(p => ['pending', 'processing'].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  const canAddMorePayments = useMemo(
    () => summary.remaining > 0,
    [summary.remaining]
  );

  return {
    payments,
    addPayment,
    removePayment,
    updatePaymentStatus,
    updatePayment,
    refundPayment,
    clearPayments,
    summary,
    totalPaid,
    totalPending,
    canAddMorePayments,
  };
};

export type UsePaymentReturn = ReturnType<typeof usePayment>;
