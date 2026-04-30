// hooks/useCart.ts
import { useState, useEffect, useCallback } from 'react';
import { CartItem, SaleItem, isCartItemOS } from '../types/cart.types';
import Swal from 'sweetalert2';

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('pdv-cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('pdv-cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = useCallback(async (item: SaleItem) => {
    if (item.type === 'product' && item.id) {
      // Buscar detalhes atualizados do servidor
      try {
        const response = await fetch(`http://localhost:3001/api/products/${item.id}`);
        if (!response.ok) {
          alert(`Erro ao buscar detalhes do produto: ${item.name}`);
          return;
        }
        const { data: productData } = await response.json();

        if (!productData || productData.currentStock <= 0) {
          alert(`Atenção: ${item.name} está sem estoque!`);
          return;
        }

        setCart(prev => {
          const existing = prev.find(i => i.id === item.id);
          if (existing) {
            return prev.map(i =>
              i.id === item.id
                ? { ...i, quantity: i.quantity + 1 }
                : i
            );
          }
          return [
            ...prev,
            {
              ...item,
              stock: productData.currentStock,
              costPrice: productData.costPrice || 0,
              price: item.price || productData.salePrice,
              quantity: 1
            }
          ];
        });
      } catch (err) {
        console.error('Erro ao validar produto:', err);
      }
    } else {
      // Não-produto (serviço)
      setCart(prev => {
        const existing = prev.find(i => i.id === item.id);
        if (existing) {
          return prev.map(i =>
            i.id === item.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        }
        return [...prev, { ...item, quantity: 1 }];
      });
    }
  }, []);

  const updateQuantity = useCallback((id: string | number, value: number | string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        // ✅ NOVO: Proteger OS contra edição de quantidade
        if (isCartItemOS(item)) {
          console.warn('⚠️ Não é permitido alterar quantidade de Ordem de Serviço');
          return item; // Retorna imutável
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

  const removeItem = useCallback((id: string | number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const applyIndividualDiscount = useCallback((id: string | number, newPrice: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === id) {
        // ✅ NOVO: Proteger OS contra aplicação de desconto
        if (isCartItemOS(item)) {
          Swal.fire({
            icon: 'error',
            title: 'Operação inválida',
            text: 'Não é permitido aplicar desconto em Ordens de Serviço',
            timer: 2000
          });
          return item; // Retorna imutável
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

  const clearCart = useCallback(() => {
    setCart([]);
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