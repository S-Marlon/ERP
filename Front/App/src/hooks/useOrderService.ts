/**
 * HOOK PARA ORDEM DE SERVIÇO
 * Gerencia estado completo e lógica de uma OS
 */

import { useReducer, useCallback, useMemo } from 'react';
import type { OrderService, OSStatus, OSLineItem, LaborCalculation, UpdateOrderServiceInput } from '../types/erp.types';
import {
  canEditOS,
  canStartOS,
  canFinalizeOS,
  canCancelOS,
  canGenerateSale,
  getNextOSStatus,
  calculateItemsSubtotal,
  calculateLaborTotal,
  calculateTotal,
} from '../utils/os-helpers';
import { generateOSNumber, generateUUID } from '../utils/id-generator';

type OSAction =
  | { type: 'INIT'; payload: OrderService }
  | { type: 'SET_STATUS'; payload: OSStatus }
  | { type: 'ADD_ITEM'; payload: Omit<OSLineItem, 'id'> }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: OSLineItem }
  | { type: 'ADD_SERVICE'; payload: Omit<OSLineItem, 'id'> }
  | { type: 'REMOVE_SERVICE'; payload: string }
  | { type: 'UPDATE_SERVICE'; payload: OSLineItem }
  | { type: 'SET_LABOR'; payload: LaborCalculation }
  | { type: 'SET_CONFIG'; payload: Partial<HydraulicAssemblyConfig> }
  | { type: 'SET_DISCOUNT'; payload: { percentage?: number; amount?: number } }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'CLEAR' };

/**
 * Estado inicial de uma OS
 */
const createInitialOS = (customerId: string): Omit<OrderService, 'id' | 'number'> => ({
  status: 'draft',
  customerId,
  createdAt: new Date(),
  updatedAt: new Date(),
  config: {
    equipment: '',
    application: '',
    gauge: '',
    layers: 2,
    finalLength: 0,
  },
  items: [],
  services: [],
  labor: {
    type: 'fixed',
    value: 0,
    total: 0,
  },
  subtotalProducts: 0,
  subtotalServices: 0,
  laborTotal: 0,
  totalAmount: 0,
});

/**
 * Reducer para OS
 */
const orderServiceReducer = (state: OrderService, action: OSAction): OrderService => {
  switch (action.type) {
    case 'INIT':
      return action.payload;

    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload,
        updatedAt: new Date(),
      };

    case 'ADD_ITEM': {
      const newItem: OSLineItem = {
        ...action.payload,
        id: generateUUID(),
      };
      const items = [...state.items, newItem];
      const subtotal = calculateItemsSubtotal(items);
      return {
        ...state,
        items,
        subtotalProducts: subtotal,
        totalAmount: calculateTotal(
          subtotal,
          state.subtotalServices,
          state.laborTotal,
          state.discountPercentage,
          state.discountAmount
        ),
        updatedAt: new Date(),
      };
    }

    case 'REMOVE_ITEM': {
      const items = state.items.filter(item => item.id !== action.payload);
      const subtotal = calculateItemsSubtotal(items);
      return {
        ...state,
        items,
        subtotalProducts: subtotal,
        totalAmount: calculateTotal(
          subtotal,
          state.subtotalServices,
          state.laborTotal,
          state.discountPercentage,
          state.discountAmount
        ),
        updatedAt: new Date(),
      };
    }

    case 'UPDATE_ITEM': {
      const items = state.items.map(item =>
        item.id === action.payload.id ? action.payload : item
      );
      const subtotal = calculateItemsSubtotal(items);
      return {
        ...state,
        items,
        subtotalProducts: subtotal,
        totalAmount: calculateTotal(
          subtotal,
          state.subtotalServices,
          state.laborTotal,
          state.discountPercentage,
          state.discountAmount
        ),
        updatedAt: new Date(),
      };
    }

    case 'ADD_SERVICE': {
      const newService: OSLineItem = {
        ...action.payload,
        id: generateUUID(),
      };
      const services = [...state.services, newService];
      const subtotal = calculateItemsSubtotal(services);
      return {
        ...state,
        services,
        subtotalServices: subtotal,
        totalAmount: calculateTotal(
          state.subtotalProducts,
          subtotal,
          state.laborTotal,
          state.discountPercentage,
          state.discountAmount
        ),
        updatedAt: new Date(),
      };
    }

    case 'REMOVE_SERVICE': {
      const services = state.services.filter(service => service.id !== action.payload);
      const subtotal = calculateItemsSubtotal(services);
      return {
        ...state,
        services,
        subtotalServices: subtotal,
        totalAmount: calculateTotal(
          state.subtotalProducts,
          subtotal,
          state.laborTotal,
          state.discountPercentage,
          state.discountAmount
        ),
        updatedAt: new Date(),
      };
    }

    case 'UPDATE_SERVICE': {
      const services = state.services.map(service =>
        service.id === action.payload.id ? action.payload : service
      );
      const subtotal = calculateItemsSubtotal(services);
      return {
        ...state,
        services,
        subtotalServices: subtotal,
        totalAmount: calculateTotal(
          state.subtotalProducts,
          subtotal,
          state.laborTotal,
          state.discountPercentage,
          state.discountAmount
        ),
        updatedAt: new Date(),
      };
    }

    case 'SET_LABOR': {
      const labor = action.payload;
      const laborTotal = labor.total;
      return {
        ...state,
        labor,
        laborTotal,
        totalAmount: calculateTotal(
          state.subtotalProducts,
          state.subtotalServices,
          laborTotal,
          state.discountPercentage,
          state.discountAmount
        ),
        updatedAt: new Date(),
      };
    }

    case 'SET_CONFIG': {
      return {
        ...state,
        config: { ...state.config, ...action.payload },
        updatedAt: new Date(),
      };
    }

    case 'SET_DISCOUNT': {
      const { percentage, amount } = action.payload;
      return {
        ...state,
        discountPercentage: percentage,
        discountAmount: amount,
        totalAmount: calculateTotal(
          state.subtotalProducts,
          state.subtotalServices,
          state.laborTotal,
          percentage,
          amount
        ),
        updatedAt: new Date(),
      };
    }

    case 'SET_NOTES':
      return {
        ...state,
        notes: action.payload,
        updatedAt: new Date(),
      };

    case 'CLEAR':
      return {
        ...createInitialOS(state.customerId),
        id: generateUUID(),
        number: generateOSNumber(),
      } as OrderService;

    default:
      return state;
  }
};

/**
 * Hook useOrderService
 */
export const useOrderService = (customerId: string) => {
  const initialState: OrderService = {
    id: generateUUID(),
    number: generateOSNumber(),
    ...(createInitialOS(customerId) as OrderService),
  };

  const [os, dispatch] = useReducer(orderServiceReducer, initialState);

  // Métodos
  const addItem = useCallback((item: Omit<OSLineItem, 'id'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: itemId });
  }, []);

  const updateItem = useCallback((item: OSLineItem) => {
    dispatch({ type: 'UPDATE_ITEM', payload: item });
  }, []);

  const addService = useCallback((service: Omit<OSLineItem, 'id'>) => {
    dispatch({ type: 'ADD_SERVICE', payload: service });
  }, []);

  const removeService = useCallback((serviceId: string) => {
    dispatch({ type: 'REMOVE_SERVICE', payload: serviceId });
  }, []);

  const updateService = useCallback((service: OSLineItem) => {
    dispatch({ type: 'UPDATE_SERVICE', payload: service });
  }, []);

  const setLabor = useCallback((labor: LaborCalculation) => {
    dispatch({ type: 'SET_LABOR', payload: labor });
  }, []);

  const setConfig = useCallback((config: Partial<HydraulicAssemblyConfig>) => {
    dispatch({ type: 'SET_CONFIG', payload: config });
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

  const setStatus = useCallback((status: OSStatus) => {
    if (canEditOS(os.status) || status === 'canceled') {
      dispatch({ type: 'SET_STATUS', payload: status });
    }
  }, [os.status]);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  // Verificações de estado
  const canEdit = useMemo(() => canEditOS(os.status), [os.status]);
  const canStart = useMemo(() => canStartOS(os.status), [os.status]);
  const canFinalize = useMemo(() => canFinalizeOS(os.status), [os.status]);
  const canCancel = useMemo(() => canCancelOS(os.status), [os.status]);
  const canGenerateSales = useMemo(() => canGenerateSale(os.status), [os.status]);

  return {
    os,
    addItem,
    removeItem,
    updateItem,
    addService,
    removeService,
    updateService,
    setLabor,
    setConfig,
    setDiscount,
    setNotes,
    setStatus,
    clear,
    canEdit,
    canStart,
    canFinalize,
    canCancel,
    canGenerateSales,
  };
};

export type UseOrderServiceReturn = ReturnType<typeof useOrderService>;
