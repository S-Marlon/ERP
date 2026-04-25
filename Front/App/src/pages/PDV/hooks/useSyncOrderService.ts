/**
 * HOOK PARA SINCRONIZAR COM CONTEXTO PDV LEGADO
 * Permite que useOrderService funcione com o estado antigo
 */

import { useEffect } from 'react';
import type { CartItem } from '../types/cart.types';
import type { OSLineItem } from '../../types/erp.types';
import type { UseOrderServiceReturn } from '../../hooks/useOrderService';

/**
 * Sincroniza OrderService com o estado legado do PDV
 * Mantém compatibilidade durante migração
 */
export const useSyncOrderServiceWithContext = (
  os: UseOrderServiceReturn['os'],
  osItems: CartItem[],
  osServices: CartItem[],
  osData: any,
  addItem: UseOrderServiceReturn['addItem'],
  addService: UseOrderServiceReturn['addService']
) => {
  // Sincroniza osItems legados → OrderService
  useEffect(() => {
    // Converte CartItems para OSLineItems
    const newItems = osItems
      .filter(item => item.type !== 'os')
      .map(item => ({
        name: item.name,
        description: item.description,
        price: item.price,
        quantity: item.quantity || 1,
        itemType: 'product' as const,
      }));

    // Se há novos itens não presentes no OS, adiciona
    newItems.forEach(item => {
      const exists = os.items.some(osItem => osItem.name === item.name);
      if (!exists) {
        addItem(item);
      }
    });
  }, [osItems, os.items, addItem]);

  // Sincroniza osServices legados → OrderService
  useEffect(() => {
    const newServices = osServices
      .filter(item => item.type !== 'os')
      .map(item => ({
        name: item.name,
        description: item.description,
        price: item.price,
        quantity: item.quantity || 1,
        itemType: 'service' as const,
      }));

    newServices.forEach(service => {
      const exists = os.services.some(s => s.name === service.name);
      if (!exists) {
        addService(service);
      }
    });
  }, [osServices, os.services, addService]);
};
