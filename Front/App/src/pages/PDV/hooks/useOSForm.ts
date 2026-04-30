/**
 * useOSForm
 */
import { useCallback, useMemo, useState } from 'react';
import { CartItem } from '../types/cart.types';

export type LaborType = 'per_point' | 'fixed' | 'table';
export type OSStatus = 'draft' | 'in_progress' | 'finished';

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

interface UseOSFormReturn {
  osData: OSFormData;
  osItems: CartItem[];
  osServices: CartItem[];
  paid: number;
  setOsData: (data: Partial<OSFormData>) => void;
  setPaid: (value: number) => void;
  totals: {
    products: number;
    services: number;
    labor: number;
    total: number;
    remaining: number;
  };
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string | number) => void;
  updateItemQuantity: (itemId: string | number, quantity: number) => void;
  addService: (service: CartItem) => void;
  updateServiceQuantity: (id: string | number, newQty: number) => void; // ✅ Adicionado aqui
  removeService: (serviceId: string | number) => void;
  buildPayload: () => Record<string, any>;
}

const INITIAL_STATE: OSFormData = {
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
};

export const useOSForm = (customerId: string, osNumber: string): UseOSFormReturn => {
  const [osData, setOsDataState] = useState<OSFormData>(INITIAL_STATE);
  const [osItems, setOsItems] = useState<CartItem[]>([]);
  const [osServices, setOsServices] = useState<CartItem[]>([]);
  const [paid, setPaid] = useState(0);

  const setOsData = useCallback((updates: Partial<OSFormData>) => {
    setOsDataState(prev => ({ ...prev, ...updates }));
  }, []);

  const totals = useMemo(() => {
    const productsTotal = osItems.reduce((acc, i) => acc + i.price * (i.quantity || 1), 0);
    const servicesTotal = osServices.reduce((acc, i) => acc + i.price * (i.quantity || 1), 0);

    let laborTotal = 0;
    if (osData.laborType === 'fixed') {
      laborTotal = osData.laborValue;
    } else if (osData.laborType === 'per_point') {
      const points = osItems.length * 2;
      laborTotal = points * osData.laborValue;
    }

    const total = productsTotal + servicesTotal + laborTotal;
    return {
      products: productsTotal,
      services: servicesTotal,
      labor: laborTotal,
      total,
      remaining: total - paid,
    };
  }, [osItems, osServices, osData.laborType, osData.laborValue, paid]);

  const addItem = useCallback((item: CartItem) => {
    setOsItems(prev => [...prev, { ...item, quantity: item.quantity || 1 }]);
  }, []);

  const removeItem = useCallback((itemId: string | number) => {
    setOsItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const updateItemQuantity = useCallback((itemId: string | number, quantity: number) => {
    if (quantity <= 0) {
      setOsItems(prev => prev.filter(i => i.id !== itemId));
      return;
    }
    setOsItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i));
  }, []);

  const addService = useCallback((service: CartItem) => {
    setOsServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.map(s => 
          s.id === service.id ? { ...s, quantity: (s.quantity || 1) + (service.quantity || 1) } : s
        );
      }
      return [...prev, { ...service, quantity: service.quantity || 1 }];
    });
  }, []);

  const updateServiceQuantity = useCallback((id: string | number, newQty: number) => {
    setOsServices(prev => 
      prev.map(s => s.id === id ? { ...s, quantity: Math.max(1, newQty) } : s)
    );
  }, []);

  const removeService = useCallback((serviceId: string | number) => {
    setOsServices(prev => prev.filter(s => s.id !== serviceId));
  }, []);

  const buildPayload = useCallback(() => {
    return {
      osNumber,
      customerId,
      ...osData,
      items: osItems,
      services: osServices,
      totals,
      createdAt: new Date().toISOString(),
    };
  }, [osNumber, customerId, osData, osItems, osServices, totals]);

  return {
    osData,
    osItems,
    osServices,
    paid,
    setOsData,
    setPaid,
    totals,
    addItem,
    removeItem,
    updateItemQuantity,
    addService,
    updateServiceQuantity,
    removeService,
    buildPayload,
  };
};