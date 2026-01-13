import { useState, useMemo, useCallback } from 'react';
import { AutoPart, CartItem, SaleSummary } from './types';
import { MOCK_PRODUCTS } from './mockData';

export const usePOS = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const addToCart = useCallback((part: AutoPart) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === part.id);
      if (existing) {
        return prev.map((item) =>
          item.id === part.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Adicionando desconto inicial 0 conforme sua interface CartItem
      return [...prev, { ...part, quantity: 1, discount: 0 }];
    });
  }, []);

  // ... (mantenha as funções removeFromCart e updateQuantity iguais)

  const totals: SaleSummary = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => 
      acc + (item.price * item.quantity) - (item.discount || 0), 0
    );
    const taxes = subtotal * 0.08; 
    return { subtotal, taxes, total: subtotal + taxes };
  }, [cart]);

  // Adicione a busca por código original ou SKU
  const findByCode = (code: string) => {
    const part = MOCK_PRODUCTS.find((p) => p.oemCode === code || p.sku === code);
    if (part) addToCart(part);
  };

  return { cart, addToCart, findByCode, totals, isModalOpen, setIsModalOpen, clearCart: () => setCart([]) };
};