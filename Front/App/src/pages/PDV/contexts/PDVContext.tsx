// contexts/PDVContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useCart } from '../hooks/useCart';
import { usePDVState } from '../hooks/usePDVState';
import { useFilters } from '../hooks/useFilters';
import { useSalePreparation } from '../hooks/useSalePreparation';
import { CartItem } from '../types/cart.types';
import { VendaPayload } from '../types/sale.types';

interface OSData {
  equipment?: string;
  application?: string;
  gauge?: string;
  laborType?: string;
  laborValue?: number;
}

interface PDVContextType {
  // Cart
  cart: CartItem[];
  addToCart: (item: CartItem) => Promise<void>;
  updateQuantity: (id: string | number, value: number | string) => void;
  removeItem: (id: string | number) => void;
  applyIndividualDiscount: (id: string | number, newPrice: number) => void;
  clearCart: () => void;

  // PDV State
  estagio: 'SELECAO' | 'PAGAMENTO';
  setEstagio: (estagio: 'SELECAO' | 'PAGAMENTO') => void;
  cliente: string;
  setCliente: (cliente: string) => void;
  identificadorCliente: string;
  setIdentificadorCliente: (id: string) => void;
  mostrarModalCliente: boolean;
  setMostrarModalCliente: (show: boolean) => void;
  confirmarCliente: () => void;

  // OS
  osItems: CartItem[];
  setOsItems: (items: CartItem[]) => void;
  osServices: CartItem[];
  setOsServices: (services: CartItem[]) => void;
  osData: OSData;
  setOsData: (data: OSData) => void;

  // Filters
  filters: Record<string, unknown>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  minPrice: string;
  setMinPrice: (price: string) => void;
  maxPrice: string;
  setMaxPrice: (price: string) => void;
  minStock: string;
  setMinStock: (stock: string) => void;
  status: string;
  setStatus: (status: string) => void;
  brand: string;
  setBrand: (brand: string) => void;
  sortOrder: string;
  setSortOrder: (order: string) => void;
  onlyInStock: boolean;
  setOnlyInStock: (inStock: boolean) => void;
  onlyActive: boolean;
  setOnlyActive: (active: boolean) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (limit: number) => void;
  handleResetFilters: () => void;

  // Sale Preparation
  saleData: VendaPayload | null;
  isSaleValid: boolean;
  prepareForSubmission: () => void;
}

const PDVContext = createContext<PDVContextType | null>(null);

export const PDVProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const cartHook = useCart();
  const pdvStateHook = usePDVState();
  const filtersHook = useFilters();
  const { saleData, isValid: isSaleValid, prepareForSubmission } = useSalePreparation(cartHook.cart, pdvStateHook.cliente);

  const value: PDVContextType = {
    ...cartHook,
    ...pdvStateHook,
    ...filtersHook,
    saleData,
    isSaleValid,
    prepareForSubmission
  };

  return <PDVContext.Provider value={value}>{children}</PDVContext.Provider>;
};

export const usePDV = () => {
  const context = useContext(PDVContext);
  if (!context) {
    throw new Error('usePDV must be used within a PDVProvider');
  }
  return context;
};